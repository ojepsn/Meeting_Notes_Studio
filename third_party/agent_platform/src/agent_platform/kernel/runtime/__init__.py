"""Runtime — pure logic pieces used from inside workflow nodes.

No I/O, no orchestration, no framework deps. These are the "library
functions" the workflow engine and adapters call.
"""

from .prompt_assembler import AssembledPrompt, assemble_system_prompt
from .personalization import (
    PERSONALIZATION_CATEGORY_FACT,
    PERSONALIZATION_CATEGORY_STYLE,
    PERSONALIZATION_MODE_COLLABORATIVE,
    PERSONALIZATION_MODE_KEY,
    PERSONALIZATION_MODE_STRICT_PROFESSIONAL,
    LearnedPreferenceCandidate,
    applies_in_personalization_mode,
    extract_preference_candidates,
    is_personalization_memory,
    resolve_personalization_mode,
    should_store_candidate,
)
from .safety import ToolInvocationDecision, evaluate_tool_invocation

__all__ = [
    "AssembledPrompt",
    "assemble_system_prompt",
    "LearnedPreferenceCandidate",
    "extract_preference_candidates",
    "resolve_personalization_mode",
    "is_personalization_memory",
    "applies_in_personalization_mode",
    "should_store_candidate",
    "PERSONALIZATION_CATEGORY_FACT",
    "PERSONALIZATION_CATEGORY_STYLE",
    "PERSONALIZATION_MODE_KEY",
    "PERSONALIZATION_MODE_COLLABORATIVE",
    "PERSONALIZATION_MODE_STRICT_PROFESSIONAL",
    "ToolInvocationDecision",
    "evaluate_tool_invocation",
]
