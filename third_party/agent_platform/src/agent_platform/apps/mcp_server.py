"""`agent-mcp-server` entrypoint.

Expose the internal ToolRegistry as an MCP server over stdio so external
MCP-aware hosts can discover and invoke the platform's tools.
"""

from __future__ import annotations

import asyncio

import structlog

from agent_platform.adapters.mcp import RegistryMcpServer
from agent_platform.adapters.storage.migrations import run_migrations
from agent_platform.kernel.bootstrap import Settings, build_container

log = structlog.get_logger(__name__)


async def _shutdown_container(container) -> None:
    tools = container.tool_registry()
    tools_aclose = getattr(tools, "aclose", None)
    if callable(tools_aclose):
        await tools_aclose()

    observability = container.observability()
    observability_aclose = getattr(observability, "aclose", None)
    if callable(observability_aclose):
        await observability_aclose()

    engine = container.db_engine()
    dispose = getattr(engine, "dispose", None)
    if callable(dispose):
        await dispose()


def main() -> None:
    settings = Settings()
    run_migrations(settings.database.url)
    container = build_container(settings)
    server = RegistryMcpServer(
        tool_registry=container.tool_registry(),
        server_name=f"agent-platform-{settings.deployment_name}",
        server_version="0.1.0",
    )

    async def _run() -> None:
        try:
            await server.run_stdio()
        finally:
            await _shutdown_container(container)

    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        log.info("mcp server shutdown")


if __name__ == "__main__":
    main()
