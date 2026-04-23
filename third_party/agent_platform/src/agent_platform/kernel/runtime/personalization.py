"""Pure personalization logic.

This module contains deterministic extraction and filtering helpers for the
first personalization loop implementation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ..domain import MemoryItem, MemoryKind

PERSONALIZATION_SOURCE = "personalization_loop"
PERSONALIZATION_MODE_KEY = "personalization_mode"
PERSONALIZATION_MODE_COLLABORATIVE = "collaborative"
PERSONALIZATION_MODE_STRICT_PROFESSIONAL = "strict_professional"
PERSONALIZATION_CATEGORY_KEY = "category"
PERSONALIZATION_CATEGORY_STYLE = "style"
PERSONALIZATION_CATEGORY_FACT = "fact"
PERSONALIZATION_CONFIDENCE_KEY = "confidence"
PERSONALIZATION_EXTRACTOR_KEY = "extractor"
PERSONALIZATION_EXTRACTOR_VERSION = "deterministic_v1"

_STYLE_KEYWORDS = (
    "american english",
    "brief",
    "british english",
    "bullet",
    "bullets",
    "casual",
    "concise",
    "detailed",
    "formal",
    "markdown",
    "prose",
    "short",
    "step-by-step",
    "steps",
    "tone",
)


@dataclass(frozen=True)
class LearnedPreferenceCandidate:
    content: str
    category: str
    kind: MemoryKind
    confidence: float
    importance: float

    @property
    def metadata(self) -> dict[str, Any]:
        return {
            "source": PERSONALIZATION_SOURCE,
            PERSONALIZATION_CATEGORY_KEY: self.category,
            PERSONALIZATION_CONFIDENCE_KEY: self.confidence,
            PERSONALIZATION_EXTRACTOR_KEY: PERSONALIZATION_EXTRACTOR_VERSION,
        }


def extract_preference_candidates(
    *,
    user_text: str,
    assistant_text: str = "",
) -> list[LearnedPreferenceCandidate]:
    """Extract stable preference candidates from a completed turn.

    The first slice stays intentionally conservative and only learns from
    explicit user phrasing. The assistant text is accepted so the call shape can
    grow later without changing the interface.
    """
    del assistant_text

    candidates: list[LearnedPreferenceCandidate] = []
    seen: set[tuple[MemoryKind, str]] = set()
    for candidate in _extract_name_preferences(user_text):
        key = (candidate.kind, _normalise_for_compare(candidate.content))
        if key not in seen:
            seen.add(key)
            candidates.append(candidate)
    for candidate in _extract_style_and_fact_preferences(user_text):
        key = (candidate.kind, _normalise_for_compare(candidate.content))
        if key not in seen:
            seen.add(key)
            candidates.append(candidate)
    return candidates


def resolve_personalization_mode(traits: dict[str, Any] | None) -> str:
    if not traits:
        return PERSONALIZATION_MODE_COLLABORATIVE
    mode = str(traits.get(PERSONALIZATION_MODE_KEY, "")).strip().lower()
    if mode == PERSONALIZATION_MODE_STRICT_PROFESSIONAL:
        return PERSONALIZATION_MODE_STRICT_PROFESSIONAL
    return PERSONALIZATION_MODE_COLLABORATIVE


def is_personalization_memory(memory: MemoryItem) -> bool:
    return memory.metadata.get("source") == PERSONALIZATION_SOURCE


def applies_in_personalization_mode(memory: MemoryItem, *, mode: str) -> bool:
    if not is_personalization_memory(memory):
        return True
    if mode != PERSONALIZATION_MODE_STRICT_PROFESSIONAL:
        return True
    return memory.metadata.get(PERSONALIZATION_CATEGORY_KEY) != PERSONALIZATION_CATEGORY_STYLE


def should_store_candidate(
    candidate: LearnedPreferenceCandidate,
    *,
    existing_memories: list[MemoryItem],
) -> bool:
    normalised_candidate = _normalise_for_compare(candidate.content)
    for memory in existing_memories:
        if _normalise_for_compare(memory.content) == normalised_candidate:
            return False
    return True


def _extract_name_preferences(user_text: str) -> list[LearnedPreferenceCandidate]:
    patterns = (
        r"\bcall me\s+([A-Za-z][A-Za-z0-9' -]{0,40})",
        r"\bmy name is\s+([A-Za-z][A-Za-z0-9' -]{0,40})",
    )
    candidates: list[LearnedPreferenceCandidate] = []
    for pattern in patterns:
        for match in re.finditer(pattern, user_text, flags=re.IGNORECASE):
            name = _clean_fragment(match.group(1))
            if not name:
                continue
            candidates.append(
                LearnedPreferenceCandidate(
                    content=f"Call the user {name}.",
                    category=PERSONALIZATION_CATEGORY_FACT,
                    kind=MemoryKind.PROFILE,
                    confidence=0.95,
                    importance=0.9,
                )
            )
    return candidates


def _extract_style_and_fact_preferences(user_text: str) -> list[LearnedPreferenceCandidate]:
    patterns = (
        (r"\bi prefer\s+([^.!\n]+)", 0.85, "prefer"),
        (r"\bplease use\s+([^.!\n]+)", 0.9, "use"),
        (r"\buse\s+([^.!\n]+english)", 0.9, "use"),
        (r"\bkeep (answers|responses|replies)\s+([^.!\n]+)", 0.9, "keep"),
        (r"\bdo not use\s+([^.!\n]+)", 0.85, "do_not_use"),
        (r"\bavoid\s+([^.!\n]+)", 0.8, "avoid"),
    )
    candidates: list[LearnedPreferenceCandidate] = []
    for pattern, confidence, formatter in patterns:
        for match in re.finditer(pattern, user_text, flags=re.IGNORECASE):
            if formatter == "keep":
                subject = _clean_fragment(match.group(1))
                fragment = _clean_fragment(match.group(2))
            else:
                subject = ""
                fragment = _clean_fragment(match.group(1))
            if not fragment:
                continue
            category = _classify_preference_fragment(fragment)
            content = _format_preference_content(
                formatter=formatter,
                fragment=fragment,
                subject=subject,
            )
            if category == PERSONALIZATION_CATEGORY_STYLE:
                kind = MemoryKind.PREFERENCE
                importance = 0.8
            else:
                kind = MemoryKind.PROFILE
                importance = 0.7
            candidates.append(
                LearnedPreferenceCandidate(
                    content=content,
                    category=category,
                    kind=kind,
                    confidence=confidence,
                    importance=importance,
                )
            )
    return candidates


def _classify_preference_fragment(fragment: str) -> str:
    lowered = fragment.lower()
    if any(keyword in lowered for keyword in _STYLE_KEYWORDS):
        return PERSONALIZATION_CATEGORY_STYLE
    return PERSONALIZATION_CATEGORY_FACT


def _format_preference_content(
    *,
    formatter: str,
    fragment: str,
    subject: str = "",
) -> str:
    cleaned = _sentence_case(fragment)
    if formatter == "use":
        return f"Use {cleaned}."
    if formatter == "keep":
        return f"Keep {subject.lower()} {fragment.lower()}."
    if formatter == "do_not_use":
        return f"Do not use {fragment.lower()}."
    if formatter == "avoid":
        return f"Avoid {fragment.lower()}."
    return f"Prefers {fragment.lower()}."


def _clean_fragment(value: str) -> str:
    cleaned = value.strip(" \t\r\n.,;:!?")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def _sentence_case(value: str) -> str:
    if not value:
        return value
    return value[0].upper() + value[1:]


def _normalise_for_compare(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())
