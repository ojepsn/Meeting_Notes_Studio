import type { LocalAppSettings } from "@notesmith/domain";
import { AIRequestError, type AIOperation } from "./client/openaiClient";
type AITextOperation = Exclude<AIOperation, "transcribe-audio">;
export type AIRuntimeEvent = {
    type: "request-start";
    operation: AIOperation;
    requestId: string;
    promptVersion?: string;
} | {
    type: "request-success";
    operation: AIOperation;
    requestId: string;
    durationMs: number;
    promptVersion?: string;
} | {
    type: "request-failure";
    operation: AIOperation;
    requestId: string;
    durationMs: number;
    promptVersion?: string;
    error: unknown;
} | {
    type: "request-retry";
    operation: AIOperation;
    requestId: string;
    promptVersion?: string;
    attempt: number;
    maxRetries: number;
    delayMs: number;
    error: AIRequestError;
} | {
    type: "cache-hit";
    operation: AIOperation;
    requestId: string;
    promptVersion?: string;
};
interface BaseAIExecutionOptions {
    settings: LocalAppSettings;
    promptVersion?: string;
    timeoutMs?: number;
    maxRetries?: number;
    onEvent?: (event: AIRuntimeEvent) => void;
}
interface AITextExecutionOptions extends BaseAIExecutionOptions {
    operation: AITextOperation;
    systemTexts: string[];
    userText: string;
    cacheMode?: "default" | "bypass";
}
interface AITranscriptionExecutionOptions extends BaseAIExecutionOptions {
    operation: "transcribe-audio";
    formData: FormData;
}
export declare const executeAITextOperation: ({ settings, operation, systemTexts, userText, promptVersion, timeoutMs, maxRetries, onEvent, cacheMode, }: AITextExecutionOptions) => Promise<string>;
export declare const executeAITranscriptionOperation: ({ settings, operation, formData, promptVersion, timeoutMs, maxRetries, onEvent, }: AITranscriptionExecutionOptions) => Promise<string>;
export {};
