# agent-platform

A reusable Python agent kernel designed to power multiple apps without being
rewritten each time.

**Design goals, in order:**

1. **Extractable** — the kernel has no infrastructure dependencies. You can `pip install` it into a new app and plug in a different transport/database/LLM/memory backend without touching kernel code.
2. **Multi-provider** — users pick their LLM (Anthropic, OpenAI, OpenRouter, Ollama, any OpenAI-compatible endpoint). No lock-in.
3. **Air-gap-friendly** — runs fully offline with SQLite + local LLM (Ollama)
   + SQLite-FTS5 memory + null observability. Important for regulated or
   disconnected environments.
4. **Workspace-scoped from day one** — memory, skills, runs, personas all carry `workspace_id`, so team apps don't require a migration later.
5. **MCP-first tools** — the tool layer speaks Model Context Protocol natively. Tools written for this platform work inside Claude Code, Cursor, and any other MCP-aware host.
6. **Skills are portable** — agentskills.io / Claude Skills markdown+YAML format. Drop-in compatible.

## Architecture

See `docs/architecture.md` and the ADRs in `docs/adrs/`.

Short version: `kernel/` is pure, `adapters/` contains every concrete dependency, `apps/` provides three entrypoints (`agent-server`, `agent-sidecar`, `agent-cli`).

The most important architectural choice — putting LangGraph behind a `WorkflowEnginePort` — is documented in [ADR 0001](docs/adrs/0001-langgraph-behind-port.md).

The core also now includes a first built-in tool set wired through the shared
`ToolRegistry`: scoped filesystem tools (`list_directory`, `read_file`,
`write_file`) plus opt-in web tools (`web_fetch`, `web_search`). Those same
tools can now also be exposed outward through the `agent-mcp-server`
entrypoint for MCP-aware hosts.

The core also now includes a first personalization loop: completed runs can
extract explicit user preferences into private memory and apply them in later
runs. Strict-professional personas can suppress learned style/tone preferences
while still keeping factual user preferences available.

## Quick start

Requires Python 3.11+.

```bash
# Install in editable mode with the extras you need
pip install -e ".[langgraph,anthropic,mcp,dev]"

# First-run smoke test
agent-cli doctor

# Interactive chat
ANTHROPIC_API_KEY=... agent-cli chat

# Start the HTTP API (for Next.js/React clients)
agent-server
# -> http://127.0.0.1:8088/healthz

# Start as a Tauri sidecar (local-only, binds to 127.0.0.1)
agent-sidecar
```

Database schema is now managed by Alembic. App entrypoints upgrade to
`head` on startup, and you can also run migrations manually with:

```bash
alembic upgrade head
```

Core verification now includes contract-style adapter checks and run lifecycle
coverage:

```bash
pytest tests/test_contracts.py tests/test_run_lifecycle.py tests/test_smoke.py
```

Personalization coverage is included here:

```bash
pytest tests/test_personalization.py tests/test_run_lifecycle.py tests/test_smoke.py
```

TypeScript SDK verification is now part of the repo as well:

```bash
pytest tests/test_typescript_sdk.py
```

## Configuration

All configuration flows through `Settings` (`kernel/bootstrap/config.py`), sourced from environment variables or `.env`. Prefix: `AGENT_PLATFORM_`.

Common variables:

```bash
AGENT_PLATFORM_DEPLOYMENT_NAME=personal-ola
AGENT_PLATFORM_DATABASE__URL=sqlite+aiosqlite:///./data/app.db
AGENT_PLATFORM_WORKFLOW__ENGINE=langgraph
AGENT_PLATFORM_MEMORY__BACKEND=sqlite_fts
AGENT_PLATFORM_AUTH__ADAPTER=local_single_user
AGENT_PLATFORM_LLM__ANTHROPIC_API_KEY=sk-ant-...
AGENT_PLATFORM_LLM__OPENROUTER_API_KEY=sk-or-...
AGENT_PLATFORM_LLM__OLLAMA_BASE_URL=http://localhost:11434
AGENT_PLATFORM_OBSERVABILITY__BACKEND=langfuse
AGENT_PLATFORM_OBSERVABILITY__LANGFUSE_HOST=https://langfuse.example
```

Example `.env.airgapped`:

```bash
AGENT_PLATFORM_DEPLOYMENT_NAME=airgapped-deployment
AGENT_PLATFORM_DATABASE__URL=postgresql+asyncpg://agent:...@db/app
AGENT_PLATFORM_AUTH__ADAPTER=msal
AGENT_PLATFORM_AUTH__MSAL_TENANT_ID=...
AGENT_PLATFORM_LLM__ANTHROPIC_ENABLED=false
AGENT_PLATFORM_LLM__OPENAI_ENABLED=false
AGENT_PLATFORM_LLM__OPENROUTER_ENABLED=false
AGENT_PLATFORM_LLM__OLLAMA_ENABLED=true
AGENT_PLATFORM_LLM__OLLAMA_BASE_URL=http://llm-internal:11434
AGENT_PLATFORM_LLM__ALLOWLIST=["ollama"]
AGENT_PLATFORM_OBSERVABILITY__BACKEND=null
```

The `LLM__ALLOWLIST` setting is a hard wall: even if cloud provider credentials leak into the process, those providers stay disabled.

## Directory layout

```
agent_platform/
├── src/agent_platform/
│   ├── kernel/              # reusable core — no infra deps
│   │   ├── domain/          # entities, value objects, events
│   │   ├── ports/           # protocols adapters must satisfy
│   │   ├── application/     # use-case services
│   │   ├── runtime/         # prompt assembly, safety (pure)
│   │   └── bootstrap/       # Settings + DI container
│   ├── adapters/            # concrete implementations
│   │   ├── workflow/        # LangGraph adapter (the centerpiece)
│   │   ├── llm/             # Anthropic, OpenAI, OpenRouter, Ollama
│   │   ├── memory/          # SQLite-FTS; Letta/Mem0/Zep stubs
│   │   ├── storage/         # SQLAlchemy repositories
│   │   ├── mcp/             # MCP client + MCP server exposure
│   │   ├── tools/           # built-in ToolPort implementations
│   │   ├── skills/          # agentskills.io loader
│   │   ├── auth/            # local_single_user; MSAL stub
│   │   ├── api/             # FastAPI + SSE
│   │   └── observability/   # null default; langfuse optional backend
│   └── apps/                # entrypoints
│       ├── server.py        # hosted / on-prem HTTP server
│       ├── sidecar.py       # Tauri-friendly local-only server
│       └── cli.py           # developer console
├── docs/
│   ├── architecture.md
│   └── adrs/                # why-we-did-it records
├── skills_examples/         # sample agentskills.io files
├── tests/
└── pyproject.toml
```

## Writing a new adapter

Implement the port, register in the container:

```python
# adapters/memory/my_custom_memory.py
from agent_platform.kernel.ports import MemoryPort

class MyCustomMemory(MemoryPort):
    async def write(self, item): ...
    async def retrieve(self, ...): ...
    # ...
```

Then in `kernel/bootstrap/container.py`, add a branch in `_build_memory`:

```python
if backend == "my_custom":
    from agent_platform.adapters.memory.my_custom_memory import MyCustomMemory
    return MyCustomMemory(**settings.memory.extra)
```

That's it. No kernel change.

## Writing a new app

For most apps, you don't write Python at all — you just consume the HTTP/SSE API from your React/Next.js/Tauri client. The API surface is:

- `POST /api/sessions` — create a conversation
- `POST /api/sessions/{id}/messages` — post a user message
- `POST /api/sessions/{id}/runs/stream` — start a run, SSE stream of events
- `GET /api/memory?q=...` — search memory
- `GET /api/approvals` — pending approval requests
- `POST /api/approvals/{id}/decide/stream` — approve or reject, resume run

For a local desktop app, spawn `agent-sidecar` as a child process, read the
JSON readiness line from stdout to discover the port, then point your frontend
at `http://127.0.0.1:<port>`.

A generated TypeScript SDK now lives in `sdk/typescript`. To regenerate and
build it:

```bash
cd sdk/typescript
npm ci
npm run check
```

For internal distribution to another app, the primary supported path is now a
tarball package:

```bash
cd sdk/typescript
npm run release:tarball
```

That produces a `.tgz` file that another app can install directly with
`npm install ../path/to/agent-platform-sdk-typescript-<version>.tgz`. The full
step-by-step integration guide lives in `docs/implementing-an-agent-app.html`.

## What's not here yet (v0.1)

- MSAL auth adapter (stub only — fill in when the team app needs it)
- Letta / Mem0 / Zep memory adapters (stubs; SQLite-FTS works today)
- Skill drafting from runs (data model ready; flow TBD)

See `docs/architecture.md` for the full out-of-scope list.

## License

Proprietary. All rights reserved.
