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
export declare const resetAIMetrics: () => void;
export declare const getAIMetricsSnapshot: () => AIMetricsSnapshot;
export declare const getAIDiagnosticsItems: () => AIDiagnosticsItem[];
export declare const recordAIRuntimeMetric: (event: AIRuntimeEvent) => void;
export {};
