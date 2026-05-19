import { createDefaultSnapshot } from "../lib/db/repository";
import {
  findNearestAvailableTodoSlot,
  inferTodoStructureAssignment,
  isSuspiciouslyReducedSnapshot,
  reconcileCalendarBackedScheduleFields,
  rollForwardOverdueCalendarTodos,
} from "./useDesktopStore";

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

const buildActivity = (id: string, description: string, doOn: string, startTime = "09:00", endTime = "10:00") => ({
  id,
  type: "meeting" as const,
  parentActivityId: "",
  description,
  isDone: false,
  isPrivate: false,
  comments: "",
  domain: "",
  project: "",
  activity: "",
  doOn,
  dueDate: "",
  startTime,
  endTime,
  detailsHtml: "",
  timeRequiredMinutes: 0,
  actualTimeSpentMinutes: 0,
  createdAt: "2026-04-18T08:00:00.000Z",
  sessionIds: [],
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

describe("findNearestAvailableTodoSlot", () => {
  it("uses the preferred slot when it is empty", () => {
    expect(findNearestAvailableTodoSlot([], "2026-04-22", 120)).toBe(120);
  });

  it("places new todos in the nearest free slot, preferring later slots over earlier slots", () => {
    const calendarItems = [
      buildCalendarActivity("current-meeting", "2026-04-22", 120, 1),
    ];

    expect(findNearestAvailableTodoSlot(calendarItems, "2026-04-22", 120)).toBe(121);
  });

  it("falls back to the nearest earlier slot when the immediate later slots are occupied", () => {
    const calendarItems = [
      buildCalendarActivity("current-meeting", "2026-04-22", 120, 2),
      buildCalendarTodo("later-todo", "todo-later", "2026-04-22", 122),
    ];

    expect(findNearestAvailableTodoSlot(calendarItems, "2026-04-22", 120)).toBe(119);
  });
});

describe("reconcileCalendarBackedScheduleFields", () => {
  it("keeps the todo do-on date authoritative and rewrites the calendar row to match", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = [buildTodo("todo-1", "Mismatch", "2026-04-23")];
    snapshot.calendarItems = [buildCalendarTodo("calendar-1", "todo-1", "2026-04-22", 120)];

    const result = reconcileCalendarBackedScheduleFields(snapshot);

    expect(result.changed).toBe(true);
    expect(result.snapshot.todos[0]?.doOn).toBe("2026-04-23");
    expect(result.snapshot.calendarItems[0]).toMatchObject({
      id: "calendar-1",
      date: "2026-04-23",
    });
  });

  it("backfills a missing todo do-on date from the calendar row", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = [buildTodo("todo-1", "Missing date", "")];
    snapshot.calendarItems = [buildCalendarTodo("calendar-1", "todo-1", "2026-04-22", 120)];

    const result = reconcileCalendarBackedScheduleFields(snapshot);

    expect(result.changed).toBe(true);
    expect(result.snapshot.todos[0]?.doOn).toBe("2026-04-22");
  });

  it("keeps the meeting date and times authoritative and rewrites the calendar row to match", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.activities = [buildActivity("activity-1", "Meeting", "2026-04-23", "09:00", "10:00")];
    snapshot.calendarItems = [
      {
        ...buildCalendarActivity("activity-1", "2026-04-22", 132, 18),
        targetId: "activity-1",
      },
    ];

    const result = reconcileCalendarBackedScheduleFields(snapshot);

    expect(result.changed).toBe(true);
    expect(result.snapshot.activities[0]).toMatchObject({
      doOn: "2026-04-23",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result.snapshot.calendarItems[0]).toMatchObject({
      targetId: "activity-1",
      date: "2026-04-23",
      startSlot: 108,
      durationSlots: 12,
    });
  });

  it("backfills missing meeting date and times from the calendar row", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.activities = [buildActivity("activity-1", "Meeting", "", "", "")];
    snapshot.calendarItems = [
      {
        ...buildCalendarActivity("activity-1", "2026-04-22", 132, 18),
        targetId: "activity-1",
      },
    ];

    const result = reconcileCalendarBackedScheduleFields(snapshot);

    expect(result.changed).toBe(true);
    expect(result.snapshot.activities[0]).toMatchObject({
      doOn: "2026-04-22",
      startTime: "11:00",
      endTime: "12:30",
    });
  });
});

describe("inferTodoStructureAssignment", () => {
  it("backfills domain, project, and activity for a short recurring title like Regnora", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = [
      buildTodo("todo-regnora-1", "Regnora follow-up", "2026-05-07"),
      buildTodo("todo-regnora-2", "Regnora review", "2026-05-08"),
    ].map((todo) => ({
      ...todo,
      domain: "Clinical Success",
      project: "Regnora",
      activity: "Regnora",
      updatedAt: "2026-05-08T08:00:00.000Z",
      participantText: "",
    }));

    const inferred = inferTodoStructureAssignment(snapshot, "Regnora", {
      activityId: "",
      domain: "",
      project: "",
      activity: "",
    });

    expect(inferred).toMatchObject({
      domain: "Clinical Success",
      project: "Regnora",
      activity: "Regnora",
    });
  });

  it("treats Other/Other/Other placeholders as blank so real historical matches can replace them", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.activities = [
      {
        id: "activity-regnora",
        type: "meeting",
        parentActivityId: "",
        description: "Regnora",
        participantText: "",
        isDone: false,
        isPrivate: false,
        comments: "",
        domain: "AI",
        project: "Regnora",
        activity: "Meetings",
        doOn: "2026-05-13",
        dueDate: "",
        startTime: "15:00",
        endTime: "15:15",
        detailsHtml: "",
        timeRequiredMinutes: 0,
        actualTimeSpentMinutes: 20,
        createdAt: "2026-05-11T09:29:32.215Z",
        updatedAt: "2026-05-13T13:25:58.417Z",
        sessionIds: [],
      },
    ];

    const inferred = inferTodoStructureAssignment(snapshot, "Regnora", {
      activityId: "",
      domain: "Other",
      project: "Other",
      activity: "Other",
    });

    expect(inferred).toMatchObject({
      domain: "AI",
      project: "Regnora",
      activity: "Meetings",
    });
  });
});

describe("isSuspiciouslyReducedSnapshot", () => {
  it("flags snapshots where many calendar todo rows have lost their source todos", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = [buildTodo("todo-1", "Only survivor", "2026-05-19")];
    snapshot.calendarItems = Array.from({ length: 12 }, (_, index) =>
      buildCalendarTodo(`calendar-${index + 1}`, `todo-${index + 1}`, "2026-05-19", 96 + index),
    );

    expect(isSuspiciouslyReducedSnapshot(snapshot)).toBe(true);
  });

  it("does not flag snapshots when calendar todo rows still have matching todo records", () => {
    const snapshot = createDefaultSnapshot();
    snapshot.todos = Array.from({ length: 12 }, (_, index) =>
      buildTodo(`todo-${index + 1}`, `Todo ${index + 1}`, "2026-05-19"),
    );
    snapshot.calendarItems = snapshot.todos.map((todo, index) =>
      buildCalendarTodo(`calendar-${index + 1}`, todo.id, "2026-05-19", 96 + index),
    );

    expect(isSuspiciouslyReducedSnapshot(snapshot)).toBe(false);
  });
});
