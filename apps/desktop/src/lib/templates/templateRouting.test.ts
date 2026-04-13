import { describe, expect, it } from "vitest";
import {
  BUILTIN_TEMPLATES,
  getPrimaryCaptureMode,
  getTemplatesForCaptureMode,
  type TemplateDefinition,
} from "@notesmith/domain";

describe("template routing", () => {
  it("keeps built-in templates scoped to one top-level capture mode", () => {
    const templateMap = Object.fromEntries(BUILTIN_TEMPLATES.map((template) => [template.id, template.captureModes]));
    const meetingTemplate = BUILTIN_TEMPLATES.find((template) => template.id === "meeting");

    expect(templateMap.meeting).toEqual(["meeting-note"]);
    expect(templateMap["one-on-one"]).toEqual(["quick-note"]);
    expect(templateMap["personal-note"]).toEqual(["quick-note"]);
    expect(templateMap["voice-memo"]).toEqual(["voice-note"]);
    expect(meetingTemplate?.fields.some((field) => field.key === "agenda" && field.enabled)).toBe(true);
    expect(meetingTemplate?.sections[0]?.id).toBe("agenda");
  });

  it("filters templates by their primary capture mode", () => {
    const customTemplate: TemplateDefinition = {
      id: "custom-quick",
      name: "Project jotting",
      kind: "custom",
      captureModes: ["quick-note"],
      fields: [],
      sections: [],
      promptInstructions: "",
    };

    const templates = [...BUILTIN_TEMPLATES, customTemplate];

    expect(getTemplatesForCaptureMode(templates, "quick-note").map((template) => template.id)).toContain("custom-quick");
    expect(getTemplatesForCaptureMode(templates, "meeting-note").map((template) => template.id)).not.toContain("custom-quick");
  });

  it("normalizes older multi-mode templates down to one category", () => {
    expect(
      getPrimaryCaptureMode({
        captureModes: ["quick-note", "voice-note"],
      }),
    ).toBe("quick-note");
  });
});
