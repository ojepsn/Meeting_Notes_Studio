import type { AIErrorCode, AIOperation } from "./client/openaiClient";
import type { AIRuntimeEvent } from "./runtime";
export interface AIRequestHistoryEntry {
    requestId: string;
    operation: AIOperation;
    promptVersion?: string;
    status: "success" | "failure";
    cached: boolean;
    retryCount: number;
    durationMs: number;
    timestamp: number;
    errorCode?: AIErrorCode;
    errorMessage?: string;
}
export declare const AI_REQUEST_HISTORY_MAX_ENTRIES = 40;
export declare const resetAIRequestHistory: () => void;
export declare const hydrateAIRequestHistory: (entries: AIRequestHistoryEntry[]) => void;
export declare const configureAIRequestHistoryPersistence: ({ save, }: {
    save: (records: AIRequestHistoryEntry[]) => Promise<void>;
}) => void;
export declare const getAIRequestHistory: () => AIRequestHistoryEntry[];
export declare const recordAIRequestHistory: (event: AIRuntimeEvent) => void;
