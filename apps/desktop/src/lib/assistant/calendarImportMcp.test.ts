import { describe, expect, it } from "vitest";
import {
  buildChatGptOutlookImportBatch,
  CHATGPT_CALENDAR_WINDOW_DAYS,
  getChatGptCalendarImportWindow,
  type CalendarImportMcpRequest,
} from "./calendarImportMcp";

const request = (events: CalendarImportMcpRequest["events"]): CalendarImportMcpRequest => ({
  requestId: "request-1",
  completeSnapshot: true,
  events,
});

describe("ChatGPT calendar MCP import", () => {
  it("uses exactly seven calendar dates including today", () => {
    expect(CHATGPT_CALENDAR_WINDOW_DAYS).toBe(7);
    expect(getChatGptCalendarImportWindow(new Date("2026-10-27T08:00:00Z"))).toEqual({
      fromDate: "2026-10-27",
      toDate: "2026-11-02",
    });
  });

  it("maps connector events into the existing Outlook reconciliation format", () => {
    const result = buildChatGptOutlookImportBatch(
      request([{
        externalId: "event-1",
        iCalUId: "ical-1",
        title: "Clinical review",
        startDateTime: "2026-10-29T09:00:00",
        endDateTime: "2026-10-29T10:00:00",
        attendeeNames: ["Ada", "Grace"],
        location: "Teams",
      }]),
      new Date("2026-10-27T08:00:00Z"),
    );

    expect(result.rejectedOutsideWindow).toBe(0);
    expect(result.batch).toMatchObject({
      accountKey: "chatgpt-outlook-calendar",
      fullSync: true,
      fromDate: "2026-10-27",
      toDate: "2026-11-02",
    });
    expect(result.batch.events[0]).toMatchObject({
      id: "event-1",
      subject: "Clinical review",
      attendees: [{ emailAddress: { name: "Ada" } }, { emailAddress: { name: "Grace" } }],
    });
  });

  it("rejects past and later events outside the seven-day window", () => {
    const result = buildChatGptOutlookImportBatch(
      request([
        { externalId: "past", title: "Past", startDateTime: "2026-10-26T09:00:00", endDateTime: "2026-10-26T10:00:00" },
        { externalId: "inside", title: "Inside", startDateTime: "2026-11-02T09:00:00", endDateTime: "2026-11-02T10:00:00" },
        { externalId: "later", title: "Later", startDateTime: "2026-11-03T09:00:00", endDateTime: "2026-11-03T10:00:00" },
      ]),
      new Date("2026-10-27T08:00:00Z"),
    );
    expect(result.batch.events.map((event) => event.id)).toEqual(["inside"]);
    expect(result.rejectedOutsideWindow).toBe(2);
  });
});
