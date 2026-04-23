"""No-op observability. Use in air-gapped deployments or during tests."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from agent_platform.kernel.domain import RunId, WorkspaceId
from agent_platform.kernel.ports import ObservabilityPort


class NullObservability(ObservabilityPort):
    @asynccontextmanager
    async def start_run_trace(
        self,
        *,
        run_id: RunId,
        workspace_id: WorkspaceId,
        metadata: dict[str, Any] | None = None,
    ) -> AsyncIterator[None]:
        yield None

    @asynccontextmanager
    async def start_span(
        self,
        *,
        name: str,
        attributes: dict[str, Any] | None = None,
    ) -> AsyncIterator[None]:
        yield None

    async def log_event(self, *, name: str, attributes: dict[str, Any] | None = None) -> None:
        return

    async def aclose(self) -> None:
        return
