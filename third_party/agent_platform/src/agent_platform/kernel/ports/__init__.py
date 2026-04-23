"""Ports — protocols every adapter must satisfy.

The kernel depends only on these protocols. Importing `agent_platform.adapters`
from kernel code is a bug.
"""

from .auth import AuthError, AuthPort, Principal
from .llm import (
    ContentBlock,
    LLMMessage,
    LLMPort,
    LLMRegistry,
    LLMRequest,
    StreamEnd,
    StreamEvent,
    StreamStart,
    StreamTextDelta,
    StreamToolUseDelta,
    StreamToolUseStart,
    StreamUsage,
    TextBlock,
    ToolResultBlock,
    ToolSchema,
    ToolUseBlock,
)
from .memory import MemoryPort
from .observability import ObservabilityPort
from .skills import SkillLoaderPort
from .storage import (
    ApprovalRepo,
    EventStore,
    MembershipRepo,
    MessageRepo,
    PersonaRepo,
    RunRepo,
    SessionRepo,
    UserRepo,
    WorkspaceRepo,
)
from .tools import ToolDescriptor, ToolPort, ToolRegistry, ToolResult
from .workflow import (
    ExecutionContext,
    WorkflowDomainEventEnvelope,
    WorkflowEnginePort,
    WorkflowError,
    WorkflowEvent,
    WorkflowFinished,
    WorkflowInput,
    WorkflowInterrupt,
    WorkflowTextDelta,
    WorkflowToolCallArgumentsDelta,
    WorkflowToolCallStart,
)

__all__ = [
    # LLM
    "LLMPort",
    "LLMRegistry",
    "LLMRequest",
    "LLMMessage",
    "ContentBlock",
    "TextBlock",
    "ToolUseBlock",
    "ToolResultBlock",
    "ToolSchema",
    "StreamEvent",
    "StreamStart",
    "StreamTextDelta",
    "StreamToolUseStart",
    "StreamToolUseDelta",
    "StreamUsage",
    "StreamEnd",
    # Memory
    "MemoryPort",
    # Workflow
    "WorkflowEnginePort",
    "WorkflowInput",
    "ExecutionContext",
    "WorkflowEvent",
    "WorkflowDomainEventEnvelope",
    "WorkflowTextDelta",
    "WorkflowToolCallStart",
    "WorkflowToolCallArgumentsDelta",
    "WorkflowInterrupt",
    "WorkflowFinished",
    "WorkflowError",
    # Tools
    "ToolPort",
    "ToolRegistry",
    "ToolDescriptor",
    "ToolResult",
    # Skills
    "SkillLoaderPort",
    # Auth
    "AuthPort",
    "Principal",
    "AuthError",
    # Storage
    "WorkspaceRepo",
    "UserRepo",
    "MembershipRepo",
    "SessionRepo",
    "MessageRepo",
    "RunRepo",
    "PersonaRepo",
    "ApprovalRepo",
    "EventStore",
    # Observability
    "ObservabilityPort",
]
