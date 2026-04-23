import { describe, expect, it } from "vitest";
import type { DesktopAppSnapshot } from "@notesmith/domain";
import { invokeNoteSmithMcpTool, listNoteSmithMcpTools } from "./notesmithMcpBridge";

const snapshot = {
  sessions: [
    {
      id: "session-1",
      captureMode: "meeting-note",
      templateId: "meeting",
      title: "Protocol amendment meeting",
      isPrivate: false,
      deletedAt: null,
      participantText: "Ola, Anna",
      project: "ARE",
      domain: "Clinical",
      activity: "Protocol",
      tagsText: "",
      date: "2026-04-17",
      startTime: "09:00",
      endTime: "10:00",
      quickHighlights: "Recruitment",
      transcribeOnly: false,
      outputLanguage: "same",
      detailLevel: 3,
      additionalInstructions: "",
      manualNotes: "Protocol amendment and recruitment risk.",
      liveTranscript: "",
      uploadedTranscript: "",
      customFieldValues: {},
      excludedSectionIds: [],
      output: "",
      outputVersions: [],
      createdAt: "2026-04-17T09:00:00.000Z",
      updatedAt: "2026-04-17T10:00:00.000Z",
    },
    {
      id: "session-private",
      captureMode: "meeting-note",
      templateId: "meeting",
      title: "Private Aurora meeting",
      isPrivate: true,
      deletedAt: null,
      participantText: "Ola",
      project: "",
      domain: "",
      activity: "",
      tagsText: "",
      date: "2026-04-18",
      startTime: "09:00",
      endTime: "10:00",
      quickHighlights: "",
      transcribeOnly: false,
      outputLanguage: "same",
      detailLevel: 3,
      additionalInstructions: "",
      manualNotes: "Aurora",
      liveTranscript: "",
      uploadedTranscript: "",
      customFieldValues: {},
      excludedSectionIds: [],
      output: "",
      outputVersions: [],
      createdAt: "2026-04-18T09:00:00.000Z",
      updatedAt: "2026-04-18T10:00:00.000Z",
    },
  ],
  templates: [],
  todos: [
    {
      id: "todo-1",
      description: "Follow up recruitment",
      isDone: false,
      isPrivate: false,
      comments: "",
      activityId: "activity-1",
      domain: "Clinical",
      project: "ARE",
      activity: "Protocol",
      doOn: "2026-04-17",
      dueDate: "",
      detailsHtml: "",
      createdAt: "2026-04-17T10:00:00.000Z",
      sessionIds: ["session-1"],
    },
  ],
  activities: [
    {
      id: "activity-1",
      type: "meeting",
      parentActivityId: "",
      description: "Protocol amendment meeting",
      isDone: false,
      isPrivate: false,
      comments: "",
      domain: "Clinical",
      project: "ARE",
      activity: "Protocol",
      doOn: "2026-04-17",
      dueDate: "",
      startTime: "09:00",
      endTime: "10:00",
      detailsHtml: "",
      timeRequiredMinutes: 60,
      actualTimeSpentMinutes: 0,
      createdAt: "2026-04-17T09:00:00.000Z",
      sessionIds: ["session-1"],
    },
  ],
  timelogs: [],
  calendarItems: [],
  entityLinks: [
    {
      id: "link-1",
      fromType: "activity",
      fromId: "activity-1",
      toType: "session",
      toId: "session-1",
      relation: "has_session",
      createdAt: "2026-04-17T09:00:00.000Z",
    },
  ],
  attachments: [],
  settings: {
    apiKey: "",
    textModel: "gpt-5.4-mini",
  },
} as unknown as DesktopAppSnapshot;

describe("notesmithMcpBridge", () => {
  it("lists only low-risk read-only NoteSmith tools", () => {
    const tools = listNoteSmithMcpTools();
    expect(tools.map((tool) => tool.name)).toContain("notesmith_search_sessions");
    expect(tools.every((tool) => tool.riskLevel === "low")).toBe(true);
  });

  it("invokes search tools with private filtering by default", () => {
    const publicResult = invokeNoteSmithMcpTool(snapshot, "notesmith_search_sessions", { query: "Aurora" });
    expect(publicResult).toMatchObject({ sources: [] });

    const privateResult = invokeNoteSmithMcpTool(snapshot, "notesmith_search_sessions", {
      query: "Aurora",
      includePrivate: true,
    });
    expect("sources" in privateResult ? privateResult.sources[0]?.id : null).toBe("session-private");
  });

  it("returns linked context for session ids", () => {
    const result = invokeNoteSmithMcpTool(snapshot, "notesmith_get_linked_context", { id: "session-1" });
    expect("activity" in result ? result.activity?.id : null).toBe("activity-1");
    expect("todos" in result ? result.todos[0]?.id : null).toBe("todo-1");
  });

  it("returns a workspace summary through the MCP contract", () => {
    const result = invokeNoteSmithMcpTool(snapshot, "notesmith_summarize_workspace", {});
    expect("summary" in result && result.summary ? result.summary.snippet : "").toContain("1 active sessions");
  });
});
