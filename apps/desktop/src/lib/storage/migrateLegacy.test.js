import { describe, expect, it } from "vitest";
import { parseLegacyImportSnapshot } from "./migrateLegacy";
describe("parseLegacyImportSnapshot", () => {
    it("maps a plain PWA sessions export into a desktop snapshot", () => {
        const snapshot = parseLegacyImportSnapshot({
            app: "Meeting Notes Studio",
            version: 1,
            exportedAt: "2026-04-18T09:00:00.000Z",
            sessions: [
                {
                    id: "session-1",
                    template: "meeting",
                    title: "Imported project sync",
                    participants: "Ola, Marcus",
                    meetingDate: "2026-04-17",
                    meetingStartTime: "09:30",
                    meetingEndTime: "10:00",
                    highlights: ["Decision review", "Recruitment"],
                    rawNotes: "mtg booked 3/4",
                    polishedHtml: "<p>Meeting summary</p>",
                    updatedAt: 1760000000000,
                },
            ],
        });
        expect(snapshot).not.toBeNull();
        expect(snapshot?.sessions).toHaveLength(1);
        expect(snapshot?.sessions[0]?.templateId).toBe("meeting");
        expect(snapshot?.sessions[0]?.participantText).toBe("Ola, Marcus");
        expect(snapshot?.sessions[0]?.manualNotes).toBe("mtg booked 3/4");
        expect(snapshot?.sessions[0]?.output).toBe("Meeting summary");
    });
    it("maps a shared PWA data payload including participants, abbreviations, and custom templates", () => {
        const snapshot = parseLegacyImportSnapshot({
            app: "Meeting Notes Studio",
            version: 1,
            updatedAt: "2026-04-18T10:00:00.000Z",
            sessions: [],
            settings: {
                themeFamily: "graphite-forest",
                themeMode: "dark",
                participantDirectory: ["Ola Jeppsson"],
                abbreviationDirectory: [{ short: "mtg", full: "meeting" }],
                preferredParticipantNames: [{ shortForm: "Ola", fullName: "Ola Jeppsson" }],
                ruleSuggestions: [{ type: "abbreviation", sourceValue: "mins", suggestedValue: "minutes" }],
                promptSettings: {
                    meetingMinutesRules: "Use flowing text.",
                },
                customTemplates: [
                    {
                        id: "custom-template-1",
                        label: "Field note",
                        fields: { title: true, participants: true },
                    },
                ],
            },
        });
        expect(snapshot).not.toBeNull();
        expect(snapshot?.settings.savedParticipants).toEqual(["Ola Jeppsson"]);
        expect(snapshot?.settings.abbreviations[0]?.shortForm).toBe("mtg");
        expect(snapshot?.settings.preferredParticipantNames[0]?.shortForm).toBe("Ola");
        expect(snapshot?.settings.ruleSuggestions[0]?.suggestedValue).toBe("minutes");
        expect(snapshot?.settings.theme).toBe("graphite-forest-dark");
        expect(snapshot?.settings.promptProfile.meetingMinutesRules).toContain("Use flowing text.");
        expect(snapshot?.templates.some((template) => template.id === "custom-template-1")).toBe(true);
    });
});
