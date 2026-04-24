import {
  addDays,
  layoutCalendarItems,
  clampPane,
  clampSlot,
  dayColumnWidthForView,
  durationFromTimes,
  durationLabel,
  getLocalDateString,
  initialCalendarScrollTop,
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

  it("uses local dates and scrolls to the hour before now on open", () => {
    expect(getLocalDateString(new Date(2026, 3, 19, 9, 30))).toBe("2026-04-19");
    expect(initialCalendarScrollTop(new Date(2026, 3, 19, 9, 30), 16)).toBe(102 * 16);
    expect(initialCalendarScrollTop(new Date(2026, 3, 19, 0, 20), 16)).toBe(0);
  });

  it("reflows visible items when completed todos are hidden", () => {
    const visible = layoutCalendarItems([
      {
        id: "todo-open",
        date: "2026-04-24",
        startSlot: 96,
        durationSlots: 1,
        targetType: "todo" as const,
        targetId: "todo-open",
        title: "Open todo",
        label: "Todo",
        isMeeting: false,
        isPrivate: false,
        isDone: false,
        lane: 0,
        laneCount: 1,
      },
      {
        id: "activity-overlap",
        date: "2026-04-24",
        startSlot: 96,
        durationSlots: 12,
        targetType: "activity" as const,
        targetId: "activity-overlap",
        title: "Overlap activity",
        label: "Activity",
        isMeeting: false,
        isPrivate: false,
        isDone: false,
        lane: 0,
        laneCount: 1,
      },
    ]);

    const openTodo = visible.find((item) => item.id === "todo-open");
    const activity = visible.find((item) => item.id === "activity-overlap");
    expect(openTodo?.lane).toBe(0);
    expect(activity?.lane).toBe(1);
    expect(openTodo?.laneCount).toBe(2);
    expect(activity?.laneCount).toBe(2);
  });
});
