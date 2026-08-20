import { describe, expect, it } from "vitest";
import { buildNotebookSessionTitle, compareNotebookSessionsNewestFirst, filterNotebookSessions, getNotebookListTitle, getNotebookTitleText, preserveNotebookRowBreaks, } from "./NotebookWorkspace";
import { createSessionRecord } from "../../../lib/db/repository";
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
        expect(getNotebookListTitle({
            date: "2026-08-10",
            title: "2026-08-10 Operations Meeting",
            captureMode: "meeting-note",
        })).toBe("2026-08-10 Operations Meeting");
    });
    it("preserves browser-generated rows and explicit line breaks", () => {
        expect(preserveNotebookRowBreaks("First row<div>Second row</div><div><br></div><div>Fourth row</div>")).toBe("First row<p>Second row</p><p><br></p><p>Fourth row</p>");
        expect(preserveNotebookRowBreaks("First row<br>Second row")).toBe("First row<br>Second row");
    });
    it("filters notebook pages by free text and assigned structure", () => {
        const regnora = {
            ...createSessionRecord("personal-note", "quick-note"),
            id: "regnora",
            title: "2026-08-14 Regnora planning",
            domain: "Clinical Success",
            project: "Regnora",
            activity: "Planning",
            manualNotes: "<p>Prepare database review</p>",
        };
        const bahamas = {
            ...createSessionRecord("personal-note", "quick-note"),
            id: "bahamas",
            title: "2026-08-14 Bahamas follow-up",
            domain: "Clinical Success",
            project: "Bahamas",
            activity: "Review",
        };
        expect(filterNotebookSessions([regnora, bahamas], {
            query: "database",
            domain: "clinical success",
            project: "Regnora",
            activity: "Planning",
        }).map((session) => session.id)).toEqual(["regnora"]);
    });
    it("sorts same-day notebook pages by their note time", () => {
        const morning = {
            ...createSessionRecord("personal-note", "quick-note"),
            id: "morning",
            date: "2026-08-20",
            startTime: "08:15",
        };
        const afternoon = {
            ...createSessionRecord("personal-note", "quick-note"),
            id: "afternoon",
            date: "2026-08-20",
            startTime: "14:30",
        };
        const yesterday = {
            ...createSessionRecord("personal-note", "quick-note"),
            id: "yesterday",
            date: "2026-08-19",
            startTime: "18:00",
        };
        expect([morning, yesterday, afternoon].sort(compareNotebookSessionsNewestFirst).map((session) => session.id)).toEqual([
            "afternoon",
            "morning",
            "yesterday",
        ]);
    });
});
