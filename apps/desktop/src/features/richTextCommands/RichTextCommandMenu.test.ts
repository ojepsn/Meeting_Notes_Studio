import { describe, expect, it } from "vitest";
import { buildRichTextCommands, findRichTextCommandQuery, getRichTextSpellCheckAttributes, resolveRichTextCommandValue, richTextCommandMatchesQuery } from "./RichTextCommandMenu";

describe("rich-text commands", () => {
  const now = new Date(2026, 7, 10, 9, 5);

  it("resolves system-local date and 24-hour time placeholders", () => {
    expect(resolveRichTextCommandValue("{date} {time}", now)).toBe("2026-08-10 09:05");
    expect(resolveRichTextCommandValue("{tomorrow} / {yesterday}", now)).toBe("2026-08-11 / 2026-08-09");
  });

  it("includes custom commands without allowing built-in aliases to be replaced", () => {
    const commands = buildRichTextCommands([
      { id: "1", trigger: "followup", label: "Follow-up", template: "Follow up by {date}" },
      { id: "2", trigger: "date", label: "Override", template: "wrong" },
    ]);
    expect(commands.find((command) => command.trigger === "followup")?.template).toBe("Follow up by {date}");
    expect(commands.filter((command) => command.trigger === "date")).toHaveLength(1);
  });

  it("finds commands only at a token boundary immediately before the caret", () => {
    expect(findRichTextCommandQuery("Plan @da")).toEqual({ query: "da", start: 5, end: 8 });
    expect(findRichTextCommandQuery("email@date")).toBeNull();
    expect(findRichTextCommandQuery("@n next", 2)).toEqual({ query: "n", start: 0, end: 2 });
  });

  it("filters by trigger and label-word prefixes without loose substring matches", () => {
    const commands = buildRichTextCommands();
    expect(commands.filter((command) => richTextCommandMatchesQuery(command, "da")).map((command) => command.trigger)).toEqual([
      "date",
      "d",
      "datetime",
      "dt",
      "day",
    ]);
    expect(richTextCommandMatchesQuery(commands.find((command) => command.trigger === "yesterday")!, "da")).toBe(false);
  });

  it("defaults rich-text spell checking to off and applies explicit language modes", () => {
    expect(getRichTextSpellCheckAttributes(undefined)).toEqual({ spellCheck: false, lang: "" });
    expect(getRichTextSpellCheckAttributes("off")).toEqual({ spellCheck: false, lang: "" });
    expect(getRichTextSpellCheckAttributes("auto")).toEqual({ spellCheck: true, lang: "" });
    expect(getRichTextSpellCheckAttributes("en")).toEqual({ spellCheck: true, lang: "en" });
    expect(getRichTextSpellCheckAttributes("sv")).toEqual({ spellCheck: true, lang: "sv" });
  });
});
