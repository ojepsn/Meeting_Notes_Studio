import { describe, expect, it } from "vitest";
import type { TimeLogRecord } from "@notesmith/domain";
import { getRunningTodoIds } from "./todosWindowBridge";

const log = (id: string, targetType: TimeLogRecord["targetType"], targetId: string, startTime: string, endTime: string): TimeLogRecord => ({
  id,
  targetType,
  targetId,
  date: "2026-08-13",
  startTime,
  endTime,
  durationMinutes: 0,
  notes: "",
  createdAt: "2026-08-13T08:00:00Z",
  updatedAt: "2026-08-13T08:00:00Z",
});

describe("getRunningTodoIds", () => {
  it("returns only unique Todos with open time logs", () => {
    expect(getRunningTodoIds([
      log("1", "todo", "todo-1", "09:00", "09:00"),
      log("2", "todo", "todo-1", "08:00", "08:30"),
      log("3", "activity", "activity-1", "10:00", "10:00"),
    ])).toEqual(["todo-1"]);
  });
});
