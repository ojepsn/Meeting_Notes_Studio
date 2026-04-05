import { describe, expect, it } from "vitest";
import { parseTodoShortcut } from "./shortcut";
describe("parseTodoShortcut", () => {
    it("returns the todo text for td-prefixed input", () => {
        expect(parseTodoShortcut("td Follow up with client")).toBe("Follow up with client");
    });
    it("trims surrounding whitespace", () => {
        expect(parseTodoShortcut("  td   Prepare board summary   ")).toBe("Prepare board summary");
    });
    it("returns an empty string for non-shortcut input", () => {
        expect(parseTodoShortcut("Follow up with client")).toBe("");
    });
});
