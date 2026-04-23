"""Ollama adapter — for local/air-gapped deployments.

Ollama now exposes an OpenAI-compatible endpoint at /v1, so in principle you
could just use OpenAIAdapter with base_url=http://localhost:11434/v1. This
dedicated adapter exists so we can surface Ollama-specific behaviour
(loading models on demand, richer model metadata) if we need it later.

For the first iteration, we delegate to OpenAI-compatible mode.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from agent_platform.kernel.domain import ProviderId
from agent_platform.kernel.ports import LLMPort
from agent_platform.kernel.ports.llm import LLMRequest, StreamEvent

from .openai_adapter import OpenAIAdapter


class OllamaAdapter(LLMPort):
    provider_id = ProviderId.OLLAMA

    def __init__(self, *, base_url: str = "http://localhost:11434") -> None:
        # Ollama accepts any non-empty API key
        self._inner = OpenAIAdapter(
            api_key="ollama",
            base_url=f"{base_url.rstrip('/')}/v1",
            provider_id=ProviderId.OLLAMA,
        )

    async def list_models(self) -> list[str]:
        return await self._inner.list_models()

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamEvent]:
        async for ev in self._inner.stream(request):
            yield ev
