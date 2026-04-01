import { beforeEach, describe, expect, it } from "vitest";
import { getAIDiagnosticsItems, getAIMetricsSnapshot, recordAIRuntimeMetric, resetAIMetrics } from "./metrics";
import type { AIRuntimeEvent } from "./runtime";

describe("ai metrics", () => {
  beforeEach(() => {
    resetAIMetrics();
  });

  it("tracks request counts, retries, cache hits, failures, and average duration", () => {
    const events: AIRuntimeEvent[] = [
      { type: "request-start", operation: "translate-output", requestId: "1", promptVersion: "v1" },
      {
        type: "request-retry",
        operation: "translate-output",
        requestId: "1",
        promptVersion: "v1",
        attempt: 1,
        maxRetries: 2,
        delayMs: 400,
        error: new Error("retry") as never,
      },
      { type: "cache-hit", operation: "translate-output", requestId: "1", promptVersion: "v1" },
      { type: "request-success", operation: "translate-output", requestId: "1", promptVersion: "v1", durationMs: 120 },
      { type: "request-start", operation: "generate-notes", requestId: "2", promptVersion: "v1" },
      {
        type: "request-failure",
        operation: "generate-notes",
        requestId: "2",
        promptVersion: "v1",
        durationMs: 50,
        error: new Error("failed"),
      },
    ];

    events.forEach(recordAIRuntimeMetric);

    const snapshot = getAIMetricsSnapshot();
    expect(snapshot.totals.requestCount).toBe(2);
    expect(snapshot.totals.retryCount).toBe(1);
    expect(snapshot.totals.cacheHitCount).toBe(1);
    expect(snapshot.totals.successCount).toBe(1);
    expect(snapshot.totals.failureCount).toBe(1);
    expect(snapshot.totals.averageDurationMs).toBe(120);
    expect(snapshot.operations["translate-output"].cacheHitCount).toBe(1);
    expect(snapshot.operations["generate-notes"].failureCount).toBe(1);
    expect(getAIDiagnosticsItems()[0]).toMatchObject({ operation: "totals", successRate: 50 });
  });
});