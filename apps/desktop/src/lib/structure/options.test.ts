import { describe, expect, it } from "vitest";
import { buildStructureOptions, getActivitiesForSelection, getProjectsForDomain } from "./options";
import type { ActivityRecord, ProjectLinkRecord, SessionRecord, TodoRecord } from "@notesmith/domain";

const sessions: SessionRecord[] = [
  {
    id: "session-1",
    captureMode: "meeting-note",
    templateId: "meeting",
    title: "Session",
    isPrivate: false,
    participantText: "",
    project: "Project Atlas",
    domain: "Finance",
    activity: "Budget review",
    tagsText: "",
    date: "2026-04-09",
    startTime: "",
    endTime: "",
    quickHighlights: "",
    detailLevel: 3,
    manualNotes: "",
    liveTranscript: "",
    uploadedTranscript: "",
    customFieldValues: {},
    excludedSectionIds: [],
    output: "",
    outputVersions: [],
    createdAt: "2026-04-09T10:00:00.000Z",
    updatedAt: "2026-04-09T10:00:00.000Z",
  },
];

const todos: TodoRecord[] = [
  {
    id: "todo-1",
    description: "Prepare budget",
    isDone: false,
    isPrivate: false,
    comments: "",
    activityId: "",
    domain: "Finance",
    project: "Project Atlas",
    activity: "Budget review",
    doOn: "",
    dueDate: "",
    detailsHtml: "",
    createdAt: "2026-04-09T10:00:00.000Z",
    sessionIds: [],
  },
];

const activities: ActivityRecord[] = [
  {
    id: "activity-1",
    type: "task",
    parentActivityId: "",
    description: "Budget review",
    isDone: false,
    isPrivate: false,
    comments: "",
    domain: "Finance",
    project: "Project Atlas",
    activity: "",
    doOn: "",
    dueDate: "",
    startTime: "",
    endTime: "",
    detailsHtml: "",
    timeRequiredMinutes: 0,
    actualTimeSpentMinutes: 0,
    createdAt: "2026-04-09T10:00:00.000Z",
    sessionIds: [],
  },
  {
    id: "activity-2",
    type: "meeting",
    parentActivityId: "",
    description: "Product sync",
    isDone: false,
    isPrivate: false,
    comments: "",
    domain: "Product",
    project: "Project Nova",
    activity: "",
    doOn: "",
    dueDate: "",
    startTime: "",
    endTime: "",
    detailsHtml: "",
    timeRequiredMinutes: 0,
    actualTimeSpentMinutes: 0,
    createdAt: "2026-04-09T10:00:00.000Z",
    sessionIds: [],
  },
];

const projectLinks: ProjectLinkRecord[] = [
  { id: "link-1", project: "Project Atlas", domain: "Finance" },
  { id: "link-2", project: "Project Nova", domain: "Product" },
];

describe("structure options", () => {
  it("collects all known domains, projects, and activities", () => {
    const options = buildStructureOptions({
      savedDomains: ["Operations"],
      savedProjects: ["Project Orion"],
      savedActivities: ["Quarterly planning"],
      projectLinks,
      sessions,
      todos,
      activities,
    });

    expect(options.domains).toEqual(["Finance", "Operations", "Product"]);
    expect(options.projects).toEqual(["Project Atlas", "Project Nova", "Project Orion"]);
    expect(options.activities).toEqual(["Budget review", "Product sync", "Quarterly planning"]);
  });

  it("filters projects by domain", () => {
    const options = buildStructureOptions({
      savedDomains: [],
      savedProjects: [],
      savedActivities: [],
      projectLinks,
      sessions,
      todos,
      activities,
    });

    expect(getProjectsForDomain(options, "Finance")).toEqual(["Project Atlas"]);
    expect(getProjectsForDomain(options, "Product")).toEqual(["Project Nova"]);
  });

  it("filters activities by selected domain and project", () => {
    const options = buildStructureOptions({
      savedDomains: [],
      savedProjects: [],
      savedActivities: [],
      projectLinks,
      sessions,
      todos,
      activities,
    });

    expect(getActivitiesForSelection(options, "Finance", "")).toEqual(["Budget review"]);
    expect(getActivitiesForSelection(options, "", "Project Nova")).toEqual(["Product sync"]);
    expect(getActivitiesForSelection(options, "Product", "Project Nova")).toEqual(["Product sync"]);
  });
});
