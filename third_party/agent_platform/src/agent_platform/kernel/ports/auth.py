"""AuthPort — identity resolution at the edge.

Each deployment picks its own adapter:
- LocalSingleUserAdapter: no auth; every request is "you, the local user"
- MsalAuthAdapter: Microsoft Entra ID (matches your SharePoint setup)
- OidcAuthAdapter: generic OIDC for future SaaS deployments

The port is narrow: given whatever the transport layer captured (a token,
a header, a cookie), return a resolved Principal or raise.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict

from ..domain import User, UserId, WorkspaceId


class Principal(BaseModel):
    """Authenticated context for a request.

    `current_workspace_id` is resolved during auth from: explicit header,
    default workspace for the user, or a single-workspace deployment's only
    workspace. The application layer trusts this.
    """

    model_config = ConfigDict(frozen=True)
    user: User
    current_workspace_id: WorkspaceId
    workspaces: list[WorkspaceId]  # workspaces this user has access to
    roles: dict[WorkspaceId, str]  # workspace -> role


class AuthError(Exception):
    """Raised when auth fails. The API adapter maps this to 401/403."""

    def __init__(self, message: str, *, code: str = "auth_failed") -> None:
        super().__init__(message)
        self.code = code


@runtime_checkable
class AuthPort(Protocol):
    async def authenticate(
        self,
        *,
        credentials: dict[str, Any],  # {"bearer": "..."} | {"cookie": "..."} | ...
        requested_workspace_id: WorkspaceId | None = None,
    ) -> Principal:
        """Validate credentials and return a Principal. Raises AuthError on failure."""
        ...

    async def get_user(self, user_id: UserId) -> User | None: ...
