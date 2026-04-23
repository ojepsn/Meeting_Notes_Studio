"""Deployment configuration.

All deployment-specific behaviour flows through this Settings object. To add
a new deployment mode (e.g., an air-gapped regulated environment), you create a
YAML/env file that sets the right flags here — no code changes.

Reads from (in order): explicit constructor args -> environment variables ->
.env file -> defaults. Prefix for env vars: AGENT_PLATFORM_.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """SQLite for local/single-user/air-gapped. Postgres for shared servers."""

    url: str = "sqlite+aiosqlite:///./data/agent_platform.db"
    echo: bool = False


class WorkflowSettings(BaseSettings):
    """Which workflow engine to use. LangGraph is the only real option today."""

    engine: Literal["langgraph", "custom_loop"] = "langgraph"
    checkpoint_db_url: str = "sqlite+aiosqlite:///./data/checkpoints.db"


class LLMProviderSettings(BaseSettings):
    """Per-provider enablement. On an air-gapped deployment,
    every cloud provider is disabled here and only ollama/vllm are on."""

    anthropic_enabled: bool = True
    anthropic_api_key: str | None = None

    openai_enabled: bool = True
    openai_api_key: str | None = None
    openai_base_url: str | None = None  # set for OpenAI-compatible endpoints

    openrouter_enabled: bool = True
    openrouter_api_key: str | None = None

    ollama_enabled: bool = True
    ollama_base_url: str = "http://localhost:11434"

    # Hard wall: if set, only these providers are allowed regardless of above
    allowlist: list[str] | None = None


class MemorySettings(BaseSettings):
    """Which memory backend to use."""

    backend: Literal["sqlite_fts", "letta", "mem0", "zep", "memori"] = "sqlite_fts"
    # Adapter-specific overrides land in `extra`
    extra: dict = Field(default_factory=dict)


class AuthSettings(BaseSettings):
    adapter: Literal["local_single_user", "msal", "oidc"] = "local_single_user"
    # For local_single_user: who is the implicit user?
    local_user_id: str = "usr_local"
    local_user_name: str = "Local User"
    local_user_email: str | None = None

    # For MSAL
    msal_tenant_id: str | None = None
    msal_client_id: str | None = None


class ObservabilitySettings(BaseSettings):
    backend: Literal["null", "langfuse", "otel"] = "null"
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str | None = None  # self-hosted for on-prem
    otel_endpoint: str | None = None


class ServerSettings(BaseSettings):
    host: str = "127.0.0.1"
    port: int = 8088
    # When true, bind only to loopback and disable CORS for remote origins.
    # Sidecar mode forces this on.
    local_only: bool = False
    cors_origins: list[str] = Field(default_factory=list)
    # Sliding-window limit per client IP for /api (runs/stream counts extra).
    rate_limit_enabled: bool = True
    rate_limit_max_requests: int = 400
    rate_limit_window_seconds: float = 60.0
    rate_limit_runs_stream_cost: int = 5


class ToolSettings(BaseSettings):
    """Built-in tool configuration.

    Web tools are opt-in so the default deployment remains air-gap friendly.
    Filesystem tools are scoped to a safe root directory.
    """

    enabled_builtins: list[str] = Field(
        default_factory=lambda: [
            "list_directory",
            "read_file",
            "write_file",
            "glob_files",
            "file_stat",
            "search_in_files",
            "now_utc",
            "parse_json",
        ]
    )
    fs_root: Path = Path("./workspace")
    web_timeout_seconds: float = 10.0
    web_user_agent: str = "agent-platform/0.1"
    # SSRF mitigation for web_fetch (and redirect chain). Disable only in
    # controlled dev environments.
    web_fetch_block_private_networks: bool = True
    # If non-empty, host must match an entry: exact host or wildcard "*.suffix".
    web_fetch_host_allowlist: list[str] = Field(default_factory=list)
    web_fetch_max_redirects: int = 8


class Settings(BaseSettings):
    """Top-level composed settings. Import this and inject it."""

    model_config = SettingsConfigDict(
        env_prefix="AGENT_PLATFORM_",
        env_nested_delimiter="__",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    deployment_name: str = "default"
    app_id_default: str = "default-app"  # used if a request doesn't specify
    data_dir: Path = Path("./data")
    skills_dir: Path = Path("./skills")

    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    workflow: WorkflowSettings = Field(default_factory=WorkflowSettings)
    llm: LLMProviderSettings = Field(default_factory=LLMProviderSettings)
    memory: MemorySettings = Field(default_factory=MemorySettings)
    auth: AuthSettings = Field(default_factory=AuthSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)
    server: ServerSettings = Field(default_factory=ServerSettings)
    tools: ToolSettings = Field(default_factory=ToolSettings)

    def ensure_directories(self) -> None:
        """Create local directories if missing. Safe to call repeatedly."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self.tools.fs_root.mkdir(parents=True, exist_ok=True)
