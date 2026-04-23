"""MCP-capable ToolRegistry.

Satisfies the kernel's `ToolRegistry` port. Can hold:
- Built-in tools (implementing ToolPort directly, in-process)
- Tools discovered from MCP servers (stdio or streamable HTTP transport)

# Why MCP-first?

Because it's the closest thing to a universal interop standard in 2026.
Exposing your tools as MCP means they work inside Claude Code, Cursor,
and any other MCP-aware host — that's the lever that makes your agent
truly reusable across apps.

This implementation is intentionally minimal; it handles the tool-discovery
and invocation path. Extending it to also *expose* the registry as an MCP
server to outside clients is one more small module (`mcp_server.py`).
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import structlog

from agent_platform.kernel.domain import RiskLevel
from agent_platform.kernel.ports import ToolDescriptor, ToolPort, ToolRegistry, ToolResult
from agent_platform.kernel.ports.llm import ToolSchema

log = structlog.get_logger(__name__)


class McpToolRegistry(ToolRegistry):
    def __init__(self) -> None:
        self._builtins: dict[str, ToolPort] = {}
        self._mcp_sessions: dict[str, Any] = {}  # name -> mcp.ClientSession
        self._mcp_descriptors: dict[str, ToolDescriptor] = {}  # tool_name -> descriptor

    # ---- Built-in tools ----

    def register_builtin(self, tool: ToolPort) -> None:
        self._builtins[tool.descriptor.name] = tool

    # ---- MCP integration ----

    async def load_mcp_server(self, name: str, connection: dict[str, Any]) -> None:
        """Connect to an MCP server and register all its tools.

        `connection` shape:
            {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"],
             "env": {...}}                    # stdio transport
          OR
            {"url": "https://mcp.example.com/mcp"}   # streamable HTTP transport
        """
        try:
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client
            from mcp.client.streamable_http import streamablehttp_client
        except ImportError as exc:
            raise RuntimeError(
                "MCP integration requires the `mcp` extra: pip install agent-platform[mcp]"
            ) from exc

        if "command" in connection:
            params = StdioServerParameters(
                command=connection["command"],
                args=connection.get("args", []),
                env=connection.get("env"),
            )
            read, write = await stdio_client(params).__aenter__()
            session = ClientSession(read, write)
        elif "url" in connection:
            read, write, _ = await streamablehttp_client(connection["url"]).__aenter__()
            session = ClientSession(read, write)
        else:
            raise ValueError("MCP connection must have `command` or `url`")

        await session.__aenter__()
        await session.initialize()
        tools_resp = await session.list_tools()

        self._mcp_sessions[name] = session

        for t in tools_resp.tools:
            descriptor = ToolDescriptor(
                name=t.name,
                description=t.description or "",
                tool_schema=ToolSchema(
                    name=t.name,
                    description=t.description or "",
                    input_schema=t.inputSchema or {"type": "object", "properties": {}},
                ),
                # MCP doesn't declare risk itself; default to medium and let
                # deployment config upgrade/downgrade via explicit overrides.
                risk_level=_infer_risk(t.name),
                source=f"mcp:{name}",
                mcp_server_name=name,
            )
            self._mcp_descriptors[t.name] = descriptor
            log.info("mcp tool registered", server=name, tool=t.name)

    # ---- Query ----

    def available_tools(
        self,
        *,
        allowed_names: list[str] | None = None,
        max_risk: RiskLevel | None = None,
    ) -> list[ToolDescriptor]:
        all_descriptors: list[ToolDescriptor] = [
            t.descriptor for t in self._builtins.values()
        ]
        all_descriptors.extend(self._mcp_descriptors.values())

        if allowed_names is not None:
            allowed_set = set(allowed_names)
            all_descriptors = [d for d in all_descriptors if d.name in allowed_set]
        if max_risk is not None:
            order = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 1, RiskLevel.HIGH: 2, RiskLevel.CRITICAL: 3}
            all_descriptors = [d for d in all_descriptors if order[d.risk_level] <= order[max_risk]]
        return all_descriptors

    def get_schemas(
        self,
        *,
        allowed_names: list[str] | None = None,
        max_risk: RiskLevel | None = None,
    ) -> list[ToolSchema]:
        return [
            d.tool_schema
            for d in self.available_tools(
                allowed_names=allowed_names,
                max_risk=max_risk,
            )
        ]

    # ---- Invoke ----

    async def invoke(
        self,
        *,
        tool_name: str,
        tool_use_id: str,
        arguments: dict[str, Any],
    ) -> ToolResult:
        started = time.monotonic()

        # Prefer built-ins (lower overhead)
        if tool_name in self._builtins:
            result = await self._builtins[tool_name].invoke(tool_use_id, arguments)
            return result

        if tool_name in self._mcp_descriptors:
            descriptor = self._mcp_descriptors[tool_name]
            assert descriptor.mcp_server_name is not None
            session = self._mcp_sessions.get(descriptor.mcp_server_name)
            if session is None:
                return ToolResult(
                    tool_use_id=tool_use_id,
                    content=f"MCP server '{descriptor.mcp_server_name}' not connected",
                    is_error=True,
                )
            resp = await session.call_tool(tool_name, arguments)
            content = "\n".join(
                getattr(block, "text", str(block)) for block in resp.content
            )
            return ToolResult(
                tool_use_id=tool_use_id,
                content=content,
                is_error=bool(getattr(resp, "isError", False)),
                duration_ms=int((time.monotonic() - started) * 1000),
            )

        return ToolResult(
            tool_use_id=tool_use_id,
            content=f"Unknown tool: {tool_name}",
            is_error=True,
        )

    async def aclose(self) -> None:
        """Shutdown all MCP sessions. Call during app lifespan teardown."""
        for tool in self._builtins.values():
            aclose = getattr(tool, "aclose", None)
            if callable(aclose):
                try:
                    await aclose()
                except Exception as exc:  # noqa: BLE001
                    log.warning(
                        "builtin tool close failed",
                        tool=tool.descriptor.name,
                        error=str(exc),
                    )
        for name, session in self._mcp_sessions.items():
            try:
                await session.__aexit__(None, None, None)
            except Exception as exc:  # noqa: BLE001
                log.warning("mcp session close failed", server=name, error=str(exc))
        self._mcp_sessions.clear()
        self._builtins.clear()
        self._mcp_descriptors.clear()


def _infer_risk(tool_name: str) -> RiskLevel:
    """Very rough heuristic. Override via deployment config for real use."""
    name = tool_name.lower()
    if any(k in name for k in ("delete", "remove", "drop", "purge", "destroy")):
        return RiskLevel.CRITICAL
    if any(k in name for k in ("write", "create", "update", "send", "post", "publish", "commit", "push")):
        return RiskLevel.HIGH
    if any(k in name for k in ("read", "list", "search", "get", "fetch", "find")):
        return RiskLevel.LOW
    return RiskLevel.MEDIUM
