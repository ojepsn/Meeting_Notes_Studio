import { describe, expect, it } from "vitest";
import { buildVisibleQuickSuggestions, parsePeople, parseTokenList } from "./peoplePickerUtils";

describe("parsePeople", () => {
  it("parses and deduplicates names across common separators", () => {
    expect(parsePeople("Anna, Bob\nAnna; Cara")).toEqual(["Anna", "Bob", "Cara"]);
  });
});

describe("parseTokenList", () => {
  it("deduplicates generic token values across common separators", () => {
    expect(parseTokenList("alpha, beta\nalpha; gamma")).toEqual(["alpha", "beta", "gamma"]);
  });
});

describe("buildVisibleQuickSuggestions", () => {
  it("removes already selected people and limits the result", () => {
    expect(
      buildVisibleQuickSuggestions({
        suggestedPeople: ["Anna", "Bob", "Cara", "Dina", "Erik", "Fatima", "Gus"],
        selectedPeople: ["Bob", "Erik"],
        limit: 3,
      }),
    ).toEqual(["Anna", "Cara", "Dina"]);
  });
});
