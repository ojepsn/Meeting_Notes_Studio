"""LangGraphWorkflowAdapter — implements WorkflowEnginePort using LangGraph.

# Architectural contract

The **only** place in this codebase that imports `langgraph` or `langchain_core`.
Everything else talks through `WorkflowEnginePort`.

# Why this matters

This adapter converts between two vocabularies:

- **Kernel side (domain-flavoured):** WorkflowInput, ExecutionContext, WorkflowEvent,
  DomainEvent, LLMRequest, ToolResult.
- **LangGraph side (orchestration-flavoured):** StateGraph, CompiledGraph,
  checkpointers, interrupt(), streaming modes.

The adapter is where we pay the translation cost once. If you ever want to
swap LangGraph for a custom loop or a different orchestrator, you write a
new adapter that satisfies the same port and everything upstream is unchanged.

# What LangGraph gives us for free

1. **Checkpointing** — every node transition persists state. Free run resume.
2. **interrupt()** — first-class pause/resume for human-in-the-loop approvals.
3. **Streaming** — token-level updates from inside nodes.
4. **Time-travel debugging** — rewind a run to any checkpoint.

We map each of these to the kernel-side equivalents:

- Checkpointing → our `ExecutionContext.run_id` becomes the LangGraph thread_id.
- interrupt() → we re-emit as `WorkflowInterrupt` events.
- Streaming → we translate LangGraph stream events to `WorkflowEvent` shapes.
- Time-travel → exposed via `get_state()`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, TypedDict

import structlog

from agent_platform.kernel.domain import (
    ProviderId,
    RunId,
    RunStatus,
    RunStatusChanged,
    ToolInvoked,
    TurnStarted,
)
from agent_platform.kernel.ports import (
    ExecutionContext,
    LLMRegistry,
    MemoryPort,
    SkillLoaderPort,
    ToolRegistry,
    WorkflowDomainEventEnvelope,
    WorkflowEnginePort,
    WorkflowEvent,
    WorkflowFinished,
    WorkflowInput,
    WorkflowInterrupt,
    WorkflowTextDelta,
    WorkflowToolCallStart,
)
from agent_platform.kernel.ports.llm import (
    LLMMessage,
    LLMRequest,
    StreamEnd,
    StreamTextDelta,
    StreamToolUseDelta,
    StreamToolUseStart,
    StreamUsage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
)

log = structlog.get_logger(__name__)


def _ensure_aiosqlite_langgraph_compat() -> None:
    """Patch newer aiosqlite versions for langgraph sqlite checkpointing.

    langgraph-checkpoint-sqlite currently calls `Connection.is_alive()`.
    Newer aiosqlite releases don't expose that method, so we provide a small
    compatibility shim.
    """
    try:
        import aiosqlite
    except ImportError:
        return

    if hasattr(aiosqlite.Connection, "is_alive"):
        return

    def _is_alive(self) -> bool:
        return True

    setattr(aiosqlite.Connection, "is_alive", _is_alive)


# --- LangGraph state shape ---------------------------------------------------
# This TypedDict is the type of state that flows through every LangGraph node.
# It's strictly internal — never leaks past this module.


class AgentGraphState(TypedDict, total=False):
    # Inputs (set once at graph start)
    ctx: ExecutionContext
    user_input: str

    # Conversation
    messages: list[LLMMessage]  # running message list (user + assistant + tool)
    system_prompt: str

    # Intermediate
    turn_index: int
    tool_calls_pending: list[dict[str, Any]]  # [{id, name, args}]
    last_usage: dict[str, int]

    # Output
    final_text: str
    total_input_tokens: int
    total_output_tokens: int
    should_stop: bool
    stop_reason: str


# --- The adapter ------------------------------------------------------------


class LangGraphWorkflowAdapter:
    """WorkflowEnginePort implementation using LangGraph under the hood."""

    def __init__(
        self,
        *,
        llm_registry: LLMRegistry,
        tool_registry: ToolRegistry,
        memory: MemoryPort,
        skills: SkillLoaderPort,
        checkpoint_db_url: str,
    ) -> None:
        # Lazy import so the kernel can be inspected / tested without LangGraph
        _ensure_aiosqlite_langgraph_compat()
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

        self._llm = llm_registry
        self._tools = tool_registry
        self._memory = memory
        self._skills = skills
        self._workflows: dict[str, Any] = {}  # name -> uncompiled graph builder
        self._compiled: dict[str, Any] = {}  # name -> compiled graph
        # One checkpointer, shared across all workflows. thread_id = run_id.
        self._checkpointer_url = checkpoint_db_url
        self._checkpointer_cm = AsyncSqliteSaver.from_conn_string(
            checkpoint_db_url.replace("sqlite+aiosqlite:///", "")
        )
        self._checkpointer: Any | None = None

    # ---- Registration ----

    def register_workflow(self, name: str, definition: Any) -> None:
        """Accepts either (a) a callable that returns a StateGraph given the
        adapter's helpers, or (b) a pre-built StateGraph.

        Using a callable lets workflow authors close over node helpers without
        importing LangGraph themselves (if we extract enough helpers here)."""
        self._workflows[name] = definition
        self._compiled.pop(name, None)  # invalidate compiled cache

    async def _get_compiled(self, name: str):
        if name not in self._compiled:
            if name not in self._workflows:
                raise KeyError(f"Workflow not registered: {name}")
            definition = self._workflows[name]
            graph = definition(self) if callable(definition) else definition
            checkpointer = await self._get_checkpointer()
            self._compiled[name] = graph.compile(checkpointer=checkpointer)
        return self._compiled[name]

    async def _get_checkpointer(self):
        if self._checkpointer is None:
            self._checkpointer = await self._checkpointer_cm.__aenter__()
        return self._checkpointer

    # ---- WorkflowEnginePort methods ----

    async def execute(
        self,
        *,
        workflow_name: str,
        input: WorkflowInput,
        context: ExecutionContext,
    ) -> AsyncIterator[WorkflowEvent]:
        compiled = await self._get_compiled(workflow_name)
        config = {"configurable": {"thread_id": context.run_id}}

        initial_state: AgentGraphState = {
            "ctx": context,
            "user_input": input.user_input,
            "messages": [],
            "system_prompt": context.system_prompt,
            "turn_index": 0,
            "tool_calls_pending": [],
            "last_usage": {},
            "final_text": "",
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "should_stop": False,
            "stop_reason": "",
        }

        async for event in self._stream_graph(compiled, initial_state, config):
            yield event

    async def resume(
        self,
        *,
        run_id: RunId,
        resume_value: dict[str, Any],
    ) -> AsyncIterator[WorkflowEvent]:
        """Resume a run after an interrupt. LangGraph's Command API is what
        makes this clean."""
        from langgraph.types import Command

        config = {"configurable": {"thread_id": run_id}}
        # Find which workflow this run belongs to. For now assume default_chat;
        # in production you'd persist workflow_name alongside the run.
        compiled = await self._get_compiled("default_chat")

        async for event in self._stream_graph(
            compiled, Command(resume=resume_value), config
        ):
            yield event

    async def cancel(self, *, run_id: RunId) -> None:
        # LangGraph doesn't have an explicit cancel; the convention is to
        # update checkpoint state to mark the run terminated and rely on
        # nodes checking for that state. For now, no-op with a log.
        log.warning("cancel() requested but not implemented", run_id=run_id)

    async def get_state(self, *, run_id: RunId) -> dict[str, Any]:
        compiled = await self._get_compiled("default_chat")
        config = {"configurable": {"thread_id": run_id}}
        state = await compiled.aget_state(config)
        return {
            "values": state.values,
            "next": state.next,
            "tasks": [str(t) for t in state.tasks],
        }

    async def aclose(self) -> None:
        """Release workflow resources used by CLI/server lifecycles."""
        self._compiled.clear()
        if self._checkpointer is not None:
            try:
                await self._checkpointer_cm.__aexit__(None, None, None)
            except Exception:  # noqa: BLE001
                pass
            self._checkpointer = None

    # ---- Internal: stream translation ----

    async def _stream_graph(
        self,
        compiled,
        initial_input,
        config: dict,
    ) -> AsyncIterator[WorkflowEvent]:
        """Translate LangGraph's stream events to WorkflowEvents.

        LangGraph supports several stream modes; we use "messages" (token
        deltas) and "updates" (node completion) interleaved.
        """
        try:
            async for mode, chunk in compiled.astream(
                initial_input,
                config=config,
                stream_mode=["messages", "updates", "custom"],
            ):
                async for wf_event in self._translate_chunk(mode, chunk):
                    yield wf_event

            # Final state
            final_state = await compiled.aget_state(config)
            values = final_state.values or {}
            if final_state.next:
                # Graph paused (interrupt). Surface it.
                pending = final_state.tasks
                interrupt_payload: dict[str, Any] = {}
                if pending:
                    task = pending[0]
                    if getattr(task, "interrupts", None):
                        interrupt = task.interrupts[0]
                        interrupt_payload = getattr(interrupt, "value", {}) or {}
                yield WorkflowInterrupt(
                    interrupt_reason=interrupt_payload.get("reason", "unknown"),
                    payload=interrupt_payload,
                )
            else:
                yield WorkflowFinished(
                    final_text=values.get("final_text", ""),
                    usage={
                        "input_tokens": values.get("total_input_tokens", 0),
                        "output_tokens": values.get("total_output_tokens", 0),
                    },
                )
        except Exception as exc:  # noqa: BLE001
            log.exception("graph stream failed", thread_id=config["configurable"]["thread_id"])
            from agent_platform.kernel.ports.workflow import WorkflowError as WF
            yield WF(error_type=type(exc).__name__, message=str(exc))

    async def _translate_chunk(
        self, mode: str, chunk: Any
    ) -> AsyncIterator[WorkflowEvent]:
        """Single translation point. LangGraph formats change occasionally;
        when they do, you fix this one function."""
        if mode == "messages":
            # chunk is (AIMessageChunk, metadata) for token streaming
            try:
                msg_chunk, _metadata = chunk
                if hasattr(msg_chunk, "content") and isinstance(msg_chunk.content, str):
                    if msg_chunk.content:
                        yield WorkflowTextDelta(text=msg_chunk.content)
            except (ValueError, AttributeError):
                pass
        elif mode == "custom":
            # Nodes emit our own events via `get_stream_writer()` + writer({"type": ...})
            # See the built-in workflows for the pattern.
            if isinstance(chunk, dict):
                evt_type = chunk.get("type")
                if evt_type == "tool_call_start":
                    yield WorkflowToolCallStart(
                        tool_call_id=chunk["tool_call_id"],
                        tool_name=chunk["tool_name"],
                    )
                elif evt_type == "domain_event":
                    # chunk["event"] is a DomainEvent-compatible dict
                    # Reconstruct the Pydantic model
                    from agent_platform.kernel.domain.events import (
                        ApprovalDecided,
                        ApprovalRequested,
                        DomainEvent,
                        MemoryRecalled,
                        MemoryWritten,
                        ModelCalled,
                        RunCompleted,
                        RunFailed,
                        RunStarted,
                        RunStatusChanged,
                        ToolInvoked,
                        TurnStarted,
                    )

                    event_map: dict[str, type[DomainEvent]] = {
                        "run.started": RunStarted,
                        "run.status_changed": RunStatusChanged,
                        "run.turn_started": TurnStarted,
                        "run.model_called": ModelCalled,
                        "run.tool_invoked": ToolInvoked,
                        "run.memory_recalled": MemoryRecalled,
                        "run.memory_written": MemoryWritten,
                        "run.approval_requested": ApprovalRequested,
                        "run.approval_decided": ApprovalDecided,
                        "run.completed": RunCompleted,
                        "run.failed": RunFailed,
                    }
                    try:
                        raw_event = chunk["event"]
                        event_type = raw_event.get("event_type", "")
                        event_cls = event_map.get(event_type, DomainEvent)
                        event = event_cls.model_validate(raw_event)
                        yield WorkflowDomainEventEnvelope(event=event)
                    except Exception:  # noqa: BLE001
                        log.warning("skipping malformed domain_event", chunk=chunk)
        # mode == "updates" is primarily useful for logging, not user-facing
