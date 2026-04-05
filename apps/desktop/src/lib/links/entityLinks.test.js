import { describe, expect, it } from "vitest";
import { findActivityIdForSession, findSessionIdForActivity, upsertEntityLink } from "./entityLinks";
describe("entity links", () => {
    const link = {
        id: "1",
        fromType: "activity",
        fromId: "activity-1",
        toType: "session",
        toId: "session-1",
        relation: "has_session",
        createdAt: "2026-04-05T10:00:00.000Z",
    };
    it("finds the linked session for an activity", () => {
        expect(findSessionIdForActivity([link], "activity-1")).toBe("session-1");
    });
    it("finds the linked activity for a session", () => {
        expect(findActivityIdForSession([link], "session-1")).toBe("activity-1");
    });
    it("replaces an existing one-to-one link for the same source and relation", () => {
        const next = { ...link, id: "2", toId: "session-2" };
        expect(upsertEntityLink([link], next)).toEqual([next]);
    });
});
