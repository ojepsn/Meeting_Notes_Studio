import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityRecord, CalendarItemRecord, TodoRecord } from "@notesmith/domain";

const SLOTS_PER_HOUR = 12;
const SLOT_COUNT = 24 * SLOTS_PER_HOUR;
const MINUTES_PER_SLOT = 5;
const DAY_EXTENSION_COUNT = 7;
const INITIAL_DAYS_BEFORE = 3;
const INITIAL_DAYS_AFTER = 10;
const TIME_COLUMN_WIDTH = 82;
const DAY_WIDTHS = [180, 220, 280];
const SLOT_HEIGHTS = [14, 18, 24];

const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

const buildDateRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
};

const formatDayLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00`));

const slotToTimeLabel = (slot: number) => {
  const totalMinutes = slot * MINUTES_PER_SLOT;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

type CalendarRenderItem = CalendarItemRecord & {
  label: string;
  kindLabel: string;
  isMeeting: boolean;
};

interface CalendarWorkspaceProps {
  todos: TodoRecord[];
  activities: ActivityRecord[];
  calendarItems: CalendarItemRecord[];
  onCreateFromText: (date: string, startSlot: number, value: string) => void;
  onMoveItem: (id: string, date: string, startSlot: number) => void;
  onOpenTodoWorkspace: () => void;
  onOpenActivityWorkspace: (activityId: string) => void;
}

export const CalendarWorkspace = ({
  todos = [],
  activities = [],
  calendarItems = [],
  onCreateFromText,
  onMoveItem,
  onOpenTodoWorkspace,
  onOpenActivityWorkspace,
}: CalendarWorkspaceProps) => {
  const today = new Date().toISOString().slice(0, 10);
  const [rangeStart, setRangeStart] = useState(addDays(today, -INITIAL_DAYS_BEFORE));
  const [rangeEnd, setRangeEnd] = useState(addDays(today, INITIAL_DAYS_AFTER));
  const [dayScaleIndex, setDayScaleIndex] = useState(1);
  const [timeScaleIndex, setTimeScaleIndex] = useState(1);
  const [activeCell, setActiveCell] = useState<{ date: string; slot: number } | null>(null);
  const [cellDraft, setCellDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prependAdjustmentRef = useRef<number | null>(null);
  const initializedScrollRef = useRef(false);

  const dayWidth = DAY_WIDTHS[dayScaleIndex];
  const slotHeight = SLOT_HEIGHTS[timeScaleIndex];
  const dates = useMemo(() => buildDateRange(rangeStart, rangeEnd), [rangeEnd, rangeStart]);
  const safeTodos = Array.isArray(todos) ? todos : [];
  const safeActivities = Array.isArray(activities) ? activities : [];
  const safeCalendarItems = Array.isArray(calendarItems) ? calendarItems : [];

  const itemsByDate = useMemo(() => {
    const todoMap = new Map(safeTodos.map((todo) => [todo.id, todo]));
    const activityMap = new Map(safeActivities.map((activity) => [activity.id, activity]));
    const grouped = new Map<string, CalendarRenderItem[]>();

    safeCalendarItems.forEach((item) => {
      const target = item.targetType === "todo" ? todoMap.get(item.targetId) : activityMap.get(item.targetId);
      if (!target) {
        return;
      }
      const renderItem: CalendarRenderItem = {
        ...item,
        label: target.description,
        kindLabel:
          item.targetType === "todo"
            ? "Todo"
            : (target as ActivityRecord).type === "meeting"
              ? "Meeting"
              : "Activity",
        isMeeting: item.targetType === "activity" && (target as ActivityRecord).type === "meeting",
      };
      const existing = grouped.get(item.date) ?? [];
      existing.push(renderItem);
      grouped.set(item.date, existing);
    });

    grouped.forEach((items, date) => {
      grouped.set(
        date,
        [...items].sort((left, right) => left.startSlot - right.startSlot || right.durationSlots - left.durationSlots),
      );
    });

    return grouped;
  }, [safeActivities, safeCalendarItems, safeTodos]);

  useEffect(() => {
    if (!scrollRef.current || initializedScrollRef.current) return;
    const currentHour = new Date().getHours();
    scrollRef.current.scrollTop = Math.max(0, (currentHour * SLOTS_PER_HOUR - 6) * slotHeight);
    scrollRef.current.scrollLeft = INITIAL_DAYS_BEFORE * dayWidth;
    initializedScrollRef.current = true;
  }, [dayWidth, slotHeight]);

  useEffect(() => {
    if (!scrollRef.current || prependAdjustmentRef.current == null) return;
    scrollRef.current.scrollLeft += prependAdjustmentRef.current;
    prependAdjustmentRef.current = null;
  }, [dates.length, dayWidth]);

  const commitCellDraft = () => {
    if (!activeCell || !cellDraft.trim()) {
      setActiveCell(null);
      setCellDraft("");
      return;
    }
    onCreateFromText(activeCell.date, activeCell.slot, cellDraft);
    setActiveCell(null);
    setCellDraft("");
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const threshold = dayWidth * 1.5;
    if (element.scrollLeft < threshold) {
      setRangeStart((current) => {
        prependAdjustmentRef.current = dayWidth * DAY_EXTENSION_COUNT;
        return addDays(current, -DAY_EXTENSION_COUNT);
      });
    } else if (element.scrollWidth - element.clientWidth - element.scrollLeft < threshold) {
      setRangeEnd((current) => addDays(current, DAY_EXTENSION_COUNT));
    }
  };

  return (
    <div className="card calendar-workspace">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Calendar</h2>
        </div>
        <div className="page-actions">
          <button className="shell-button" type="button" onClick={() => {
            setRangeStart(addDays(today, -INITIAL_DAYS_BEFORE));
            setRangeEnd(addDays(today, INITIAL_DAYS_AFTER));
            setActiveCell(null);
            setCellDraft("");
            initializedScrollRef.current = false;
          }}>
            Today
          </button>
          <div className="capture-density-toggle">
            <button className="segment-button" type="button" disabled={dayScaleIndex === 0} onClick={() => setDayScaleIndex((value) => Math.max(0, value - 1))}>
              Fewer days
            </button>
            <button className="segment-button" type="button" disabled={dayScaleIndex === DAY_WIDTHS.length - 1} onClick={() => setDayScaleIndex((value) => Math.min(DAY_WIDTHS.length - 1, value + 1))}>
              More detail
            </button>
          </div>
          <div className="capture-density-toggle">
            <button className="segment-button" type="button" disabled={timeScaleIndex === 0} onClick={() => setTimeScaleIndex((value) => Math.max(0, value - 1))}>
              More hours
            </button>
            <button className="segment-button" type="button" disabled={timeScaleIndex === SLOT_HEIGHTS.length - 1} onClick={() => setTimeScaleIndex((value) => Math.min(SLOT_HEIGHTS.length - 1, value + 1))}>
              More time detail
            </button>
          </div>
        </div>
      </div>

      <div className="workspace-guide-row workspace-guide-row-quiet">
        <span className="tiny-text">Type directly into a slot to create a todo, or use `td`, `act`, or `meet` prefixes. Drag blocks to reschedule them.</span>
      </div>

      <div className="calendar-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div
          className="calendar-surface"
          style={{
            gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${dates.length}, ${dayWidth}px)`,
            gridTemplateRows: `52px ${SLOT_COUNT * slotHeight}px`,
          }}
        >
          <div className="calendar-corner" />
          {dates.map((date) => (
            <div key={`header-${date}`} className="calendar-day-header">
              <strong>{date}</strong>
              <span>{formatDayLabel(date)}</span>
            </div>
          ))}

          <div className="calendar-time-column">
            {Array.from({ length: SLOT_COUNT }, (_, slot) => (
              <div key={`time-${slot}`} className={`calendar-time-cell${slot % SLOTS_PER_HOUR === 0 ? " calendar-time-cell-hour" : ""}`} style={{ height: slotHeight }}>
                <span>{slotToTimeLabel(slot)}</span>
              </div>
            ))}
          </div>

          {dates.map((date) => (
            <div key={date} className="calendar-day-column" style={{ height: SLOT_COUNT * slotHeight }}>
              {Array.from({ length: SLOT_COUNT }, (_, slot) => {
                const isActive = activeCell?.date === date && activeCell.slot === slot;
                return (
                  <div
                    key={`${date}-${slot}`}
                    className={`calendar-grid-cell${slot % SLOTS_PER_HOUR === 0 ? " calendar-grid-cell-hour" : ""}${isActive ? " calendar-grid-cell-active" : ""}`}
                    style={{ height: slotHeight }}
                    onClick={() => {
                      setActiveCell({ date, slot });
                      setCellDraft("");
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const itemId = event.dataTransfer.getData("text/plain");
                      if (itemId) {
                        onMoveItem(itemId, date, slot);
                      }
                    }}
                  >
                    {isActive ? (
                      <input
                        autoFocus
                        className="calendar-cell-input"
                        value={cellDraft}
                        onChange={(event) => setCellDraft(event.target.value)}
                        onBlur={commitCellDraft}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            commitCellDraft();
                          }
                          if (event.key === "Escape") {
                            setActiveCell(null);
                            setCellDraft("");
                          }
                        }}
                        placeholder="Add todo, act, or meet"
                      />
                    ) : null}
                  </div>
                );
              })}

              {(itemsByDate.get(date) ?? []).map((item) => (
                <button
                  key={item.id}
                  className={`calendar-item-block${item.isMeeting ? " calendar-item-block-meeting" : ""}`}
                  style={{
                    top: item.startSlot * slotHeight + 1,
                    height: Math.max(slotHeight - 2, item.durationSlots * slotHeight - 2),
                  }}
                  draggable
                  type="button"
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                  onDoubleClick={() => {
                    if (item.targetType === "todo") {
                      onOpenTodoWorkspace();
                    } else {
                      onOpenActivityWorkspace(item.targetId);
                    }
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.kindLabel}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
