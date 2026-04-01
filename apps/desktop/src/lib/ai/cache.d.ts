import type { AIOperation } from "./client/openaiClient";
type AICacheableOperation = Extract<AIOperation, "revise-output" | "translate-output">;
export interface AITextCacheEntry {
    key: string;
    value: string;
    createdAt: number;
    expiresAt: number;
}
export declare const AI_TEXT_CACHE_TTL_MS: number;
export declare const AI_TEXT_CACHE_MAX_ENTRIES = 100;
export declare const clearAITextCache: () => void;
export declare const hydrateAITextCache: ({ records, now, }: {
    records: AITextCacheEntry[];
    now?: number;
}) => void;
export declare const configureAITextCachePersistence: ({ save, }: {
    save: (records: AITextCacheEntry[]) => Promise<void>;
}) => void;
export declare const snapshotAITextCache: ({ now }?: {
    now?: number;
}) => AITextCacheEntry[];
export declare const isAITextCacheableOperation: (operation: AIOperation) => operation is AICacheableOperation;
export declare const createAITextCacheKey: ({ operation, model, promptVersion, systemTexts, userText, }: {
    operation: AIOperation;
    model: string;
    promptVersion?: string;
    systemTexts: string[];
    userText: string;
}) => string;
export declare const getCachedAITextResponse: ({ key, now, }: {
    key: string;
    now?: number;
}) => string | null;
export declare const storeCachedAITextResponse: ({ key, value, now, }: {
    key: string;
    value: string;
    now?: number;
}) => void;
export {};
