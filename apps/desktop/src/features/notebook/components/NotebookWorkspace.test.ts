import { describe, expect, it } from "vitest";
import {
  buildNotebookSessionTitle,
  getNotebookListTitle,
  getNotebookTitleText,
  preserveNotebookRowBreaks,
} from "./NotebookWorkspace";

describe("NotebookWorkspace title helpers", () => {
  it("stores the editable date as the canonical session title prefix", () => {
    expect(buildNotebookSessionTitle("2026-08-10", "Planning")).toBe("2026-08-10 Planning");
    expect(buildNotebookSessionTitle("2026-08-10", "")).toBe("2026-08-10");
  });

  it("extracts only the user-editable title without removing intentional spaces", () => {
    expect(getNotebookTitleText({ date: "2026-08-10", title: "2026-08-10 Planning notes" })).toBe("Planning notes");
    expect(getNotebookTitleText({ date: "2026-08-10", title: "2026-08-10 Planning " })).toBe("Planning ");
  });

  it("does not duplicate dates already stored in meeting titles", () => {
    expect(
      getNotebookListTitle({
        date: "2026-08-10",
        title: "2026-08-10 Operations Meeting",
        captureMode: "meeting-note",
      }),
    ).toBe("2026-08-10 Operations Meeting");
  });

  it("preserves browser-generated rows and explicit line breaks", () => {
    expect(preserveNotebookRowBreaks("First row<div>Second row</div><div><br></div><div>Fourth row</div>")).toBe(
      "First row<p>Second row</p><p><br></p><p>Fourth row</p>",
    );
    expect(preserveNotebookRowBreaks("First row<br>Second row")).toBe("First row<br>Second row");
  });
});
