export type AIOperation = "generate-notes" | "revise-output" | "translate-output" | "transcribe-audio";
export type AIErrorCode = "missing-api-key" | "network-error" | "timeout" | "rate-limited" | "upstream-error" | "invalid-response";
interface OpenAIRequestOptions {
    apiKey: string;
    body: Record<string, unknown>;
    operation: Exclude<AIOperation, "transcribe-audio">;
    timeoutMs?: number;
    maxRetries?: number;
    onRetry?: (event: {
        operation: AIOperation;
        attempt: number;
        maxRetries: number;
        delayMs: number;
        error: AIRequestError;
    }) => void;
}
interface OpenAITranscriptionOptions {
    apiKey: string;
    formData: FormData;
    operation: "transcribe-audio";
    timeoutMs?: number;
    maxRetries?: number;
    onRetry?: (event: {
        operation: AIOperation;
        attempt: number;
        maxRetries: number;
        delayMs: number;
        error: AIRequestError;
    }) => void;
}
interface OpenAITextResponse {
    output_text?: string;
    output?: Array<{
        content?: Array<{
            text?: string;
            type?: string;
        }>;
    }>;
    text?: string;
}
export declare class AIRequestError extends Error {
    readonly code: AIErrorCode;
    readonly operation: AIOperation;
    readonly retryable: boolean;
    readonly status?: number;
    constructor({ message, code, operation, retryable, status, cause, }: {
        message: string;
        code: AIErrorCode;
        operation: AIOperation;
        retryable: boolean;
        status?: number;
        cause?: unknown;
    });
}
export declare const extractResponseText: (response: OpenAITextResponse) => string;
export declare const callResponsesApi: ({ apiKey, body, operation, timeoutMs, maxRetries, onRetry, }: OpenAIRequestOptions) => Promise<OpenAITextResponse>;
export declare const callTranscriptionsApi: ({ apiKey, formData, operation, timeoutMs, maxRetries, onRetry, }: OpenAITranscriptionOptions) => Promise<OpenAITextResponse>;
export {};
