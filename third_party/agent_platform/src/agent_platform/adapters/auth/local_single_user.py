"""Local single-user auth.

For deployments where there is exactly one human — desktop assistant, Tauri
sidecar, local CLI. Skips all real auth and returns the configured user.

The point of this adapter: the kernel still receives a proper Principal, so
downstream code doesn't need to branch on "auth or no auth." When you later
plug in OIDC/MSAL for a shared deployment, you swap the adapter in config and
nothing else changes.
"""

from __future__ import annotations

from typing import Any

from agent_platform.kernel.domain import User, UserId, Workspace, WorkspaceId
from agent_platform.kernel.ports import AuthError, AuthPort, Principal


class LocalSingleUserAuth(AuthPort):
    def __init__(
        self,
        *,
        user_id: str,
        display_name: str,
        email: str | None = None,
    ) -> None:
        self._user = User(
            id=UserId(user_id),
            display_name=display_name,
            email=email,
        )
        # Workspace resolution happens lazily on first authenticate() call —
        # we don't have the workspace repo here, so the API lifespan sets a
        # default workspace ID on us after the WorkspaceService ensures one
        # exists.
        self._default_workspace_id: WorkspaceId | None = None

    def bind_default_workspace(self, workspace: Workspace) -> None:
        self._default_workspace_id = workspace.id

    async def authenticate(
        self,
        *,
        credentials: dict[str, Any],
        requested_workspace_id: WorkspaceId | None = None,
    ) -> Principal:
        if self._default_workspace_id is None:
            raise AuthError("no default workspace bound", code="no_workspace")
        if (
            requested_workspace_id is not None
            and requested_workspace_id != self._default_workspace_id
        ):
            raise AuthError("workspace not allowed for this principal", code="workspace_denied")
        workspace_id = self._default_workspace_id
        return Principal(
            user=self._user,
            current_workspace_id=workspace_id,
            workspaces=[self._default_workspace_id],
            roles={self._default_workspace_id: "admin"},
        )

    async def get_user(self, user_id: UserId) -> User | None:
        return self._user if user_id == self._user.id else None
