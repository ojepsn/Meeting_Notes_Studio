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
        expect(resolved.profile.meetingMinutesRules).toContain("Write professional meeting minutes from the source material");
        expect(resolved.profile.personalNotesSystem).toContain("expert editor for personal notes");
        expect(resolved.profile.personalNotesRules).toContain("Polish the source into a clean, readable note");
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
    it("promotes legacy built-in short prompts to the richer current defaults", () => {
        const resolved = resolvePromptProfile({
            meetingMinutesSystem: "You are an executive note assistant. Convert rough notes and transcripts into structured professional notes. Synthesize spoken content instead of reproducing it line by line.",
            meetingMinutesRules: "Prefer concise business language, preserve important decisions and action items, remove filler and repeated phrasing, and organize the output under clear sections.",
            revisionRules: "Apply only the requested improvements, keep the existing structure, and avoid unnecessary rewrites.",
            translationRules: "Translate the current output faithfully while preserving the same structure, tone, and action items.",
        });
        expect(resolved.profile.meetingMinutesSystem).toContain("expert business meeting-minutes writer");
        expect(resolved.profile.meetingMinutesRules).toContain("flowing text that captures the substance of the discussion");
        expect(resolved.profile.revisionRules).toContain("Make the smallest set of changes needed");
        expect(resolved.profile.translationRules).toContain("Preserve the same structure, headings, emphasis, and practical meaning");
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
