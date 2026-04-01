import type { AIRuntimeEvent } from "./runtime";

export const AI_OPERATION_STATUS = {
  "generate-notes": {
    start: "Generating notes with OpenAI...",
    cache: "Loaded a matching AI generation from local cache.",
    retry: (attempt: number, maxRetries: number) => `Generation hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
  },
  "revise-output": {
    start: "Revising the current output with OpenAI...",
    cache: "Loaded a matching revision from local cache.",
    retry: (attempt: number, maxRetries: number) => `Revision hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
  },
  "translate-output": {
    start: "Translating the current output with OpenAI...",
    cache: "Loaded a matching translation from local cache.",
    retry: (attempt: number, maxRetries: number) => `Translation hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
  },
  "transcribe-audio": {
    start: "Transcribing audio with OpenAI...",
    cache: "",
    retry: (attempt: number, maxRetries: number) => `Transcription hit a transient issue. Retrying ${attempt} of ${maxRetries}...`,
  },
} as const;

export const createAIRuntimeStatusHandler = ({
  setStatus,
  logEvent,
  onCacheHit,
}: {
  setStatus: (status: string) => void;
  logEvent: (event: AIRuntimeEvent) => void;
  onCacheHit?: () => void;
}) => (event: AIRuntimeEvent) => {
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