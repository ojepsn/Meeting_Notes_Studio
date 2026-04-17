import { describe, expect, it } from "vitest";
import { acceptRuleSuggestion, collectRuleSuggestionObservations, ignoreRuleSuggestion, mergeRuleSuggestionObservations, restoreIgnoredRuleSuggestion, } from "./ruleSuggestions";
const createSettings = () => ({
    theme: "fluent-slate-light",
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
    apiKey: "",
    textModel: "gpt-5.4-mini",
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
        meetingMinutesSystem: "",
        meetingMinutesRules: "",
        personalNotesSystem: "",
        personalNotesRules: "",
        revisionRules: "",
        translationRules: "",
        extraBlocks: [],
    },
});
const createSession = (overrides = {}) => ({
    id: "session-1",
    captureMode: "meeting-note",
    templateId: "meeting",
    title: "Meeting",
    isPrivate: false,
    deletedAt: null,
    startTime: "09:00",
    endTime: "10:00",
    participantText: "",
    project: "",
    domain: "",
    activity: "",
    tagsText: "",
    date: "2026-04-17",
    quickHighlights: "",
    detailLevel: 3,
    manualNotes: "",
    liveTranscript: "",
    uploadedTranscript: "",
    customFieldValues: {},
    excludedSectionIds: [],
    output: "",
    outputVersions: [],
    createdAt: "2026-04-17T09:00:00.000Z",
    updatedAt: "2026-04-17T09:00:00.000Z",
    ...overrides,
});
describe("rule suggestion helpers", () => {
    it("collects safe abbreviation suggestions from repeated shorthand", () => {
        const observations = collectRuleSuggestionObservations(createSession(), createSettings(), "Follow-up mtg booked for next week.");
        expect(observations).toContainEqual({
            type: "abbreviation",
            sourceValue: "mtg",
            suggestedValue: "meeting",
            confidence: 0.86,
        });
    });
    it("collects preferred participant-name suggestions only when the mapping is unambiguous", () => {
        const observations = collectRuleSuggestionObservations(createSession({ participantText: "Ola Jeppsson, Anna Smith" }), createSettings(), "Ola will send the revised draft.");
        expect(observations).toContainEqual({
            type: "preferred_name",
            sourceValue: "Ola",
            suggestedValue: "Ola Jeppsson",
            confidence: 0.83,
        });
    });
    it("does not suggest ambiguous first-name mappings", () => {
        const observations = collectRuleSuggestionObservations(createSession({ participantText: "Ann Smith, Ann Jones" }), createSettings(), "Ann will follow up.");
        expect(observations.some((entry) => entry.type === "preferred_name")).toBe(false);
    });
    it("only surfaces suggestions after they are seen across two sessions", () => {
        const settings = createSettings();
        const first = mergeRuleSuggestionObservations(settings, "session-1", [
            { type: "abbreviation", sourceValue: "mtg", suggestedValue: "meeting", confidence: 0.86 },
        ]);
        expect(first.visibleSuggestions).toHaveLength(0);
        const second = mergeRuleSuggestionObservations(first.nextSettings, "session-2", [
            { type: "abbreviation", sourceValue: "mtg", suggestedValue: "meeting", confidence: 0.86 },
        ]);
        expect(second.visibleSuggestions).toHaveLength(1);
        expect(second.visibleSuggestions[0].evidenceCount).toBe(2);
    });
    it("accepting a suggestion stores the reusable rule", () => {
        const merged = mergeRuleSuggestionObservations(createSettings(), "session-1", [
            { type: "preferred_name", sourceValue: "Ola", suggestedValue: "Ola Jeppsson", confidence: 0.83 },
            { type: "preferred_name", sourceValue: "Ola", suggestedValue: "Ola Jeppsson", confidence: 0.83 },
        ]);
        const suggestionId = merged.nextSettings.ruleSuggestions[0].id;
        const accepted = acceptRuleSuggestion(merged.nextSettings, suggestionId);
        expect(accepted.preferredParticipantNames).toContainEqual(expect.objectContaining({ shortForm: "Ola", fullName: "Ola Jeppsson" }));
        expect(accepted.ruleSuggestions[0].status).toBe("accepted");
    });
    it("can ignore and restore a suggestion", () => {
        const merged = mergeRuleSuggestionObservations(createSettings(), "session-1", [
            { type: "abbreviation", sourceValue: "mtg", suggestedValue: "meeting", confidence: 0.86 },
            { type: "abbreviation", sourceValue: "mtg", suggestedValue: "meeting", confidence: 0.86 },
        ]);
        const suggestionId = merged.nextSettings.ruleSuggestions[0].id;
        const ignored = ignoreRuleSuggestion(merged.nextSettings, suggestionId, { forever: true });
        expect(ignored.ruleSuggestions[0].status).toBe("ignored");
        expect(ignored.ruleSuggestions[0].ignoreForever).toBe(true);
        const restored = restoreIgnoredRuleSuggestion(ignored, suggestionId);
        expect(restored.ruleSuggestions[0].status).toBe("pending");
        expect(restored.ruleSuggestions[0].ignoreForever).toBe(false);
    });
});
