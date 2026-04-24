const redactEnv = (env) => Object.fromEntries(Object.entries(env).map(([key, value]) => [
    key,
    /API_KEY|TOKEN|SECRET|PASSWORD/i.test(key) && value ? "[redacted]" : value,
]));
export const buildAgentPlatformLaunchConfig = ({ settings, agentDataDir, notesmithMcpCommand, notesmithMcpArgs = [], }) => {
    const env = {
        AGENT_PLATFORM_DEPLOYMENT_NAME: "notesmith-desktop",
        AGENT_PLATFORM_APP_ID_DEFAULT: "notesmith-desktop-assistant",
        AGENT_PLATFORM_DATA_DIR: agentDataDir,
        AGENT_PLATFORM_DATABASE__URL: `sqlite+aiosqlite:///${agentDataDir.replace(/\\/g, "/")}/agent_platform.db`,
        AGENT_PLATFORM_WORKFLOW__CHECKPOINT_DB_URL: `sqlite+aiosqlite:///${agentDataDir.replace(/\\/g, "/")}/checkpoints.db`,
        AGENT_PLATFORM_AUTH__ADAPTER: "local_single_user",
        AGENT_PLATFORM_LLM__OPENAI_ENABLED: "true",
        AGENT_PLATFORM_LLM__ANTHROPIC_ENABLED: "false",
        AGENT_PLATFORM_LLM__OPENROUTER_ENABLED: "false",
        AGENT_PLATFORM_LLM__OLLAMA_ENABLED: "true",
        AGENT_PLATFORM_LLM__ALLOWLIST: '["openai","ollama"]',
        AGENT_PLATFORM_MEMORY__BACKEND: "sqlite_fts",
        AGENT_PLATFORM_OBSERVABILITY__BACKEND: "null",
        AGENT_PLATFORM_SERVER__HOST: "127.0.0.1",
        AGENT_PLATFORM_SERVER__PORT: "0",
        AGENT_PLATFORM_TOOLS__ENABLED_BUILTINS: '["now_utc","parse_json","web_search"]',
    };
    if (settings.apiKey.trim()) {
        env.AGENT_PLATFORM_LLM__OPENAI_API_KEY = settings.apiKey.trim();
    }
    if (settings.textModel.trim()) {
        env.NOTESMITH_ASSISTANT_TEXT_MODEL = settings.textModel.trim();
    }
    return {
        env,
        redactedEnv: redactEnv(env),
        appId: "notesmith-desktop-assistant",
        expectedReadyEvent: "ready",
        transport: "local-sidecar-http-sse",
        notesmithMcp: notesmithMcpCommand ? { command: notesmithMcpCommand, args: notesmithMcpArgs } : undefined,
    };
};
export const getAgentPlatformStoragePolicy = () => ({
    owner: "NoteSmith stores the OpenAI key in local app settings.",
    runtime: "The sidecar receives the key only as AGENT_PLATFORM_LLM__OPENAI_API_KEY at launch.",
    persistence: "The key is not written to the agent_platform database, MCP payloads, Assistant logs, or backups.",
});
