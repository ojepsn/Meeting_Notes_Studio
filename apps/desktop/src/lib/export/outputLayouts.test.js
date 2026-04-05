import { describe, expect, it } from "vitest";
import { DEFAULT_OUTPUT_LAYOUT_PRESET_ID, OUTPUT_LAYOUT_PRESETS, getOutputLayoutPreset, getPrimaryFontFamily, isOutputLayoutPresetId, } from "./outputLayouts";
describe("output layout presets", () => {
    it("returns the default preset for unknown values", () => {
        expect(getOutputLayoutPreset("unknown-preset").id).toBe(DEFAULT_OUTPUT_LAYOUT_PRESET_ID);
    });
    it("accepts every shipped preset id", () => {
        expect(OUTPUT_LAYOUT_PRESETS.every((preset) => isOutputLayoutPresetId(preset.id))).toBe(true);
    });
    it("rejects empty ids", () => {
        expect(isOutputLayoutPresetId("")).toBe(false);
    });
    it("extracts a concrete font family from a CSS stack", () => {
        expect(getPrimaryFontFamily("\"Helvetica Neue\", Helvetica, Arial, sans-serif")).toBe("Helvetica Neue");
        expect(getPrimaryFontFamily("Georgia, Cambria, serif")).toBe("Georgia");
    });
});
