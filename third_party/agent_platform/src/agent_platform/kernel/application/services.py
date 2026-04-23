"""Application services — the use cases.

These are what your API routes, CLI commands, and Tauri sidecar call.
They orchestrate ports; they don't contain transport logic.

Keep methods small. A service method does ONE thing, emits events, and
returns. Complex workflows live in the workflow engine, not here.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone

import structlog

from ..domain import (
    AppId,
    ApprovalDecided,
    DomainEvent,
    MemoryItem,
    MemoryKind,
    Message,
    MessageId,
    MessageRole,
    Persona,
    PersonaId,
    Run,
    RunFailed,
    RunId,
    RunStarted,
    RunStatus,
    RunStatusChanged,
    Session,
    SessionId,
    UserId,
    Visibility,
    Workspace,
    WorkspaceId,
)
from ..ports import (
    ApprovalRepo,
    EventStore,
    ExecutionContext,
    MemoryPort,
    ObservabilityPort,
    MessageRepo,
    PersonaRepo,
    Principal,
    RunRepo,
    SessionRepo,
    SkillLoaderPort,
    WorkflowEnginePort,
    WorkflowEvent,
    WorkflowFinished,
    WorkflowInput,
    WorkspaceRepo,
)
from ..runtime import (
    PERSONALIZATION_MODE_KEY,
    extract_preference_candidates,
    resolve_personalization_mode,
    should_store_candidate,
)

log = structlog.get_logger(__name__)


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


# -- Session & message services ---------------------------------------------


class SessionService:
    """Creates and manages conversation sessions."""

    def __init__(
        self,
        session_repo: SessionRepo,
        message_repo: MessageRepo,
    ) -> None:
        self._sessions = session_repo
        self._messages = message_repo

    async def create_session(
        self,
        *,
        principal: Principal,
        app_id: AppId,
        title: str = "",
        persona_id: PersonaId | None = None,
    ) -> Session:
        session = Session(
            id=SessionId(_new_id("ses")),
            workspace_id=principal.current_workspace_id,
            user_id=principal.user.id,
            app_id=app_id,
            title=title,
            persona_id=persona_id,
        )
        return await self._sessions.create(session)

    async def get_session(
        self,
        *,
        principal: Principal,
        session_id: SessionId,
    ) -> Session | None:
        """Always use this (not repo directly) so auth is enforced."""
        s = await self._sessions.get(session_id)
        if s is None:
            return None
        if s.workspace_id != principal.current_workspace_id:
            # Silent 404 — don't leak that the session exists in another ws
            return None
        if s.user_id != principal.user.id:
            # Same — sessions are user-private within a workspace
            return None
        return s

    async def post_user_message(
        self,
        *,
        principal: Principal,
        session_id: SessionId,
        text: str,
        attachments: list[dict] | None = None,
    ) -> Message:
        session = await self.get_session(principal=principal, session_id=session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found or not accessible")

        content: list[dict] = [{"type": "text", "text": text}]
        if attachments:
            content.extend(attachments)

        msg = Message(
            id=MessageId(_new_id("msg")),
            session_id=session_id,
            role=MessageRole.USER,
            content=content,
        )
        return await self._messages.append(msg)


# -- Run service (the main event) -------------------------------------------


class RunService:
    """Starts, streams, and resumes agent runs via the workflow engine."""

    def __init__(
        self,
        *,
        workflow_engine: WorkflowEnginePort,
        run_repo: RunRepo,
        session_repo: SessionRepo,
        message_repo: MessageRepo,
        persona_repo: PersonaRepo,
        memory: MemoryPort,
        event_store: EventStore,
        observability: ObservabilityPort,
    ) -> None:
        self._engine = workflow_engine
        self._runs = run_repo
        self._sessions = session_repo
        self._messages = message_repo
        self._personas = persona_repo
        self._memory = memory
        self._events = event_store
        self._observability = observability

    async def start_run(
        self,
        *,
        principal: Principal,
        session_id: SessionId,
        input_message_id: MessageId,
        workflow_name: str = "default_chat",
        goal: str = "",
        max_turns: int = 20,
    ) -> AsyncIterator[WorkflowEvent]:
        session = await self._sessions.get(session_id)
        if session is None or session.workspace_id != principal.current_workspace_id:
            raise ValueError("Session not found or not accessible")
        if session.user_id != principal.user.id:
            raise ValueError("Session not found or not accessible")

        # Resolve persona -> system prompt + model defaults
        system_prompt = "You are a helpful assistant."
        preferred_provider = None
        preferred_model = None
        persona_traits: dict[str, object] = {}
        if session.persona_id is not None:
            p = await self._personas.get(session.persona_id)
            if p is not None and p.workspace_id == session.workspace_id:
                system_prompt = p.system_prompt
                preferred_provider = (
                    p.default_provider.value if p.default_provider else None
                )
                preferred_model = p.default_model
                persona_traits = dict(p.traits)

        run = Run(
            id=RunId(_new_id("run")),
            session_id=session_id,
            workspace_id=session.workspace_id,
            user_id=principal.user.id,
            status=RunStatus.PENDING,
            input_message_id=input_message_id,
            goal=goal,
            max_turns=max_turns,
        )
        run = await self._runs.create(run)

        await self._events.append(
            RunStarted(workspace_id=session.workspace_id, run_id=run.id, goal=goal)
        )
        await self._transition(run, RunStatus.RUNNING)

        ctx = ExecutionContext(
            run_id=run.id,
            session_id=session_id,
            workspace_id=session.workspace_id,
            user_id=principal.user.id,
            system_prompt=system_prompt,
            preferred_provider=preferred_provider,
            preferred_model=preferred_model,
            max_turns=max_turns,
            metadata={
                PERSONALIZATION_MODE_KEY: resolve_personalization_mode(persona_traits),
            },
        )

        input_msg = await self._messages.get(input_message_id)
        if input_msg is None or input_msg.session_id != session_id:
            raise ValueError("input_message not found")

        user_text = next(
            (b.get("text", "") for b in input_msg.content if b.get("type") == "text"),
            "",
        )
        wf_input = WorkflowInput(user_input=user_text)

        trace_metadata = {
            "session_id": str(session_id),
            "workflow_name": workflow_name,
            "goal": goal,
            "input_message_id": str(input_message_id),
            "max_turns": max_turns,
            "preferred_provider": preferred_provider,
            "preferred_model": preferred_model,
        }
        async with self._observability.start_run_trace(
            run_id=run.id,
            workspace_id=session.workspace_id,
            metadata=trace_metadata,
        ):
            await self._observability.log_event(
                name="run.started",
                attributes=trace_metadata,
            )
            try:
                async with self._observability.start_span(
                    name="workflow.execute",
                    attributes={"workflow_name": workflow_name},
                ):
                    async for event in self._engine.execute(
                        workflow_name=workflow_name,
                        input=wf_input,
                        context=ctx,
                    ):
                        # The engine yields domain events wrapped in envelopes — we
                        # persist them here so the engine itself stays
                        # storage-agnostic.
                        if event.type == "domain_event":
                            await self._events.append(event.event)  # type: ignore[attr-defined]
                            await self._observability.log_event(
                                name=event.event.event_type,
                                attributes={
                                    "run_id": str(run.id),
                                    "event_type": event.event.event_type,
                                },
                            )
                        elif event.type == "finished":
                            assert isinstance(event, WorkflowFinished)
                            await self._finish_run(run, event)
                            personalization_writes = (
                                await self._learn_preferences_for_completed_run(
                                    run=run,
                                    user_text=user_text,
                                    assistant_text=event.final_text,
                                )
                            )
                            await self._observability.log_event(
                                name="run.completed",
                                attributes={
                                    "run_id": str(run.id),
                                    "personalization_writes": personalization_writes,
                                },
                            )
                        elif event.type == "error":
                            await self._fail_run(run, event.message)  # type: ignore[attr-defined]
                            await self._observability.log_event(
                                name="run.failed",
                                attributes={
                                    "run_id": str(run.id),
                                    "error": event.message,  # type: ignore[attr-defined]
                                },
                            )
                        yield event
            except Exception as exc:  # noqa: BLE001
                log.exception("run execution crashed", run_id=run.id)
                error_message = f"{type(exc).__name__}: {exc}"
                await self._fail_run(run, error_message)
                await self._observability.log_event(
                    name="run.crashed",
                    attributes={"run_id": str(run.id), "error": error_message},
                )
                raise

    async def _transition(self, run: Run, new_status: RunStatus) -> None:
        old = run.status
        run.status = new_status
        if new_status == RunStatus.RUNNING and run.started_at is None:
            run.started_at = datetime.now(timezone.utc)
        await self._runs.update(run)
        await self._events.append(
            RunStatusChanged(
                workspace_id=run.workspace_id,
                run_id=run.id,
                old_status=old,
                new_status=new_status,
            )
        )

    async def _finish_run(self, run: Run, event: WorkflowFinished) -> None:
        run.completed_at = datetime.now(timezone.utc)
        await self._transition(run, RunStatus.COMPLETED)

    async def _fail_run(self, run: Run, error: str) -> None:
        run.error = error
        run.completed_at = datetime.now(timezone.utc)
        await self._transition(run, RunStatus.FAILED)
        await self._events.append(
            RunFailed(workspace_id=run.workspace_id, run_id=run.id, error=error)
        )

    async def _learn_preferences_for_completed_run(
        self,
        *,
        run: Run,
        user_text: str,
        assistant_text: str,
    ) -> int:
        candidates = extract_preference_candidates(
            user_text=user_text,
            assistant_text=assistant_text,
        )
        if not candidates:
            return 0

        try:
            existing_memories = await self._memory.list_by_scope(
                workspace_id=run.workspace_id,
                user_id=run.user_id,
                visibility=Visibility.PRIVATE,
                limit=200,
            )
            stored = 0
            for candidate in candidates:
                if not should_store_candidate(
                    candidate,
                    existing_memories=existing_memories,
                ):
                    continue
                item = MemoryItem(
                    id=f"mem_{uuid.uuid4().hex[:16]}",  # type: ignore[arg-type]
                    workspace_id=run.workspace_id,
                    user_id=run.user_id,
                    visibility=Visibility.PRIVATE,
                    kind=candidate.kind,
                    content=candidate.content,
                    source_run_id=run.id,
                    importance=candidate.importance,
                    metadata=candidate.metadata,
                )
                await self._memory.write(item)
                existing_memories.append(item)
                stored += 1
            return stored
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "personalization loop failed",
                run_id=run.id,
                error=str(exc),
            )
            await self._observability.log_event(
                name="run.personalization_failed",
                attributes={
                    "run_id": str(run.id),
                    "error": f"{type(exc).__name__}: {exc}",
                },
            )
            return 0


# -- Workspace & persona admin services --------------------------------------


class WorkspaceService:
    def __init__(self, workspace_repo: WorkspaceRepo) -> None:
        self._repo = workspace_repo

    async def ensure_default_workspace(self) -> Workspace:
        """Creates a 'default' workspace if none exists. Handy for first-run."""
        existing = await self._repo.get_by_slug("default")
        if existing is not None:
            return existing
        workspace = Workspace(
            id=WorkspaceId(_new_id("ws")),
            name="Default",
            slug="default",
            description="Auto-created on first run",
        )
        return await self._repo.create(workspace)


class MemoryService:
    """User-facing memory operations. The workflow engine uses MemoryPort
    directly for in-run recall; this service is for memory browser UIs,
    manual memory entry, and bulk import."""

    def __init__(self, memory: MemoryPort) -> None:
        self._memory = memory

    async def write_user_fact(
        self,
        *,
        principal: Principal,
        content: str,
        kind: MemoryKind = MemoryKind.PROFILE,
        visibility: Visibility = Visibility.PRIVATE,
    ) -> str:
        item = MemoryItem(
            id=f"mem_{uuid.uuid4().hex[:16]}",  # type: ignore[arg-type]
            workspace_id=principal.current_workspace_id,
            user_id=principal.user.id if visibility == Visibility.PRIVATE else None,
            visibility=visibility,
            kind=kind,
            content=content,
        )
        return await self._memory.write(item)

    async def search(
        self,
        *,
        principal: Principal,
        query: str,
        limit: int = 10,
    ) -> list[MemoryItem]:
        return await self._memory.retrieve(
            workspace_id=principal.current_workspace_id,
            user_id=principal.user.id,
            query=query,
            limit=limit,
        )


class ApprovalService:
    """Handles the human-in-the-loop approval flow."""

    def __init__(
        self,
        *,
        approval_repo: ApprovalRepo,
        workflow_engine: WorkflowEnginePort,
        run_repo: RunRepo,
        event_store: EventStore,
        observability: ObservabilityPort,
    ) -> None:
        self._repo = approval_repo
        self._engine = workflow_engine
        self._runs = run_repo
        self._events = event_store
        self._observability = observability

    async def decide(
        self,
        *,
        principal: Principal,
        approval_id: str,
        approved: bool,
    ) -> AsyncIterator[WorkflowEvent]:
        approval = await self._repo.get(approval_id)
        if approval is None:
            raise ValueError("approval not found")
        if approval.workspace_id != principal.current_workspace_id:
            raise ValueError("not accessible")
        run = await self._runs.get(approval.run_id)
        if run is None:
            raise ValueError("run not found")
        if run.user_id != principal.user.id:
            raise ValueError("not accessible")

        approval.status = "approved" if approved else "rejected"
        approval.decided_by = principal.user.id
        approval.decided_at = datetime.now(timezone.utc)
        await self._repo.update(approval)

        await self._events.append(
            ApprovalDecided(
                workspace_id=approval.workspace_id,
                run_id=approval.run_id,
                approval_id=approval.id,
                decision=approval.status,  # type: ignore[arg-type]
            )
        )

        async with self._observability.start_run_trace(
            run_id=approval.run_id,
            workspace_id=approval.workspace_id,
            metadata={
                "approval_id": approval.id,
                "decision": approval.status,
            },
        ):
            await self._observability.log_event(
                name="run.approval_decided",
                attributes={
                    "approval_id": approval.id,
                    "decision": approval.status,
                },
            )
            async with self._observability.start_span(
                name="workflow.resume",
                attributes={"approval_id": approval.id},
            ):
                try:
                    async for event in self._engine.resume(
                        run_id=approval.run_id,
                        resume_value={"approved": approved, "approval_id": approval.id},
                    ):
                        if event.type == "domain_event":
                            await self._events.append(event.event)  # type: ignore[attr-defined]
                            await self._observability.log_event(
                                name=event.event.event_type,
                                attributes={
                                    "run_id": str(approval.run_id),
                                    "event_type": event.event.event_type,
                                },
                            )
                        elif event.type == "finished":
                            assert isinstance(event, WorkflowFinished)
                            await self._finish_run(run, event)
                            await self._observability.log_event(
                                name="run.completed",
                                attributes={"run_id": str(approval.run_id)},
                            )
                        elif event.type == "error":
                            await self._fail_run(run, event.message)  # type: ignore[attr-defined]
                            await self._observability.log_event(
                                name="run.failed",
                                attributes={
                                    "run_id": str(approval.run_id),
                                    "error": event.message,  # type: ignore[attr-defined]
                                },
                            )
                        yield event
                except Exception as exc:  # noqa: BLE001
                    log.exception("approval resume crashed", run_id=approval.run_id)
                    error_message = f"{type(exc).__name__}: {exc}"
                    await self._fail_run(run, error_message)
                    await self._observability.log_event(
                        name="run.crashed",
                        attributes={
                            "run_id": str(approval.run_id),
                            "error": error_message,
                        },
                    )
                    raise

    async def _transition(self, run: Run, new_status: RunStatus) -> None:
        old = run.status
        run.status = new_status
        if new_status == RunStatus.RUNNING and run.started_at is None:
            run.started_at = datetime.now(timezone.utc)
        await self._runs.update(run)
        await self._events.append(
            RunStatusChanged(
                workspace_id=run.workspace_id,
                run_id=run.id,
                old_status=old,
                new_status=new_status,
            )
        )

    async def _finish_run(self, run: Run, event: WorkflowFinished) -> None:
        run.completed_at = datetime.now(timezone.utc)
        await self._transition(run, RunStatus.COMPLETED)

    async def _fail_run(self, run: Run, error: str) -> None:
        run.error = error
        run.completed_at = datetime.now(timezone.utc)
        await self._transition(run, RunStatus.FAILED)
        await self._events.append(
            RunFailed(workspace_id=run.workspace_id, run_id=run.id, error=error)
        )
