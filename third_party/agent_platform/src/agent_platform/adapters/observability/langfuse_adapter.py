"""Langfuse-backed observability adapter."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import AbstractContextManager
from contextlib import asynccontextmanager
from typing import Any

from agent_platform.kernel.domain import RunId, WorkspaceId
from agent_platform.kernel.ports import ObservabilityPort


class LangfuseObservability(ObservabilityPort):
    def __init__(
        self,
        *,
        public_key: str | None,
        secret_key: str | None,
        host: str | None = None,
    ) -> None:
        try:
            from langfuse import Langfuse  # type: ignore[import-not-found]
        except ImportError as exc:
            raise RuntimeError(
                "Langfuse observability requires the `langfuse` extra: "
                "pip install agent-platform[langfuse]"
            ) from exc

        kwargs: dict[str, Any] = {
            "public_key": public_key,
            "secret_key": secret_key,
        }
        if host:
            kwargs["host"] = host
        self._client = Langfuse(**kwargs)

    @asynccontextmanager
    async def start_run_trace(
        self,
        *,
        run_id: RunId,
        workspace_id: WorkspaceId,
        metadata: dict[str, Any] | None = None,
    ) -> AsyncIterator[Any]:
        trace_metadata = {
            "run_id": str(run_id),
            "workspace_id": str(workspace_id),
            **(metadata or {}),
        }
        with self._start_span_context(
            name="agent.run",
            attributes=trace_metadata,
        ) as span:
            update_trace = getattr(span, "update_trace", None)
            if callable(update_trace):
                update_trace(
                    session_id=str(run_id),
                    metadata=trace_metadata,
                    tags=[f"workspace:{workspace_id}"],
                )
            yield span

    @asynccontextmanager
    async def start_span(
        self,
        *,
        name: str,
        attributes: dict[str, Any] | None = None,
    ) -> AsyncIterator[Any]:
        with self._start_span_context(name=name, attributes=attributes) as span:
            yield span

    async def log_event(
        self,
        *,
        name: str,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        event = getattr(self._client, "event", None)
        if callable(event):
            event(name=name, metadata=attributes or {})
            return

        with self._client.start_as_current_observation(
            as_type="event",
            name=name,
            metadata=attributes or {},
        ):
            return

    async def aclose(self) -> None:
        flush_async = getattr(self._client, "flush_async", None)
        if callable(flush_async):
            await flush_async()
            return

        flush = getattr(self._client, "flush", None)
        if callable(flush):
            flush()

    def _start_span_context(
        self,
        *,
        name: str,
        attributes: dict[str, Any] | None = None,
    ) -> AbstractContextManager[Any]:
        start_as_current_span = getattr(self._client, "start_as_current_span", None)
        if callable(start_as_current_span):
            return start_as_current_span(
                name=name,
                input=attributes or None,
                metadata=attributes or None,
            )

        return self._client.start_as_current_observation(
            as_type="span",
            name=name,
            input=attributes or None,
            metadata=attributes or None,
        )
