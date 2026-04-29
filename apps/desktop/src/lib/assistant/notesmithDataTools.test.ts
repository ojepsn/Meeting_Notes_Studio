import { describe, expect, it } from "vitest";
import type { DesktopAppSnapshot } from "@notesmith/domain";
import { buildAssistantPreviewAnswer, getNoteSmithLinkedContext, searchNoteSmithData, summarizeNoteSmithWorkspace } from "./notesmithDataTools";

const buildSnapshot = (): DesktopAppSnapshot => ({
  sessions: [
    {
      id: "session-public",
      captureMode: "meeting-note",
      templateId: "meeting",
      title: "ARE project risk meeting",
      isPrivate: false,
      deletedAt: null,
      participantText: "Ola, Anna",
      project: "ARE",
      domain: "Clinical",
      activity: "Risk review",
      tagsText: "protocol, risk",
      date: "2026-04-17",
      startTime: "09:00",
      endTime: "10:00",
      quickHighlights: "Protocol amendment",
      transcribeOnly: false,
      outputLanguage: "same",
      detailLevel: 3,
      additionalInstructions: "",
      manualNotes: "<p>Discussed recruitment risk and protocol amendment.</p>",
      liveTranscript: "",
      uploadedTranscript: "",
      customFieldValues: {},
      excludedSectionIds: [],
      output: "The team agreed to monitor recruitment risk.",
      outputVersions: [],
      createdAt: "2026-04-17T09:00:00.000Z",
      updatedAt: "2026-04-17T10:00:00.000Z",
    },
    {
      id: "session-private",
      captureMode: "meeting-note",
      templateId: "meeting",
      title: "Private acquisition discussion",
      isPrivate: true,
      deletedAt: null,
      participantText: "Ola",
      project: "Secret",
      domain: "Strategy",
      activity: "Confidential",
      tagsText: "",
      date: "2026-04-18",
      startTime: "11:00",
      endTime: "12:00",
      quickHighlights: "",
      transcribeOnly: false,
      outputLanguage: "same",
      detailLevel: 3,
      additionalInstructions: "",
      manualNotes: "Acquisition code name Aurora.",
      liveTranscript: "",
      uploadedTranscript: "",
      customFieldValues: {},
      excludedSectionIds: [],
      output: "",
      outputVersions: [],
      createdAt: "2026-04-18T11:00:00.000Z",
      updatedAt: "2026-04-18T12:00:00.000Z",
    },
  ],
  templates: [],
  todos: [
    {
      id: "todo-1",
      description: "Follow up recruitment risk",
      isDone: false,
      completedAt: null,
      isPrivate: false,
      comments: "",
      activityId: "activity-1",
      domain: "Clinical",
      project: "ARE",
      activity: "Risk review",
      doOn: "2026-04-19",
      dueDate: "",
      detailsHtml: "",
      createdAt: "2026-04-17T10:30:00.000Z",
      sessionIds: ["session-public"],
    },
  ],
  checklists: [],
  checklistTemplates: [],
  checklistRecurrences: [],
  archivedTasks: [],
  activities: [
    {
      id: "activity-1",
      type: "meeting",
      parentActivityId: "",
      description: "ARE project risk meeting",
      isDone: false,
      isPrivate: false,
      comments: "",
      domain: "Clinical",
      project: "ARE",
      activity: "Risk review",
      doOn: "2026-04-17",
      dueDate: "",
      startTime: "09:00",
      endTime: "10:00",
      detailsHtml: "",
      timeRequiredMinutes: 60,
      actualTimeSpentMinutes: 0,
      createdAt: "2026-04-17T09:00:00.000Z",
      sessionIds: ["session-public"],
    },
  ],
  timelogs: [],
  calendarItems: [
    {
      id: "calendar-1",
      targetType: "activity",
      targetId: "activity-1",
      date: "2026-04-17",
      startSlot: 108,
      durationSlots: 12,
      createdAt: "2026-04-17T08:00:00.000Z",
      updatedAt: "2026-04-17T08:00:00.000Z",
    },
  ],
  entityLinks: [
    {
      id: "link-1",
      fromType: "activity",
      fromId: "activity-1",
      toType: "session",
      toId: "session-public",
      relation: "has_session",
      createdAt: "2026-04-17T08:00:00.000Z",
    },
  ],
  attachments: [],
  settings: {
    theme: "fluent-slate-light",
    outputLanguage: "same",
    preferredDesktopTemplateId: "meeting",
    outputLayoutPresetId: "modern-minutes",
    notesCapturePaneWidth: 640,
    captureWorkspaceDensity: "minimal",
    outputWorkspaceDensity: "minimal",
    calendarDaysInView: 5,
    calendarSlotHeight: 16,
    calendarIsFullScreen: true,
    calendarFullScreenPreferenceInitialized: false,
    calendarDetailsPaneWidth: 320,
    calendarScrollTop: 0,
    calendarScrollLeft: 0,
    calendarVisibilityFilter: "all",
    baselineWorkEnabled: false,
    baselineWorkActivityId: "",
    apiKey: "",
    textModel: "gpt-5.4-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    savedParticipants: [],
    savedProjects: [],
    savedDomains: [],
    savedActivities: [],
    savedTags: [],
    projectLinks: [],
    timeReportPresets: [],
    abbreviations: [],
    preferredParticipantNames: [],
    ruleSuggestions: [],
    assistantQueryMemories: [],
    promptProfile: {
      meetingMinutesSystem: "",
      meetingMinutesRules: "",
      personalNotesSystem: "",
      personalNotesRules: "",
      revisionRules: "",
      translationRules: "",
      extraBlocks: [],
    },
  },
});

describe("notesmithDataTools", () => {
  it("searches sessions, todos, activities, and calendar records", () => {
    const results = searchNoteSmithData(buildSnapshot(), { query: "recruitment risk", limit: 10 });
    expect(results.map((result) => result.type)).toContain("session");
    expect(results.map((result) => result.type)).toContain("todo");
    expect(results.some((result) => result.title.includes("ARE"))).toBe(true);
  });

  it("excludes private records by default and includes them only when requested", () => {
    const publicResults = searchNoteSmithData(buildSnapshot(), { query: "Aurora", limit: 10 });
    expect(publicResults).toHaveLength(0);
    const privateResults = searchNoteSmithData(buildSnapshot(), { query: "Aurora", includePrivate: true, limit: 10 });
    expect(privateResults[0]?.id).toBe("session-private");
  });

  it("builds linked meeting context without direct database access", () => {
    const context = getNoteSmithLinkedContext(buildSnapshot(), "session-public");
    expect(context.activity?.id).toBe("activity-1");
    expect(context.calendarItems[0]?.id).toBe("calendar-1");
    expect(context.todos[0]?.id).toBe("todo-1");
  });

  it("summarizes the visible workspace and builds a local preview answer", () => {
    const snapshot = buildSnapshot();
    expect(summarizeNoteSmithWorkspace(snapshot).snippet).toContain("1 active sessions");
    const preview = buildAssistantPreviewAnswer(snapshot, "protocol amendment");
    expect(preview.answer).toContain("protocol amendment");
    expect(preview.sources.length).toBeGreaterThan(0);
  });
});
