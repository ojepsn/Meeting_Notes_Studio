import { describe, expect, it, vi } from "vitest";
import { createAIRuntimeStatusHandler } from "./status";
describe("createAIRuntimeStatusHandler", () => {
    it("maps start, retry, and cache-hit events into status updates", () => {
        const setStatus = vi.fn();
        const logEvent = vi.fn();
        const onCacheHit = vi.fn();
        const handler = createAIRuntimeStatusHandler({ setStatus, logEvent, onCacheHit });
        const events = [
            { type: "request-start", operation: "translate-output", requestId: "1", promptVersion: "v1" },
            {
                type: "request-retry",
                operation: "translate-output",
                requestId: "1",
                promptVersion: "v1",
                attempt: 1,
                maxRetries: 2,
                delayMs: 400,
                error: new Error("retry"),
            },
            { type: "cache-hit", operation: "translate-output", requestId: "1", promptVersion: "v1" },
        ];
        events.forEach(handler);
        expect(logEvent).toHaveBeenCalledTimes(3);
        expect(setStatus).toHaveBeenNthCalledWith(1, "Translating the current output with OpenAI...");
        expect(setStatus).toHaveBeenNthCalledWith(2, "Translation hit a transient issue. Retrying 1 of 2...");
        expect(setStatus).toHaveBeenNthCalledWith(3, "Loaded a matching translation from local cache.");
        expect(onCacheHit).toHaveBeenCalledTimes(1);
    });
});
