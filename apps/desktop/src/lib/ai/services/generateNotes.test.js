import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAITextOperation } from "../runtime";
import { generateNotes } from "./generateNotes";
vi.mock("../runtime", () => ({
    executeAITextOperation: vi.fn(),
}));
const executeAITextOperationMock = vi.mocked(executeAITextOperation);
const settings = {
    theme: "modern-olive",
    outputLanguage: "same",
    preferredDesktopTemplateId: "meeting",
    outputLayoutPresetId: "modern-minutes",
    notesCapturePaneWidth: 640,
    captureWorkspaceDensity: "full",
    outputWorkspaceDensity: "full",
    calendarDaysInView: 5,
    calendarSlotHeight: 16,
    calendarIsFullScreen: false,
    calendarDetailsPaneWidth: 320,
    calendarScrollTop: 0,
    calendarScrollLeft: 0,
    apiKey: "test-key",
    textModel: "gpt-5-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    savedParticipants: [],
    savedProjects: [],
    savedDomains: [],
    savedActivities: [],
    savedTags: [],
    projectLinks: [],
    timeReportPresets: [],
    abbreviations: [],
    preferredParticipantNames: [],
    ruleSuggestions: [],
    promptProfile: {
        meetingMinutesSystem: "Meeting system prompt",
        meetingMinutesRules: "Meeting generation rules",
        personalNotesSystem: "Personal notes system",
        personalNotesRules: "Personal notes rules",
        revisionRules: "Revision rules",
        translationRules: "Translation rules",
        extraBlocks: [],
    },
};
const template = {
    id: "meeting",
    name: "Meeting",
    kind: "builtin",
    captureModes: ["meeting-note"],
    fields: [],
    sections: [
        {
            id: "discussion",
            title: "Key discussion points",
            instructions: "Write the main discussion as flowing text.",
            enabledByDefault: true,
            position: 1,
        },
    ],
};
const createSession = (overrides = {}) => ({
    id: "session-1",
    captureMode: "meeting-note",
    templateId: "meeting",
    title: "Long transcript meeting",
    isPrivate: false,
    participantText: "Anna, Marcus",
    project: "",
    domain: "",
    activity: "",
    tagsText: "",
    date: "2026-04-21",
    startTime: "09:00",
    endTime: "10:00",
    quickHighlights: "",
    transcribeOnly: false,
    outputLanguage: "same",
    detailLevel: 3,
    additionalInstructions: "",
    manualNotes: "",
    liveTranscript: "",
    uploadedTranscript: "We discussed the protocol amendment and agreed next steps.",
    customFieldValues: {},
    excludedSectionIds: [],
    output: "",
    outputVersions: [],
    createdAt: "2026-04-21T09:00:00.000Z",
    updatedAt: "2026-04-21T09:00:00.000Z",
    ...overrides,
});
describe("generateNotes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("splits very long transcripts into summaries before final generation", async () => {
        const longTranscript = Array.from({ length: 360 }, (_, index) => `Transcript paragraph ${index + 1}. The team discussed protocol amendments, recruitment, risks, action owners, decision timing, and project context that must be preserved for the final minutes.`).join("\n\n".repeat(20));
        executeAITextOperationMock.mockImplementation(async ({ promptVersion }) => promptVersion?.includes("chunk-summary")
            ? "Chunk summary with decisions, risks, action items, names, dates, and enough factual detail preserved for later synthesis."
            : "Final synthesized meeting minutes with flowing discussion text, clear outcomes, decisions, and action items.");
        const output = await generateNotes({
            session: createSession({ uploadedTranscript: longTranscript }),
            settings,
            template,
        });
        expect(output).toContain("Final synthesized");
        expect(executeAITextOperationMock.mock.calls.length).toBeGreaterThan(2);
        const finalCall = executeAITextOperationMock.mock.calls.at(-1)?.[0];
        expect(finalCall?.userText).toContain("Condensed source summaries");
        expect(finalCall?.userText).toContain("Chunk 1 summary");
        expect(finalCall?.maxOutputTokens).toBe(20000);
    });
    it("rejects unusably short generated output instead of returning a partial response", async () => {
        executeAITextOperationMock.mockResolvedValue("T");
        await expect(generateNotes({
            session: createSession({ uploadedTranscript: "Long enough source material. ".repeat(120) }),
            settings,
            template,
        })).rejects.toThrow(/unusably short generation/);
    });
});
