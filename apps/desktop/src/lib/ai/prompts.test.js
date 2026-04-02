import { describe, expect, it } from "vitest";
import { AI_PROMPT_PROFILE_VERSION, formatEnabledPromptBlocks, resolvePromptProfile } from "./prompts";
describe("resolvePromptProfile", () => {
    it("falls back to defaults when fields are blank", () => {
        const resolved = resolvePromptProfile({
            generationSystem: "   ",
            generationRules: "",
            personalNotesSystem: " ",
            personalNotesRules: " ",
            revisionRules: "\n",
            translationRules: "",
            extraBlocks: [],
        });
        expect(resolved.version).toBe(AI_PROMPT_PROFILE_VERSION);
        expect(resolved.profile.meetingMinutesSystem).toContain("meeting-minutes writer");
        expect(resolved.profile.meetingMinutesRules).toContain("structured professional meeting minutes");
        expect(resolved.profile.personalNotesSystem).toContain("professional note editor");
        expect(resolved.profile.personalNotesRules).toContain("Polish personal notes and dictations");
        expect(resolved.profile.revisionRules).toContain("requested improvements");
        expect(resolved.profile.translationRules).toContain("Translate the current output faithfully");
    });
    it("normalizes prompt blocks while preserving enabled state", () => {
        const resolved = resolvePromptProfile({
            meetingMinutesSystem: "Meeting system",
            meetingMinutesRules: "Meeting rules",
            personalNotesSystem: "Personal system",
            personalNotesRules: "Personal rules",
            revisionRules: "Revise",
            translationRules: "Translate",
            extraBlocks: [
                { id: "1", label: "  Team style  ", body: "  Use action verbs.  ", enabled: 1 },
                { id: "2", label: "", body: "   ", enabled: false },
            ],
        });
        expect(resolved.profile.extraBlocks).toEqual([
            { id: "1", label: "Team style", body: "Use action verbs.", enabled: true },
            { id: "2", label: "Extra prompt", body: "", enabled: false },
        ]);
    });
});
describe("formatEnabledPromptBlocks", () => {
    it("formats only enabled blocks with non-empty bodies", () => {
        const text = formatEnabledPromptBlocks([
            { id: "1", label: "Voice", body: "Be concise.", enabled: true },
            { id: "2", label: "Ignore", body: "", enabled: true },
            { id: "3", label: "Disabled", body: "Do not show.", enabled: false },
        ]);
        expect(text).toBe("Voice:\nBe concise.");
    });
});
