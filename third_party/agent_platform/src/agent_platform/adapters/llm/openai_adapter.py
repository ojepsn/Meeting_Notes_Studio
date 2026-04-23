"""OpenAI adapter — handles OpenAI, OpenRouter, and any OpenAI-compatible
endpoint (vLLM, LM Studio, llama.cpp server) by parameterising base_url.

This means "OpenAI-compatible" is the lowest-common-denominator protocol for
on-prem and air-gapped deployments that prefer self-hosted endpoints.
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


class OpenAIAdapter(LLMPort):
    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str | None = None,
        provider_id: ProviderId = ProviderId.OPENAI,
    ) -> None:
        from openai import AsyncOpenAI  # type: ignore[import-not-found]

        self.provider_id = provider_id
        self._client = AsyncOpenAI(api_key=api_key or "dummy", base_url=base_url)

    async def list_models(self) -> list[str]:
        try:
            res = await self._client.models.list()
            return [m.id for m in res.data]
        except Exception as exc:  # noqa: BLE001
            log.warning("openai list_models failed", error=str(exc))
            return []

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamEvent]:
        params = self._build_params(request)

        yield StreamStart(model=request.model, provider=self.provider_id)

        # Track tool calls being streamed (OpenAI sends them in parts)
        tool_call_buffers: dict[int, dict[str, str]] = {}
        input_tokens = 0
        output_tokens = 0
        stop_reason = "end_turn"

        stream = await self._client.chat.completions.create(**params, stream=True)
        async for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if choice is None:
                continue
            delta = choice.delta
            if delta.content:
                yield StreamTextDelta(text=delta.content)
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_call_buffers:
                        tool_call_buffers[idx] = {
                            "id": tc.id or f"call_{idx}",
                            "name": "",
                            "args": "",
                        }
                        if tc.function and tc.function.name:
                            tool_call_buffers[idx]["name"] = tc.function.name
                            yield StreamToolUseStart(
                                tool_use_id=tool_call_buffers[idx]["id"],
                                tool_name=tc.function.name,
                            )
                    else:
                        if tc.function and tc.function.name and not tool_call_buffers[idx]["name"]:
                            tool_call_buffers[idx]["name"] = tc.function.name
                            yield StreamToolUseStart(
                                tool_use_id=tool_call_buffers[idx]["id"],
                                tool_name=tc.function.name,
                            )
                    if tc.function and tc.function.arguments:
                        tool_call_buffers[idx]["args"] += tc.function.arguments
                        yield StreamToolUseDelta(
                            tool_use_id=tool_call_buffers[idx]["id"],
                            arguments_delta=tc.function.arguments,
                        )
            if choice.finish_reason:
                stop_reason = _translate_finish_reason(choice.finish_reason)
            # OpenAI includes usage only with stream_options={"include_usage": True}
            if chunk.usage is not None:
                input_tokens = chunk.usage.prompt_tokens
                output_tokens = chunk.usage.completion_tokens

        yield StreamUsage(input_tokens=input_tokens, output_tokens=output_tokens)
        yield StreamEnd(stop_reason=stop_reason)

    def _build_params(self, req: LLMRequest) -> dict[str, Any]:
        messages = self._build_messages(req)
        params: dict[str, Any] = {
            "model": req.model,
            "messages": messages,
            "max_completion_tokens": req.max_tokens,
            "stream_options": {"include_usage": True},
        }
        if req.temperature is not None:
            params["temperature"] = req.temperature
        if req.stop_sequences:
            params["stop"] = list(req.stop_sequences)
        if req.tools:
            params["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema,
                    },
                }
                for t in req.tools
            ]
            if req.tool_choice == "any":
                params["tool_choice"] = "required"
            elif req.tool_choice == "none":
                params["tool_choice"] = "none"
            elif req.tool_choice not in ("auto", ""):
                params["tool_choice"] = {"type": "function", "function": {"name": req.tool_choice}}
        if req.extra:
            params.update(req.extra)
        return params

    def _build_messages(self, req: LLMRequest) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        if req.system:
            messages.append({"role": "system", "content": req.system})
        for m in req.messages:
            if m.role == MessageRole.TOOL:
                for block in m.content:
                    if isinstance(block, ToolResultBlock):
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": block.tool_use_id,
                                "content": block.content,
                            }
                        )
                continue

            role = {
                MessageRole.USER: "user",
                MessageRole.ASSISTANT: "assistant",
                MessageRole.SYSTEM: "system",
            }[m.role]

            text_parts = []
            tool_calls = []
            for block in m.content:
                if isinstance(block, TextBlock):
                    text_parts.append(block.text)
                elif isinstance(block, ToolUseBlock):
                    import json as _json
                    tool_calls.append(
                        {
                            "id": block.id,
                            "type": "function",
                            "function": {
                                "name": block.name,
                                "arguments": _json.dumps(block.arguments),
                            },
                        }
                    )

            msg: dict[str, Any] = {"role": role}
            if text_parts:
                msg["content"] = "\n".join(text_parts)
            else:
                msg["content"] = None
            if tool_calls:
                msg["tool_calls"] = tool_calls
            messages.append(msg)
        return messages


def _translate_finish_reason(openai_reason: str) -> str:
    return {
        "stop": "end_turn",
        "tool_calls": "tool_use",
        "length": "max_tokens",
        "content_filter": "content_filter",
    }.get(openai_reason, openai_reason)
