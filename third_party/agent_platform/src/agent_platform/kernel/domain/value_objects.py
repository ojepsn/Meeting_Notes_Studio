"""Value objects: small, immutable types with no identity.

These are the vocabulary the rest of the domain speaks. Add new enum values
here before using them elsewhere — prevents stringly-typed drift.
"""

from __future__ import annotations

from enum import StrEnum
from typing import NewType

# --- Identity types -----------------------------------------------------------
# NewType gives us type-safety without runtime overhead. A WorkspaceId is still
# just a str at runtime, but mypy will catch you passing a UserId where a
# WorkspaceId is expected.

WorkspaceId = NewType("WorkspaceId", str)
UserId = NewType("UserId", str)
SessionId = NewType("SessionId", str)
RunId = NewType("RunId", str)
MessageId = NewType("MessageId", str)
MemoryId = NewType("MemoryId", str)
SkillId = NewType("SkillId", str)
PersonaId = NewType("PersonaId", str)
AppId = NewType("AppId", str)  # provenance label: "meeting-minutes", "personal", etc.


# --- Enums --------------------------------------------------------------------


class Visibility(StrEnum):
    """Scope of a memory item or skill.

    private — visible only to the user who created it (within a workspace)
    shared  — visible to everyone in the workspace
    system  — baked into the deployment (regulatory templates, etc.)

    Keep this list short. If you need a fourth, think hard about whether it
    deserves to be a new concept (e.g., 'role-scoped') rather than yet another
    visibility flag.
    """

    PRIVATE = "private"
    SHARED = "shared"
    SYSTEM = "system"


class RunStatus(StrEnum):
    """Lifecycle of a Run."""

    PENDING = "pending"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    INTERRUPTED = "interrupted"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class MemoryKind(StrEnum):
    """What kind of memory this is.

    profile     — explicit user facts (name, role, preferences)
    preference  — inferred preferences (tone, formatting)
    episodic    — summarised past interactions
    semantic    — extracted facts (domain knowledge)
    procedural  — how-to traces that may become skills
    """

    PROFILE = "profile"
    PREFERENCE = "preference"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PROCEDURAL = "procedural"


class RiskLevel(StrEnum):
    """Tool risk classification. Drives approval requirements.

    low     — read-only, idempotent, no side effects (e.g., read_file)
    medium  — writes local state or calls external read APIs (e.g., write_file)
    high    — sends messages, spends money, modifies external systems
    critical — destructive or irreversible (e.g., delete, publish)
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SkillStatus(StrEnum):
    DRAFT = "draft"
    PROMOTED = "promoted"
    DEPRECATED = "deprecated"


class ProviderId(StrEnum):
    """Known LLM providers. Add new values here when adding an adapter."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    OPENROUTER = "openrouter"
    OLLAMA = "ollama"
    VLLM = "vllm"
    CUSTOM = "custom"
