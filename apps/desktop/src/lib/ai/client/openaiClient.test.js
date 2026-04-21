import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callResponsesApi, extractResponseText } from "./openaiClient";
const createJsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
});
describe("openaiClient", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });
    it("throws a normalized missing key error before fetch", async () => {
        await expect(callResponsesApi({
            apiKey: "",
            body: {},
            operation: "generate-notes",
        })).rejects.toMatchObject({ code: "missing-api-key", retryable: false });
    });
    it("retries a rate-limited request and returns the later success payload", async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(createJsonResponse({ error: { message: "Too many requests" } }, 429))
            .mockResolvedValueOnce(createJsonResponse({ output_text: "Recovered" }));
        vi.stubGlobal("fetch", fetchMock);
        const responsePromise = callResponsesApi({
            apiKey: "test-key",
            body: { model: "gpt-5-mini" },
            operation: "generate-notes",
            maxRetries: 1,
        });
        await vi.runAllTimersAsync();
        await expect(responsePromise).resolves.toMatchObject({ output_text: "Recovered" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it("maps low-level fetch failures to a normalized network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
        await expect(callResponsesApi({
            apiKey: "test-key",
            body: {},
            operation: "translate-output",
            maxRetries: 0,
        })).rejects.toEqual(expect.objectContaining({
            code: "network-error",
            retryable: true,
        }));
    });
    it("fails with invalid-response when a success body is not valid JSON", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        })));
        await expect(callResponsesApi({
            apiKey: "test-key",
            body: {},
            operation: "revise-output",
            maxRetries: 0,
        })).rejects.toMatchObject({ code: "invalid-response", retryable: false });
    });
    it("rejects incomplete Responses API payloads instead of accepting partial text", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createJsonResponse({
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output_text: "T",
        })));
        await expect(callResponsesApi({
            apiKey: "test-key",
            body: {},
            operation: "generate-notes",
            maxRetries: 0,
        })).rejects.toMatchObject({ code: "invalid-response", retryable: false });
    });
    it("extracts text from output_text and nested output blocks", () => {
        expect(extractResponseText({ output_text: "Direct text" })).toBe("Direct text");
        expect(extractResponseText({
            output: [{ content: [{ text: "First" }, { text: "Second" }] }],
        })).toBe("First\nSecond");
    });
});
