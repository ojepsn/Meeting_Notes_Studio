"""MemoryPort — abstraction over the agent's long-term memory.

Why a port: the memory space is moving fast (Letta, Mem0, Zep, Cognee, ...).
Every vendor has different tradeoffs around temporal reasoning, self-editing,
local-first, graph vs vector. You want to swap without touching the kernel.

The port is intentionally modest. It does *not* try to be a superset of every
memory framework's features. It covers the 80% that every framework supports:
write, retrieve-by-relevance, retrieve-by-id, list-by-scope, delete.

For framework-specific features (Letta's self-editing blocks, Zep's temporal
graphs), either:
(a) expose them through adapter-specific extension protocols, OR
(b) accept that they're leaky and hide them behind application-level logic
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..domain import MemoryId, MemoryItem, MemoryKind, UserId, Visibility, WorkspaceId


@runtime_checkable
class MemoryPort(Protocol):
    """Read/write access to memory. Implementations: sqlite-fts, letta, mem0, zep.

    All methods are workspace-scoped. The adapter enforces scope; callers pass
    a workspace_id and trust the adapter to isolate.

    Visibility rules (enforced at retrieve time):
    - A user can retrieve: their own private + workspace-shared + system
    - System memories are never returned when user_id is None (safer default)
    """

    async def write(self, item: MemoryItem) -> MemoryId:
        """Persist a memory item. Returns the (possibly new) ID.

        The adapter may rewrite/consolidate rather than strictly appending —
        Mem0 in particular does this. The returned ID may differ from
        item.id if the adapter merged with an existing memory.
        """
        ...

    async def retrieve(
        self,
        *,
        workspace_id: WorkspaceId,
        user_id: UserId | None,
        query: str,
        kinds: list[MemoryKind] | None = None,
        visibilities: list[Visibility] | None = None,
        limit: int = 10,
    ) -> list[MemoryItem]:
        """Retrieve memories relevant to `query`.

        Passing user_id=None retrieves only shared/system memories.
        Passing user_id=<uid> retrieves private(uid) + shared + system.
        """
        ...

    async def get(self, memory_id: MemoryId) -> MemoryItem | None: ...

    async def list_by_scope(
        self,
        *,
        workspace_id: WorkspaceId,
        user_id: UserId | None,
        visibility: Visibility | None = None,
        kind: MemoryKind | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[MemoryItem]:
        """Non-relevance-ranked listing, for memory-browser UIs."""
        ...

    async def delete(self, memory_id: MemoryId) -> bool: ...

    async def health_check(self) -> bool:
        """Quick probe: is the backend reachable and writable?"""
        ...
