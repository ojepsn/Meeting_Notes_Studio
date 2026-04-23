"""SkillLoaderPort — discovers and loads skills in the agentskills.io format.

A skill is a markdown file with YAML frontmatter:

    ---
    name: summary-slide-outline
    description: Generic outline for interim findings
    visibility: shared
    triggers:
      - summary
      - slide
      - interim findings
    ---

    # How to build a summary results slide

    Start with a one-line headline describing the key outcome.
    ...

The loader parses frontmatter, indexes by name + triggers, and supports
ranking against a query for retrieval-augmented prompting.

This is the same shape used by Claude Code skills and the agentskills.io
open standard, so skills are portable.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..domain import Skill, UserId, Visibility, WorkspaceId


@runtime_checkable
class SkillLoaderPort(Protocol):
    """Loads skills from wherever they live (disk, DB, remote registry)."""

    async def list_skills(
        self,
        *,
        workspace_id: WorkspaceId,
        user_id: UserId | None = None,
        visibility: Visibility | None = None,
    ) -> list[Skill]: ...

    async def get_skill(self, skill_id: str) -> Skill | None: ...

    async def rank_for_query(
        self,
        *,
        workspace_id: WorkspaceId,
        user_id: UserId | None,
        query: str,
        limit: int = 5,
    ) -> list[Skill]:
        """Return the top-N skills likely relevant to the query.

        Simple adapters may just do keyword match on name + triggers +
        description; sophisticated adapters may use embeddings.
        """
        ...

    async def save_draft(
        self,
        skill: Skill,
    ) -> str:
        """Persist a skill (draft or promoted). Returns the skill ID."""
        ...

    async def reload(self) -> int:
        """Re-scan the underlying source (e.g., skills directory).
        Returns number of skills now loaded."""
        ...
