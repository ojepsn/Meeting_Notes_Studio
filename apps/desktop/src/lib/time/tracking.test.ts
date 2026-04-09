import { describe, expect, it } from "vitest";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "./tracking";
import type { TimeLogRecord } from "@notesmith/domain";

const buildLog = (overrides?: Partial<TimeLogRecord>): TimeLogRecord => ({
  id: "log-1",
  targetType: "todo",
  targetId: "todo-1",
  date: "2026-04-09",
  startTime: "09:00",
  endTime: "09:00",
  durationMinutes: 0,
  notes: "",
  createdAt: "2026-04-09T09:00:00.000Z",
  updatedAt: "2026-04-09T09:00:00.000Z",
  ...overrides,
});

describe("time tracking helpers", () => {
  it("detects running logs", () => {
    expect(isTimeLogRunning(buildLog())).toBe(true);
    expect(isTimeLogRunning(buildLog({ endTime: "09:30" }))).toBe(false);
  });

  it("returns the active running log", () => {
    const logs = [buildLog({ id: "a", endTime: "09:30" }), buildLog({ id: "b" })];
    expect(getRunningTimeLog(logs)?.id).toBe("b");
  });

  it("calculates live elapsed minutes", () => {
    const minutes = calculateLiveDurationMinutes(
      buildLog(),
      new Date("2026-04-09T10:15:00"),
    );
    expect(minutes).toBe(75);
  });

  it("formats tracked minutes compactly", () => {
    expect(formatTrackedMinutes(0)).toBe("0m");
    expect(formatTrackedMinutes(45)).toBe("45m");
    expect(formatTrackedMinutes(120)).toBe("2h");
    expect(formatTrackedMinutes(135)).toBe("2h 15m");
  });
});
