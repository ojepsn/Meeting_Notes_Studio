import { createAITextCacheKey, getCachedAITextResponse, isAITextCacheableOperation, storeCachedAITextResponse } from "./cache";
import { AIRequestError, callResponsesApi, callTranscriptionsApi, extractResponseText, } from "./client/openaiClient";
import { recordAIRuntimeMetric } from "./metrics";
const createRequestId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
const emitEvent = (event, onEvent) => {
    recordAIRuntimeMetric(event);
    onEvent?.(event);
};
const ensureResponseText = ({ text, operation, }) => {
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
export const executeAITextOperation = async ({ settings, operation, systemTexts, userText, promptVersion, timeoutMs, maxRetries, onEvent, cacheMode = "default", maxOutputTokens, }) => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    const cacheKey = cacheMode === "default" && isAITextCacheableOperation(operation)
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
            emitEvent({
                type: "request-success",
                operation,
                requestId,
                durationMs: Date.now() - startedAt,
                promptVersion,
            }, onEvent);
            return cachedValue;
        }
    }
    try {
        const response = await callResponsesApi({
            apiKey: settings.apiKey,
            operation,
            timeoutMs,
            maxRetries,
            onRetry: ({ attempt, maxRetries: retryLimit, delayMs, error }) => emitEvent({
                type: "request-retry",
                operation,
                requestId,
                promptVersion,
                attempt,
                maxRetries: retryLimit,
                delayMs,
                error,
            }, onEvent),
            body: {
                model: settings.textModel,
                ...(typeof maxOutputTokens === "number" && maxOutputTokens > 0
                    ? { max_output_tokens: Math.round(maxOutputTokens) }
                    : {}),
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
        emitEvent({
            type: "request-success",
            operation,
            requestId,
            durationMs: Date.now() - startedAt,
            promptVersion,
        }, onEvent);
        return text;
    }
    catch (error) {
        emitEvent({
            type: "request-failure",
            operation,
            requestId,
            durationMs: Date.now() - startedAt,
            promptVersion,
            error,
        }, onEvent);
        throw error;
    }
};
export const executeAITranscriptionOperation = async ({ settings, operation, formData, promptVersion, timeoutMs, maxRetries, onEvent, }) => {
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
            onRetry: ({ attempt, maxRetries: retryLimit, delayMs, error }) => emitEvent({
                type: "request-retry",
                operation,
                requestId,
                promptVersion,
                attempt,
                maxRetries: retryLimit,
                delayMs,
                error,
            }, onEvent),
        });
        const text = ensureResponseText({ text: extractResponseText(response), operation });
        emitEvent({
            type: "request-success",
            operation,
            requestId,
            durationMs: Date.now() - startedAt,
            promptVersion,
        }, onEvent);
        return text;
    }
    catch (error) {
        emitEvent({
            type: "request-failure",
            operation,
            requestId,
            durationMs: Date.now() - startedAt,
            promptVersion,
            error,
        }, onEvent);
        throw error;
    }
};
