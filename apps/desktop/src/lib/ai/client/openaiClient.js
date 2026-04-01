const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
export class AIRequestError extends Error {
    code;
    operation;
    retryable;
    status;
    constructor({ message, code, operation, retryable, status, cause, }) {
        super(message, { cause });
        this.name = "AIRequestError";
        this.code = code;
        this.operation = operation;
        this.retryable = retryable;
        this.status = status;
    }
}
const assertApiKey = (apiKey, operation) => {
    if (!apiKey.trim()) {
        throw new AIRequestError({
            message: "Add an OpenAI API key in desktop settings before using AI features.",
            code: "missing-api-key",
            operation,
            retryable: false,
        });
    }
};
const delay = (ms) => new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
});
const getBackoffDelay = (attempt) => {
    const baseDelay = 400 * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(4_000, baseDelay + jitter);
};
const isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
const normalizeUnexpectedError = (error, operation) => {
    if (error instanceof AIRequestError) {
        return error;
    }
    if (isAbortError(error)) {
        return new AIRequestError({
            message: "The AI request timed out. Please try again.",
            code: "timeout",
            operation,
            retryable: true,
            cause: error,
        });
    }
    return new AIRequestError({
        message: "The AI request could not reach OpenAI. Check your network connection and try again.",
        code: "network-error",
        operation,
        retryable: true,
        cause: error,
    });
};
const parseUpstreamErrorMessage = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        try {
            const payload = (await response.json());
            return payload.error?.message?.trim() || `OpenAI returned status ${response.status}.`;
        }
        catch {
            return `OpenAI returned status ${response.status}.`;
        }
    }
    try {
        const text = (await response.text()).trim();
        return text || `OpenAI returned status ${response.status}.`;
    }
    catch {
        return `OpenAI returned status ${response.status}.`;
    }
};
const createHttpError = async ({ response, operation, failurePrefix, }) => {
    const message = await parseUpstreamErrorMessage(response);
    const code = response.status === 429 ? "rate-limited" : "upstream-error";
    return new AIRequestError({
        message: `${failurePrefix}: ${message}`,
        code,
        operation,
        retryable: RETRYABLE_STATUS_CODES.has(response.status),
        status: response.status,
    });
};
const parseJsonResponse = async (response, operation) => {
    try {
        return (await response.json());
    }
    catch (error) {
        throw new AIRequestError({
            message: "OpenAI returned an unreadable response. Please try again.",
            code: "invalid-response",
            operation,
            retryable: false,
            cause: error,
        });
    }
};
const performRequest = async ({ url, init, operation, timeoutMs, maxRetries, failurePrefix, onRetry, }) => {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
            });
            if (!response.ok) {
                throw await createHttpError({ response, operation, failurePrefix });
            }
            return await parseJsonResponse(response, operation);
        }
        catch (error) {
            const normalizedError = normalizeUnexpectedError(error, operation);
            if (attempt >= maxRetries || !normalizedError.retryable) {
                throw normalizedError;
            }
            const delayMs = getBackoffDelay(attempt);
            onRetry?.({
                operation,
                attempt: attempt + 1,
                maxRetries,
                delayMs,
                error: normalizedError,
            });
            await delay(delayMs);
        }
        finally {
            globalThis.clearTimeout(timeoutId);
        }
    }
    throw new AIRequestError({
        message: `${failurePrefix}: request failed after retries.`,
        code: "upstream-error",
        operation,
        retryable: false,
    });
};
export const extractResponseText = (response) => {
    const outputText = response.output_text?.trim();
    if (outputText) {
        return outputText;
    }
    const nestedText = response.output
        ?.flatMap((item) => item.content || [])
        .map((contentItem) => contentItem.text?.trim() || "")
        .filter(Boolean)
        .join("\n")
        .trim();
    if (nestedText) {
        return nestedText;
    }
    return response.text?.trim() || "";
};
export const callResponsesApi = async ({ apiKey, body, operation, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, onRetry, }) => {
    assertApiKey(apiKey, operation);
    return performRequest({
        url: OPENAI_RESPONSES_URL,
        init: {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        },
        operation,
        timeoutMs,
        maxRetries,
        failurePrefix: "OpenAI request failed",
        onRetry,
    });
};
export const callTranscriptionsApi = async ({ apiKey, formData, operation, timeoutMs = DEFAULT_TRANSCRIPTION_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, onRetry, }) => {
    assertApiKey(apiKey, operation);
    return performRequest({
        url: OPENAI_TRANSCRIPTIONS_URL,
        init: {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
        },
        operation,
        timeoutMs,
        maxRetries,
        failurePrefix: "Audio transcription failed",
        onRetry,
    });
};
