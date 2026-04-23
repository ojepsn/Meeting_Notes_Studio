export interface AgentPlatformSession {
    id: string;
    title?: string;
}
export interface AgentPlatformMessage {
    id: string;
    session_id: string;
}
export interface AgentPlatformSseEvent {
    event: string;
    data: Record<string, unknown>;
}
export interface RunAgentPlatformTurnOptions {
    baseUrl: string;
    sessionId: string;
    inputMessageId: string;
    goal?: string;
    onTextDelta?: (text: string) => void;
    onEvent?: (event: AgentPlatformSseEvent) => void;
}
export declare const createAgentPlatformSession: (baseUrl: string, title: string) => Promise<AgentPlatformSession>;
export declare const postAgentPlatformMessage: (baseUrl: string, sessionId: string, text: string) => Promise<AgentPlatformMessage>;
export declare const parseSseBlocks: (raw: string) => AgentPlatformSseEvent[];
export declare const runAgentPlatformTurn: ({ baseUrl, sessionId, inputMessageId, goal, onTextDelta, onEvent, }: RunAgentPlatformTurnOptions) => Promise<string>;
