"""In-process LLM registry.

Keeps a mapping of ProviderId -> LLMPort and dispatches requests.
Per-user credential resolution: adapters are expected to look up their own
credentials using the user_id on LLMRequest (consulting a credential store
or environment). The registry stays simple.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from agent_platform.kernel.domain import ProviderId
from agent_platform.kernel.ports import LLMPort, LLMRegistry, LLMRequest
from agent_platform.kernel.ports.llm import StreamEvent


class SimpleLLMRegistry(LLMRegistry):
    def __init__(self) -> None:
        self._adapters: dict[ProviderId, LLMPort] = {}

    def register(self, adapter: LLMPort) -> None:
        self._adapters[adapter.provider_id] = adapter

    def get(self, provider: ProviderId) -> LLMPort:
        if provider not in self._adapters:
            raise KeyError(
                f"No LLM adapter registered for provider '{provider.value}'. "
                f"Available: {[p.value for p in self._adapters]}"
            )
        return self._adapters[provider]

    def available_providers(self) -> list[ProviderId]:
        return list(self._adapters.keys())

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamEvent]:
        adapter = self.get(request.provider)
        async for event in adapter.stream(request):
            yield event
