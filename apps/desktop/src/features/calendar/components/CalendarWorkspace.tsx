import { useMemo, useState } from "react";
import type { ActivityRecord, CalendarItemRecord, TodoRecord } from "@notesmith/domain";

const MINUTES_PER_SLOT = 5;
const RANGE_SHIFT_DAYS = 7;
const INITIAL_DAYS_BEFORE = 7;
const INITIAL_DAYS_AFTER = 21;

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
  onOpenTodoWorkspace,
  onOpenActivityWorkspace,
}: CalendarWorkspaceProps) => {
  const today = new Date().toISOString().slice(0, 10);
  const [rangeStart, setRangeStart] = useState(addDays(today, -INITIAL_DAYS_BEFORE));
  const [rangeEnd, setRangeEnd] = useState(addDays(today, INITIAL_DAYS_AFTER));
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

  return (
    <div className="card calendar-workspace">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Calendar</h2>
        </div>
        <div className="page-actions">
          <button
            className="shell-button"
            type="button"
            onClick={() => {
              setRangeStart((current) => addDays(current, -RANGE_SHIFT_DAYS));
              setRangeEnd((current) => addDays(current, -RANGE_SHIFT_DAYS));
            }}
          >
            Previous
          </button>
          <button
            className="shell-button"
            type="button"
            onClick={() => {
              setRangeStart(addDays(today, -INITIAL_DAYS_BEFORE));
              setRangeEnd(addDays(today, INITIAL_DAYS_AFTER));
            }}
          >
            Today
          </button>
          <button
            className="shell-button"
            type="button"
            onClick={() => {
              setRangeStart((current) => addDays(current, RANGE_SHIFT_DAYS));
              setRangeEnd((current) => addDays(current, RANGE_SHIFT_DAYS));
            }}
          >
            Next
          </button>
        </div>
      </div>

      <div className="workspace-guide-row workspace-guide-row-quiet">
        <span className="tiny-text">Calendar is temporarily running in a stable agenda mode while the interactive time-grid is rebuilt in smaller steps.</span>
      </div>

      <div className="calendar-calendar-summary">
        <div className="status-chip">{dates.length} days in view</div>
        <div className="status-chip">{safeCalendarItems.length} scheduled items</div>
        <div className="status-chip">Interactive grid temporarily disabled</div>
      </div>

      <div className="calendar-agenda-list">
        {dates.map((date) => {
          const items = itemsByDate.get(date) ?? [];
          return (
            <div key={`agenda-${date}`} className="calendar-agenda-day">
              <div className="calendar-agenda-day-header">
                <strong>{date}</strong>
                <span>{formatDayLabel(date)}</span>
              </div>
              {items.length ? (
                items.map((item) => (
                  <button
                    key={`agenda-item-${item.id}`}
                    className={`calendar-agenda-item${item.isMeeting ? " calendar-agenda-item-meeting" : ""}`}
                    type="button"
                    onClick={() => {
                      if (item.targetType === "todo") {
                        onOpenTodoWorkspace();
                      } else {
                        onOpenActivityWorkspace(item.targetId);
                      }
                    }}
                  >
                    <strong>{slotToTimeLabel(item.startSlot)} {item.label}</strong>
                    <span>{item.kindLabel}</span>
                  </button>
                ))
              ) : (
                <div className="calendar-agenda-empty">No scheduled items</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
