"""ToolPort and ToolRegistry — where MCP integration lives.

Design: every tool looks like an MCP tool, even ones built-in to the process.
That way, exposing tools externally is trivial (wrap your registry in an MCP
server) and consuming external MCP tools is also trivial (register them in
the same registry).

ToolPort is what the workflow engine calls. ToolRegistry is what bootstrap
populates.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field

from ..domain import RiskLevel
from .llm import ToolSchema


class ToolDescriptor(BaseModel):
    """Metadata about a registered tool."""

    model_config = ConfigDict(frozen=True)
    name: str
    description: str
    tool_schema: ToolSchema
    risk_level: RiskLevel
    source: str  # "builtin:fs_read" | "mcp:github" | "workspace:my_custom"
    # MCP-specific (None for builtins)
    mcp_server_name: str | None = None


class ToolResult(BaseModel):
    """Outcome of a single tool invocation."""

    model_config = ConfigDict(frozen=True)
    tool_use_id: str
    content: str  # always string; structured data JSON-serialised
    is_error: bool = False
    duration_ms: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


@runtime_checkable
class ToolPort(Protocol):
    """A single invokable tool. Most adapters should prefer going through the
    registry, but this exists for tests and simple direct cases."""

    descriptor: ToolDescriptor

    async def invoke(
        self,
        tool_use_id: str,
        arguments: dict[str, Any],
    ) -> ToolResult: ...


@runtime_checkable
class ToolRegistry(Protocol):
    """Where the workflow engine asks for tools.

    Also responsible for:
    - aggregating tools from multiple MCP servers
    - filtering by workspace / persona / risk policy
    - producing the `tools=[...]` parameter for LLMRequest
    """

    def register_builtin(self, tool: ToolPort) -> None: ...

    async def load_mcp_server(
        self,
        name: str,
        connection: dict[str, Any],  # command/args for stdio, url for HTTP
    ) -> None:
        """Connect to an MCP server, discover its tools, register them."""
        ...

    def available_tools(
        self,
        *,
        allowed_names: list[str] | None = None,
        max_risk: RiskLevel | None = None,
    ) -> list[ToolDescriptor]: ...

    def get_schemas(
        self,
        *,
        allowed_names: list[str] | None = None,
        max_risk: RiskLevel | None = None,
    ) -> list[ToolSchema]:
        """Shortcut: schemas for passing to LLMRequest."""
        ...

    async def invoke(
        self,
        *,
        tool_name: str,
        tool_use_id: str,
        arguments: dict[str, Any],
    ) -> ToolResult: ...
