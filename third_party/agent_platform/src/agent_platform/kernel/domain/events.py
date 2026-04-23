"""Domain events: append-only facts about what happened.

Events are NOT the same as LangGraph's internal stream. These are
domain-level, human-meaningful facts: "run started", "memory recalled",
"tool invoked", "approval requested". They're persisted to the event store
for observability and auditing, and they're what UIs subscribe to.

The workflow adapter is responsible for emitting these events when it
orchestrates. The kernel defines the shape and vocabulary.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import RiskLevel, RunId, RunStatus, SessionId, WorkspaceId


class DomainEvent(BaseModel):
    """Base class for all events."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    event_type: str
    workspace_id: WorkspaceId
    run_id: RunId | None = None
    session_id: SessionId | None = None
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunStarted(DomainEvent):
    event_type: Literal["run.started"] = "run.started"
    goal: str = ""


class RunStatusChanged(DomainEvent):
    event_type: Literal["run.status_changed"] = "run.status_changed"
    old_status: RunStatus
    new_status: RunStatus


class TurnStarted(DomainEvent):
    event_type: Literal["run.turn_started"] = "run.turn_started"
    turn_index: int


class ModelCalled(DomainEvent):
    event_type: Literal["run.model_called"] = "run.model_called"
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0


class ToolInvoked(DomainEvent):
    event_type: Literal["run.tool_invoked"] = "run.tool_invoked"
    tool_name: str
    risk_level: RiskLevel
    arguments: dict[str, Any] = Field(default_factory=dict)
    # Don't include the full tool_result here — that can be huge.
    # Store results in a separate artifact store and reference by ID.
    result_summary: str = ""
    error: str | None = None


class MemoryRecalled(DomainEvent):
    event_type: Literal["run.memory_recalled"] = "run.memory_recalled"
    query: str
    recalled_count: int
    recalled_ids: list[str] = Field(default_factory=list)


class MemoryWritten(DomainEvent):
    event_type: Literal["run.memory_written"] = "run.memory_written"
    memory_id: str
    kind: str


class ApprovalRequested(DomainEvent):
    event_type: Literal["run.approval_requested"] = "run.approval_requested"
    approval_id: str
    tool_name: str
    risk_level: RiskLevel


class ApprovalDecided(DomainEvent):
    event_type: Literal["run.approval_decided"] = "run.approval_decided"
    approval_id: str
    decision: Literal["approved", "rejected"]


class RunCompleted(DomainEvent):
    event_type: Literal["run.completed"] = "run.completed"
    turn_count: int
    total_input_tokens: int = 0
    total_output_tokens: int = 0


class RunFailed(DomainEvent):
    event_type: Literal["run.failed"] = "run.failed"
    error: str
    error_type: str = ""
