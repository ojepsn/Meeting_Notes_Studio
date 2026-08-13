import { describe, expect, it } from "vitest";
import { DEFAULT_TODO_STRUCTURE, getTodoPriority, migrateTodoCommentsToDetails, normalizeTaskRecord } from "./model";
const task = (overrides = {}) => ({
    id: "task-1",
    description: "Planning",
    isDone: false,
    isPrivate: false,
    comments: "",
    activityId: "",
    domain: "",
    project: "",
    activity: "",
    doOn: "2026-08-10",
    dueDate: "",
    detailsHtml: "",
    createdAt: "2026-08-10T08:00:00Z",
    sessionIds: [],
    ...overrides,
});
describe("todo structure defaults", () => {
    it("uses Other for every unassigned structure field", () => {
        expect(DEFAULT_TODO_STRUCTURE).toEqual({
            domain: "Other",
            project: "Other",
            activity: "Other",
        });
    });
});
describe("todo priority normalization", () => {
    it("migrates the legacy Prio flag to High", () => {
        const normalized = normalizeTaskRecord(task({ isPriority: true }));
        expect(normalized.priority).toBe("high");
        expect(normalized.isPriority).toBe(true);
    });
    it("keeps the canonical level authoritative and urgency independent", () => {
        const normalized = normalizeTaskRecord(task({ priority: "low", isPriority: true, isUrgent: true }));
        expect(getTodoPriority(normalized)).toBe("low");
        expect(normalized.isPriority).toBe(false);
        expect(normalized.isUrgent).toBe(true);
    });
    it("moves legacy comments into rich-text details and clears the old field", () => {
        const normalized = normalizeTaskRecord(task({
            comments: "First line\nSecond line",
            detailsHtml: "<p>Existing details</p>",
        }));
        expect(normalized.comments).toBe("");
        expect(normalized.detailsHtml).toBe("<p>Existing details</p><p><br></p><p>First line<br>Second line</p>");
    });
    it("does not duplicate comments already represented by details", () => {
        expect(migrateTodoCommentsToDetails("<p>Already moved</p>", "Already moved")).toBe("<p>Already moved</p>");
    });
    it("escapes legacy comment markup during migration", () => {
        expect(migrateTodoCommentsToDetails("", "Use <script> safely & clearly")).toBe("<p>Use &lt;script&gt; safely &amp; clearly</p>");
    });
});
