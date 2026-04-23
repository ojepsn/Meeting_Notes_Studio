"""Prompt assembly — pure logic, no I/O.

Build the system prompt for a turn by composing:
  persona -> retrieved memories -> retrieved skills -> tool guidance

This is called from inside workflow nodes. It's pure so it's trivially testable.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..domain import MemoryItem, Skill
from .personalization import (
    PERSONALIZATION_MODE_COLLABORATIVE,
    applies_in_personalization_mode,
    is_personalization_memory,
)


@dataclass(frozen=True)
class AssembledPrompt:
    system: str
    sections: dict[str, str]  # for debugging / observability


def assemble_system_prompt(
    *,
    persona_prompt: str,
    memories: list[MemoryItem],
    skills: list[Skill],
    tool_guidance: str = "",
    personalization_mode: str = PERSONALIZATION_MODE_COLLABORATIVE,
) -> AssembledPrompt:
    """Returns a system prompt and a dict of labelled sections.

    The section dict exists so observability UIs can show exactly what went
    into a prompt — very useful for "why did the agent do X?" questions.
    """
    sections: dict[str, str] = {}

    if persona_prompt:
        sections["persona"] = persona_prompt.strip()

    if memories:
        personalization_memories = [
            memory for memory in memories if is_personalization_memory(memory)
        ]
        learned_preferences = [
            memory
            for memory in personalization_memories
            if applies_in_personalization_mode(
                memory,
                mode=personalization_mode,
            )
        ]
        contextual_memories = [
            memory for memory in memories if memory not in personalization_memories
        ]

        if learned_preferences:
            bullets = []
            for memory in learned_preferences:
                category = memory.metadata.get("category", "fact")
                bullets.append(f"- ({category}) {memory.content}")
            sections["learned_preferences"] = (
                "Stable user preferences and profile details learned from prior "
                "interaction:\n" + "\n".join(bullets)
            )

        if contextual_memories:
            bullets = []
            for memory in contextual_memories:
                bullets.append(f"- ({memory.kind.value}) {memory.content}")
            sections["memories"] = "Relevant context you remember:\n" + "\n".join(bullets)

    if skills:
        skill_blocks = []
        for s in skills:
            skill_blocks.append(f"### Skill: {s.name}\n{s.description}\n\n{s.body}")
        sections["skills"] = (
            "The following skills are available for reference; consult them "
            "when relevant:\n\n" + "\n\n".join(skill_blocks)
        )

    if tool_guidance:
        sections["tools"] = tool_guidance.strip()

    # Ordered concatenation. Persona first, tools last — matches how Claude
    # Code and Hermes both structure their system prompts.
    order = ["persona", "learned_preferences", "memories", "skills", "tools"]
    parts = [sections[k] for k in order if k in sections]
    system = "\n\n---\n\n".join(parts) if parts else ""

    return AssembledPrompt(system=system, sections=sections)
