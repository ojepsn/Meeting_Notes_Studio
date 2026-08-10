import { describe, expect, it } from "vitest";
import { getTodoPriority, normalizeTaskRecord } from "./model";
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
});
