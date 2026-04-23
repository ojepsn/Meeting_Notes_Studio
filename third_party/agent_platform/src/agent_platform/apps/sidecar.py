"""`agent-sidecar` entrypoint.

Identical to `agent-server` except it forces local-only binding, disables
CORS, and picks an ephemeral port if none given. This is what your Tauri
shell (meeting-minutes app) spawns and talks to.

Why a separate entrypoint rather than a flag on server:
- Misconfiguration is dangerous. A sidecar that accidentally binds to 0.0.0.0
  exposes personal data on the LAN.
- Lets us print the chosen port on stdout in a machine-readable way, which
  Tauri can parse to know where to connect.
"""

from __future__ import annotations

import json
import sys

import structlog
import uvicorn

from agent_platform.adapters.api.app import create_app
from agent_platform.adapters.storage.migrations import run_migrations
from agent_platform.kernel.bootstrap import Settings, build_container

log = structlog.get_logger(__name__)


def main() -> None:
    settings = Settings()

    # Harden defaults for local-only sidecar use
    settings.server.host = "127.0.0.1"
    settings.server.local_only = True
    settings.server.cors_origins = []
    settings.server.rate_limit_enabled = False
    # If port=0, OS picks one; print it so the parent (Tauri) can discover.
    port = settings.server.port

    run_migrations(settings.database.url)
    container = build_container(settings)
    app = create_app(container=container, settings=settings)

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
        access_log=False,
    )
    server = uvicorn.Server(config)

    # Emit a single JSON line so the parent can discover the port (useful
    # when port=0, and harmless when port is fixed).
    def _emit_ready():
        if server.servers and server.servers[0].sockets:
            bound = server.servers[0].sockets[0].getsockname()
            print(
                json.dumps({"event": "ready", "host": bound[0], "port": bound[1]}),
                flush=True,
            )

    server.install_signal_handlers = lambda: None  # type: ignore[assignment]

    import asyncio

    async def run() -> None:
        await server.serve()

    # Start the server, then emit readiness once the socket is bound.
    import threading

    def ready_watcher() -> None:
        import time
        while not server.started:
            time.sleep(0.05)
        _emit_ready()

    threading.Thread(target=ready_watcher, daemon=True).start()
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        log.info("sidecar shutdown")
        sys.exit(0)


if __name__ == "__main__":
    main()
