import { describe, expect, it } from "vitest";
import { buildMetadataReview, EMPTY_METADATA_REVIEW } from "./review";
const settings = {
    theme: "fluent-slate-light",
    outputLanguage: "same",
    preferredDesktopTemplateId: "meeting",
    outputLayoutPresetId: "modern-aptos",
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
    savedParticipants: ["Anna"],
    savedProjects: ["Project Atlas"],
    savedDomains: ["Finance"],
    savedActivities: ["Planning"],
    savedTags: [],
    projectLinks: [],
    timeReportPresets: [],
    abbreviations: [],
    promptProfile: {
        meetingMinutesSystem: "",
        meetingMinutesRules: "",
        personalNotesSystem: "",
        personalNotesRules: "",
        revisionRules: "",
        translationRules: "",
        extraBlocks: [],
    },
};
const session = {
    id: "1",
    captureMode: "meeting-note",
    templateId: "meeting",
    title: "",
    isPrivate: false,
    participantText: "Anna, Marcus",
    project: "Project Nova",
    domain: "Finance",
    activity: "Retrospective",
    tagsText: "",
    date: "2026-04-02",
    startTime: "09:00",
    endTime: "10:00",
    quickHighlights: "",
    detailLevel: 3,
    manualNotes: "",
    liveTranscript: "",
    uploadedTranscript: "",
    customFieldValues: {},
    excludedSectionIds: [],
    output: "",
    createdAt: "",
    updatedAt: "",
};
describe("buildMetadataReview", () => {
    it("returns only new reusable values", () => {
        expect(buildMetadataReview(session, settings)).toEqual({
            people: ["Marcus"],
            domains: [],
            projects: ["Project Nova"],
            activities: ["Retrospective"],
        });
    });
    it("returns an empty review when data is missing", () => {
        expect(buildMetadataReview(null, settings)).toEqual(EMPTY_METADATA_REVIEW);
        expect(buildMetadataReview(session, null)).toEqual(EMPTY_METADATA_REVIEW);
    });
});
