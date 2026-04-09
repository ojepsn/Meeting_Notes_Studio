import {
  buildExportFilename,
  buildJsonExportFilename,
  calculateDurationMinutes,
  differenceInDaysInclusive,
  formatMinutes,
  getPresetRange,
  shiftDays,
} from "./TimeWorkspace";

describe("TimeWorkspace helpers", () => {
  it("formats minutes in a readable way", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(135)).toBe("2h 15m");
  });

  it("shifts dates and measures inclusive ranges", () => {
    expect(shiftDays("2026-04-09", 2)).toBe("2026-04-11");
    expect(differenceInDaysInclusive("2026-04-09", "2026-04-11")).toBe(3);
  });

  it("builds preset ranges for today, week, and month", () => {
    const now = new Date("2026-04-09T10:00:00");
    expect(getPresetRange("today", now)).toEqual({
      fromDate: "2026-04-09",
      toDate: "2026-04-09",
      label: "Today",
    });
    expect(getPresetRange("this-week", now)).toEqual({
      fromDate: "2026-04-06",
      toDate: "2026-04-12",
      label: "This week",
    });
    expect(getPresetRange("this-month", now)).toEqual({
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      label: "This month",
    });
  });

  it("calculates time-log duration from date/time input", () => {
    expect(calculateDurationMinutes("2026-04-09", "09:00", "10:30")).toBe(90);
    expect(calculateDurationMinutes("2026-04-09", "09:00", "08:00")).toBe(0);
  });

  it("builds stable export filenames", () => {
    const now = new Date("2026-04-09T10:11:12");
    expect(buildExportFilename("csv", now)).toBe("notesmith-time-report-2026-04-09-10-11-12.csv");
    expect(buildJsonExportFilename(now)).toBe("notesmith-time-report-2026-04-09-10-11-12.json");
  });
});
