"""Storage ports — repository pattern for persistence.

The kernel never imports SQLAlchemy. These protocols describe what it needs;
adapters implement them using SQLAlchemy, Postgres, SQLite, or whatever fits
the deployment.

Naming convention: *Repo for single-entity stores, *Store for things that
hold many heterogeneous items (event store).
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..domain import (
    ApprovalRequest,
    DomainEvent,
    Membership,
    Message,
    MessageId,
    Persona,
    PersonaId,
    Run,
    RunId,
    Session,
    SessionId,
    User,
    UserId,
    Workspace,
    WorkspaceId,
)


@runtime_checkable
class WorkspaceRepo(Protocol):
    async def create(self, workspace: Workspace) -> Workspace: ...
    async def get(self, workspace_id: WorkspaceId) -> Workspace | None: ...
    async def get_by_slug(self, slug: str) -> Workspace | None: ...
    async def list_all(self) -> list[Workspace]: ...
    async def update(self, workspace: Workspace) -> Workspace: ...


@runtime_checkable
class UserRepo(Protocol):
    async def create(self, user: User) -> User: ...
    async def get(self, user_id: UserId) -> User | None: ...
    async def get_by_email(self, email: str) -> User | None: ...


@runtime_checkable
class MembershipRepo(Protocol):
    async def create(self, m: Membership) -> Membership: ...
    async def list_for_user(self, user_id: UserId) -> list[Membership]: ...
    async def list_for_workspace(self, workspace_id: WorkspaceId) -> list[Membership]: ...
    async def get_role(
        self, workspace_id: WorkspaceId, user_id: UserId
    ) -> str | None: ...


@runtime_checkable
class SessionRepo(Protocol):
    async def create(self, session: Session) -> Session: ...
    async def get(self, session_id: SessionId) -> Session | None: ...
    async def list_for_user(
        self,
        *,
        workspace_id: WorkspaceId,
        user_id: UserId,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Session]: ...
    async def update(self, session: Session) -> Session: ...


@runtime_checkable
class MessageRepo(Protocol):
    async def append(self, message: Message) -> Message: ...
    async def list_for_session(
        self, session_id: SessionId, *, limit: int = 200
    ) -> list[Message]: ...
    async def get(self, message_id: MessageId) -> Message | None: ...


@runtime_checkable
class RunRepo(Protocol):
    async def create(self, run: Run) -> Run: ...
    async def get(self, run_id: RunId) -> Run | None: ...
    async def update(self, run: Run) -> Run: ...
    async def list_for_session(self, session_id: SessionId) -> list[Run]: ...


@runtime_checkable
class PersonaRepo(Protocol):
    async def create(self, persona: Persona) -> Persona: ...
    async def get(self, persona_id: PersonaId) -> Persona | None: ...
    async def list_for_workspace(self, workspace_id: WorkspaceId) -> list[Persona]: ...
    async def update(self, persona: Persona) -> Persona: ...


@runtime_checkable
class ApprovalRepo(Protocol):
    async def create(self, approval: ApprovalRequest) -> ApprovalRequest: ...
    async def get(self, approval_id: str) -> ApprovalRequest | None: ...
    async def list_pending(self, workspace_id: WorkspaceId) -> list[ApprovalRequest]: ...
    async def update(self, approval: ApprovalRequest) -> ApprovalRequest: ...


@runtime_checkable
class EventStore(Protocol):
    """Append-only log of domain events.

    This is NOT the LangGraph checkpoint store; those are separate. This store
    is for human-meaningful facts that power observability UIs, audit logs,
    and (eventually) projections.
    """

    async def append(self, event: DomainEvent) -> None: ...

    async def read_run_timeline(self, run_id: RunId) -> list[DomainEvent]: ...

    async def read_workspace_recent(
        self, workspace_id: WorkspaceId, limit: int = 100
    ) -> list[DomainEvent]: ...
