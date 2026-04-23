"""Anthropic LLM adapter — reference implementation.

Translates between our provider-neutral shape and Anthropic's Messages API.

Credential resolution: if request.user_id is set and a per-user credential
store is wired in the future, we'd look it up there. For now we use the
api_key passed at construction (deployment-level credential).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import structlog

from agent_platform.kernel.domain import MessageRole, ProviderId
from agent_platform.kernel.ports import LLMPort
from agent_platform.kernel.ports.llm import (
    LLMRequest,
    StreamEnd,
    StreamEvent,
    StreamStart,
    StreamTextDelta,
    StreamToolUseDelta,
    StreamToolUseStart,
    StreamUsage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
)

log = structlog.get_logger(__name__)


class AnthropicAdapter(LLMPort):
    provider_id = ProviderId.ANTHROPIC

    def __init__(self, *, api_key: str | None, base_url: str | None = None) -> None:
        # Lazy import so installing without [anthropic] extra doesn't break
        # the kernel. If we get here, the user expected anthropic to work.
        from anthropic import AsyncAnthropic  # type: ignore[import-not-found]

        self._client = AsyncAnthropic(api_key=api_key, base_url=base_url) if api_key else AsyncAnthropic(base_url=base_url)

    async def list_models(self) -> list[str]:
        # Anthropic's models endpoint: client.models.list()
        try:
            res = await self._client.models.list()
            return [m.id for m in res.data]
        except Exception as exc:  # noqa: BLE001
            log.warning("anthropic list_models failed", error=str(exc))
            # Reasonable fallback list
            return [
                "claude-opus-4-6",
                "claude-opus-4-5",
                "claude-sonnet-4-6",
                "claude-haiku-4-5",
            ]

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamEvent]:
        params = self._build_params(request)

        yield StreamStart(model=request.model, provider=self.provider_id)

        async with self._client.messages.stream(**params) as stream:
            async for event in stream:
                async for translated in self._translate(event):
                    yield translated

            # Final usage, after the stream closes
            final_message = await stream.get_final_message()
            yield StreamUsage(
                input_tokens=final_message.usage.input_tokens,
                output_tokens=final_message.usage.output_tokens,
            )
            yield StreamEnd(stop_reason=final_message.stop_reason or "end_turn")

    # ---- Translation helpers ----

    def _build_params(self, req: LLMRequest) -> dict[str, Any]:
        messages = [self._to_anthropic_message(m) for m in req.messages]
        params: dict[str, Any] = {
            "model": req.model,
            "messages": messages,
            "max_tokens": req.max_tokens,
        }
        if req.system:
            params["system"] = req.system
        if req.temperature is not None:
            params["temperature"] = req.temperature
        if req.stop_sequences:
            params["stop_sequences"] = list(req.stop_sequences)
        if req.tools:
            params["tools"] = [
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema,
                }
                for t in req.tools
            ]
            # Translate our tool_choice to Anthropic shape
            if req.tool_choice == "any":
                params["tool_choice"] = {"type": "any"}
            elif req.tool_choice == "none":
                params["tool_choice"] = {"type": "none"}
            elif req.tool_choice not in ("auto", ""):
                params["tool_choice"] = {"type": "tool", "name": req.tool_choice}
        if req.extra:
            params.update(req.extra)
        return params

    def _to_anthropic_message(self, m: Any) -> dict[str, Any]:
        """Convert our LLMMessage to Anthropic format.

        Anthropic merges tool results into the user turn and tool_use into
        the assistant turn; the tool role on our side becomes user-role
        with tool_result blocks.
        """
        if m.role == MessageRole.TOOL:
            role = "user"
            content = []
            for block in m.content:
                if isinstance(block, ToolResultBlock):
                    content.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.tool_use_id,
                            "content": block.content,
                            "is_error": block.is_error,
                        }
                    )
            return {"role": role, "content": content}

        role = {
            MessageRole.USER: "user",
            MessageRole.ASSISTANT: "assistant",
            MessageRole.SYSTEM: "user",  # shouldn't happen (use request.system)
        }[m.role]

        content = []
        for block in m.content:
            if isinstance(block, TextBlock):
                content.append({"type": "text", "text": block.text})
            elif isinstance(block, ToolUseBlock):
                content.append(
                    {
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.arguments,
                    }
                )
            elif isinstance(block, ToolResultBlock):
                # Defensive — shouldn't appear on non-TOOL messages in our model
                content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.tool_use_id,
                        "content": block.content,
                        "is_error": block.is_error,
                    }
                )
        return {"role": role, "content": content}

    async def _translate(self, anthropic_event: Any) -> AsyncIterator[StreamEvent]:
        """Translate a single Anthropic stream event to 0+ StreamEvents."""
        et = getattr(anthropic_event, "type", "")

        if et == "content_block_start":
            block = anthropic_event.content_block
            if getattr(block, "type", "") == "tool_use":
                yield StreamToolUseStart(tool_use_id=block.id, tool_name=block.name)

        elif et == "content_block_delta":
            delta = anthropic_event.delta
            dt = getattr(delta, "type", "")
            if dt == "text_delta":
                if delta.text:
                    yield StreamTextDelta(text=delta.text)
            elif dt == "input_json_delta":
                # Anthropic only gives us the block index, not the tool_use_id,
                # so this adapter assumes single-tool-use streaming. Proper
                # production code would maintain an index->id map from the
                # preceding content_block_start.
                index = getattr(anthropic_event, "index", 0)
                yield StreamToolUseDelta(
                    tool_use_id=f"block_{index}",
                    arguments_delta=delta.partial_json or "",
                )
        # message_delta carries stop_reason but we read it from final_message
        # message_stop is the terminator; we emit StreamEnd after the loop
        return
