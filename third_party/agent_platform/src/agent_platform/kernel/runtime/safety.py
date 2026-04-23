"""Safety policies — pure logic for risk evaluation.

When a workflow wants to invoke a tool, it asks the policy whether that's
allowed, and if not, raises an approval request. Policy is a plain function
so it's testable and easy to customise per deployment.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..domain import RiskLevel

_RISK_ORDER: dict[RiskLevel, int] = {
    RiskLevel.LOW: 0,
    RiskLevel.MEDIUM: 1,
    RiskLevel.HIGH: 2,
    RiskLevel.CRITICAL: 3,
}


@dataclass(frozen=True)
class ToolInvocationDecision:
    allow: bool
    needs_approval: bool
    reason: str = ""


def evaluate_tool_invocation(
    *,
    tool_risk: RiskLevel,
    approval_required_above: str,
    tool_name: str,
    allowed_tools: list[str],
) -> ToolInvocationDecision:
    """Decide whether a tool call proceeds, needs approval, or is rejected.

    Rules:
    - If allowed_tools is non-empty and tool_name not in it -> reject.
    - If tool_risk > approval_required_above -> needs approval.
    - Otherwise allow.
    """
    if allowed_tools and tool_name not in allowed_tools:
        return ToolInvocationDecision(
            allow=False,
            needs_approval=False,
            reason=f"Tool '{tool_name}' not in allowed_tools for this run.",
        )

    try:
        threshold_level = RiskLevel(approval_required_above)
    except ValueError:
        threshold_level = RiskLevel.MEDIUM

    if _RISK_ORDER[tool_risk] > _RISK_ORDER[threshold_level]:
        return ToolInvocationDecision(
            allow=False,
            needs_approval=True,
            reason=f"Tool '{tool_name}' risk {tool_risk.value} exceeds threshold "
            f"{threshold_level.value}; approval required.",
        )

    return ToolInvocationDecision(allow=True, needs_approval=False)
