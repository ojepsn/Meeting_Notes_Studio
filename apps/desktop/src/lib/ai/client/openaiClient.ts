export type AIOperation = "generate-notes" | "revise-output" | "translate-output" | "transcribe-audio";

export type AIErrorCode =
  | "missing-api-key"
  | "network-error"
  | "timeout"
  | "rate-limited"
  | "upstream-error"
  | "invalid-response";

interface OpenAIRequestOptions {
  apiKey: string;
  body: Record<string, unknown>;
  operation: Exclude<AIOperation, "transcribe-audio">;
  timeoutMs?: number;
  maxRetries?: number;
  onRetry?: (event: { operation: AIOperation; attempt: number; maxRetries: number; delayMs: number; error: AIRequestError }) => void;
}

interface OpenAITranscriptionOptions {
  apiKey: string;
  formData: FormData;
  operation: "transcribe-audio";
  timeoutMs?: number;
  maxRetries?: number;
  onRetry?: (event: { operation: AIOperation; attempt: number; maxRetries: number; delayMs: number; error: AIRequestError }) => void;
}

interface OpenAIErrorPayload {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
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
  transcript?: string;
  alternatives?: Array<{
    text?: string;
    transcript?: string;
  }>;
  segments?: Array<{
    text?: string;
    alternatives?: Array<{
      text?: string;
      transcript?: string;
    }>;
  }>;
  results?: Array<{
    text?: string;
    transcript?: string;
    alternatives?: Array<{
      text?: string;
      transcript?: string;
    }>;
  }>;
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);

export class AIRequestError extends Error {
  readonly code: AIErrorCode;
  readonly operation: AIOperation;
  readonly retryable: boolean;
  readonly status?: number;

  constructor({
    message,
    code,
    operation,
    retryable,
    status,
    cause,
  }: {
    message: string;
    code: AIErrorCode;
    operation: AIOperation;
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "AIRequestError";
    this.code = code;
    this.operation = operation;
    this.retryable = retryable;
    this.status = status;
  }
}

const assertApiKey = (apiKey: string, operation: AIOperation) => {
  if (!apiKey.trim()) {
    throw new AIRequestError({
      message: "Add an OpenAI API key in desktop settings before using AI features.",
      code: "missing-api-key",
      operation,
      retryable: false,
    });
  }
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const getBackoffDelay = (attempt: number) => {
  const baseDelay = 400 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(4_000, baseDelay + jitter);
};

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

const normalizeUnexpectedError = (error: unknown, operation: AIOperation) => {
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

const parseUpstreamErrorMessage = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as OpenAIErrorPayload;
      return payload.error?.message?.trim() || `OpenAI returned status ${response.status}.`;
    } catch {
      return `OpenAI returned status ${response.status}.`;
    }
  }

  try {
    const text = (await response.text()).trim();
    return text || `OpenAI returned status ${response.status}.`;
  } catch {
    return `OpenAI returned status ${response.status}.`;
  }
};

const createHttpError = async ({
  response,
  operation,
  failurePrefix,
}: {
  response: Response;
  operation: AIOperation;
  failurePrefix: string;
}) => {
  const message = await parseUpstreamErrorMessage(response);
  const code: AIErrorCode = response.status === 429 ? "rate-limited" : "upstream-error";
  return new AIRequestError({
    message: `${failurePrefix}: ${message}`,
    code,
    operation,
    retryable: RETRYABLE_STATUS_CODES.has(response.status),
    status: response.status,
  });
};

const parseJsonResponse = async <T>(response: Response, operation: AIOperation) => {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new AIRequestError({
      message: "OpenAI returned an unreadable response. Please try again.",
      code: "invalid-response",
      operation,
      retryable: false,
      cause: error,
    });
  }
};

const performRequest = async <T>({
  url,
  init,
  operation,
  timeoutMs,
  maxRetries,
  failurePrefix,
  onRetry,
}: {
  url: string;
  init: RequestInit;
  operation: AIOperation;
  timeoutMs: number;
  maxRetries: number;
  failurePrefix: string;
  onRetry?: (event: { operation: AIOperation; attempt: number; maxRetries: number; delayMs: number; error: AIRequestError }) => void;
}) => {
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

      return await parseJsonResponse<T>(response, operation);
    } catch (error) {
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
    } finally {
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

export const extractResponseText = (response: OpenAITextResponse) => {
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

  const directText = response.text?.trim() || response.transcript?.trim();
  if (directText) {
    return directText;
  }

  const alternativeText = response.alternatives
    ?.flatMap((alternative) => [alternative.text?.trim() || "", alternative.transcript?.trim() || ""])
    .filter(Boolean)
    .join("\n")
    .trim();
  if (alternativeText) {
    return alternativeText;
  }

  const segmentText = response.segments
    ?.flatMap((segment) => {
      const direct = segment.text?.trim() || "";
      const alternatives =
        segment.alternatives
          ?.flatMap((alternative) => [alternative.text?.trim() || "", alternative.transcript?.trim() || ""])
          .filter(Boolean) || [];
      return [direct, ...alternatives].filter(Boolean);
    })
    .filter(Boolean)
    .join("\n")
    .trim();
  if (segmentText) {
    return segmentText;
  }

  const resultText = response.results
    ?.flatMap((result) => {
      const direct = [result.text?.trim() || "", result.transcript?.trim() || ""].filter(Boolean);
      const alternatives =
        result.alternatives
          ?.flatMap((alternative) => [alternative.text?.trim() || "", alternative.transcript?.trim() || ""])
          .filter(Boolean) || [];
      return [...direct, ...alternatives];
    })
    .join("\n")
    .trim();
  if (resultText) {
    return resultText;
  }

  return "";
};

export const callResponsesApi = async ({
  apiKey,
  body,
  operation,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  onRetry,
}: OpenAIRequestOptions) => {
  assertApiKey(apiKey, operation);
  const payload = await performRequest<OpenAITextResponse>({
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

  if (payload.status === "incomplete") {
    const reason = payload.incomplete_details?.reason;
    throw new AIRequestError({
      message: `OpenAI returned an incomplete response${reason ? ` (${reason})` : ""}. No output was saved. Please try again or choose a stronger model in Settings.`,
      code: "invalid-response",
      operation,
      retryable: false,
    });
  }

  return payload;
};

export const callTranscriptionsApi = async ({
  apiKey,
  formData,
  operation,
  timeoutMs = DEFAULT_TRANSCRIPTION_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  onRetry,
}: OpenAITranscriptionOptions) => {
  assertApiKey(apiKey, operation);
  return performRequest<OpenAITextResponse>({
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
