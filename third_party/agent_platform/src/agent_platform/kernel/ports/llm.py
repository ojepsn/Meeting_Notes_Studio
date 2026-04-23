"""LLMPort — the contract every model provider adapter must satisfy.

Design decisions:
- Use an abstract LLMMessage/ToolCall shape rather than passing through
  provider-specific formats. Translation happens inside each adapter.
- Streaming is the first-class case. Non-streaming is `async for` discard.
- The port knows nothing about LangGraph. The LangGraph adapter uses this
  port inside its nodes.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from typing import Any, Literal, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field

from ..domain import MessageRole, ProviderId, UserId


# --- Provider-neutral message and content shapes ----------------------------


class TextBlock(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["text"] = "text"
    text: str


class ToolUseBlock(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["tool_use"] = "tool_use"
    id: str
    name: str
    arguments: dict[str, Any]


class ToolResultBlock(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["tool_result"] = "tool_result"
    tool_use_id: str
    content: str  # serialised; adapters may need to split into parts
    is_error: bool = False


ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock


class LLMMessage(BaseModel):
    """Provider-neutral message. Adapters translate to/from this."""

    model_config = ConfigDict(frozen=True)
    role: MessageRole
    content: list[ContentBlock]


class ToolSchema(BaseModel):
    """JSON-schema description of a callable tool.

    This is intentionally close to Anthropic's tool_use schema, which is also
    compatible with OpenAI function-calling after minor transformation.
    """

    model_config = ConfigDict(frozen=True)
    name: str
    description: str
    input_schema: dict[str, Any]  # JSON schema object


class LLMRequest(BaseModel):
    """Everything the adapter needs to make a single model call."""

    model_config = ConfigDict(frozen=True)

    provider: ProviderId
    model: str
    messages: Sequence[LLMMessage]
    system: str | None = None
    tools: Sequence[ToolSchema] = Field(default_factory=list)
    tool_choice: Literal["auto", "any", "none"] | str = "auto"
    max_tokens: int = 4096
    temperature: float | None = None
    stop_sequences: Sequence[str] = Field(default_factory=list)
    # Per-user credential resolution: the adapter looks up creds for this user.
    # None means "use deployment default".
    user_id: UserId | None = None
    # Extra provider-specific knobs escape hatch. Adapters may ignore.
    extra: dict[str, Any] = Field(default_factory=dict)


# --- Streaming events (provider-neutral) ------------------------------------


class StreamStart(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["start"] = "start"
    model: str
    provider: ProviderId


class StreamTextDelta(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["text_delta"] = "text_delta"
    text: str


class StreamToolUseStart(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["tool_use_start"] = "tool_use_start"
    tool_use_id: str
    tool_name: str


class StreamToolUseDelta(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["tool_use_delta"] = "tool_use_delta"
    tool_use_id: str
    arguments_delta: str  # partial JSON


class StreamUsage(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["usage"] = "usage"
    input_tokens: int
    output_tokens: int


class StreamEnd(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Literal["end"] = "end"
    stop_reason: str  # "end_turn" | "tool_use" | "max_tokens" | "stop_sequence"


StreamEvent = (
    StreamStart
    | StreamTextDelta
    | StreamToolUseStart
    | StreamToolUseDelta
    | StreamUsage
    | StreamEnd
)


# --- The port ---------------------------------------------------------------


@runtime_checkable
class LLMPort(Protocol):
    """A single provider adapter implements this.

    The registry (below) is what the rest of the kernel actually uses — it
    dispatches to the right LLMPort based on ProviderId.
    """

    provider_id: ProviderId

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamEvent]:
        """Execute a model call and yield provider-neutral stream events."""
        ...

    async def list_models(self) -> list[str]:
        """Return the models this provider currently offers.

        Implementations should cache; this may be called often for UI listing.
        """
        ...


@runtime_checkable
class LLMRegistry(Protocol):
    """Routes LLMRequests to the correct LLMPort based on ProviderId.

    The registry also resolves per-user credentials — individual adapters
    don't read environment variables directly; they get them from the
    registry's credential lookup.
    """

    def register(self, adapter: LLMPort) -> None: ...

    def get(self, provider: ProviderId) -> LLMPort:
        """Returns the registered adapter for a provider, or raises."""
        ...

    def available_providers(self) -> list[ProviderId]: ...

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamEvent]:
        """Convenience: lookup + stream in one call."""
        ...
