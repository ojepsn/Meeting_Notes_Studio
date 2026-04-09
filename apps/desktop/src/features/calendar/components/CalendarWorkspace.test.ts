import {
  addDays,
  clampPane,
  clampSlot,
  dayColumnWidthForView,
  durationFromTimes,
  durationLabel,
  slotToTime,
  timeToSlot,
} from "./CalendarWorkspace";

describe("CalendarWorkspace helpers", () => {
  it("adds days to the anchor date", () => {
    expect(addDays("2026-04-09", 5)).toBe("2026-04-14");
  });

  it("converts between slots and times", () => {
    expect(timeToSlot("09:25")).toBe(113);
    expect(slotToTime(113)).toBe("09:25");
  });

  it("clamps slot and pane values into supported bounds", () => {
    expect(clampSlot(-5)).toBe(0);
    expect(clampSlot(9999)).toBe(287);
    expect(clampPane(100)).toBe(240);
    expect(clampPane(1000)).toBe(520);
  });

  it("computes meeting durations and labels", () => {
    expect(durationFromTimes("09:00", "10:00")).toBe(12);
    expect(durationLabel(12)).toBe("1h");
    expect(durationLabel(3)).toBe("15 min");
  });

  it("shrinks day columns as the view expands", () => {
    expect(dayColumnWidthForView(3)).toBeGreaterThan(dayColumnWidthForView(5));
    expect(dayColumnWidthForView(5)).toBeGreaterThan(dayColumnWidthForView(7));
    expect(dayColumnWidthForView(7)).toBeGreaterThan(dayColumnWidthForView(14));
  });
});
