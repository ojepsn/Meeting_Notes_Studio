import { buildStructuredOutput, isHeadingLine, normalizeHeadingText, splitOutputBlocks, toFileSafeName } from "./exportService";
describe("exportService helpers", () => {
    it("creates safe filenames from output titles", () => {
        expect(toFileSafeName("Board review: Q2 / Europe")).toBe("Board review Q2  Europe");
        expect(toFileSafeName("")).toBe("notesmith-output");
    });
    it("splits output into trimmed logical blocks", () => {
        expect(splitOutputBlocks("Summary\nline\n\nDecisions\nitem")).toEqual([
            "Summary\nline",
            "Decisions\nitem",
        ]);
    });
    it("detects headings and excludes bullets and sentences", () => {
        expect(isHeadingLine("Decisions and next steps")).toBe(true);
        expect(isHeadingLine("Decisions and next steps:")).toBe(true);
        expect(isHeadingLine("Meeting title: Weekly project sync")).toBe(false);
        expect(isHeadingLine("- action item")).toBe(false);
        expect(isHeadingLine("This is a full sentence.")).toBe(false);
    });
    it("normalizes heading punctuation", () => {
        expect(normalizeHeadingText("Action items:")).toBe("Action items");
    });
    it("builds structured output with heading/body classification", () => {
        expect(buildStructuredOutput("## Key discussion points\n### 1) Site dry run\n\n- Call customer\n1. Confirm timeline\nThis is a summary line.")).toEqual([
            { kind: "heading", level: 2, text: "Key discussion points" },
            { kind: "heading", level: 3, text: "1) Site dry run" },
            { kind: "bullet", text: "Call customer" },
            { kind: "numbered", order: 1, text: "Confirm timeline" },
            { kind: "body", text: "This is a summary line." },
        ]);
    });
});
