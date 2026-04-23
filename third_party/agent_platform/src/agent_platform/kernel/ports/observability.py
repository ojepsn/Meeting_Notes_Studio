"""ObservabilityPort — traces, metrics, logs.

Keep this narrow. The goal is: any run should be inspectable end-to-end.
Provide adapters for:
- NullObservabilityAdapter (no-op; for tests and air-gapped deployments that
  want zero phone-home)
- LangfuseObservabilityAdapter (self-hostable, free for on-prem)
- OpenTelemetryObservabilityAdapter (for shops with existing infra)
"""

from __future__ import annotations

from contextlib import AbstractAsyncContextManager
from typing import Any, Protocol, runtime_checkable

from ..domain import RunId, WorkspaceId


@runtime_checkable
class ObservabilityPort(Protocol):
    def start_run_trace(
        self,
        *,
        run_id: RunId,
        workspace_id: WorkspaceId,
        metadata: dict[str, Any] | None = None,
    ) -> AbstractAsyncContextManager[Any]:
        """Context manager that yields a trace span for the whole run."""
        ...

    def start_span(
        self,
        *,
        name: str,
        attributes: dict[str, Any] | None = None,
    ) -> AbstractAsyncContextManager[Any]:
        """Nested span for any operation you want to measure."""
        ...

    async def log_event(
        self,
        *,
        name: str,
        attributes: dict[str, Any] | None = None,
    ) -> None: ...
