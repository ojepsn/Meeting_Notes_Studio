"""`agent-server` entrypoint.

Standalone FastAPI HTTP server. Used for:
- Hosted deployments (you run this on a VM/container and point frontends at it)
- On-prem server deployments (same binary, different Settings)
- Development (uvicorn with reload)
"""

from __future__ import annotations

import structlog
import uvicorn

from agent_platform.adapters.api.app import create_app
from agent_platform.adapters.storage.migrations import run_migrations
from agent_platform.kernel.bootstrap import Settings, build_container

log = structlog.get_logger(__name__)


def main() -> None:
    settings = Settings()
    run_migrations(settings.database.url)
    container = build_container(settings)
    app = create_app(container=container, settings=settings)

    log.info(
        "starting agent-server",
        host=settings.server.host,
        port=settings.server.port,
        deployment=settings.deployment_name,
    )

    uvicorn.run(
        app,
        host=settings.server.host,
        port=settings.server.port,
        log_level="info",
        access_log=False,
    )


if __name__ == "__main__":
    main()
