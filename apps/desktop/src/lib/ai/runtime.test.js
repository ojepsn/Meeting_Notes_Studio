import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAITextCache } from "./cache";
import { executeAITextOperation } from "./runtime";
const settings = {
    theme: "modern-olive",
    outputLanguage: "same",
    preferredDesktopTemplateId: "meeting",
    outputLayoutPresetId: "modern-aptos",
    captureWorkspaceDensity: "full",
    outputWorkspaceDensity: "full",
    calendarDaysInView: 5,
    calendarSlotHeight: 16,
    calendarIsFullScreen: false,
    calendarDetailsPaneWidth: 320,
    apiKey: "test-key",
    textModel: "gpt-5-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    savedParticipants: [],
    savedProjects: [],
    savedDomains: [],
    savedActivities: [],
    savedTags: [],
    abbreviations: [],
    promptProfile: {
        meetingMinutesSystem: "Meeting system",
        meetingMinutesRules: "Meeting rules",
        personalNotesSystem: "Personal system",
        personalNotesRules: "Personal rules",
        revisionRules: "Revise",
        translationRules: "Translate",
        extraBlocks: [],
    },
};
describe("executeAITextOperation", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        clearAITextCache();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("emits start and success events and sends the expected request body", async () => {
        const events = [];
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: "Done" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }));
        vi.stubGlobal("fetch", fetchMock);
        const text = await executeAITextOperation({
            settings,
            operation: "translate-output",
            promptVersion: "2026-04-01",
            systemTexts: [" Rule one ", "", "Rule two"],
            userText: "Translate this",
            onEvent: (event) => events.push(event),
            maxRetries: 0,
        });
        expect(text).toBe("Done");
        expect(events[0]).toMatchObject({ type: "request-start", operation: "translate-output" });
        expect(events[1]).toMatchObject({ type: "request-success", operation: "translate-output" });
        const [, requestInit] = fetchMock.mock.calls[0];
        const parsedBody = JSON.parse(String(requestInit.body));
        expect(parsedBody.input[0].content).toEqual([
            { type: "input_text", text: "Rule one" },
            { type: "input_text", text: "Rule two" },
        ]);
        expect(parsedBody.input[1].content[0].text).toBe("Translate this");
    });
    it("fails when the model response does not contain readable text", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ output: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })));
        await expect(executeAITextOperation({
            settings,
            operation: "revise-output",
            systemTexts: ["Only revise"],
            userText: "Revise",
            maxRetries: 0,
        })).rejects.toMatchObject({ code: "invalid-response", retryable: false });
    });
    it("serves repeat translation requests from the local cache", async () => {
        const events = [];
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: "Cached translation" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }));
        vi.stubGlobal("fetch", fetchMock);
        const request = {
            settings,
            operation: "translate-output",
            promptVersion: "2026-04-01",
            systemTexts: ["Translate"],
            userText: "Hello",
            onEvent: (event) => events.push(event),
            maxRetries: 0,
        };
        await expect(executeAITextOperation(request)).resolves.toBe("Cached translation");
        await expect(executeAITextOperation(request)).resolves.toBe("Cached translation");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(events.some((event) => event.type === "cache-hit")).toBe(true);
    });
});
