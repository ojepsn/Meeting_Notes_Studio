"""API-layer DTOs for OpenAPI generation and SDK codegen."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from agent_platform.kernel.domain import (
    ApprovalDecided,
    ApprovalRequested,
    ApprovalRequest,
    MemoryItem,
    MemoryRecalled,
    MemoryWritten,
    Message,
    ModelCalled,
    RunCompleted,
    RunFailed,
    RunStarted,
    RunStatusChanged,
    Session,
    ToolInvoked,
    TurnStarted,
    User,
)


class _ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


_MAX_ATTACHMENTS = 32
_MAX_ATTACHMENT_JSON_CHARS = 200_000
_MAX_MESSAGE_TEXT_CHARS = 120_000


class CreateSessionIn(_ApiModel):
    app_id: str = Field(default="", max_length=128)
    title: str = Field(default="", max_length=500)
    persona_id: str | None = Field(None, max_length=128)


class PostMessageIn(_ApiModel):
    text: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_TEXT_CHARS)
    attachments: list[dict[str, Any]] = Field(
        default_factory=list,
        max_length=_MAX_ATTACHMENTS,
    )

    @field_validator("attachments")
    @classmethod
    def _attachments_json_size(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len(json.dumps(value, default=str)) > _MAX_ATTACHMENT_JSON_CHARS:
            raise ValueError("attachments JSON payload is too large")
        return value


class StartRunIn(_ApiModel):
    input_message_id: str = Field(..., min_length=1, max_length=128)
    workflow_name: str = Field(default="default_chat", max_length=128)
    goal: str = Field(default="", max_length=12_000)
    max_turns: int = Field(default=20, ge=1, le=500)


class ApprovalIn(_ApiModel):
    approved: bool


class MemoryWriteIn(_ApiModel):
    content: str = Field(..., min_length=1, max_length=100_000)
    kind: str = Field(default="profile", max_length=64)
    visibility: str = Field(default="private", max_length=32)


class HealthzOut(_ApiModel):
    ok: bool
    deployment: str


class MeOut(_ApiModel):
    user: User
    current_workspace_id: str
    workspaces: list[str]


class ProvidersOut(_ApiModel):
    providers: list[str]


class SessionsOut(_ApiModel):
    sessions: list[Session]


class MessagesOut(_ApiModel):
    messages: list[Message]


TimelineEvent = (
    RunStarted
    | RunStatusChanged
    | TurnStarted
    | ModelCalled
    | ToolInvoked
    | MemoryRecalled
    | MemoryWritten
    | ApprovalRequested
    | ApprovalDecided
    | RunCompleted
    | RunFailed
)


class RunTimelineOut(_ApiModel):
    events: list[TimelineEvent]


class ApprovalsOut(_ApiModel):
    approvals: list[ApprovalRequest]


class MemoriesOut(_ApiModel):
    memories: list[MemoryItem]


class MemoryWriteOut(_ApiModel):
    id: str
