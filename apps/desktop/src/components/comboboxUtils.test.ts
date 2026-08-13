import { describe, expect, it } from "vitest";
import { filterComboboxOptions } from "./comboboxUtils";

describe("filterComboboxOptions", () => {
  it("puts prefix matches before contains matches", () => {
    expect(filterComboboxOptions(["Clinical Success", "Success Planning", "Clinic"], "cli")).toEqual([
      "Clinical Success",
      "Clinic",
    ]);
    expect(filterComboboxOptions(["Clinical Success", "Success Planning"], "success")).toEqual([
      "Success Planning",
      "Clinical Success",
    ]);
  });

  it("deduplicates saved choices without changing their display text", () => {
    expect(filterComboboxOptions(["Regnora", " regnora ", "General"], "")).toEqual(["Regnora", "General"]);
  });

  it("limits the number of visible choices", () => {
    expect(filterComboboxOptions(["A", "B", "C"], "", 2)).toEqual(["A", "B"]);
  });
});
