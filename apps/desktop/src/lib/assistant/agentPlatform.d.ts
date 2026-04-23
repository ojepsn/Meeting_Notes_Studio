import type { LocalAppSettings } from "@notesmith/domain";
export interface AgentPlatformLaunchConfig {
    env: Record<string, string>;
    redactedEnv: Record<string, string>;
    appId: string;
    expectedReadyEvent: "ready";
    transport: "local-sidecar-http-sse";
    notesmithMcp?: {
        command: string;
        args: string[];
    };
}
export declare const buildAgentPlatformLaunchConfig: ({ settings, agentDataDir, notesmithMcpCommand, notesmithMcpArgs, }: {
    settings: LocalAppSettings;
    agentDataDir: string;
    notesmithMcpCommand?: string;
    notesmithMcpArgs?: string[];
}) => AgentPlatformLaunchConfig;
export declare const getAgentPlatformStoragePolicy: () => {
    owner: string;
    runtime: string;
    persistence: string;
};
