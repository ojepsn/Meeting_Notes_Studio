import { describe, expect, it } from "vitest";
import type { TodoRecord } from "@notesmith/domain";
import {
  applyNotebookTodoCompletionAnchors,
  DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS,
  filterNotebookTodos,
  normalizeNotebookTodoViewSettings,
  sortNotebookTodos,
} from "./NotebookTodosPanel";

const todo = (id: string, description: string, priority: TodoRecord["priority"], createdAt: string): TodoRecord => ({
  id,
  description,
  isDone: false,
  isPrivate: false,
  priority,
  isPriority: priority === "high",
  isUrgent: false,
  comments: "",
  activityId: "",
  domain: "",
  project: "",
  activity: "",
  doOn: "",
  dueDate: "",
  detailsHtml: "",
  createdAt,
  updatedAt: createdAt,
  sessionIds: [],
});

describe("Notebook Todos sorting", () => {
  const todos = [
    todo("1", "Zulu", "normal", "2026-08-09T08:00:00Z"),
    todo("2", "Alpha", "high", "2026-08-10T08:00:00Z"),
    todo("3", "Bravo", "low", "2026-08-08T08:00:00Z"),
  ];

  it("sorts alphabetically in both directions", () => {
    expect(sortNotebookTodos(todos, "title-asc").map((entry) => entry.id)).toEqual(["2", "3", "1"]);
    expect(sortNotebookTodos(todos, "title-desc").map((entry) => entry.id)).toEqual(["1", "3", "2"]);
  });

  it("sorts by creation time and priority in both directions", () => {
    expect(sortNotebookTodos(todos, "created-desc").map((entry) => entry.id)).toEqual(["2", "1", "3"]);
    expect(sortNotebookTodos(todos, "created-asc").map((entry) => entry.id)).toEqual(["3", "1", "2"]);
    expect(sortNotebookTodos(todos, "priority-desc").map((entry) => entry.id)).toEqual(["2", "1", "3"]);
    expect(sortNotebookTodos(todos, "priority-asc").map((entry) => entry.id)).toEqual(["3", "1", "2"]);
  });

  it("combines free-text, privacy, urgency, and priority filters", () => {
    const privateUrgent = {
      ...todo("4", "Regnora follow-up", "high", "2026-08-10T09:00:00Z"),
      isPrivate: true,
      isUrgent: true,
      detailsHtml: "<p>Prepare the safety response</p>",
    };
    const candidates = [...todos, privateUrgent];

    expect(filterNotebookTodos(candidates, {
      query: "safety",
      domain: "all",
      project: "all",
      activity: "all",
      showBusiness: true,
      showPrivate: true,
      urgentOnly: true,
      priority: "high",
    }).map((entry) => entry.id)).toEqual(["4"]);

    expect(filterNotebookTodos(candidates, {
      query: "regnora",
      domain: "all",
      project: "all",
      activity: "all",
      showBusiness: true,
      showPrivate: false,
      urgentOnly: false,
      priority: "all",
    })).toEqual([]);
  });

  it("combines exact Domain, Project, and Activity filters with free text", () => {
    const matching = {
      ...todo("4", "Regnora planning", "normal", "2026-08-10T09:00:00Z"),
      domain: "Clinical Success",
      project: "Regnora",
      activity: "Planning",
    };
    const wrongActivity = { ...matching, id: "5", activity: "Meetings" };

    expect(filterNotebookTodos([matching, wrongActivity], {
      query: "regnora",
      domain: "clinical success",
      project: "Regnora",
      activity: "Planning",
      showBusiness: true,
      showPrivate: true,
      urgentOnly: false,
      priority: "all",
    }).map((entry) => entry.id)).toEqual(["4"]);
  });

  it("keeps a newly completed todo at its previous visible index", () => {
    const reorderedAfterSave = [todos[1], todos[2], { ...todos[0], isDone: true }];
    expect(applyNotebookTodoCompletionAnchors(reorderedAfterSave, { "1": 0 }).map((entry) => entry.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("restores every persisted checkbox and radio setting", () => {
    expect(normalizeNotebookTodoViewSettings({
      sortField: "updated",
      sortDirection: "asc",
      showBusiness: false,
      showPrivate: true,
      showCompleted: false,
      urgentOnly: true,
      priorityFilter: "high",
      domainFilter: "Clinical Success",
      projectFilter: "Regnora",
      activityFilter: "Planning",
    })).toEqual({
      sortField: "updated",
      sortDirection: "asc",
      showBusiness: false,
      showPrivate: true,
      showCompleted: false,
      urgentOnly: true,
      priorityFilter: "high",
      domainFilter: "Clinical Success",
      projectFilter: "Regnora",
      activityFilter: "Planning",
    });
  });

  it("falls back safely when persisted settings are incomplete or invalid", () => {
    expect(normalizeNotebookTodoViewSettings({ showCompleted: false, sortField: "unknown" })).toEqual({
      ...DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS,
      showCompleted: false,
    });
  });
});
