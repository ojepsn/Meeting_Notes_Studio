"""Composition root: wires concrete adapters behind ports, then assembles
services.

The container's job is to be the single place where `agent_platform.kernel`
meets `agent_platform.adapters`. Everything else depends only on the kernel
interfaces.

We use `dependency-injector` lightly here — mostly as a factory registry —
because explicit `Providers.Factory(...)` patterns make the wiring legible.

If this grows unwieldy, feel free to swap to plain functions. The container
is an implementation choice, not a kernel concept.
"""

from __future__ import annotations

from pathlib import Path

from dependency_injector import containers, providers

from ..application.services import (
    ApprovalService,
    MemoryService,
    RunService,
    SessionService,
    WorkspaceService,
)
from .config import Settings


def _build_llm_registry(settings: Settings):
    """Registers every enabled LLM adapter. Import is lazy so missing extras
    don't break deployments that don't use that provider."""
    from agent_platform.adapters.llm.registry import SimpleLLMRegistry

    registry = SimpleLLMRegistry()

    allowlist = settings.llm.allowlist
    def allowed(p: str) -> bool:
        return allowlist is None or p in allowlist

    if settings.llm.anthropic_enabled and allowed("anthropic"):
        try:
            from agent_platform.adapters.llm.anthropic_adapter import AnthropicAdapter
            registry.register(AnthropicAdapter(api_key=settings.llm.anthropic_api_key))
        except ImportError:
            pass  # extras not installed

    if settings.llm.openai_enabled and allowed("openai"):
        try:
            from agent_platform.adapters.llm.openai_adapter import OpenAIAdapter
            registry.register(OpenAIAdapter(
                api_key=settings.llm.openai_api_key,
                base_url=settings.llm.openai_base_url,
            ))
        except ImportError:
            pass

    if settings.llm.openrouter_enabled and allowed("openrouter"):
        try:
            from agent_platform.adapters.llm.openai_adapter import OpenAIAdapter
            from agent_platform.kernel.domain import ProviderId
            registry.register(OpenAIAdapter(
                api_key=settings.llm.openrouter_api_key,
                base_url="https://openrouter.ai/api/v1",
                provider_id=ProviderId.OPENROUTER,
            ))
        except ImportError:
            pass

    if settings.llm.ollama_enabled and allowed("ollama"):
        try:
            from agent_platform.adapters.llm.ollama_adapter import OllamaAdapter
            registry.register(OllamaAdapter(base_url=settings.llm.ollama_base_url))
        except ImportError:
            pass

    return registry


def _build_memory(settings: Settings):
    backend = settings.memory.backend
    if backend == "sqlite_fts":
        from agent_platform.adapters.memory.sqlite_fts_adapter import SqliteFtsMemoryAdapter
        return SqliteFtsMemoryAdapter(db_path=settings.data_dir / "memory.db")
    if backend == "letta":
        from agent_platform.adapters.memory.letta_adapter import LettaMemoryAdapter
        return LettaMemoryAdapter(**settings.memory.extra)
    if backend == "mem0":
        from agent_platform.adapters.memory.mem0_adapter import Mem0MemoryAdapter
        return Mem0MemoryAdapter(**settings.memory.extra)
    raise ValueError(f"Unsupported memory backend: {backend}")


def _build_auth(settings: Settings):
    adapter = settings.auth.adapter
    if adapter == "local_single_user":
        from agent_platform.adapters.auth.local_single_user import LocalSingleUserAuth
        return LocalSingleUserAuth(
            user_id=settings.auth.local_user_id,
            display_name=settings.auth.local_user_name,
            email=settings.auth.local_user_email,
        )
    if adapter == "msal":
        from agent_platform.adapters.auth.msal_adapter import MsalAuthAdapter
        return MsalAuthAdapter(
            tenant_id=settings.auth.msal_tenant_id,
            client_id=settings.auth.msal_client_id,
        )
    raise ValueError(f"Unsupported auth adapter: {adapter}")


def _build_workflow_engine(settings: Settings, llm_registry, tool_registry, memory, skills):
    engine = settings.workflow.engine
    if engine == "langgraph":
        from agent_platform.adapters.workflow.langgraph_adapter import (
            LangGraphWorkflowAdapter,
        )
        adapter = LangGraphWorkflowAdapter(
            llm_registry=llm_registry,
            tool_registry=tool_registry,
            memory=memory,
            skills=skills,
            checkpoint_db_url=settings.workflow.checkpoint_db_url,
        )
        # Register built-in workflows
        from agent_platform.adapters.workflow.default_workflows import (
            build_default_chat_workflow,
        )
        adapter.register_workflow("default_chat", build_default_chat_workflow())
        return adapter
    raise ValueError(f"Unsupported workflow engine: {engine}")


def _build_observability(settings: Settings):
    backend = settings.observability.backend
    if backend == "null":
        from agent_platform.adapters.observability.null_adapter import NullObservability
        return NullObservability()
    if backend == "langfuse":
        from agent_platform.adapters.observability.langfuse_adapter import (
            LangfuseObservability,
        )
        return LangfuseObservability(
            public_key=settings.observability.langfuse_public_key,
            secret_key=settings.observability.langfuse_secret_key,
            host=settings.observability.langfuse_host,
        )
    raise ValueError(f"Unsupported observability backend: {backend}")


def _register_builtin_tools(settings: Settings, tool_registry) -> None:
    from agent_platform.adapters.tools import (
        FileStatTool,
        GlobFilesTool,
        ListDirectoryTool,
        NowUtcTool,
        ParseJsonTool,
        ReadFileTool,
        SearchInFilesTool,
        WebFetchTool,
        WebSearchTool,
        WriteFileTool,
    )

    builders = {
        "list_directory": lambda: ListDirectoryTool(root=settings.tools.fs_root),
        "read_file": lambda: ReadFileTool(root=settings.tools.fs_root),
        "write_file": lambda: WriteFileTool(root=settings.tools.fs_root),
        "glob_files": lambda: GlobFilesTool(root=settings.tools.fs_root),
        "file_stat": lambda: FileStatTool(root=settings.tools.fs_root),
        "search_in_files": lambda: SearchInFilesTool(root=settings.tools.fs_root),
        "now_utc": lambda: NowUtcTool(),
        "parse_json": lambda: ParseJsonTool(root=settings.tools.fs_root),
        "web_fetch": lambda: WebFetchTool(
            timeout_seconds=settings.tools.web_timeout_seconds,
            user_agent=settings.tools.web_user_agent,
            block_private_networks=settings.tools.web_fetch_block_private_networks,
            host_allowlist=settings.tools.web_fetch_host_allowlist,
            max_redirects=settings.tools.web_fetch_max_redirects,
        ),
        "web_search": lambda: WebSearchTool(
            timeout_seconds=settings.tools.web_timeout_seconds,
            user_agent=settings.tools.web_user_agent,
        ),
    }

    for tool_name in settings.tools.enabled_builtins:
        builder = builders.get(tool_name)
        if builder is None:
            raise ValueError(f"Unsupported built-in tool: {tool_name}")
        tool_registry.register_builtin(builder())


class Container(containers.DeclarativeContainer):
    """The root container. Build with `Container.from_settings(settings)`."""

    config = providers.Configuration()

    # --- Singletons (one per process) ---

    settings = providers.Singleton(lambda: None)  # replaced in from_settings
    db_engine = providers.Singleton(lambda: None)
    llm_registry = providers.Singleton(lambda: None)
    memory = providers.Singleton(lambda: None)
    auth = providers.Singleton(lambda: None)
    skill_loader = providers.Singleton(lambda: None)
    tool_registry = providers.Singleton(lambda: None)
    observability = providers.Singleton(lambda: None)
    workflow_engine = providers.Singleton(lambda: None)
    event_store = providers.Singleton(lambda: None)

    # Repositories
    workspace_repo = providers.Singleton(lambda: None)
    user_repo = providers.Singleton(lambda: None)
    membership_repo = providers.Singleton(lambda: None)
    session_repo = providers.Singleton(lambda: None)
    message_repo = providers.Singleton(lambda: None)
    run_repo = providers.Singleton(lambda: None)
    persona_repo = providers.Singleton(lambda: None)
    approval_repo = providers.Singleton(lambda: None)

    # Services
    session_service = providers.Factory(
        SessionService,
        session_repo=session_repo,
        message_repo=message_repo,
    )
    workspace_service = providers.Factory(
        WorkspaceService,
        workspace_repo=workspace_repo,
    )
    memory_service = providers.Factory(MemoryService, memory=memory)
    run_service = providers.Factory(
        RunService,
        workflow_engine=workflow_engine,
        run_repo=run_repo,
        session_repo=session_repo,
        message_repo=message_repo,
        persona_repo=persona_repo,
        memory=memory,
        event_store=event_store,
        observability=observability,
    )
    approval_service = providers.Factory(
        ApprovalService,
        approval_repo=approval_repo,
        workflow_engine=workflow_engine,
        run_repo=run_repo,
        event_store=event_store,
        observability=observability,
    )


def build_container(settings: Settings) -> Container:
    """Build a container, wiring all concrete adapters.

    Call exactly once at process startup. Entrypoints (server/sidecar/cli)
    each call this with their own Settings.
    """
    settings.ensure_directories()
    container = Container()

    # Storage first — everything needs the DB
    from agent_platform.adapters.storage.sqlite_repo import (
        SqliteStorageBundle,
        build_storage,
    )
    storage: SqliteStorageBundle = build_storage(settings.database.url, echo=settings.database.echo)

    container.settings.override(providers.Object(settings))
    container.workspace_repo.override(providers.Object(storage.workspace_repo))
    container.user_repo.override(providers.Object(storage.user_repo))
    container.membership_repo.override(providers.Object(storage.membership_repo))
    container.session_repo.override(providers.Object(storage.session_repo))
    container.message_repo.override(providers.Object(storage.message_repo))
    container.run_repo.override(providers.Object(storage.run_repo))
    container.persona_repo.override(providers.Object(storage.persona_repo))
    container.approval_repo.override(providers.Object(storage.approval_repo))
    container.event_store.override(providers.Object(storage.event_store))
    container.db_engine.override(providers.Object(storage.engine))

    # Auth
    container.auth.override(providers.Object(_build_auth(settings)))

    # LLM registry
    llm_registry = _build_llm_registry(settings)
    container.llm_registry.override(providers.Object(llm_registry))

    # Skills (agentskills.io format, disk-backed)
    from agent_platform.adapters.skills.agentskills_loader import (
        AgentSkillsLoader,
    )
    skill_loader = AgentSkillsLoader(skills_dir=settings.skills_dir)
    container.skill_loader.override(providers.Object(skill_loader))

    # Tool registry (MCP-capable)
    from agent_platform.adapters.mcp.mcp_client import McpToolRegistry
    tool_registry = McpToolRegistry()
    _register_builtin_tools(settings, tool_registry)
    container.tool_registry.override(providers.Object(tool_registry))

    # Memory
    container.memory.override(providers.Object(_build_memory(settings)))

    # Observability
    container.observability.override(providers.Object(_build_observability(settings)))

    # Workflow engine (depends on everything above)
    engine = _build_workflow_engine(
        settings,
        llm_registry=llm_registry,
        tool_registry=tool_registry,
        memory=container.memory(),
        skills=skill_loader,
    )
    container.workflow_engine.override(providers.Object(engine))

    return container
