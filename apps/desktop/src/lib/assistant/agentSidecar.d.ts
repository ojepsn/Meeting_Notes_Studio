export interface AgentSidecarReady {
    host: string;
    port: number;
    baseUrl: string;
}
export interface AgentSidecarHealth {
    ok: boolean;
    status?: number;
}
export declare const startAgentSidecar: (env: Record<string, string>) => Promise<AgentSidecarReady>;
export declare const stopAgentSidecar: () => Promise<void>;
export declare const getAgentSidecarStatus: () => Promise<AgentSidecarReady | null>;
export declare const checkAgentSidecarHealth: (baseUrl: string) => Promise<AgentSidecarHealth>;
