import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
import { getSessionEditorTemplateOptions } from "./SessionEditor";

describe("SessionEditor template options", () => {
  it("adds meeting templates to Notebook-opened quick-note sessions", () => {
    const ordinaryQuickNoteOptions = getSessionEditorTemplateOptions(BUILTIN_TEMPLATES, "quick-note");
    const notebookOptions = getSessionEditorTemplateOptions(
      BUILTIN_TEMPLATES,
      "quick-note",
      ["quick-note", "meeting-note"],
    );

    expect(ordinaryQuickNoteOptions.map((template) => template.id)).not.toContain("meeting");
    expect(notebookOptions.map((template) => template.id)).toEqual(
      expect.arrayContaining(["personal-note", "one-on-one", "meeting"]),
    );
  });
});
