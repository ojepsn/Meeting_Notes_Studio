"""agentskills.io / Claude Skills format loader.

Skill file layout (one skill per markdown file):

    ---
    name: summary-slide-outline
    description: Generic slide structure for interim findings
    visibility: shared
    triggers:
      - summary
      - slide
      - interim findings
    ---

    # How to build a summary results slide
    ...

The loader scans `skills_dir` recursively for `.md` files, parses frontmatter,
and indexes by name + triggers. Keyword ranking is good enough for a
scaffolding start; swap in embedding-based ranking later without touching
any callers.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

import frontmatter
import structlog

from agent_platform.kernel.domain import (
    Skill,
    SkillId,
    SkillStatus,
    UserId,
    Visibility,
    WorkspaceId,
)
from agent_platform.kernel.ports import SkillLoaderPort

log = structlog.get_logger(__name__)


class AgentSkillsLoader(SkillLoaderPort):
    """Disk-backed, workspace-partitioned skills loader.

    Directory layout on disk:
        skills_dir/
        ├── system/                   # visibility=system, applies to all workspaces
        │   └── response-style-guide.md
        ├── <workspace_id>/shared/    # visibility=shared within workspace
        │   └── summary-slide-outline.md
        └── <workspace_id>/users/<user_id>/  # visibility=private to that user
            └── my_draft.md
    """

    def __init__(self, *, skills_dir: Path) -> None:
        self._root = Path(skills_dir)
        self._root.mkdir(parents=True, exist_ok=True)
        self._index: list[Skill] = []
        self._loaded = False

    async def list_skills(
        self,
        *,
        workspace_id: WorkspaceId,
        user_id: UserId | None = None,
        visibility: Visibility | None = None,
    ) -> list[Skill]:
        if not self._loaded:
            await self.reload()
        return [s for s in self._index if _matches_scope(s, workspace_id, user_id, visibility)]

    async def get_skill(self, skill_id: str) -> Skill | None:
        if not self._loaded:
            await self.reload()
        return next((s for s in self._index if s.id == skill_id), None)

    async def rank_for_query(
        self,
        *,
        workspace_id: WorkspaceId,
        user_id: UserId | None,
        query: str,
        limit: int = 5,
    ) -> list[Skill]:
        candidates = await self.list_skills(workspace_id=workspace_id, user_id=user_id)
        query_lower = query.lower()
        query_tokens = {t for t in re.split(r"\W+", query_lower) if len(t) > 2}

        scored: list[tuple[float, Skill]] = []
        for skill in candidates:
            score = 0.0
            name_lower = skill.name.lower()
            desc_lower = skill.description.lower()
            triggers: list[str] = skill.frontmatter.get("triggers", []) or []

            if any(tok in name_lower for tok in query_tokens):
                score += 3.0
            for trigger in triggers:
                if trigger.lower() in query_lower:
                    score += 2.0
                if any(tok in trigger.lower() for tok in query_tokens):
                    score += 1.0
            if any(tok in desc_lower for tok in query_tokens):
                score += 0.5

            if score > 0:
                scored.append((score, skill))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [s for _, s in scored[:limit]]

    async def save_draft(self, skill: Skill) -> str:
        """Persist a draft to disk. Chooses path based on visibility + user."""
        target_dir: Path
        if skill.visibility == Visibility.SYSTEM:
            target_dir = self._root / "system"
        elif skill.visibility == Visibility.SHARED:
            target_dir = self._root / skill.workspace_id / "shared"
        else:
            if skill.user_id is None:
                raise ValueError("private skill requires user_id")
            target_dir = self._root / skill.workspace_id / "users" / skill.user_id
        target_dir.mkdir(parents=True, exist_ok=True)

        safe_name = re.sub(r"[^a-z0-9_-]+", "-", skill.name.lower())
        path = target_dir / f"{safe_name}.md"

        post = frontmatter.Post(
            skill.body,
            name=skill.name,
            description=skill.description,
            visibility=skill.visibility.value,
            status=skill.status.value,
            **{k: v for k, v in skill.frontmatter.items() if k not in {"name", "description", "visibility", "status"}},
        )
        path.write_bytes(frontmatter.dumps(post).encode("utf-8"))
        log.info("skill saved", path=str(path), skill_id=skill.id)
        # Invalidate index so next call reloads
        self._loaded = False
        return skill.id

    async def reload(self) -> int:
        self._index = []
        for md in self._root.rglob("*.md"):
            try:
                skill = _parse_skill_file(md, self._root)
                self._index.append(skill)
            except Exception as exc:  # noqa: BLE001
                log.warning("skill parse failed", path=str(md), error=str(exc))
        self._loaded = True
        return len(self._index)


def _matches_scope(
    skill: Skill,
    workspace_id: WorkspaceId,
    user_id: UserId | None,
    visibility: Visibility | None,
) -> bool:
    if visibility is not None and skill.visibility != visibility:
        return False
    if skill.visibility == Visibility.SYSTEM:
        return True
    if skill.workspace_id != workspace_id:
        return False
    if skill.visibility == Visibility.PRIVATE:
        return skill.user_id == user_id
    return True  # SHARED within workspace


def _parse_skill_file(path: Path, root: Path) -> Skill:
    """Parse a single skill file, deriving scope from its path."""
    rel = path.relative_to(root)
    parts = rel.parts

    workspace_id: WorkspaceId = WorkspaceId("default")
    user_id: UserId | None = None
    visibility = Visibility.PRIVATE

    if parts[0] == "system":
        visibility = Visibility.SYSTEM
        workspace_id = WorkspaceId("*")  # applies everywhere
    elif len(parts) >= 2:
        workspace_id = WorkspaceId(parts[0])
        if parts[1] == "shared":
            visibility = Visibility.SHARED
        elif parts[1] == "users" and len(parts) >= 4:
            visibility = Visibility.PRIVATE
            user_id = UserId(parts[2])

    post = frontmatter.loads(path.read_text(encoding="utf-8"))
    fm: dict[str, Any] = dict(post.metadata)
    name = fm.pop("name", path.stem)
    description = fm.pop("description", "")
    status = SkillStatus(fm.pop("status", "promoted"))
    fm.pop("visibility", None)  # derived from path, not frontmatter

    # Deterministic ID from path so reloads don't orphan things
    id_hash = hashlib.sha1(str(rel).encode()).hexdigest()[:16]
    return Skill(
        id=SkillId(f"skl_{id_hash}"),
        workspace_id=workspace_id,
        user_id=user_id,
        visibility=visibility,
        status=status,
        name=name,
        description=description,
        body=post.content,
        frontmatter=fm,
        source=str(rel),
    )
