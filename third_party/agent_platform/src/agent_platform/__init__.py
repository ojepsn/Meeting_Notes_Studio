"""agent_platform — reusable agent kernel with ports/adapters.

Import guidance:
    from agent_platform.kernel.domain import Workspace, User, Run
    from agent_platform.kernel.ports import LLMPort, MemoryPort
    from agent_platform.kernel.application import StartRunService

Adapters and apps are never imported from kernel code. If you find yourself
reaching for `agent_platform.adapters.*` inside `agent_platform.kernel.*`,
stop — that's the one architectural rule this project enforces.
"""

__version__ = "0.1.0"
