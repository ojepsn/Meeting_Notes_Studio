"""WorkflowEnginePort — the seam that keeps LangGraph swappable.

This is the most important port in the system for your goal of
"reusable across apps." The kernel describes *what* a workflow is
(inputs, outputs, events, pause points). The adapter decides *how* to run it.

First adapter: LangGraph. We get checkpointing, HITL, streaming, time-travel
for free. If LangGraph ever becomes a liability, write a custom loop adapter —
the kernel doesn't change.

An "agent run" is an instance of one of these workflows. The run's lifecycle
is driven entirely by events yielded from execute().
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field

from ..domain import DomainEvent, RunId, SessionId, UserId, WorkspaceId


class WorkflowInput(BaseModel):
    """Input to a workflow run.

    Narrow by design. The context (workspace, user, session, persona) lives
    in ExecutionContext; actual user content is `user_input`. Structured
    per-workflow inputs go in `extra`.
    """

    model_config = ConfigDict(frozen=True)
    user_input: str
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)


class ExecutionContext(BaseModel):
    """Everything the workflow engine needs to know about who/where.

    Passed into execute() alongside the input. The engine propagates this
    to every node that needs scope info (memory recall, tool dispatch, etc.).
    """

    model_config = ConfigDict(frozen=True)

    run_id: RunId
    session_id: SessionId
    workspace_id: WorkspaceId
    user_id: UserId

    # Persona + model routing
    system_prompt: str
    preferred_provider: str | None = None
    preferred_model: str | None = None

    # Guardrails
    max_turns: int = 20
    allowed_tools: list[str] = Field(default_factory=list)  # [] = all registered
    approval_required_above: str = "medium"  # risk level name

    # Free-form config (passed to nodes; avoid putting secrets here)
    metadata: dict[str, Any] = Field(default_factory=dict)


# --- Workflow output events --------------------------------------------------
# The engine streams these. They're a superset of DomainEvents (which go to
# the event store) plus transport-level events (text deltas, tool argument
# deltas) that are only useful for live UI streaming.


class WorkflowDomainEventEnvelope(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: str = "domain_event"
    event: DomainEvent


class WorkflowTextDelta(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: str = "text_delta"
    text: str


class WorkflowToolCallStart(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: str = "tool_call_start"
    tool_call_id: str
    tool_name: str


class WorkflowToolCallArgumentsDelta(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: str = "tool_arguments_delta"
    tool_call_id: str
    arguments_delta: str


class WorkflowInterrupt(BaseModel):
    """Emitted when the workflow pauses (e.g., awaiting approval).

    The engine sets up the resumption point internally; to continue, the
    application layer calls engine.resume(run_id, resume_value).
    """

    model_config = ConfigDict(frozen=True)
    type: str = "interrupt"
    interrupt_reason: str  # "approval_required" | "hitl_input_required"
    payload: dict[str, Any] = Field(default_factory=dict)


class WorkflowFinished(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: str = "finished"
    final_text: str = ""
    usage: dict[str, int] = Field(default_factory=dict)


class WorkflowError(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: str = "error"
    error_type: str
    message: str


WorkflowEvent = (
    WorkflowDomainEventEnvelope
    | WorkflowTextDelta
    | WorkflowToolCallStart
    | WorkflowToolCallArgumentsDelta
    | WorkflowInterrupt
    | WorkflowFinished
    | WorkflowError
)


# --- The port ---------------------------------------------------------------


@runtime_checkable
class WorkflowEnginePort(Protocol):
    """What every orchestrator adapter must provide.

    Implementations:
    - LangGraphWorkflowAdapter (first-class, recommended)
    - CustomLoopWorkflowAdapter (for very simple cases or edge environments)
    - [future] Any other engine you want to try
    """

    async def execute(
        self,
        *,
        workflow_name: str,
        input: WorkflowInput,
        context: ExecutionContext,
    ) -> AsyncIterator[WorkflowEvent]:
        """Start (or resume-from-zero) a workflow run. Streams events.

        The caller is responsible for persisting events of interest to the
        event store. The engine persists its own checkpoints internally.
        """
        ...

    async def resume(
        self,
        *,
        run_id: RunId,
        resume_value: dict[str, Any],
    ) -> AsyncIterator[WorkflowEvent]:
        """Resume a paused workflow with a value for the pending interrupt."""
        ...

    async def cancel(self, *, run_id: RunId) -> None: ...

    async def get_state(self, *, run_id: RunId) -> dict[str, Any]:
        """Inspect current workflow state for debugging / UI."""
        ...

    def register_workflow(self, name: str, definition: Any) -> None:
        """Register a workflow definition. The `definition` type is
        adapter-specific — for LangGraph this is a compiled StateGraph.

        Applications register workflows at bootstrap time.
        """
        ...
