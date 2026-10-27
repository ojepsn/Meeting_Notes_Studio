import { describe, expect, it } from "vitest";
import { createDefaultSnapshot } from "../db/repository";
import { reconcileOutlookCalendar } from "./outlookCalendar";
const batch = (events, fullSync = false) => ({
    accountKey: "organizations:client-1",
    events,
    fullSync,
    fromDate: "2026-10-01",
    toDate: "2026-12-31",
    rangeKey: "range",
    syncedAt: "2026-10-27T08:00:00.000Z",
});
const event = {
    id: "outlook-1",
    iCalUId: "ical-1",
    subject: "Clinical team meeting",
    start: { dateTime: "2026-10-28T09:30:00.0000000", timeZone: "Europe/Stockholm" },
    end: { dateTime: "2026-10-28T10:30:00.0000000", timeZone: "Europe/Stockholm" },
    attendees: [{ emailAddress: { name: "Ada" } }, { emailAddress: { address: "grace@example.com" } }],
    location: { displayName: "Room 4" },
    changeKey: "change-1",
    lastModifiedDateTime: "2026-10-27T07:00:00Z",
};
describe("reconcileOutlookCalendar", () => {
    it("creates a meeting and calendar row while applying learned local structure", () => {
        const result = reconcileOutlookCalendar(createDefaultSnapshot(), batch([event]), {
            now: "2026-10-27T08:00:00Z",
            idFactory: (() => {
                const ids = ["activity-1", "calendar-1"];
                return () => ids.shift();
            })(),
            inferStructure: () => ({ domain: "Clinical", project: "Study", activity: "Meeting" }),
        });
        expect(result.summary).toMatchObject({ created: 1, updated: 0, removed: 0 });
        expect(result.snapshot.activities[0]).toMatchObject({
            id: "activity-1",
            description: "Clinical team meeting",
            participantText: "Ada, grace@example.com",
            domain: "Clinical",
            project: "Study",
            activity: "Meeting",
            externalSource: "outlook",
            externalEventId: "outlook-1",
            externalLocation: "Room 4",
        });
        expect(result.snapshot.calendarItems[0]).toMatchObject({
            id: "calendar-1",
            targetId: "activity-1",
            date: "2026-10-28",
            startSlot: 114,
            durationSlots: 12,
        });
    });
    it("updates Outlook-owned fields without overwriting NoteSmith-owned details", () => {
        const created = reconcileOutlookCalendar(createDefaultSnapshot(), batch([event]), {
            now: "2026-10-27T08:00:00Z",
            idFactory: (() => {
                const ids = ["activity-1", "calendar-1"];
                return () => ids.shift();
            })(),
        }).snapshot;
        created.activities[0] = {
            ...created.activities[0],
            domain: "Local domain",
            project: "Local project",
            activity: "Local activity",
            detailsHtml: "<p>Keep this note</p>",
            comments: "Keep this comment",
            sessionIds: ["session-1"],
        };
        const result = reconcileOutlookCalendar(created, batch([{ ...event, subject: "Renamed in Outlook", changeKey: "change-2" }]), { now: "2026-10-27T09:00:00Z" });
        expect(result.summary.updated).toBe(1);
        expect(result.snapshot.activities[0]).toMatchObject({
            description: "Renamed in Outlook",
            domain: "Local domain",
            project: "Local project",
            activity: "Local activity",
            detailsHtml: "<p>Keep this note</p>",
            comments: "Keep this comment",
            sessionIds: ["session-1"],
        });
    });
    it("soft-removes deleted Outlook meetings and preserves their local activity", () => {
        const created = reconcileOutlookCalendar(createDefaultSnapshot(), batch([event]), {
            now: "2026-10-27T08:00:00Z",
            idFactory: (() => {
                const ids = ["activity-1", "calendar-1"];
                return () => ids.shift();
            })(),
        }).snapshot;
        const result = reconcileOutlookCalendar(created, batch([{ id: "outlook-1", "@removed": { reason: "deleted" } }]), { now: "2026-10-27T10:00:00Z" });
        expect(result.summary.removed).toBe(1);
        expect(result.snapshot.activities[0]).toMatchObject({
            id: "activity-1",
            isDone: true,
            externalDeletedAt: "2026-10-27T10:00:00Z",
        });
        expect(result.snapshot.calendarItems).toHaveLength(0);
    });
    it("reconciles missing events during a full sync", () => {
        const created = reconcileOutlookCalendar(createDefaultSnapshot(), batch([event]), {
            now: "2026-10-27T08:00:00Z",
            idFactory: (() => {
                const ids = ["activity-1", "calendar-1"];
                return () => ids.shift();
            })(),
        }).snapshot;
        const result = reconcileOutlookCalendar(created, batch([], true), { now: "2026-10-27T11:00:00Z" });
        expect(result.summary.removed).toBe(1);
        expect(result.snapshot.calendarItems).toHaveLength(0);
    });
});
