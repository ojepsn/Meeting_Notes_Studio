import { createDefaultSnapshot } from "../lib/db/repository";
import { rollForwardOverdueCalendarTodos } from "./useDesktopStore";

const buildTodo = (id: string, description: string, doOn: string, isDone = false) => ({
  id,
  description,
  isDone,
  isPrivate: false,
  comments: "",
  activityId: "",
  domain: "",
  project: "",
  activity: "",
  doOn,
  dueDate: "",
  detailsHtml: "",
  createdAt: "2026-04-18T08:00:00.000Z",
  sessionIds: [],
});

const buildCalendarTodo = (id: string, targetId: string, date: string, startSlot: number) => ({
  id,
  targetType: "todo" as const,
  targetId,
  date,
  startSlot,
  durationSlots: 1,
  createdAt: "2026-04-18T08:00:00.000Z",
  updatedAt: "2026-04-18T08:00:00.000Z",
});

const buildCalendarActivity = (id: string, date: string, startSlot: number, durationSlots: number) => ({
  id,
  targetType: "activity" as const,
  targetId: `activity-${id}`,
  date,
  startSlot,
  durationSlots,
  createdAt: "2026-04-18T08:00:00.000Z",
  updatedAt: "2026-04-18T08:00:00.000Z",
});

describe("rollForwardOverdueCalendarTodos", () => {
  it("moves overdue scheduled todos to today from 08:00 onwards and updates doOn", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = [
      buildTodo("todo-1", "Old first", "2026-04-19"),
      buildTodo("todo-2", "Old second", "2026-04-20"),
    ];
    snapshot.calendarItems = [
      buildCalendarActivity("existing-meeting", "2026-04-22", 96, 1),
      buildCalendarTodo("calendar-1", "todo-1", "2026-04-19", 120),
      buildCalendarTodo("calendar-2", "todo-2", "2026-04-20", 80),
    ];

    const result = rollForwardOverdueCalendarTodos(snapshot, "2026-04-22");

    expect(result.changed).toBe(true);
    expect(result.snapshot.todos.map((todo) => todo.doOn)).toEqual(["2026-04-22", "2026-04-22"]);
    expect(result.snapshot.calendarItems.find((item) => item.id === "calendar-1")).toMatchObject({
      date: "2026-04-22",
      startSlot: 97,
      durationSlots: 1,
    });
    expect(result.snapshot.calendarItems.find((item) => item.id === "calendar-2")).toMatchObject({
      date: "2026-04-22",
      startSlot: 98,
      durationSlots: 1,
    });
  });

  it("places two overdue todos per early row when there are more todos than free morning rows", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = Array.from({ length: 25 }, (_, index) =>
      buildTodo(`todo-${index}`, `Todo ${index}`, "2026-04-21"),
    );
    snapshot.calendarItems = snapshot.todos.map((todo, index) =>
      buildCalendarTodo(`calendar-${index}`, todo.id, "2026-04-21", 60 + index),
    );

    const result = rollForwardOverdueCalendarTodos(snapshot, "2026-04-22");
    const movedSlots = result.snapshot.calendarItems
      .filter((item) => item.targetType === "todo")
      .map((item) => item.startSlot);

    expect(result.changed).toBe(true);
    expect(movedSlots.slice(0, 4)).toEqual([96, 96, 97, 97]);
    expect(movedSlots.at(-1)).toBe(108);
  });

  it("leaves completed and current-day todos untouched", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = [
      buildTodo("todo-done", "Done", "2026-04-20", true),
      buildTodo("todo-today", "Today", "2026-04-22"),
    ];
    snapshot.calendarItems = [
      buildCalendarTodo("calendar-done", "todo-done", "2026-04-20", 60),
      buildCalendarTodo("calendar-today", "todo-today", "2026-04-22", 120),
    ];

    const result = rollForwardOverdueCalendarTodos(snapshot, "2026-04-22");

    expect(result.changed).toBe(false);
    expect(result.snapshot).toBe(snapshot);
  });
});
