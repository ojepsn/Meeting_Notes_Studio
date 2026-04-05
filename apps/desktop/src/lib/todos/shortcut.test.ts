import { describe, expect, it } from "vitest";
import { parseActivityShortcut, parseTodoShortcut } from "./shortcut";

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

describe("parseActivityShortcut", () => {
  it("returns the activity text for act-prefixed input", () => {
    expect(parseActivityShortcut("Act Prepare steering-group agenda")).toBe("Prepare steering-group agenda");
  });

  it("trims surrounding whitespace", () => {
    expect(parseActivityShortcut("  act   Prepare implementation review   ")).toBe("Prepare implementation review");
  });

  it("returns an empty string for non-shortcut input", () => {
    expect(parseActivityShortcut("Prepare implementation review")).toBe("");
  });
});
