"""SQLite/SQLAlchemy-backed implementation of every storage port.

Design notes:
- One `build_storage()` factory returns a bundle of all repos. The container
  pulls them out by name. This keeps adapter wiring in one place.
- ORM models are kept private (prefixed with `_`). The public surface is
  the domain entities; mapping is done at the repo boundary.
- Works with sqlite+aiosqlite:// or postgresql+asyncpg:// — no code changes.

The `workspace_id` column exists on every scoped table and is indexed. That's
cheap insurance for future multi-tenant-per-deployment scenarios.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from agent_platform.kernel.domain import (
    ApprovalRequest,
    DomainEvent,
    Membership,
    Message,
    MessageId,
    MessageRole,
    Persona,
    PersonaId,
    ProviderId,
    Run,
    RunId,
    RunStatus,
    Session,
    SessionId,
    User,
    UserId,
    Workspace,
    WorkspaceId,
)
from agent_platform.kernel.domain.value_objects import AppId
from agent_platform.kernel.ports import (
    ApprovalRepo,
    EventStore,
    MembershipRepo,
    MessageRepo,
    PersonaRepo,
    RunRepo,
    SessionRepo,
    UserRepo,
    WorkspaceRepo,
)


# ==== ORM models ============================================================


class _Base(DeclarativeBase):
    pass


STORAGE_METADATA = _Base.metadata


class _Workspace(_Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    extra: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _User(_Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    extra: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _Membership(_Base):
    __tablename__ = "memberships"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(64), ForeignKey("workspaces.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(32), default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _Session(_Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    app_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(Text, default="")
    persona_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    extra: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _Message(_Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[list] = mapped_column(JSON)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    usage: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _Run(_Base):
    __tablename__ = "runs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    input_message_id: Mapped[str] = mapped_column(String(64))
    goal: Mapped[str] = mapped_column(Text, default="")
    max_turns: Mapped[int] = mapped_column(default=20)
    turn_count: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _Persona(_Base):
    __tablename__ = "personas"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    system_prompt: Mapped[str] = mapped_column(Text)
    traits: Mapped[dict] = mapped_column(JSON, default=dict)
    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    default_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _Approval(_Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(64), index=True)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True)
    tool_name: Mapped[str] = mapped_column(String(128))
    tool_arguments: Mapped[dict] = mapped_column(JSON, default=dict)
    risk_level: Mapped[str] = mapped_column(String(16))
    rationale: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    decided_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class _Event(_Base):
    __tablename__ = "domain_events"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


# ==== Mapping helpers =======================================================


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ws_to_domain(row: _Workspace) -> Workspace:
    return Workspace(
        id=WorkspaceId(row.id),
        name=row.name,
        slug=row.slug,
        description=row.description,
        metadata=row.extra,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _user_to_domain(row: _User) -> User:
    return User(
        id=UserId(row.id),
        display_name=row.display_name,
        email=row.email,
        metadata=row.extra,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _session_to_domain(row: _Session) -> Session:
    return Session(
        id=SessionId(row.id),
        workspace_id=WorkspaceId(row.workspace_id),
        user_id=UserId(row.user_id),
        app_id=AppId(row.app_id),
        title=row.title,
        persona_id=PersonaId(row.persona_id) if row.persona_id else None,
        metadata=row.extra,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _message_to_domain(row: _Message) -> Message:
    return Message(
        id=MessageId(row.id),
        session_id=SessionId(row.session_id),
        run_id=RunId(row.run_id) if row.run_id else None,
        role=MessageRole(row.role),
        content=row.content,
        model=row.model,
        provider=ProviderId(row.provider) if row.provider else None,
        usage=row.usage,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _run_to_domain(row: _Run) -> Run:
    return Run(
        id=RunId(row.id),
        session_id=SessionId(row.session_id),
        workspace_id=WorkspaceId(row.workspace_id),
        user_id=UserId(row.user_id),
        status=RunStatus(row.status),
        input_message_id=MessageId(row.input_message_id),
        goal=row.goal,
        max_turns=row.max_turns,
        turn_count=row.turn_count,
        started_at=row.started_at,
        completed_at=row.completed_at,
        error=row.error,
        metadata=row.extra,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


# ==== Repositories ==========================================================


class _RepoBase:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._sf = session_factory


class WorkspaceRepoImpl(_RepoBase, WorkspaceRepo):
    async def create(self, workspace: Workspace) -> Workspace:
        async with self._sf() as s:
            row = _Workspace(
                id=workspace.id,
                name=workspace.name,
                slug=workspace.slug,
                description=workspace.description,
                extra=workspace.metadata,
                created_at=workspace.created_at,
                updated_at=workspace.updated_at,
            )
            s.add(row)
            await s.commit()
            return _ws_to_domain(row)

    async def get(self, workspace_id: WorkspaceId) -> Workspace | None:
        async with self._sf() as s:
            row = await s.get(_Workspace, workspace_id)
            return _ws_to_domain(row) if row else None

    async def get_by_slug(self, slug: str) -> Workspace | None:
        async with self._sf() as s:
            q = select(_Workspace).where(_Workspace.slug == slug)
            res = await s.execute(q)
            row = res.scalar_one_or_none()
            return _ws_to_domain(row) if row else None

    async def list_all(self) -> list[Workspace]:
        async with self._sf() as s:
            res = await s.execute(select(_Workspace))
            return [_ws_to_domain(r) for r in res.scalars().all()]

    async def update(self, workspace: Workspace) -> Workspace:
        async with self._sf() as s:
            row = await s.get(_Workspace, workspace.id)
            if row is None:
                raise ValueError(f"Workspace {workspace.id} not found")
            row.name = workspace.name
            row.description = workspace.description
            row.extra = workspace.metadata
            row.updated_at = _now()
            await s.commit()
            return _ws_to_domain(row)


class UserRepoImpl(_RepoBase, UserRepo):
    async def create(self, user: User) -> User:
        async with self._sf() as s:
            row = _User(
                id=user.id,
                display_name=user.display_name,
                email=user.email,
                extra=user.metadata,
                created_at=user.created_at,
                updated_at=user.updated_at,
            )
            s.add(row)
            await s.commit()
            return _user_to_domain(row)

    async def get(self, user_id: UserId) -> User | None:
        async with self._sf() as s:
            row = await s.get(_User, user_id)
            return _user_to_domain(row) if row else None

    async def get_by_email(self, email: str) -> User | None:
        async with self._sf() as s:
            res = await s.execute(select(_User).where(_User.email == email))
            row = res.scalar_one_or_none()
            return _user_to_domain(row) if row else None


class MembershipRepoImpl(_RepoBase, MembershipRepo):
    async def create(self, m: Membership) -> Membership:
        async with self._sf() as s:
            row = _Membership(
                id=f"mem_{m.workspace_id}_{m.user_id}",
                workspace_id=m.workspace_id,
                user_id=m.user_id,
                role=m.role,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            s.add(row)
            await s.commit()
            return m

    async def list_for_user(self, user_id: UserId) -> list[Membership]:
        async with self._sf() as s:
            res = await s.execute(
                select(_Membership).where(_Membership.user_id == user_id)
            )
            return [
                Membership(
                    workspace_id=WorkspaceId(r.workspace_id),
                    user_id=UserId(r.user_id),
                    role=r.role,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
                for r in res.scalars().all()
            ]

    async def list_for_workspace(self, workspace_id: WorkspaceId) -> list[Membership]:
        async with self._sf() as s:
            res = await s.execute(
                select(_Membership).where(_Membership.workspace_id == workspace_id)
            )
            return [
                Membership(
                    workspace_id=WorkspaceId(r.workspace_id),
                    user_id=UserId(r.user_id),
                    role=r.role,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
                for r in res.scalars().all()
            ]

    async def get_role(
        self, workspace_id: WorkspaceId, user_id: UserId
    ) -> str | None:
        async with self._sf() as s:
            res = await s.execute(
                select(_Membership.role)
                .where(_Membership.workspace_id == workspace_id)
                .where(_Membership.user_id == user_id)
            )
            return res.scalar_one_or_none()


class SessionRepoImpl(_RepoBase, SessionRepo):
    async def create(self, session: Session) -> Session:
        async with self._sf() as s:
            row = _Session(
                id=session.id,
                workspace_id=session.workspace_id,
                user_id=session.user_id,
                app_id=session.app_id,
                title=session.title,
                persona_id=session.persona_id,
                extra=session.metadata,
                created_at=session.created_at,
                updated_at=session.updated_at,
            )
            s.add(row)
            await s.commit()
            return _session_to_domain(row)

    async def get(self, session_id: SessionId) -> Session | None:
        async with self._sf() as s:
            row = await s.get(_Session, session_id)
            return _session_to_domain(row) if row else None

    async def list_for_user(
        self, *, workspace_id: WorkspaceId, user_id: UserId, limit: int = 50, offset: int = 0
    ) -> list[Session]:
        async with self._sf() as s:
            q = (
                select(_Session)
                .where(_Session.workspace_id == workspace_id)
                .where(_Session.user_id == user_id)
                .order_by(_Session.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
            res = await s.execute(q)
            return [_session_to_domain(r) for r in res.scalars().all()]

    async def update(self, session: Session) -> Session:
        async with self._sf() as s:
            row = await s.get(_Session, session.id)
            if row is None:
                raise ValueError(f"Session {session.id} not found")
            row.title = session.title
            row.persona_id = session.persona_id
            row.extra = session.metadata
            row.updated_at = _now()
            await s.commit()
            return _session_to_domain(row)


class MessageRepoImpl(_RepoBase, MessageRepo):
    async def append(self, message: Message) -> Message:
        async with self._sf() as s:
            row = _Message(
                id=message.id,
                session_id=message.session_id,
                run_id=message.run_id,
                role=message.role.value,
                content=message.content,
                model=message.model,
                provider=message.provider.value if message.provider else None,
                usage=message.usage,
                created_at=message.created_at,
                updated_at=message.updated_at,
            )
            s.add(row)
            await s.commit()
            return _message_to_domain(row)

    async def list_for_session(
        self, session_id: SessionId, *, limit: int = 200
    ) -> list[Message]:
        async with self._sf() as s:
            q = (
                select(_Message)
                .where(_Message.session_id == session_id)
                .order_by(_Message.created_at.asc())
                .limit(limit)
            )
            res = await s.execute(q)
            return [_message_to_domain(r) for r in res.scalars().all()]

    async def get(self, message_id: MessageId) -> Message | None:
        async with self._sf() as s:
            row = await s.get(_Message, message_id)
            return _message_to_domain(row) if row else None


class RunRepoImpl(_RepoBase, RunRepo):
    async def create(self, run: Run) -> Run:
        async with self._sf() as s:
            row = _Run(
                id=run.id,
                session_id=run.session_id,
                workspace_id=run.workspace_id,
                user_id=run.user_id,
                status=run.status.value,
                input_message_id=run.input_message_id,
                goal=run.goal,
                max_turns=run.max_turns,
                turn_count=run.turn_count,
                started_at=run.started_at,
                completed_at=run.completed_at,
                error=run.error,
                extra=run.metadata,
                created_at=run.created_at,
                updated_at=run.updated_at,
            )
            s.add(row)
            await s.commit()
            return _run_to_domain(row)

    async def get(self, run_id: RunId) -> Run | None:
        async with self._sf() as s:
            row = await s.get(_Run, run_id)
            return _run_to_domain(row) if row else None

    async def update(self, run: Run) -> Run:
        async with self._sf() as s:
            row = await s.get(_Run, run.id)
            if row is None:
                raise ValueError(f"Run {run.id} not found")
            row.status = run.status.value
            row.turn_count = run.turn_count
            row.started_at = run.started_at
            row.completed_at = run.completed_at
            row.error = run.error
            row.updated_at = _now()
            await s.commit()
            return _run_to_domain(row)

    async def list_for_session(self, session_id: SessionId) -> list[Run]:
        async with self._sf() as s:
            q = (
                select(_Run)
                .where(_Run.session_id == session_id)
                .order_by(_Run.created_at.desc())
            )
            res = await s.execute(q)
            return [_run_to_domain(r) for r in res.scalars().all()]


class PersonaRepoImpl(_RepoBase, PersonaRepo):
    async def create(self, persona: Persona) -> Persona:
        async with self._sf() as s:
            row = _Persona(
                id=persona.id,
                workspace_id=persona.workspace_id,
                name=persona.name,
                system_prompt=persona.system_prompt,
                traits=persona.traits,
                default_model=persona.default_model,
                default_provider=persona.default_provider.value if persona.default_provider else None,
                created_at=persona.created_at,
                updated_at=persona.updated_at,
            )
            s.add(row)
            await s.commit()
            return persona

    async def get(self, persona_id: PersonaId) -> Persona | None:
        async with self._sf() as s:
            row = await s.get(_Persona, persona_id)
            if row is None:
                return None
            return Persona(
                id=PersonaId(row.id),
                workspace_id=WorkspaceId(row.workspace_id),
                name=row.name,
                system_prompt=row.system_prompt,
                traits=row.traits,
                default_model=row.default_model,
                default_provider=(
                    ProviderId(row.default_provider) if row.default_provider else None
                ),
                created_at=row.created_at,
                updated_at=row.updated_at,
            )

    async def list_for_workspace(self, workspace_id: WorkspaceId) -> list[Persona]:
        async with self._sf() as s:
            q = select(_Persona).where(_Persona.workspace_id == workspace_id)
            res = await s.execute(q)
            rows = res.scalars().all()
            return [
                Persona(
                    id=PersonaId(r.id),
                    workspace_id=WorkspaceId(r.workspace_id),
                    name=r.name,
                    system_prompt=r.system_prompt,
                    traits=r.traits,
                    default_model=r.default_model,
                    default_provider=(
                        ProviderId(r.default_provider) if r.default_provider else None
                    ),
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
                for r in rows
            ]

    async def update(self, persona: Persona) -> Persona:
        async with self._sf() as s:
            row = await s.get(_Persona, persona.id)
            if row is None:
                raise ValueError(f"Persona {persona.id} not found")
            row.name = persona.name
            row.system_prompt = persona.system_prompt
            row.traits = persona.traits
            row.default_model = persona.default_model
            row.default_provider = (
                persona.default_provider.value if persona.default_provider else None
            )
            row.updated_at = _now()
            await s.commit()
            return persona


class ApprovalRepoImpl(_RepoBase, ApprovalRepo):
    async def create(self, approval: ApprovalRequest) -> ApprovalRequest:
        async with self._sf() as s:
            row = _Approval(
                id=approval.id,
                run_id=approval.run_id,
                workspace_id=approval.workspace_id,
                tool_name=approval.tool_name,
                tool_arguments=approval.tool_arguments,
                risk_level=approval.risk_level.value,
                rationale=approval.rationale,
                status=approval.status,
                decided_by=approval.decided_by,
                decided_at=approval.decided_at,
                created_at=approval.created_at,
                updated_at=approval.updated_at,
            )
            s.add(row)
            await s.commit()
            return approval

    async def get(self, approval_id: str) -> ApprovalRequest | None:
        async with self._sf() as s:
            row = await s.get(_Approval, approval_id)
            if row is None:
                return None
            from agent_platform.kernel.domain import RiskLevel
            return ApprovalRequest(
                id=row.id,
                run_id=RunId(row.run_id),
                workspace_id=WorkspaceId(row.workspace_id),
                tool_name=row.tool_name,
                tool_arguments=row.tool_arguments,
                risk_level=RiskLevel(row.risk_level),
                rationale=row.rationale,
                status=row.status,
                decided_by=UserId(row.decided_by) if row.decided_by else None,
                decided_at=row.decided_at,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )

    async def list_pending(self, workspace_id: WorkspaceId) -> list[ApprovalRequest]:
        async with self._sf() as s:
            q = (
                select(_Approval)
                .where(_Approval.workspace_id == workspace_id)
                .where(_Approval.status == "pending")
            )
            res = await s.execute(q)
            rows = res.scalars().all()
            from agent_platform.kernel.domain import RiskLevel
            return [
                ApprovalRequest(
                    id=r.id,
                    run_id=RunId(r.run_id),
                    workspace_id=WorkspaceId(r.workspace_id),
                    tool_name=r.tool_name,
                    tool_arguments=r.tool_arguments,
                    risk_level=RiskLevel(r.risk_level),
                    rationale=r.rationale,
                    status=r.status,
                    decided_by=UserId(r.decided_by) if r.decided_by else None,
                    decided_at=r.decided_at,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
                for r in rows
            ]

    async def update(self, approval: ApprovalRequest) -> ApprovalRequest:
        async with self._sf() as s:
            row = await s.get(_Approval, approval.id)
            if row is None:
                raise ValueError(f"Approval {approval.id} not found")
            row.status = approval.status
            row.decided_by = approval.decided_by
            row.decided_at = approval.decided_at
            row.updated_at = _now()
            await s.commit()
            return approval


class EventStoreImpl(_RepoBase, EventStore):
    async def append(self, event: DomainEvent) -> None:
        async with self._sf() as s:
            row = _Event(
                event_type=event.event_type,
                workspace_id=event.workspace_id,
                run_id=event.run_id,
                session_id=event.session_id,
                payload=event.model_dump(mode="json"),
                occurred_at=event.occurred_at,
            )
            s.add(row)
            await s.commit()

    async def read_run_timeline(self, run_id: RunId) -> list[DomainEvent]:
        async with self._sf() as s:
            q = (
                select(_Event)
                .where(_Event.run_id == run_id)
                .order_by(_Event.occurred_at.asc())
            )
            res = await s.execute(q)
            return [_reconstruct_event(r) for r in res.scalars().all()]

    async def read_workspace_recent(
        self, workspace_id: WorkspaceId, limit: int = 100
    ) -> list[DomainEvent]:
        async with self._sf() as s:
            q = (
                select(_Event)
                .where(_Event.workspace_id == workspace_id)
                .order_by(_Event.occurred_at.desc())
                .limit(limit)
            )
            res = await s.execute(q)
            return [_reconstruct_event(r) for r in res.scalars().all()]


def _reconstruct_event(row: _Event) -> DomainEvent:
    """Reconstruct the right subclass based on event_type."""
    from agent_platform.kernel.domain.events import (
        ApprovalDecided,
        ApprovalRequested,
        DomainEvent as _DE,
        MemoryRecalled,
        MemoryWritten,
        ModelCalled,
        RunCompleted,
        RunFailed,
        RunStarted,
        RunStatusChanged,
        ToolInvoked,
        TurnStarted,
    )
    mapping: dict[str, type[_DE]] = {
        "run.started": RunStarted,
        "run.status_changed": RunStatusChanged,
        "run.turn_started": TurnStarted,
        "run.model_called": ModelCalled,
        "run.tool_invoked": ToolInvoked,
        "run.memory_recalled": MemoryRecalled,
        "run.memory_written": MemoryWritten,
        "run.approval_requested": ApprovalRequested,
        "run.approval_decided": ApprovalDecided,
        "run.completed": RunCompleted,
        "run.failed": RunFailed,
    }
    cls = mapping.get(row.event_type, _DE)
    return cls.model_validate(row.payload)


# ==== Bundle & factory ======================================================


@dataclass
class SqliteStorageBundle:
    engine: AsyncEngine
    workspace_repo: WorkspaceRepo
    user_repo: UserRepo
    membership_repo: MembershipRepo
    session_repo: SessionRepo
    message_repo: MessageRepo
    run_repo: RunRepo
    persona_repo: PersonaRepo
    approval_repo: ApprovalRepo
    event_store: EventStore


def build_storage(url: str, *, echo: bool = False) -> SqliteStorageBundle:
    engine = create_async_engine(url, echo=echo, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    return SqliteStorageBundle(
        engine=engine,
        workspace_repo=WorkspaceRepoImpl(session_factory),
        user_repo=UserRepoImpl(session_factory),
        membership_repo=MembershipRepoImpl(session_factory),
        session_repo=SessionRepoImpl(session_factory),
        message_repo=MessageRepoImpl(session_factory),
        run_repo=RunRepoImpl(session_factory),
        persona_repo=PersonaRepoImpl(session_factory),
        approval_repo=ApprovalRepoImpl(session_factory),
        event_store=EventStoreImpl(session_factory),
    )
