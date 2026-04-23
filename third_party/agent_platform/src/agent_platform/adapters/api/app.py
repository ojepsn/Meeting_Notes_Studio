"""FastAPI application factory.

Transport only. No business logic here — every route is a 3–10 line wrapper
around an application service call. The point of FastAPI is HTTP/SSE; if
tomorrow you want to expose the same services over Websockets, you write
a sibling `ws_app.py` that's just as thin.

The app wires a per-request Principal via dependency injection: the
`get_principal` dep calls the AuthPort adapter, which may raise AuthError.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Annotated, Any

import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from agent_platform.kernel.bootstrap import Container, Settings
from agent_platform.kernel.domain import (
    AppId,
    ApprovalRequest,
    Message,
    MessageId,
    PersonaId,
    RunId,
    Session,
    SessionId,
    WorkspaceId,
)
from agent_platform.kernel.ports import AuthError, Principal
from .schemas import (
    ApprovalIn,
    ApprovalsOut,
    CreateSessionIn,
    HealthzOut,
    MemoriesOut,
    MemoryWriteIn,
    MemoryWriteOut,
    MeOut,
    MessagesOut,
    PostMessageIn,
    ProvidersOut,
    RunTimelineOut,
    SessionsOut,
    StartRunIn,
)

log = structlog.get_logger(__name__)


def _json_default(obj: Any) -> Any:
    """Extend json encoding to cover datetimes and pydantic models."""
    from datetime import datetime

    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def create_app(*, container: Container, settings: Settings) -> FastAPI:
    """Build the FastAPI app. Called from apps/server.py and apps/sidecar.py."""

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # Ensure default workspace exists (first-run)
        ws_service = container.workspace_service()
        default_ws = await ws_service.ensure_default_workspace()
        # Bind it to local-single-user auth if that's the adapter in use
        auth = container.auth()
        bind = getattr(auth, "bind_default_workspace", None)
        if callable(bind):
            bind(default_ws)
        log.info("app ready", workspace=default_ws.slug, local_only=settings.server.local_only)
        yield
        # Teardown: close MCP sessions
        tools = container.tool_registry()
        aclose = getattr(tools, "aclose", None)
        if callable(aclose):
            await aclose()

        observability = container.observability()
        observability_aclose = getattr(observability, "aclose", None)
        if callable(observability_aclose):
            await observability_aclose()

    app = FastAPI(
        title=f"agent-platform ({settings.deployment_name})",
        version="0.1.0",
        lifespan=lifespan,
    )

    if not settings.server.local_only and settings.server.cors_origins:
        cors_origins = list(settings.server.cors_origins)
        allow_credentials = True
        if "*" in cors_origins:
            # Browser security: wildcard origin is incompatible with credentials.
            allow_credentials = False
            cors_origins = ["*"]
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=allow_credentials,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    if settings.server.rate_limit_enabled:
        from agent_platform.adapters.api.rate_limit import RateLimitMiddleware

        app.add_middleware(
            RateLimitMiddleware,
            enabled=True,
            max_requests=settings.server.rate_limit_max_requests,
            window_seconds=settings.server.rate_limit_window_seconds,
            stream_path_cost=settings.server.rate_limit_runs_stream_cost,
        )

    # ---- Dependency: resolve Principal from request ----

    async def get_principal(
        request: Request,
        authorization: Annotated[str | None, Header()] = None,
        x_workspace_id: Annotated[str | None, Header()] = None,
    ) -> Principal:
        auth = container.auth()
        creds: dict[str, Any] = {}
        if authorization and authorization.lower().startswith("bearer "):
            creds["bearer"] = authorization[7:]
        try:
            return await auth.authenticate(
                credentials=creds,
                requested_workspace_id=(
                    WorkspaceId(x_workspace_id) if x_workspace_id else None
                ),
            )
        except AuthError as exc:
            raise HTTPException(status_code=401, detail={"code": exc.code, "message": str(exc)})

    # ---- Routes ----

    @app.get(
        "/healthz",
        response_model=HealthzOut,
        tags=["system"],
        operation_id="getHealthz",
    )
    async def healthz() -> HealthzOut:
        return HealthzOut(ok=True, deployment=settings.deployment_name)

    @app.get(
        "/api/me",
        response_model=MeOut,
        tags=["identity"],
        operation_id="getMe",
    )
    async def me(principal: Principal = Depends(get_principal)) -> MeOut:
        return MeOut(
            user=principal.user,
            current_workspace_id=str(principal.current_workspace_id),
            workspaces=[str(workspace_id) for workspace_id in principal.workspaces],
        )

    @app.get(
        "/api/providers",
        response_model=ProvidersOut,
        tags=["providers"],
        operation_id="listProviders",
    )
    async def providers(principal: Principal = Depends(get_principal)) -> ProvidersOut:
        registry = container.llm_registry()
        return ProvidersOut(providers=[p.value for p in registry.available_providers()])

    @app.post(
        "/api/sessions",
        response_model=Session,
        tags=["sessions"],
        operation_id="createSession",
    )
    async def create_session(
        body: CreateSessionIn,
        principal: Principal = Depends(get_principal),
    ) -> Session:
        svc = container.session_service()
        session = await svc.create_session(
            principal=principal,
            app_id=AppId(body.app_id or settings.app_id_default),
            title=body.title,
            persona_id=PersonaId(body.persona_id) if body.persona_id else None,
        )
        return session

    @app.get(
        "/api/sessions",
        response_model=SessionsOut,
        tags=["sessions"],
        operation_id="listSessions",
    )
    async def list_sessions(
        principal: Principal = Depends(get_principal),
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0, le=1_000_000),
    ) -> SessionsOut:
        repo = container.session_repo()
        sessions = await repo.list_for_user(
            workspace_id=principal.current_workspace_id,
            user_id=principal.user.id,
            limit=limit,
            offset=offset,
        )
        return SessionsOut(sessions=sessions)

    @app.get(
        "/api/sessions/{session_id}/messages",
        response_model=MessagesOut,
        tags=["sessions"],
        operation_id="listSessionMessages",
    )
    async def list_messages(
        session_id: str,
        principal: Principal = Depends(get_principal),
    ) -> MessagesOut:
        svc = container.session_service()
        session = await svc.get_session(
            principal=principal, session_id=SessionId(session_id)
        )
        if session is None:
            raise HTTPException(404, detail="session not found")
        repo = container.message_repo()
        messages = await repo.list_for_session(SessionId(session_id))
        return MessagesOut(messages=messages)

    @app.post(
        "/api/sessions/{session_id}/messages",
        response_model=Message,
        tags=["sessions"],
        operation_id="postSessionMessage",
    )
    async def post_message(
        session_id: str,
        body: PostMessageIn,
        principal: Principal = Depends(get_principal),
    ) -> Message:
        svc = container.session_service()
        msg = await svc.post_user_message(
            principal=principal,
            session_id=SessionId(session_id),
            text=body.text,
            attachments=body.attachments,
        )
        return msg

    @app.post(
        "/api/sessions/{session_id}/runs/stream",
        tags=["runs"],
        operation_id="startSessionRunStream",
    )
    async def start_run_stream(
        session_id: str,
        body: StartRunIn,
        principal: Principal = Depends(get_principal),
    ) -> EventSourceResponse:
        """Start a run and stream events as SSE."""
        run_service = container.run_service()

        async def event_gen():
            async for event in run_service.start_run(
                principal=principal,
                session_id=SessionId(session_id),
                input_message_id=MessageId(body.input_message_id),
                workflow_name=body.workflow_name,
                goal=body.goal,
                max_turns=body.max_turns,
            ):
                # Translate WorkflowEvent -> SSE
                yield {
                    "event": event.type,
                    "data": json.dumps(event.model_dump(mode="json"), default=_json_default),
                }

        return EventSourceResponse(event_gen())

    @app.get(
        "/api/runs/{run_id}/timeline",
        response_model=RunTimelineOut,
        tags=["runs"],
        operation_id="getRunTimeline",
    )
    async def run_timeline(
        run_id: str,
        principal: Principal = Depends(get_principal),
    ) -> RunTimelineOut:
        runs = container.run_repo()
        run = await runs.get(RunId(run_id))
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")
        if (
            run.workspace_id != principal.current_workspace_id
            or run.user_id != principal.user.id
        ):
            raise HTTPException(status_code=404, detail="run not found")
        store = container.event_store()
        events = await store.read_run_timeline(run.id)
        return RunTimelineOut(events=events)

    @app.get(
        "/api/approvals",
        response_model=ApprovalsOut,
        tags=["approvals"],
        operation_id="listApprovals",
    )
    async def list_approvals(
        principal: Principal = Depends(get_principal),
    ) -> ApprovalsOut:
        repo = container.approval_repo()
        runs = container.run_repo()
        pending = await repo.list_pending(principal.current_workspace_id)
        visible: list[ApprovalRequest] = []
        for approval in pending:
            run = await runs.get(approval.run_id)
            if run is not None and run.user_id == principal.user.id:
                visible.append(approval)
        return ApprovalsOut(approvals=visible)

    @app.post(
        "/api/approvals/{approval_id}/decide/stream",
        tags=["approvals"],
        operation_id="decideApprovalStream",
    )
    async def decide_approval(
        approval_id: str,
        body: ApprovalIn,
        principal: Principal = Depends(get_principal),
    ) -> EventSourceResponse:
        svc = container.approval_service()

        async def event_gen():
            async for event in svc.decide(
                principal=principal, approval_id=approval_id, approved=body.approved
            ):
                yield {
                    "event": event.type,
                    "data": json.dumps(event.model_dump(mode="json"), default=_json_default),
                }

        return EventSourceResponse(event_gen())

    @app.get(
        "/api/memory",
        response_model=MemoriesOut,
        tags=["memory"],
        operation_id="searchMemory",
    )
    async def search_memory(
        q: str = Query(..., min_length=1, max_length=4000),
        principal: Principal = Depends(get_principal),
        limit: int = Query(default=20, ge=1, le=200),
    ) -> MemoriesOut:
        svc = container.memory_service()
        results = await svc.search(principal=principal, query=q, limit=limit)
        return MemoriesOut(memories=results)

    @app.post(
        "/api/memory",
        response_model=MemoryWriteOut,
        tags=["memory"],
        operation_id="writeMemory",
    )
    async def write_memory(
        body: MemoryWriteIn,
        principal: Principal = Depends(get_principal),
    ) -> MemoryWriteOut:
        from agent_platform.kernel.domain import MemoryKind, Visibility

        svc = container.memory_service()
        memory_id = await svc.write_user_fact(
            principal=principal,
            content=body.content,
            kind=MemoryKind(body.kind),
            visibility=Visibility(body.visibility),
        )
        return MemoryWriteOut(id=str(memory_id))

    return app
