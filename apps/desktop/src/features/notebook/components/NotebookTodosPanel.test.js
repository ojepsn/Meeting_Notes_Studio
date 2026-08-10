import { describe, expect, it } from "vitest";
import { applyNotebookTodoCompletionAnchors, filterNotebookTodos, sortNotebookTodos, } from "./NotebookTodosPanel";
const todo = (id, description, priority, createdAt) => ({
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
            showBusiness: true,
            showPrivate: true,
            urgentOnly: true,
            priority: "high",
        }).map((entry) => entry.id)).toEqual(["4"]);
        expect(filterNotebookTodos(candidates, {
            query: "regnora",
            showBusiness: true,
            showPrivate: false,
            urgentOnly: false,
            priority: "all",
        })).toEqual([]);
    });
    it("keeps a newly completed todo at its previous visible index", () => {
        const reorderedAfterSave = [todos[1], todos[2], { ...todos[0], isDone: true }];
        expect(applyNotebookTodoCompletionAnchors(reorderedAfterSave, { "1": 0 }).map((entry) => entry.id)).toEqual([
            "1",
            "2",
            "3",
        ]);
    });
});
