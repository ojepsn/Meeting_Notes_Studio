"""Sliding-window rate limiting for HTTP API routes."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Limit requests per client IP under ``/api`` (excluding pure health checks)."""

    def __init__(
        self,
        app: Callable,
        *,
        enabled: bool,
        max_requests: int,
        window_seconds: float,
        stream_path_cost: int,
        path_prefix: str = "/api",
    ) -> None:
        super().__init__(app)
        self.enabled = enabled
        self.max_requests = max(1, max_requests)
        self.window = max(1.0, window_seconds)
        self.stream_cost = max(1, stream_path_cost)
        self.path_prefix = path_prefix
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def _consume(self, key: str, cost: int) -> bool:
        now = time.monotonic()
        dq = self._buckets[key]
        while dq and dq[0] <= now - self.window:
            dq.popleft()
        if len(dq) + cost > self.max_requests:
            return False
        for _ in range(cost):
            dq.append(now)
        return True

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        path = request.url.path
        if not path.startswith(self.path_prefix):
            return await call_next(request)
        if path == "/healthz" or path.endswith("/healthz"):
            return await call_next(request)

        cost = self.stream_cost if "/runs/stream" in path else 1
        client = request.client
        key = client.host if client else "unknown"
        if not self._consume(key, cost):
            return JSONResponse(
                {"detail": "rate limit exceeded", "code": "rate_limited"},
                status_code=429,
                headers={"Retry-After": str(int(self.window))},
            )
        return await call_next(request)
