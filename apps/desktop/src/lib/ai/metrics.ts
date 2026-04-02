import type { AIOperation } from "./client/openaiClient";
import type { AIRuntimeEvent } from "./runtime";

interface OperationMetrics {
  requestCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  cacheHitCount: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

export interface AIMetricsSnapshot {
  totals: OperationMetrics;
  operations: Record<AIOperation, OperationMetrics>;
}

export interface AIDiagnosticsItem {
  operation: AIOperation | "totals";
  requestCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  cacheHitCount: number;
  averageDurationMs: number;
  successRate: number;
}

const createOperationMetrics = (): OperationMetrics => ({
  requestCount: 0,
  successCount: 0,
  failureCount: 0,
  retryCount: 0,
  cacheHitCount: 0,
  totalDurationMs: 0,
  averageDurationMs: 0,
});

const createSnapshot = (): AIMetricsSnapshot => ({
  totals: createOperationMetrics(),
  operations: {
    "generate-notes": createOperationMetrics(),
    "revise-output": createOperationMetrics(),
    "translate-output": createOperationMetrics(),
    "transcribe-audio": createOperationMetrics(),
  },
});

let metricsSnapshot = createSnapshot();

const cloneSnapshot = (snapshot: AIMetricsSnapshot): AIMetricsSnapshot => ({
  totals: { ...snapshot.totals },
  operations: {
    "generate-notes": { ...snapshot.operations["generate-notes"] },
    "revise-output": { ...snapshot.operations["revise-output"] },
    "translate-output": { ...snapshot.operations["translate-output"] },
    "transcribe-audio": { ...snapshot.operations["transcribe-audio"] },
  },
});

const updateAverage = (metrics: OperationMetrics) => {
  metrics.averageDurationMs = metrics.successCount
    ? Math.round((metrics.totalDurationMs / metrics.successCount) * 100) / 100
    : 0;
};

const updateDuration = (metrics: OperationMetrics, durationMs: number) => {
  metrics.totalDurationMs += durationMs;
  updateAverage(metrics);
};

export const resetAIMetrics = () => {
  metricsSnapshot = createSnapshot();
};

export const getAIMetricsSnapshot = () => cloneSnapshot(metricsSnapshot);

const toDiagnosticsItem = (operation: AIOperation | "totals", metrics: OperationMetrics): AIDiagnosticsItem => ({
  operation,
  requestCount: metrics.requestCount,
  successCount: metrics.successCount,
  failureCount: metrics.failureCount,
  retryCount: metrics.retryCount,
  cacheHitCount: metrics.cacheHitCount,
  averageDurationMs: metrics.averageDurationMs,
  successRate: metrics.requestCount ? Math.round((metrics.successCount / metrics.requestCount) * 1000) / 10 : 0,
});

export const getAIDiagnosticsItems = () => {
  const snapshot = getAIMetricsSnapshot();
  return [
    toDiagnosticsItem("totals", snapshot.totals),
    toDiagnosticsItem("generate-notes", snapshot.operations["generate-notes"]),
    toDiagnosticsItem("revise-output", snapshot.operations["revise-output"]),
    toDiagnosticsItem("translate-output", snapshot.operations["translate-output"]),
    toDiagnosticsItem("transcribe-audio", snapshot.operations["transcribe-audio"]),
  ];
};

export const recordAIRuntimeMetric = (event: AIRuntimeEvent) => {
  const operationMetrics = metricsSnapshot.operations[event.operation];
  const totalMetrics = metricsSnapshot.totals;

  switch (event.type) {
    case "request-start":
      operationMetrics.requestCount += 1;
      totalMetrics.requestCount += 1;
      break;
    case "request-success":
      operationMetrics.successCount += 1;
      totalMetrics.successCount += 1;
      updateDuration(operationMetrics, event.durationMs);
      updateDuration(totalMetrics, event.durationMs);
      break;
    case "request-failure":
      operationMetrics.failureCount += 1;
      totalMetrics.failureCount += 1;
      break;
    case "request-retry":
      operationMetrics.retryCount += 1;
      totalMetrics.retryCount += 1;
      break;
    case "cache-hit":
      operationMetrics.cacheHitCount += 1;
      totalMetrics.cacheHitCount += 1;
      break;
    default:
      break;
  }
};
