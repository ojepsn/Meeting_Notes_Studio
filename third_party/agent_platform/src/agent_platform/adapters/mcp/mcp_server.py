"""Expose the internal ToolRegistry as an MCP server."""

from __future__ import annotations

import json
from typing import Any

import structlog

from agent_platform.kernel.ports import ToolDescriptor, ToolRegistry

log = structlog.get_logger(__name__)


class RegistryMcpServer:
    """Low-level MCP server backed by the shared ToolRegistry."""

    def __init__(
        self,
        *,
        tool_registry: ToolRegistry,
        server_name: str = "agent-platform",
        server_version: str = "0.1.0",
    ) -> None:
        self._tool_registry = tool_registry
        self._server_name = server_name
        self._server_version = server_version

    def describe_tools(self) -> list[dict[str, Any]]:
        return [self._descriptor_to_payload(d) for d in self._tool_registry.available_tools()]

    async def invoke_tool(self, *, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
        result = await self._tool_registry.invoke(
            tool_name=name,
            tool_use_id="mcp_external",
            arguments=arguments or {},
        )
        return {
            "content": result.content,
            "is_error": result.is_error,
            "metadata": result.metadata,
        }

    async def run_stdio(self) -> None:
        """Run the MCP server over stdio."""
        try:
            import mcp.server.stdio
            import mcp.types as types
            from mcp.server.lowlevel import NotificationOptions, Server
            from mcp.server.models import InitializationOptions
        except ImportError as exc:
            raise RuntimeError(
                "MCP server mode requires the `mcp` extra: pip install agent-platform[mcp]"
            ) from exc

        server = Server(self._server_name)

        @server.list_tools()
        async def handle_list_tools() -> list[types.Tool]:
            return [
                types.Tool(
                    name=payload["name"],
                    description=payload["description"],
                    inputSchema=payload["inputSchema"],
                )
                for payload in self.describe_tools()
            ]

        @server.call_tool()
        async def handle_call_tool(
            name: str,
            arguments: dict[str, Any] | None,
        ) -> types.CallToolResult:
            payload = await self.invoke_tool(name=name, arguments=arguments)
            text_content = types.TextContent(type="text", text=payload["content"])
            return types.CallToolResult(
                content=[text_content],
                structuredContent=payload["metadata"] or None,
                isError=payload["is_error"],
            )

        log.info("starting mcp server", name=self._server_name, version=self._server_version)

        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name=self._server_name,
                    server_version=self._server_version,
                    capabilities=server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )

    def _descriptor_to_payload(self, descriptor: ToolDescriptor) -> dict[str, Any]:
        return {
            "name": descriptor.name,
            "description": descriptor.description,
            "inputSchema": descriptor.tool_schema.input_schema,
            "source": descriptor.source,
            "riskLevel": descriptor.risk_level.value,
        }
