import { describe, expect, it } from "vitest";
import { AIRequestError } from "./client/openaiClient";
import { formatAIErrorMessage } from "./messages";
describe("formatAIErrorMessage", () => {
    it("returns user-friendly messages for normalized AI failures", () => {
        expect(formatAIErrorMessage(new AIRequestError({
            message: "Too many requests",
            code: "rate-limited",
            operation: "translate-output",
            retryable: true,
        }), "Translation failed.")).toBe("OpenAI is rate limiting requests right now. Wait a moment and try again.");
        expect(formatAIErrorMessage(new AIRequestError({
            message: "Slow",
            code: "timeout",
            operation: "generate-notes",
            retryable: true,
        }), "Generation failed.")).toBe("The AI request took too long to finish. Please try again.");
    });
    it("falls back to the original message for non-normalized errors", () => {
        expect(formatAIErrorMessage(new Error("Custom failure"), "Fallback")).toBe("Custom failure");
        expect(formatAIErrorMessage(null, "Fallback")).toBe("Fallback");
    });
});
