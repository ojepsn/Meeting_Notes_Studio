import type { LocalAppSettings } from "@notesmith/domain";
import { createAITextCacheKey, getCachedAITextResponse, isAITextCacheableOperation, storeCachedAITextResponse } from "./cache";
import {
  AIRequestError,
  type AIOperation,
  callResponsesApi,
  callTranscriptionsApi,
  extractResponseText,
} from "./client/openaiClient";
import { recordAIRuntimeMetric } from "./metrics";

type AITextOperation = Exclude<AIOperation, "transcribe-audio">;

export type AIRuntimeEvent =
  | {
      type: "request-start";
      operation: AIOperation;
      requestId: string;
      promptVersion?: string;
    }
  | {
      type: "request-success";
      operation: AIOperation;
      requestId: string;
      durationMs: number;
      promptVersion?: string;
    }
  | {
      type: "request-failure";
      operation: AIOperation;
      requestId: string;
      durationMs: number;
      promptVersion?: string;
      error: unknown;
    }
  | {
      type: "request-retry";
      operation: AIOperation;
      requestId: string;
      promptVersion?: string;
      attempt: number;
      maxRetries: number;
      delayMs: number;
      error: AIRequestError;
    }
  | {
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

const createRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const emitEvent = (event: AIRuntimeEvent, onEvent?: (event: AIRuntimeEvent) => void) => {
  recordAIRuntimeMetric(event);
  onEvent?.(event);
};

const ensureResponseText = ({
  text,
  operation,
}: {
  text: string;
  operation: AIOperation;
}) => {
  if (text.trim()) {
    return text.trim();
  }

  throw new AIRequestError({
    message: "OpenAI returned a response without readable text.",
    code: "invalid-response",
    operation,
    retryable: false,
  });
};

export const executeAITextOperation = async ({
  settings,
  operation,
  systemTexts,
  userText,
  promptVersion,
  timeoutMs,
  maxRetries,
  onEvent,
  cacheMode = "default",
}: AITextExecutionOptions) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const cacheKey =
    cacheMode === "default" && isAITextCacheableOperation(operation)
      ? createAITextCacheKey({
          operation,
          model: settings.textModel,
          promptVersion,
          systemTexts,
          userText,
        })
      : null;

  emitEvent({ type: "request-start", operation, requestId, promptVersion }, onEvent);

  if (cacheKey) {
    const cachedValue = getCachedAITextResponse({ key: cacheKey });
    if (cachedValue) {
      emitEvent({ type: "cache-hit", operation, requestId, promptVersion }, onEvent);
      emitEvent(
        {
          type: "request-success",
          operation,
          requestId,
          durationMs: Date.now() - startedAt,
          promptVersion,
        },
        onEvent,
      );
      return cachedValue;
    }
  }

  try {
    const response = await callResponsesApi({
      apiKey: settings.apiKey,
      operation,
      timeoutMs,
      maxRetries,
      onRetry: ({ attempt, maxRetries: retryLimit, delayMs, error }) =>
        emitEvent(
          {
            type: "request-retry",
            operation,
            requestId,
            promptVersion,
            attempt,
            maxRetries: retryLimit,
            delayMs,
            error,
          },
          onEvent,
        ),
      body: {
        model: settings.textModel,
        input: [
          {
            role: "system",
            content: systemTexts
              .map((text) => text.trim())
              .filter(Boolean)
              .map((text) => ({ type: "input_text", text })),
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userText }],
          },
        ],
      },
    });

    const text = ensureResponseText({ text: extractResponseText(response), operation });
    if (cacheKey) {
      storeCachedAITextResponse({ key: cacheKey, value: text });
    }
    emitEvent(
      {
        type: "request-success",
        operation,
        requestId,
        durationMs: Date.now() - startedAt,
        promptVersion,
      },
      onEvent,
    );
    return text;
  } catch (error) {
    emitEvent(
      {
        type: "request-failure",
        operation,
        requestId,
        durationMs: Date.now() - startedAt,
        promptVersion,
        error,
      },
      onEvent,
    );
    throw error;
  }
};

export const executeAITranscriptionOperation = async ({
  settings,
  operation,
  formData,
  promptVersion,
  timeoutMs,
  maxRetries,
  onEvent,
}: AITranscriptionExecutionOptions) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  emitEvent({ type: "request-start", operation, requestId, promptVersion }, onEvent);

  try {
    const response = await callTranscriptionsApi({
      apiKey: settings.apiKey,
      formData,
      operation,
      timeoutMs,
      maxRetries,
      onRetry: ({ attempt, maxRetries: retryLimit, delayMs, error }) =>
        emitEvent(
          {
            type: "request-retry",
            operation,
            requestId,
            promptVersion,
            attempt,
            maxRetries: retryLimit,
            delayMs,
            error,
          },
          onEvent,
        ),
    });
    const text = ensureResponseText({ text: extractResponseText(response), operation });
    emitEvent(
      {
        type: "request-success",
        operation,
        requestId,
        durationMs: Date.now() - startedAt,
        promptVersion,
      },
      onEvent,
    );
    return text;
  } catch (error) {
    emitEvent(
      {
        type: "request-failure",
        operation,
        requestId,
        durationMs: Date.now() - startedAt,
        promptVersion,
        error,
      },
      onEvent,
    );
    throw error;
  }
};