"""Domain entities: the nouns of the system.

Rules:
- Pydantic BaseModel for validation, not dataclasses — the extra
  (de)serialisation cost is worth the guardrails at boundaries.
- No foreign-key relationships modelled here. Those belong in the ORM layer
  inside storage adapters. Entities hold IDs, not pointers to other entities.
- Every entity that can exist in more than one workspace carries workspace_id.
- Nothing here imports SQLAlchemy, LangGraph, FastAPI, or provider SDKs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    AppId,
    MemoryId,
    MemoryKind,
    MessageId,
    MessageRole,
    PersonaId,
    ProviderId,
    RiskLevel,
    RunId,
    RunStatus,
    SessionId,
    SkillId,
    SkillStatus,
    UserId,
    Visibility,
    WorkspaceId,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class _Entity(BaseModel):
    """Shared base: timestamps + frozen-but-copyable config."""

    model_config = ConfigDict(
        frozen=False,  # mutable: we want `entity.status = ...` at service layer
        extra="forbid",
        arbitrary_types_allowed=False,
    )
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# -- Identity & scope ---------------------------------------------------------


class Workspace(_Entity):
    """Top-level scope boundary. Memory, skills, runs all live inside a workspace.

    For a personal deployment, you might create only a single `default`
    workspace. For shared or regulated deployments, each project/function can
    get its own workspace (e.g., "product-support", "study-alpha").

    Workspaces don't cross-reference. If you think you need that, you probably
    want shared system skills/memories (Visibility.SYSTEM) instead.
    """

    id: WorkspaceId
    name: str
    slug: str  # stable URL-friendly identifier
    description: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class User(_Entity):
    """A human principal within the deployment.

    Authentication produces a User; the kernel trusts the auth adapter to
    have done whatever identity verification is appropriate for that deployment.
    """

    id: UserId
    display_name: str
    email: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Membership(_Entity):
    """Links a user to a workspace with a role. Simple for now — extend when
    you need finer-grained permissions than 'member' / 'admin'."""

    workspace_id: WorkspaceId
    user_id: UserId
    role: str = "member"  # "member" | "admin"


# -- Conversation & execution ------------------------------------------------


class Session(_Entity):
    """A conversation thread. A session belongs to one workspace and, typically,
    one user. Sessions contain messages and can spawn runs."""

    id: SessionId
    workspace_id: WorkspaceId
    user_id: UserId
    app_id: AppId  # which app created this session (provenance)
    title: str = ""  # auto-generated or user-set
    persona_id: PersonaId | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Message(_Entity):
    """A single turn in a session. Content is normalised — tool calls and
    tool results live inside the content dict, not as separate rows, so the
    message timeline is a single linear stream."""

    id: MessageId
    session_id: SessionId
    run_id: RunId | None = None  # if produced during a run
    role: MessageRole
    content: list[dict[str, Any]]  # Anthropic/OpenAI-compatible content blocks
    model: str | None = None  # "claude-opus-4-7", "gpt-5", etc., when assistant
    provider: ProviderId | None = None
    usage: dict[str, int] = Field(default_factory=dict)  # tokens, cost, etc.


class Run(_Entity):
    """A single invocation of the agent loop over a session.

    A run has a lifecycle (RunStatus). It may pause for approval, resume,
    fail, or complete. Runs are the primary observability unit — everything
    the agent did lives under a run_id.

    Runs do NOT own the LangGraph thread_id directly; the workflow adapter
    keeps that mapping internally so swapping the orchestrator doesn't
    require schema changes.
    """

    id: RunId
    session_id: SessionId
    workspace_id: WorkspaceId
    user_id: UserId
    status: RunStatus = RunStatus.PENDING
    input_message_id: MessageId
    goal: str = ""  # short description, for UIs
    max_turns: int = 20
    turn_count: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# -- Memory & personalisation ------------------------------------------------


class MemoryItem(_Entity):
    """A single piece of remembered context.

    The adapter (Letta / Mem0 / Zep / sqlite-fts) decides how this is stored,
    retrieved, ranked. The kernel just knows the shape.

    Scoping rule: MemoryItem is always keyed by (workspace_id, visibility,
    optionally user_id). A private memory has user_id set; shared/system
    memories have user_id = None.
    """

    id: MemoryId
    workspace_id: WorkspaceId
    user_id: UserId | None  # None for shared/system
    visibility: Visibility
    kind: MemoryKind
    content: str
    source_run_id: RunId | None = None
    importance: float = 0.5  # 0..1; adapter may use for decay/ranking
    embedding: list[float] | None = None  # optional; adapter decides
    metadata: dict[str, Any] = Field(default_factory=dict)


class Persona(_Entity):
    """Identity/style config for an agent in a workspace.

    Inspired by Hermes's SOUL.md concept but not tied to any file format.
    A workspace can have multiple personas (e.g., "formal regulatory writer"
    vs "casual meeting-notes assistant"). Sessions pick one.
    """

    id: PersonaId
    workspace_id: WorkspaceId
    name: str
    system_prompt: str
    traits: dict[str, Any] = Field(default_factory=dict)  # tone, formality, etc.
    default_model: str | None = None
    default_provider: ProviderId | None = None


# -- Skills ------------------------------------------------------------------


class Skill(_Entity):
    """A reusable procedural workflow, stored in the agentskills.io format.

    The actual markdown content lives in `body`. `frontmatter` holds the
    parsed YAML metadata. The adapter decides whether to load from disk,
    database, or remote registry — the kernel just sees Skill objects.
    """

    id: SkillId
    workspace_id: WorkspaceId
    user_id: UserId | None  # draft skills are user-scoped; promoted are workspace-scoped
    visibility: Visibility
    status: SkillStatus = SkillStatus.DRAFT
    name: str
    description: str
    body: str  # markdown
    frontmatter: dict[str, Any] = Field(default_factory=dict)
    source: str | None = None  # filepath / url / "drafted-from-run:<id>"
    embedding: list[float] | None = None


# -- Safety / approvals ------------------------------------------------------


class ApprovalRequest(_Entity):
    """Raised when a run tries to invoke a tool above its allowed risk level.

    The workflow engine (LangGraph adapter) suspends the run via interrupt();
    the application layer surfaces this to the UI; once approved, the run
    resumes. Status transitions: pending -> approved/rejected/expired.
    """

    id: str
    run_id: RunId
    workspace_id: WorkspaceId
    tool_name: str
    tool_arguments: dict[str, Any]
    risk_level: RiskLevel
    rationale: str = ""
    status: str = "pending"  # "pending" | "approved" | "rejected" | "expired"
    decided_by: UserId | None = None
    decided_at: datetime | None = None
