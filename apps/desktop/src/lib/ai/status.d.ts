import type { AIRuntimeEvent } from "./runtime";
export declare const AI_OPERATION_STATUS: {
    readonly "generate-notes": {
        readonly start: "Generating notes with OpenAI...";
        readonly cache: "Loaded a matching AI generation from local cache.";
        readonly retry: (attempt: number, maxRetries: number) => string;
    };
    readonly "revise-output": {
        readonly start: "Revising the current output with OpenAI...";
        readonly cache: "Loaded a matching revision from local cache.";
        readonly retry: (attempt: number, maxRetries: number) => string;
    };
    readonly "translate-output": {
        readonly start: "Translating the current output with OpenAI...";
        readonly cache: "Loaded a matching translation from local cache.";
        readonly retry: (attempt: number, maxRetries: number) => string;
    };
    readonly "transcribe-audio": {
        readonly start: "Transcribing audio with OpenAI...";
        readonly cache: "";
        readonly retry: (attempt: number, maxRetries: number) => string;
    };
};
export declare const createAIRuntimeStatusHandler: ({ setStatus, logEvent, onCacheHit, }: {
    setStatus: (status: string) => void;
    logEvent: (event: AIRuntimeEvent) => void;
    onCacheHit?: () => void;
}) => (event: AIRuntimeEvent) => void;
