import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIRequestError } from "./client/openaiClient";
import {
  configureAIRequestHistoryPersistence,
  getAIRequestHistory,
  hydrateAIRequestHistory,
  recordAIRequestHistory,
  resetAIRequestHistory,
} from "./history";
import type { AIRuntimeEvent } from "./runtime";

describe("ai request history", () => {
  beforeEach(() => {
    resetAIRequestHistory();
    configureAIRequestHistoryPersistence({
      save: async () => {},
    });
    vi.restoreAllMocks();
  });

  it("records successful requests with retries and cache-hit state", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);

    const events: AIRuntimeEvent[] = [
      { type: "request-start", operation: "translate-output", requestId: "req-1", promptVersion: "v1" },
      {
        type: "request-retry",
        operation: "translate-output",
        requestId: "req-1",
        promptVersion: "v1",
        attempt: 1,
        maxRetries: 2,
        delayMs: 400,
        error: new AIRequestError({
          message: "Slow",
          code: "timeout",
          operation: "translate-output",
          retryable: true,
        }),
      },
      { type: "cache-hit", operation: "translate-output", requestId: "req-1", promptVersion: "v1" },
      { type: "request-success", operation: "translate-output", requestId: "req-1", promptVersion: "v1", durationMs: 120 },
    ];

    events.forEach(recordAIRequestHistory);

    expect(getAIRequestHistory()).toEqual([
      {
        requestId: "req-1",
        operation: "translate-output",
        promptVersion: "v1",
        status: "success",
        cached: true,
        retryCount: 1,
        durationMs: 120,
        timestamp: 10_000,
      },
    ]);
  });

  it("records failures and hydrates persisted entries", () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    recordAIRequestHistory({ type: "request-start", operation: "generate-notes", requestId: "req-2", promptVersion: "v2" });
    recordAIRequestHistory({
      type: "request-failure",
      operation: "generate-notes",
      requestId: "req-2",
      promptVersion: "v2",
      durationMs: 80,
      error: new AIRequestError({
        message: "Too many requests",
        code: "rate-limited",
        operation: "generate-notes",
        retryable: true,
      }),
    });

    hydrateAIRequestHistory([
      {
        requestId: "older",
        operation: "revise-output",
        promptVersion: "v1",
        status: "success",
        cached: false,
        retryCount: 0,
        durationMs: 60,
        timestamp: 1_000,
      },
      ...getAIRequestHistory(),
    ]);

    expect(getAIRequestHistory()[0]).toMatchObject({
      requestId: "req-2",
      status: "failure",
      errorCode: "rate-limited",
      errorMessage: "Too many requests",
    });
    expect(getAIRequestHistory()[1].requestId).toBe("older");
  });
});