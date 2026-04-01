export const AI_OPERATION_STATUS = {
    "generate-notes": {
        start: "Generating notes with OpenAI...",
        cache: "Loaded a matching AI generation from local cache.",
        retry: (attempt, maxRetries) => `Generation hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
    },
    "revise-output": {
        start: "Revising the current output with OpenAI...",
        cache: "Loaded a matching revision from local cache.",
        retry: (attempt, maxRetries) => `Revision hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
    },
    "translate-output": {
        start: "Translating the current output with OpenAI...",
        cache: "Loaded a matching translation from local cache.",
        retry: (attempt, maxRetries) => `Translation hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
    },
    "transcribe-audio": {
        start: "Transcribing audio with OpenAI...",
        cache: "",
        retry: (attempt, maxRetries) => `Transcription hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
    },
};
export const createAIRuntimeStatusHandler = ({ setStatus, logEvent, onCacheHit, }) => (event) => {
    logEvent(event);
    const statusConfig = AI_OPERATION_STATUS[event.operation];
    switch (event.type) {
        case "request-start":
            setStatus(statusConfig.start);
            break;
        case "request-retry":
            setStatus(statusConfig.retry(event.attempt, event.maxRetries));
            break;
        case "cache-hit":
            onCacheHit?.();
            if (statusConfig.cache) {
                setStatus(statusConfig.cache);
            }
            break;
        default:
            break;
    }
};
