"""Default chat workflow — a standard tool-calling agent loop.

Structure:

    START -> recall_context -> call_model -> [has_tool_calls?]
                                                |
                                    yes --> dispatch_tools --> call_model (loop)
                                                |
                                    no  --> finalise --> END

Approvals: if a tool's risk exceeds the run's threshold, we interrupt() the
graph with the approval request payload. The RunService observes the
interrupt, persists an ApprovalRequest, and presents it to the UI. Once the
user decides, the workflow resumes with the decision, and we either invoke
the tool or skip it.
"""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING, Any

from agent_platform.kernel.domain import (
    MemoryKind,
    MessageRole,
    ProviderId,
    RiskLevel,
    RunStatus,
    RunStatusChanged,
    TurnStarted,
    ToolInvoked,
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
from agent_platform.kernel.runtime import (
    PERSONALIZATION_MODE_COLLABORATIVE,
    PERSONALIZATION_MODE_KEY,
    assemble_system_prompt,
    evaluate_tool_invocation,
    is_personalization_memory,
)
from .langgraph_adapter import AgentGraphState

if TYPE_CHECKING:
    from .langgraph_adapter import LangGraphWorkflowAdapter


def build_default_chat_workflow():
    """Returns a callable that, when handed an adapter, builds a compiled
    StateGraph.

    Returning a callable (rather than a pre-built graph) lets us close over
    the adapter's dependencies (LLM registry, tool registry, memory, skills)
    without having them be module-level globals.
    """

    def _build(adapter: "LangGraphWorkflowAdapter"):
        from langgraph.graph import END, START, StateGraph
        from langgraph.types import interrupt

        from .langgraph_adapter import AgentGraphState

        llm_registry = adapter._llm
        tool_registry = adapter._tools
        memory = adapter._memory
        skills = adapter._skills

        # ---------- Node: recall_context ----------

        async def recall_context(state: "AgentGraphState") -> dict:
            ctx = state["ctx"]
            user_input = state["user_input"]

            # Fetch relevant memories + stable learned preferences in parallel.
            mem_task = memory.retrieve(
                workspace_id=ctx.workspace_id,
                user_id=ctx.user_id,
                query=user_input,
                limit=8,
            )
            personalization_task = memory.list_by_scope(
                workspace_id=ctx.workspace_id,
                user_id=ctx.user_id,
                limit=20,
            )
            skills_task = skills.rank_for_query(
                workspace_id=ctx.workspace_id,
                user_id=ctx.user_id,
                query=user_input,
                limit=3,
            )
            recalled_memories, scope_memories, recalled_skills = await asyncio.gather(
                mem_task, personalization_task, skills_task
            )
            learned_memories = [
                memory_item
                for memory_item in scope_memories
                if is_personalization_memory(memory_item)
            ]
            merged_memories = _merge_memories(recalled_memories, learned_memories)

            tool_descriptors = tool_registry.available_tools(
                allowed_names=ctx.allowed_tools or None
            )
            tool_guidance = ""
            if tool_descriptors:
                names = ", ".join(d.name for d in tool_descriptors)
                tool_guidance = (
                    f"You have access to these tools: {names}. Use them when they "
                    "help; explain your reasoning briefly before tool calls."
                )

            prompt = assemble_system_prompt(
                persona_prompt=ctx.system_prompt,
                memories=merged_memories,
                skills=recalled_skills,
                tool_guidance=tool_guidance,
                personalization_mode=ctx.metadata.get(
                    PERSONALIZATION_MODE_KEY,
                    PERSONALIZATION_MODE_COLLABORATIVE,
                ),
            )

            initial_messages = [
                LLMMessage(
                    role=MessageRole.USER,
                    content=[TextBlock(text=user_input)],
                )
            ]

            return {
                "system_prompt": prompt.system,
                "messages": initial_messages,
            }

        # ---------- Node: call_model ----------

        async def call_model(state: "AgentGraphState") -> dict:
            ctx = state["ctx"]
            turn_index = state.get("turn_index", 0) + 1

            # Emit TurnStarted as a custom stream event
            from langgraph.config import get_stream_writer
            try:
                writer = get_stream_writer()
                writer({
                    "type": "domain_event",
                    "event": TurnStarted(
                        workspace_id=ctx.workspace_id,
                        run_id=ctx.run_id,
                        turn_index=turn_index,
                    ).model_dump(mode="json"),
                })
            except Exception:  # noqa: BLE001 -- stream writer not available outside astream
                pass

            provider = (
                ProviderId(ctx.preferred_provider)
                if ctx.preferred_provider
                else _pick_default_provider(llm_registry)
            )
            model = ctx.preferred_model or _pick_default_model_for(provider)

            schemas = tool_registry.get_schemas(allowed_names=ctx.allowed_tools or None)

            request = LLMRequest(
                provider=provider,
                model=model,
                messages=list(state["messages"]),
                system=state["system_prompt"],
                tools=schemas,
                user_id=ctx.user_id,
            )

            # Accumulate streamed response
            assistant_content_blocks: list[Any] = []
            text_buffer = ""
            tool_partials: dict[str, dict] = {}  # tool_use_id -> {name, args_str}
            usage = {"input_tokens": 0, "output_tokens": 0}
            stop_reason = ""

            async for ev in llm_registry.stream(request):
                if isinstance(ev, StreamTextDelta):
                    text_buffer += ev.text
                    # Token streaming happens via LangGraph's messages mode
                    # when we use langchain models; for our direct adapter we
                    # route text via custom stream.
                    try:
                        writer = get_stream_writer()
                        writer({"type": "text_delta", "text": ev.text})
                    except Exception:  # noqa: BLE001
                        pass
                elif isinstance(ev, StreamToolUseStart):
                    tool_partials[ev.tool_use_id] = {
                        "name": ev.tool_name,
                        "args_str": "",
                    }
                    try:
                        writer = get_stream_writer()
                        writer({
                            "type": "tool_call_start",
                            "tool_call_id": ev.tool_use_id,
                            "tool_name": ev.tool_name,
                        })
                    except Exception:  # noqa: BLE001
                        pass
                elif isinstance(ev, StreamToolUseDelta):
                    if ev.tool_use_id in tool_partials:
                        tool_partials[ev.tool_use_id]["args_str"] += ev.arguments_delta
                elif isinstance(ev, StreamUsage):
                    usage["input_tokens"] += ev.input_tokens
                    usage["output_tokens"] += ev.output_tokens
                elif isinstance(ev, StreamEnd):
                    stop_reason = ev.stop_reason

            # Build assistant message from accumulated pieces
            if text_buffer:
                assistant_content_blocks.append(TextBlock(text=text_buffer))
            pending_tool_calls = []
            for tu_id, partial in tool_partials.items():
                try:
                    args = json.loads(partial["args_str"]) if partial["args_str"] else {}
                except json.JSONDecodeError:
                    args = {}
                assistant_content_blocks.append(
                    ToolUseBlock(id=tu_id, name=partial["name"], arguments=args)
                )
                pending_tool_calls.append(
                    {"id": tu_id, "name": partial["name"], "args": args}
                )

            new_messages = list(state["messages"]) + [
                LLMMessage(
                    role=MessageRole.ASSISTANT,
                    content=assistant_content_blocks,
                )
            ]

            return {
                "messages": new_messages,
                "tool_calls_pending": pending_tool_calls,
                "turn_index": turn_index,
                "last_usage": usage,
                "total_input_tokens": state.get("total_input_tokens", 0) + usage["input_tokens"],
                "total_output_tokens": state.get("total_output_tokens", 0) + usage["output_tokens"],
                "final_text": text_buffer if not pending_tool_calls else "",
                "stop_reason": stop_reason,
                "should_stop": (
                    not pending_tool_calls or turn_index >= ctx.max_turns
                ),
            }

        # ---------- Node: dispatch_tools ----------

        async def dispatch_tools(state: "AgentGraphState") -> dict:
            ctx = state["ctx"]
            pending = state["tool_calls_pending"]
            tool_results: list[ToolResultBlock] = []

            for call in pending:
                descriptor = next(
                    (d for d in tool_registry.available_tools() if d.name == call["name"]),
                    None,
                )
                risk = descriptor.risk_level if descriptor else RiskLevel.HIGH
                decision = evaluate_tool_invocation(
                    tool_risk=risk,
                    approval_required_above=ctx.approval_required_above,
                    tool_name=call["name"],
                    allowed_tools=ctx.allowed_tools,
                )

                if decision.needs_approval:
                    # Suspend the graph. The resume value will come from
                    # ApprovalService.decide() -> engine.resume().
                    approval_payload = {
                        "reason": "approval_required",
                        "tool_name": call["name"],
                        "arguments": call["args"],
                        "risk_level": risk.value,
                        "rationale": decision.reason,
                    }
                    decision_value = interrupt(approval_payload)
                    # After resume, `decision_value` is whatever the application
                    # passed: {"approved": bool, "approval_id": str}
                    if not decision_value.get("approved", False):
                        tool_results.append(
                            ToolResultBlock(
                                tool_use_id=call["id"],
                                content=f"Tool '{call['name']}' was not approved.",
                                is_error=True,
                            )
                        )
                        continue

                if not decision.allow and not decision.needs_approval:
                    tool_results.append(
                        ToolResultBlock(
                            tool_use_id=call["id"],
                            content=f"Tool '{call['name']}' rejected: {decision.reason}",
                            is_error=True,
                        )
                    )
                    continue

                # Actually invoke
                try:
                    result = await tool_registry.invoke(
                        tool_name=call["name"],
                        tool_use_id=call["id"],
                        arguments=call["args"],
                    )
                    tool_results.append(
                        ToolResultBlock(
                            tool_use_id=call["id"],
                            content=result.content,
                            is_error=result.is_error,
                        )
                    )
                    # Emit domain event
                    try:
                        writer = get_stream_writer()
                        writer({
                            "type": "domain_event",
                            "event": ToolInvoked(
                                workspace_id=ctx.workspace_id,
                                run_id=ctx.run_id,
                                tool_name=call["name"],
                                risk_level=risk,
                                arguments=call["args"],
                                result_summary=(result.content[:200] if result.content else ""),
                                error=None if not result.is_error else result.content[:200],
                            ).model_dump(mode="json"),
                        })
                    except Exception:  # noqa: BLE001
                        pass
                except Exception as exc:  # noqa: BLE001
                    tool_results.append(
                        ToolResultBlock(
                            tool_use_id=call["id"],
                            content=f"Tool error: {type(exc).__name__}: {exc}",
                            is_error=True,
                        )
                    )

            new_messages = list(state["messages"]) + [
                LLMMessage(role=MessageRole.TOOL, content=list(tool_results))
            ]
            return {
                "messages": new_messages,
                "tool_calls_pending": [],
            }

        # ---------- Conditional routing ----------

        def route_after_model(state: "AgentGraphState") -> str:
            if state.get("should_stop", False):
                return END
            if state.get("tool_calls_pending"):
                return "dispatch_tools"
            return END

        # ---------- Assemble graph ----------

        graph = StateGraph(AgentGraphState)
        graph.add_node("recall_context", recall_context)
        graph.add_node("call_model", call_model)
        graph.add_node("dispatch_tools", dispatch_tools)

        graph.add_edge(START, "recall_context")
        graph.add_edge("recall_context", "call_model")
        graph.add_conditional_edges("call_model", route_after_model)
        graph.add_edge("dispatch_tools", "call_model")

        return graph

    return _build


# --- Helpers ----------------------------------------------------------------


def _pick_default_provider(registry) -> ProviderId:
    """Fall back to whichever provider is actually available."""
    providers = registry.available_providers()
    # Preference order — prefer higher-capability providers first
    for preferred in (ProviderId.ANTHROPIC, ProviderId.OPENAI, ProviderId.OPENROUTER, ProviderId.OLLAMA):
        if preferred in providers:
            return preferred
    if providers:
        return providers[0]
    raise RuntimeError("No LLM providers available")


def _pick_default_model_for(provider: ProviderId) -> str:
    """Sensible defaults per provider. Override via Persona.default_model."""
    defaults = {
        ProviderId.ANTHROPIC: "claude-opus-4-6",
        ProviderId.OPENAI: "gpt-4o",
        ProviderId.OPENROUTER: "anthropic/claude-opus-4-6",
        ProviderId.OLLAMA: "llama3.1:8b",
    }
    return defaults.get(provider, "claude-opus-4-6")


def _merge_memories(
    recalled_memories: list,
    learned_memories: list,
) -> list:
    merged = []
    seen_ids = set()
    for memory in [*learned_memories, *recalled_memories]:
        if memory.id in seen_ids:
            continue
        seen_ids.add(memory.id)
        merged.append(memory)
    return merged
