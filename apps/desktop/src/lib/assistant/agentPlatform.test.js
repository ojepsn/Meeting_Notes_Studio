import { describe, expect, it } from "vitest";
import { buildAgentPlatformLaunchConfig, getAgentPlatformStoragePolicy } from "./agentPlatform";
const settings = {
    apiKey: "sk-test-secret",
    textModel: "gpt-5.4-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
};
describe("agentPlatform", () => {
    it("passes the NoteSmith-owned OpenAI key only through launch environment", () => {
        const config = buildAgentPlatformLaunchConfig({
            settings,
            agentDataDir: "C:/Users/Ola/AppData/Local/NoteSmith/agent",
            notesmithMcpCommand: "notesmith-mcp",
            notesmithMcpArgs: ["--stdio"],
        });
        expect(config.env.AGENT_PLATFORM_LLM__OPENAI_API_KEY).toBe("sk-test-secret");
        expect(config.redactedEnv.AGENT_PLATFORM_LLM__OPENAI_API_KEY).toBe("[redacted]");
        expect(config.env.AGENT_PLATFORM_TOOLS__ENABLED_BUILTINS).toContain('"web_search"');
        expect(config.notesmithMcp).toEqual({ command: "notesmith-mcp", args: ["--stdio"] });
        expect(config.transport).toBe("local-sidecar-http-sse");
    });
    it("documents that agent_platform does not own API key persistence", () => {
        const policy = getAgentPlatformStoragePolicy();
        expect(policy.owner).toContain("NoteSmith stores");
        expect(policy.persistence).toContain("not written");
    });
});
