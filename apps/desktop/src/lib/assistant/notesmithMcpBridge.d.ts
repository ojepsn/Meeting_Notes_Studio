import type { DesktopAppSnapshot } from "@notesmith/domain";
type JsonSchema = Record<string, unknown>;
export type NoteSmithMcpToolName = "notesmith_search_sessions" | "notesmith_get_session" | "notesmith_search_calendar" | "notesmith_search_todos" | "notesmith_search_activities" | "notesmith_search_timelogs" | "notesmith_get_linked_context" | "notesmith_summarize_workspace";
export interface NoteSmithMcpToolDescriptor {
    name: NoteSmithMcpToolName;
    description: string;
    inputSchema: JsonSchema;
    riskLevel: "low";
}
export declare const NOTESMITH_MCP_TOOLS: NoteSmithMcpToolDescriptor[];
export declare const invokeNoteSmithMcpTool: (snapshot: DesktopAppSnapshot, toolName: NoteSmithMcpToolName, args?: Record<string, unknown>) => {
    sources: import("./notesmithDataTools").NoteSmithAssistantSource[];
} | import("./notesmithDataTools").NoteSmithAssistantLinkedContext | {
    session: import("./notesmithDataTools").NoteSmithAssistantSource | null;
    linkedContext: import("./notesmithDataTools").NoteSmithAssistantLinkedContext;
    summary?: undefined;
} | {
    summary: import("./notesmithDataTools").NoteSmithAssistantSource;
    session?: undefined;
    linkedContext?: undefined;
};
export declare const listNoteSmithMcpTools: () => NoteSmithMcpToolDescriptor[];
export {};
