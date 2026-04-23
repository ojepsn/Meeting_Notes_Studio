"""`agent-cli` entrypoint.

Developer console: inspect state, chat interactively, run smoke tests.
Great for debugging and for the kind of terminal-first assistant use you
might want when iterating on personas or skills.
"""

from __future__ import annotations

import asyncio
import json
from typing import Annotated

import structlog
import typer
from rich.console import Console

from agent_platform.adapters.storage.migrations import run_migrations
from agent_platform.kernel.bootstrap import Settings, build_container
from agent_platform.kernel.domain import AppId, MessageId, SessionId

log = structlog.get_logger(__name__)
app = typer.Typer(help="agent-platform developer CLI")
console = Console()


def _bootstrap():
    settings = Settings()
    run_migrations(settings.database.url)
    container = build_container(settings)
    return settings, container


def _status_label(ok: bool) -> str:
    return "[green][OK][/green]" if ok else "[red][FAIL][/red]"


async def _shutdown_container(container) -> None:
    tools = container.tool_registry()
    tools_aclose = getattr(tools, "aclose", None)
    if callable(tools_aclose):
        await tools_aclose()

    observability = container.observability()
    observability_aclose = getattr(observability, "aclose", None)
    if callable(observability_aclose):
        await observability_aclose()

    workflow = container.workflow_engine()
    workflow_aclose = getattr(workflow, "aclose", None)
    if callable(workflow_aclose):
        await workflow_aclose()

    engine = container.db_engine()
    dispose = getattr(engine, "dispose", None)
    if callable(dispose):
        await dispose()


async def _get_principal(container):
    """For CLI, we use the configured auth adapter. For local-single-user it
    will produce the default Principal once we've bound the default workspace."""
    ws_svc = container.workspace_service()
    default_ws = await ws_svc.ensure_default_workspace()
    auth = container.auth()
    bind = getattr(auth, "bind_default_workspace", None)
    if callable(bind):
        bind(default_ws)
    return await auth.authenticate(credentials={})


@app.command()
def doctor() -> None:
    """Check that all configured adapters can actually talk to their backends."""
    settings, container = _bootstrap()

    async def _run():
        console.rule("[bold]doctor[/bold]")
        console.print(f"deployment: {settings.deployment_name}")

        # LLM providers
        registry = container.llm_registry()
        providers = registry.available_providers()
        if providers:
            console.print(f"{_status_label(True)} LLM providers: {[p.value for p in providers]}")
        else:
            console.print(f"{_status_label(False)} No LLM providers registered")

        # Memory
        mem = container.memory()
        ok = await mem.health_check()
        console.print(f"{_status_label(ok)} Memory backend: {settings.memory.backend}")

        # Skills
        skills = container.skill_loader()
        count = await skills.reload()
        console.print(f"{_status_label(True)} Skills loaded: {count}")

        # Workspaces
        ws_svc = container.workspace_service()
        ws = await ws_svc.ensure_default_workspace()
        console.print(f"{_status_label(True)} Default workspace: {ws.slug} ({ws.id})")
        await _shutdown_container(container)

    asyncio.run(_run())


@app.command()
def chat(
    provider: Annotated[str | None, typer.Option(help="provider override")] = None,
    model: Annotated[str | None, typer.Option(help="model override")] = None,
) -> None:
    """Interactive chat loop. Ctrl-C to exit."""
    _, container = _bootstrap()

    async def _run():
        principal = await _get_principal(container)

        session_svc = container.session_service()
        run_svc = container.run_service()
        session = await session_svc.create_session(
            principal=principal, app_id=AppId("cli"), title="CLI session"
        )
        console.print(f"[dim]session {session.id}[/dim]")

        while True:
            try:
                user_text = console.input("[bold cyan]>[/bold cyan] ")
            except (EOFError, KeyboardInterrupt):
                console.print("\n[dim]bye[/dim]")
                return
            if not user_text.strip():
                continue

            msg = await session_svc.post_user_message(
                principal=principal,
                session_id=SessionId(session.id),
                text=user_text,
            )

            streamed_any_text = False
            async for event in run_svc.start_run(
                principal=principal,
                session_id=SessionId(session.id),
                input_message_id=MessageId(msg.id),
            ):
                if event.type == "text_delta":
                    streamed_any_text = True
                    console.print(event.text, end="")  # type: ignore[attr-defined]
                elif event.type == "tool_call_start":
                    console.print(f"\n[yellow]→ tool:[/yellow] {event.tool_name}")  # type: ignore[attr-defined]
                elif event.type == "finished":
                    # Some adapters only provide the final assistant text on
                    # the finished event (no incremental text_delta events).
                    if not streamed_any_text and getattr(event, "final_text", ""):
                        console.print(event.final_text, end="")
                    console.print()  # newline
                elif event.type == "error":
                    console.print(f"\n[red]error:[/red] {event.message}")  # type: ignore[attr-defined]

    try:
        asyncio.run(_run())
    finally:
        asyncio.run(_shutdown_container(container))


@app.command()
def list_sessions() -> None:
    """List sessions in the default workspace."""
    _, container = _bootstrap()

    async def _run():
        principal = await _get_principal(container)
        repo = container.session_repo()
        sessions = await repo.list_for_user(
            workspace_id=principal.current_workspace_id,
            user_id=principal.user.id,
            limit=50,
        )
        for s in sessions:
            console.print(f"{s.id}  {s.created_at.isoformat()}  {s.title or '(untitled)'}")
        await _shutdown_container(container)
    asyncio.run(_run())


@app.command("run-timeline")
def run_timeline(run_id: str) -> None:
    """Print the domain event timeline for a run."""
    _, container = _bootstrap()

    async def _run():
        store = container.event_store()
        events = await store.read_run_timeline(run_id)  # type: ignore[arg-type]
        for e in events:
            console.print(json.dumps(e.model_dump(mode="json"), default=str))
        await _shutdown_container(container)
    asyncio.run(_run())


if __name__ == "__main__":
    app()
