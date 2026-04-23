"""SQLite + FTS5 memory adapter.

Zero external dependencies beyond what's already in the core. Works offline,
ships in the same SQLite database as the rest of the app, and is a perfectly
reasonable default for single-user deployments and air-gapped environments.

For richer features (temporal reasoning, self-editing, entity graphs) swap in
LettaAdapter / Mem0Adapter / ZepAdapter — they satisfy the same port.

Schema:
    memory_items(id, workspace_id, user_id, visibility, kind, content,
                 source_run_id, importance, metadata, created_at, updated_at)
    memory_items_fts - contentless FTS5 virtual table on content, synced via triggers
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from agent_platform.kernel.domain import (
    MemoryId,
    MemoryItem,
    MemoryKind,
    UserId,
    Visibility,
    WorkspaceId,
)
from agent_platform.kernel.ports import MemoryPort


_SCHEMA = """
CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT,
    visibility TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    source_run_id TEXT,
    importance REAL NOT NULL DEFAULT 0.5,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mem_scope ON memory_items(workspace_id, user_id, visibility);
CREATE INDEX IF NOT EXISTS idx_mem_kind ON memory_items(workspace_id, kind);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_items_fts USING fts5(
    content,
    content='memory_items',
    content_rowid='rowid',
    tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS memory_items_ai AFTER INSERT ON memory_items
BEGIN
    INSERT INTO memory_items_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS memory_items_ad AFTER DELETE ON memory_items
BEGIN
    INSERT INTO memory_items_fts(memory_items_fts, rowid, content)
    VALUES ('delete', old.rowid, old.content);
END;
CREATE TRIGGER IF NOT EXISTS memory_items_au AFTER UPDATE ON memory_items
BEGIN
    INSERT INTO memory_items_fts(memory_items_fts, rowid, content)
    VALUES ('delete', old.rowid, old.content);
    INSERT INTO memory_items_fts(rowid, content) VALUES (new.rowid, new.content);
END;
"""


class SqliteFtsMemoryAdapter(MemoryPort):
    """Synchronous SQLite under an async facade. Good enough for single-node
    deployments; if you deploy this on a busy shared server, swap to Postgres."""

    def __init__(self, *, db_path: Path) -> None:
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(_SCHEMA)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    async def write(self, item: MemoryItem) -> MemoryId:
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO memory_items
                    (id, workspace_id, user_id, visibility, kind, content,
                     source_run_id, importance, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    content=excluded.content,
                    importance=excluded.importance,
                    metadata=excluded.metadata,
                    updated_at=excluded.updated_at
                """,
                (
                    item.id,
                    item.workspace_id,
                    item.user_id,
                    item.visibility.value,
                    item.kind.value,
                    item.content,
                    item.source_run_id,
                    item.importance,
                    json.dumps(item.metadata),
                    item.created_at.isoformat(),
                    item.updated_at.isoformat(),
                ),
            )
        return item.id

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
        # Visibility policy: user can see their private + shared + system
        # Anonymous (user_id=None): only shared. Explicitly *not* system by
        # default to avoid leaking system prompts in public contexts.
        if visibilities is None:
            visibilities = (
                [Visibility.PRIVATE, Visibility.SHARED, Visibility.SYSTEM]
                if user_id
                else [Visibility.SHARED]
            )

        vis_placeholders = ",".join("?" for _ in visibilities)
        params: list = [workspace_id, *[v.value for v in visibilities]]

        scope_clause = f"workspace_id = ? AND visibility IN ({vis_placeholders})"
        if user_id:
            # Private items must belong to the user; shared/system don't check
            scope_clause += " AND (visibility != 'private' OR user_id = ?)"
            params.append(user_id)

        if kinds:
            kind_placeholders = ",".join("?" for _ in kinds)
            scope_clause += f" AND kind IN ({kind_placeholders})"
            params.extend(k.value for k in kinds)

        # FTS5 match. Escape query defensively — FTS5 has its own syntax.
        fts_query = _sanitise_fts(query)

        sql = f"""
            SELECT m.*
            FROM memory_items m
            JOIN memory_items_fts fts ON fts.rowid = m.rowid
            WHERE {scope_clause} AND memory_items_fts MATCH ?
            ORDER BY bm25(memory_items_fts), m.importance DESC
            LIMIT ?
        """
        params.extend([fts_query, limit])

        with self._conn() as c:
            cur = c.execute(sql, params)
            rows = cur.fetchall()
            if not rows:
                # Fallback: no FTS match, return recent items in scope
                cur = c.execute(
                    f"SELECT * FROM memory_items WHERE {scope_clause} "
                    f"ORDER BY updated_at DESC LIMIT ?",
                    params[: -2] + [limit],
                )
                rows = cur.fetchall()
        return [_row_to_item(r) for r in rows]

    async def get(self, memory_id: MemoryId) -> MemoryItem | None:
        with self._conn() as c:
            row = c.execute(
                "SELECT * FROM memory_items WHERE id = ?", (memory_id,)
            ).fetchone()
            return _row_to_item(row) if row else None

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
        params: list = [workspace_id]
        clauses = ["workspace_id = ?"]
        if user_id:
            clauses.append("(user_id = ? OR user_id IS NULL)")
            params.append(user_id)
        if visibility:
            clauses.append("visibility = ?")
            params.append(visibility.value)
        if kind:
            clauses.append("kind = ?")
            params.append(kind.value)
        sql = (
            f"SELECT * FROM memory_items WHERE {' AND '.join(clauses)} "
            f"ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        )
        params.extend([limit, offset])
        with self._conn() as c:
            rows = c.execute(sql, params).fetchall()
        return [_row_to_item(r) for r in rows]

    async def delete(self, memory_id: MemoryId) -> bool:
        with self._conn() as c:
            cur = c.execute("DELETE FROM memory_items WHERE id = ?", (memory_id,))
            return cur.rowcount > 0

    async def health_check(self) -> bool:
        try:
            with self._conn() as c:
                c.execute("SELECT 1").fetchone()
            return True
        except sqlite3.Error:
            return False


def _sanitise_fts(query: str) -> str:
    """FTS5 MATCH accepts a mini query language. To avoid injection and
    syntax errors from user input, quote every token and OR them together."""
    tokens = [t for t in query.replace('"', "").split() if t]
    if not tokens:
        return '""'
    return " OR ".join(f'"{t}"' for t in tokens)


def _row_to_item(row: sqlite3.Row) -> MemoryItem:
    return MemoryItem(
        id=row["id"],
        workspace_id=WorkspaceId(row["workspace_id"]),
        user_id=UserId(row["user_id"]) if row["user_id"] else None,
        visibility=Visibility(row["visibility"]),
        kind=MemoryKind(row["kind"]),
        content=row["content"],
        source_run_id=row["source_run_id"],
        importance=row["importance"],
        metadata=json.loads(row["metadata"]) if row["metadata"] else {},
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )
