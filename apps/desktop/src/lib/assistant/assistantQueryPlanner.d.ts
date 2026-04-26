import type { AssistantQueryMemoryRecord } from "@notesmith/domain";
export type AssistantRoute = "timelogs" | "sessions" | "calendar" | "todos" | "activities" | "workspace" | "unknown";
export interface AssistantDateRange {
    fromDate: string;
    toDate: string;
    label: string;
}
export interface AssistantQueryPlan {
    route: AssistantRoute;
    fingerprint: string;
    matchedMemory: AssistantQueryMemoryRecord | null;
    dateRange: AssistantDateRange | null;
    shouldClarify: boolean;
    clarificationQuestion: string | null;
    guidance: string;
}
export declare const createAssistantQueryFingerprint: (query: string) => string;
export declare const inferClarificationRoute: (answer: string) => AssistantRoute;
export declare const resolveAssistantDateRange: (query: string, now?: Date) => AssistantDateRange | null;
export declare const planAssistantQuery: (query: string, memories: AssistantQueryMemoryRecord[], now?: Date) => AssistantQueryPlan;
