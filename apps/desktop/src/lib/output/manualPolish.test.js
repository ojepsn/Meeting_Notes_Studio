import { describe, expect, it } from "vitest";
import { polishNonAiNotesText } from "./manualPolish";
describe("polishNonAiNotesText", () => {
    it("expands abbreviations, canonicalizes participants, and merges wrapped prose", () => {
        const polished = polishNonAiNotesText([
            "teh mtg with ola was moved to 9.30",
            "and the adress was updated",
        ].join("\n"), {
            abbreviations: [{ id: "1", shortForm: "mtg", fullForm: "meeting" }],
            sessionParticipants: "Ola Jeppsson, Anna Smith",
            savedParticipants: ["Ola Jeppsson"],
        });
        expect(polished).toBe("The meeting with Ola Jeppsson was moved to 09:30 and the address was updated.");
    });
    it("normalizes labels, drops filler-only lines, and deduplicates consecutive content", () => {
        const polished = polishNonAiNotesText([
            "ok",
            "dec - proceed with rollout",
            "dec - proceed with rollout",
            "act: anna to send revised draft by friday",
        ].join("\n"), {
            sessionParticipants: "Anna Smith",
            savedParticipants: ["Anna Smith"],
        });
        expect(polished).toBe([
            "Decision: Proceed with rollout.",
            "",
            "Action: Anna Smith to send revised draft by friday.",
        ].join("\n"));
    });
    it("does not misclassify ordinary rough prose as an action item and fixes common meeting shorthand", () => {
        const polished = polishNonAiNotesText("Tesing to write asom notes whn many mistakens\nmtg booked 3/4", {
            abbreviations: [],
            sessionParticipants: "",
            savedParticipants: [],
        });
        expect(polished).toBe("Testing to write some notes when many mistakes meeting booked 3/4.");
    });
});
