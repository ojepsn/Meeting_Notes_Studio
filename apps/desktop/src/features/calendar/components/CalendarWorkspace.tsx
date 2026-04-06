import { useEffect, useMemo, useState } from "react";
import type { ActivityRecord, CalendarItemRecord, TodoRecord } from "@notesmith/domain";

const TOTAL_SLOTS = 24 * 12;
const MINUTES_PER_SLOT = 5;
const DEFAULT_DAYS_IN_VIEW = 3;
const DAYS_IN_VIEW_OPTIONS = [3, 5, 7, 14] as const;
const SLOT_HEIGHT_OPTIONS = [12, 16, 22] as const;

const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

const formatDayLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
};

const slotToTimeLabel = (slot: number) => {
  const totalMinutes = slot * MINUTES_PER_SLOT;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const timeToSlot = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 12 + Math.floor(minutes / MINUTES_PER_SLOT);
};

const clampSlot = (slot: number) => Math.max(0, Math.min(TOTAL_SLOTS - 1, slot));
const durationFromTimes = (startTime: string, endTime: string) => Math.max(1, timeToSlot(endTime) - timeToSlot(startTime));
const durationLabel = (durationSlots: number) => {
  const minutes = durationSlots * MINUTES_PER_SLOT;
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
};

type CalendarRenderItem = {
  id: string;
  date: string;
  startSlot: number;
  durationSlots: number;
  targetType: "todo" | "activity";
  targetId: string;
  title: string;
  label: string;
  isMeeting: boolean;
  isPrivate: boolean;
  domain: string;
  project: string;
  activity: string;
  dueDate: string;
  lane: number;
  laneCount: number;
};

type ActiveCell = {
  date: string;
  slot: number;
};

type CalendarEditorDraft = {
  itemId: string;
  targetType: "todo" | "activity";
  targetId: string;
  title: string;
  isPrivate: boolean;
  domain: string;
  project: string;
  activity: string;
  doOn: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  durationSlots: number;
  isMeeting: boolean;
};

type CalendarTypeFilter = "all" | "todo" | "activity" | "meeting";
type CalendarVisibilityFilter = "all" | "public" | "private";

type ResizeState = {
  itemId: string;
  edge: "start" | "end";
  baseStartSlot: number;
  baseDurationSlots: number;
  currentStartSlot: number;
  currentDurationSlots: number;
  date: string;
};

interface CalendarWorkspaceProps {
  todos: TodoRecord[];
  activities: ActivityRecord[];
  calendarItems: CalendarItemRecord[];
  linkedSessionIdsByActivity: Record<string, string | null>;
  onCreateFromText: (date: string, startSlot: number, value: string) => void;
  onMoveItem: (id: string, date: string, startSlot: number) => void;
  onSaveTodo: (todo: TodoRecord) => void;
  onSaveActivity: (activity: ActivityRecord) => void;
  onUpdateCalendarItem: (id: string, updates: { date: string; startSlot: number; durationSlots: number }) => void;
  onOpenTodoWorkspace: () => void;
  onOpenActivityWorkspace: (activityId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onFullScreenChange?: (isFullScreen: boolean) => void;
}

export const CalendarWorkspace = ({
  todos,
  activities,
  calendarItems,
  linkedSessionIdsByActivity,
  onCreateFromText,
  onMoveItem,
  onSaveTodo,
  onSaveActivity,
  onUpdateCalendarItem,
  onOpenTodoWorkspace,
  onOpenActivityWorkspace,
  onOpenSession,
  onFullScreenChange,
}: CalendarWorkspaceProps) => {
  const today = new Date().toISOString().slice(0, 10);
  const safeTodos = Array.isArray(todos) ? todos : [];
  const safeActivities = Array.isArray(activities) ? activities : [];
  const safeCalendarItems = Array.isArray(calendarItems) ? calendarItems : [];
  const [anchorDate, setAnchorDate] = useState(today);
  const [daysInView, setDaysInView] = useState<number>(DEFAULT_DAYS_IN_VIEW);
  const [slotHeight, setSlotHeight] = useState<number>(16);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [draftText, setDraftText] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<CalendarEditorDraft | null>(null);
  const [jumpDate, setJumpDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CalendarTypeFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<CalendarVisibilityFilter>("all");
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    onFullScreenChange?.(isFullScreen);
    return () => {
      onFullScreenChange?.(false);
    };
  }, [isFullScreen, onFullScreenChange]);

  const visibleDates = useMemo(
    () => Array.from({ length: daysInView }, (_, index) => addDays(anchorDate, index)),
    [anchorDate, daysInView],
  );

  const items = useMemo<CalendarRenderItem[]>(() => {
    const todoMap = new Map(safeTodos.map((todo) => [todo.id, todo]));
    const activityMap = new Map(safeActivities.map((activity) => [activity.id, activity]));

    const baseItems = safeCalendarItems
      .map((item) => {
        if (item.targetType === "todo") {
          const todo = todoMap.get(item.targetId);
          if (!todo) {
            return null;
          }
          return {
            id: item.id,
            date: item.date,
            startSlot: item.startSlot,
            durationSlots: item.durationSlots,
            targetType: "todo" as const,
            targetId: item.targetId,
            title: todo.description,
            label: "Todo",
            isMeeting: false,
            isPrivate: todo.isPrivate,
            domain: todo.domain,
            project: todo.project,
            activity: todo.activity,
            dueDate: todo.dueDate,
            lane: 0,
            laneCount: 1,
          };
        }

        const activity = activityMap.get(item.targetId);
        if (!activity) {
          return null;
        }
        return {
          id: item.id,
          date: item.date,
          startSlot: item.startSlot,
          durationSlots: item.durationSlots,
          targetType: "activity" as const,
          targetId: item.targetId,
          title: activity.description,
          label: activity.type === "meeting" ? "Meeting" : "Activity",
          isMeeting: activity.type === "meeting",
          isPrivate: activity.isPrivate,
          domain: activity.domain,
          project: activity.project,
          activity: activity.activity,
          dueDate: activity.dueDate,
          lane: 0,
          laneCount: 1,
        };
      })
      .filter((item): item is CalendarRenderItem => item !== null)
      .sort((left, right) => {
        if (left.date !== right.date) {
          return left.date.localeCompare(right.date);
        }
        if (left.startSlot !== right.startSlot) {
          return left.startSlot - right.startSlot;
        }
        return left.title.localeCompare(right.title);
      });

    const itemsByDate = new Map<string, CalendarRenderItem[]>();
    baseItems.forEach((item) => {
      const existing = itemsByDate.get(item.date) ?? [];
      existing.push(item);
      itemsByDate.set(item.date, existing);
    });

    const laidOutItems: CalendarRenderItem[] = [];
    itemsByDate.forEach((dayItems) => {
      const lanesEnd: number[] = [];
      dayItems.forEach((item) => {
        const endSlot = item.startSlot + Math.max(1, item.durationSlots);
        let laneIndex = lanesEnd.findIndex((laneEnd) => laneEnd <= item.startSlot);
        if (laneIndex === -1) {
          laneIndex = lanesEnd.length;
          lanesEnd.push(endSlot);
        } else {
          lanesEnd[laneIndex] = endSlot;
        }

        const overlappingCount = dayItems.filter((candidate) => {
          if (candidate.id === item.id) {
            return true;
          }
          const itemEnd = item.startSlot + Math.max(1, item.durationSlots);
          const candidateEnd = candidate.startSlot + Math.max(1, candidate.durationSlots);
          return item.startSlot < candidateEnd && candidate.startSlot < itemEnd;
        }).length;

        laidOutItems.push({
          ...item,
          lane: laneIndex,
          laneCount: Math.max(1, overlappingCount),
        });
      });
    });

    return laidOutItems.sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      if (left.startSlot !== right.startSlot) {
        return left.startSlot - right.startSlot;
      }
      return left.lane - right.lane;
    });
  }, [safeActivities, safeCalendarItems, safeTodos]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter === "todo" && item.targetType !== "todo") return false;
      if (typeFilter === "activity" && (item.targetType !== "activity" || item.isMeeting)) return false;
      if (typeFilter === "meeting" && !item.isMeeting) return false;
      if (visibilityFilter === "private" && !item.isPrivate) return false;
      if (visibilityFilter === "public" && item.isPrivate) return false;
      if (!normalizedSearch) return true;
      return [item.title, item.domain, item.project, item.activity, item.label].join(" ").toLowerCase().includes(normalizedSearch);
    });
  }, [items, searchQuery, typeFilter, visibilityFilter]);

  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarRenderItem[]>();
    visibleItems.forEach((item) => {
      const existing = grouped.get(item.date) ?? [];
      existing.push(item);
      grouped.set(item.date, existing);
    });
    return grouped;
  }, [visibleItems]);

  useEffect(() => {
    if (!selectedItemId) {
      setEditorDraft(null);
      return;
    }
    const calendarItem = safeCalendarItems.find((item) => item.id === selectedItemId);
    if (!calendarItem) {
      setSelectedItemId(null);
      setEditorDraft(null);
      return;
    }
    if (calendarItem.targetType === "todo") {
      const todo = safeTodos.find((entry) => entry.id === calendarItem.targetId);
      if (!todo) {
        setSelectedItemId(null);
        setEditorDraft(null);
        return;
      }
      setEditorDraft({
        itemId: calendarItem.id,
        targetType: "todo",
        targetId: todo.id,
        title: todo.description,
        isPrivate: todo.isPrivate,
        domain: todo.domain,
        project: todo.project,
        activity: todo.activity,
        doOn: calendarItem.date,
        dueDate: todo.dueDate,
        startTime: slotToTimeLabel(calendarItem.startSlot),
        endTime: slotToTimeLabel(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots)),
        durationSlots: Math.max(1, calendarItem.durationSlots),
        isMeeting: false,
      });
      return;
    }

    const activity = safeActivities.find((entry) => entry.id === calendarItem.targetId);
    if (!activity) {
      setSelectedItemId(null);
      setEditorDraft(null);
      return;
    }
    setEditorDraft({
      itemId: calendarItem.id,
      targetType: "activity",
      targetId: activity.id,
      title: activity.description,
      isPrivate: activity.isPrivate,
      domain: activity.domain,
      project: activity.project,
      activity: activity.activity,
      doOn: calendarItem.date,
      dueDate: activity.dueDate,
      startTime: activity.type === "meeting" ? activity.startTime || slotToTimeLabel(calendarItem.startSlot) : slotToTimeLabel(calendarItem.startSlot),
      endTime:
        activity.type === "meeting"
          ? activity.endTime || slotToTimeLabel(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots))
          : slotToTimeLabel(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots)),
      durationSlots: Math.max(1, calendarItem.durationSlots),
      isMeeting: activity.type === "meeting",
    });
  }, [safeActivities, safeCalendarItems, safeTodos, selectedItemId]);

  useEffect(() => {
    if (!resizeState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaSlots = Math.round(event.movementY / slotHeight);
      if (deltaSlots === 0) {
        return;
      }
      setResizeState((current) => {
        if (!current) {
          return current;
        }
        if (current.edge === "end") {
          return {
            ...current,
            currentDurationSlots: Math.max(1, current.currentDurationSlots + deltaSlots),
          };
        }
        const currentEnd = current.currentStartSlot + current.currentDurationSlots;
        const nextStart = clampSlot(Math.min(currentEnd - 1, current.currentStartSlot + deltaSlots));
        return {
          ...current,
          currentStartSlot: nextStart,
          currentDurationSlots: Math.max(1, currentEnd - nextStart),
        };
      });
    };

    const handleMouseUp = () => {
      setResizeState((current) => {
        if (current) {
          onUpdateCalendarItem(current.itemId, {
            date: current.date,
            startSlot: current.currentStartSlot,
            durationSlots: current.currentDurationSlots,
          });
        }
        return null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onUpdateCalendarItem, resizeState, slotHeight]);

  const handleCommitActiveCell = () => {
    if (!activeCell) {
      return;
    }
    const nextValue = draftText.trim();
    if (nextValue) {
      onCreateFromText(activeCell.date, activeCell.slot, nextValue);
    }
    setDraftText("");
    setActiveCell(null);
  };

  const handleActivateCell = (date: string, slot: number) => {
    setSelectedItemId(null);
    setActiveCell({ date, slot: clampSlot(slot) });
    setDraftText("");
  };

  const moveActiveCell = (deltaDays: number, deltaSlots: number) => {
    if (!activeCell) {
      return;
    }
    const nextDate = addDays(activeCell.date, deltaDays);
    const nextSlot = clampSlot(activeCell.slot + deltaSlots);
    setActiveCell({ date: nextDate, slot: nextSlot });
  };

  const handleSaveEditor = () => {
    if (!editorDraft) {
      return;
    }
    const normalizedStartSlot = clampSlot(timeToSlot(editorDraft.startTime || "00:00"));
    const normalizedDuration = editorDraft.isMeeting
      ? Math.max(1, durationFromTimes(editorDraft.startTime || "00:00", editorDraft.endTime || editorDraft.startTime || "00:05"))
      : 1;

    if (editorDraft.targetType === "todo") {
      const todo = safeTodos.find((entry) => entry.id === editorDraft.targetId);
      if (!todo) {
        return;
      }
      onSaveTodo({
        ...todo,
        description: editorDraft.title.trim() || todo.description,
        isPrivate: editorDraft.isPrivate,
        domain: editorDraft.domain,
        project: editorDraft.project,
        activity: editorDraft.activity,
        doOn: editorDraft.doOn,
        dueDate: editorDraft.dueDate,
      });
    } else {
      const activity = safeActivities.find((entry) => entry.id === editorDraft.targetId);
      if (!activity) {
        return;
      }
      onSaveActivity({
        ...activity,
        description: editorDraft.title.trim() || activity.description,
        isPrivate: editorDraft.isPrivate,
        domain: editorDraft.domain,
        project: editorDraft.project,
        activity: editorDraft.activity,
        doOn: editorDraft.doOn,
        dueDate: editorDraft.dueDate,
        startTime: editorDraft.isMeeting ? editorDraft.startTime : activity.startTime,
        endTime: editorDraft.isMeeting ? editorDraft.endTime : activity.endTime,
      });
    }

    onUpdateCalendarItem(editorDraft.itemId, {
      date: editorDraft.doOn,
      startSlot: normalizedStartSlot,
      durationSlots: normalizedDuration,
    });
    setSelectedItemId(editorDraft.itemId);
  };

  return (
    <div className={`card calendar-workspace${isFullScreen ? " calendar-workspace-fullscreen" : ""}`}>
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Calendar</h2>
          <p className="tiny-text">Lightweight planner grid with one active input and direct in-calendar editing.</p>
        </div>
        <div className="page-actions wrap-row">
          <button className="shell-button" type="button" onClick={() => setAnchorDate((current) => addDays(current, -daysInView))}>
            Previous
          </button>
          <button className="shell-button" type="button" onClick={() => setAnchorDate(today)}>
            Today
          </button>
          <button className="shell-button" type="button" onClick={() => setAnchorDate((current) => addDays(current, daysInView))}>
            Next
          </button>
          <button className="shell-button" type="button" onClick={() => setAnchorDate((current) => addDays(current, 30))}>
            +30 days
          </button>
          <button className="shell-button" type="button" onClick={() => setIsFullScreen((current) => !current)}>
            {isFullScreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </div>

      <div className="calendar-calendar-summary">
        <div className="status-chip">{visibleItems.length} scheduled items</div>
        <div className="capture-density-toggle" role="group" aria-label="Days in view">
          {DAYS_IN_VIEW_OPTIONS.map((option) => (
            <button
              key={`days-${option}`}
              className="segment-button"
              type="button"
              data-active={option === daysInView}
              onClick={() => setDaysInView(option)}
            >
              {option} days
            </button>
          ))}
        </div>
        <div className="capture-density-toggle" role="group" aria-label="Calendar scale">
          {SLOT_HEIGHT_OPTIONS.map((option) => (
            <button
              key={`scale-${option}`}
              className="segment-button"
              type="button"
              data-active={option === slotHeight}
              onClick={() => setSlotHeight(option)}
            >
              {option === 12 ? "Compact" : option === 16 ? "Default" : "Large"}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-toolbar">
        <div className="field">
          <label htmlFor="calendar-jump-date">Jump to date</label>
          <input id="calendar-jump-date" type="date" value={jumpDate} onChange={(event) => setJumpDate(event.target.value)} />
        </div>
        <button className="shell-button" type="button" onClick={() => setAnchorDate(jumpDate || today)}>
          Go
        </button>
        <div className="field field-wide">
          <label htmlFor="calendar-search">Search</label>
          <input
            id="calendar-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search title, domain, project, activity"
          />
        </div>
        <div className="field">
          <label htmlFor="calendar-type-filter">Type</label>
          <select id="calendar-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as CalendarTypeFilter)}>
            <option value="all">All</option>
            <option value="todo">Todos</option>
            <option value="activity">Activities</option>
            <option value="meeting">Meetings</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="calendar-visibility-filter">Visibility</label>
          <select
            id="calendar-visibility-filter"
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as CalendarVisibilityFilter)}
          >
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div className={`calendar-layout${isFullScreen ? " calendar-layout-fullscreen" : ""}`}>
        <div className="calendar-main stack">
          <div className={`calendar-scroll${isFullScreen ? " calendar-scroll-fullscreen" : ""}`} style={{ ["--calendar-slot-height" as string]: `${slotHeight}px` }}>
            <div
              className="calendar-surface"
              style={{
                gridTemplateColumns: `84px repeat(${visibleDates.length}, minmax(220px, 1fr))`,
                gridTemplateRows: `52px repeat(${TOTAL_SLOTS}, var(--calendar-slot-height))`,
              }}
            >
              <div className="calendar-corner" style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }} />

              {visibleDates.map((date, index) => (
                <div key={`header-${date}`} className="calendar-day-header" style={{ gridColumn: `${index + 2} / ${index + 3}`, gridRow: "1 / 2" }}>
                  <strong>{date}</strong>
                  <span>{formatDayLabel(date)}</span>
                </div>
              ))}

              <div className="calendar-time-column" style={{ gridColumn: "1 / 2", gridRow: `2 / span ${TOTAL_SLOTS}` }}>
                {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                  <div
                    key={`time-${slot}`}
                    className={`calendar-time-cell${slot % 12 === 0 ? " calendar-time-cell-hour" : ""}`}
                    style={{ height: "var(--calendar-slot-height)" }}
                  >
                    {slot % 12 === 0 ? slotToTimeLabel(slot) : ""}
                  </div>
                ))}
              </div>

              {visibleDates.map((date, index) => {
                const dayItems = itemsByDate.get(date) ?? [];
                const activeForDay = activeCell?.date === date ? activeCell : null;
                return (
                  <div
                    key={`column-${date}`}
                    className="calendar-day-column"
                    style={{
                      gridColumn: `${index + 2} / ${index + 3}`,
                      gridRow: `2 / span ${TOTAL_SLOTS}`,
                      height: `calc(var(--calendar-slot-height) * ${TOTAL_SLOTS})`,
                    }}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input")) {
                        return;
                      }
                      const rect = event.currentTarget.getBoundingClientRect();
                      const clickedSlot = clampSlot(Math.floor((event.clientY - rect.top) / slotHeight));
                      handleActivateCell(date, clickedSlot);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      const draggedId = event.dataTransfer.getData("text/plain");
                      if (!draggedId) {
                        return;
                      }
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const nextSlot = clampSlot(Math.floor((event.clientY - rect.top) / slotHeight));
                      onMoveItem(draggedId, date, nextSlot);
                    }}
                  >
                    <div className="calendar-day-interaction-layer" />

                    {activeForDay ? (
                      <div
                        className="calendar-active-cell"
                        style={{
                          top: `calc(var(--calendar-slot-height) * ${activeForDay.slot})`,
                          height: "var(--calendar-slot-height)",
                        }}
                      >
                        <input
                          className="calendar-cell-input"
                          autoFocus
                          value={draftText}
                          onChange={(event) => setDraftText(event.target.value)}
                          onBlur={handleCommitActiveCell}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              const commitDate = activeForDay.date;
                              const commitSlot = activeForDay.slot;
                              handleCommitActiveCell();
                              setActiveCell({ date: commitDate, slot: clampSlot(commitSlot + 1) });
                            }
                            if (event.key === "Escape") {
                              setDraftText("");
                              setActiveCell(null);
                            }
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              moveActiveCell(0, 1);
                            }
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              moveActiveCell(0, -1);
                            }
                            if (event.key === "Tab") {
                              event.preventDefault();
                              moveActiveCell(event.shiftKey ? -1 : 1, 0);
                            }
                          }}
                          placeholder="Type to add todo, act..., td..., or meet..."
                        />
                      </div>
                    ) : null}

                    {dayItems.map((item) => {
                      const resizePreview =
                        resizeState?.itemId === item.id
                          ? {
                              startSlot: resizeState.currentStartSlot,
                              durationSlots: resizeState.currentDurationSlots,
                            }
                          : null;
                      const startSlot = resizePreview?.startSlot ?? item.startSlot;
                      const durationSlots = resizePreview?.durationSlots ?? item.durationSlots;
                      const visualHeight = Math.max(slotHeight * Math.max(durationSlots, item.isMeeting ? 3 : 1) - 4, 18);
                      const laneWidth = 100 / Math.max(1, item.laneCount);
                      return (
                      <button
                        key={item.id}
                        className={`calendar-item-block${item.isMeeting ? " calendar-item-block-meeting" : ""}${selectedItemId === item.id ? " calendar-item-block-selected" : ""}${visualHeight <= 22 ? " calendar-item-block-compact" : ""}`}
                        type="button"
                        draggable
                        style={{
                          top: `calc(var(--calendar-slot-height) * ${startSlot} + 2px)`,
                          height: `${visualHeight}px`,
                          width: `calc(${laneWidth}% - 8px)`,
                          left: `calc(${item.lane * laneWidth}% + 4px)`,
                          right: "auto",
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", item.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => {
                          setActiveCell(null);
                          setSelectedItemId(item.id);
                        }}
                      >
                        {item.isMeeting ? (
                          <span
                            className="calendar-resize-handle calendar-resize-handle-start"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setResizeState({
                                itemId: item.id,
                                edge: "start",
                                baseStartSlot: startSlot,
                                baseDurationSlots: durationSlots,
                                currentStartSlot: startSlot,
                                currentDurationSlots: durationSlots,
                                date: item.date,
                              });
                            }}
                          />
                        ) : null}
                        <strong>{slotToTimeLabel(startSlot)} {item.title}</strong>
                        <span>{item.isMeeting ? `${item.label} • ${durationLabel(durationSlots)}` : `${item.label}${item.isPrivate ? " • Private" : ""}`}</span>
                        {item.isMeeting ? (
                          <span
                            className="calendar-resize-handle calendar-resize-handle-end"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setResizeState({
                                itemId: item.id,
                                edge: "end",
                                baseStartSlot: startSlot,
                                baseDurationSlots: durationSlots,
                                currentStartSlot: startSlot,
                                currentDurationSlots: durationSlots,
                                date: item.date,
                              });
                            }}
                          />
                        ) : null}
                      </button>
                    );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="calendar-agenda-list">
            {visibleDates.map((date) => {
              const itemsForDay = itemsByDate.get(date) ?? [];
              return (
                <section key={`agenda-${date}`} className="calendar-agenda-day">
                  <div className="calendar-agenda-day-header">
                    <strong>{formatDayLabel(date)}</strong>
                    <span>{date}</span>
                  </div>
                  {itemsForDay.length ? (
                    itemsForDay.map((item) => (
                      <button
                        key={`agenda-item-${item.id}`}
                        className={`calendar-agenda-item${item.isMeeting ? " calendar-agenda-item-meeting" : ""}`}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <strong>{slotToTimeLabel(item.startSlot)} {item.title}</strong>
                        <span>{item.isMeeting ? `${item.label} • ${durationLabel(item.durationSlots)}` : item.label}</span>
                      </button>
                    ))
                  ) : (
                    <div className="calendar-agenda-empty">No scheduled items</div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <aside className="calendar-editor-card">
          {editorDraft ? (
            <div className="stack">
              <div className="card-header">
                <div>
                  <h3>{editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity"}</h3>
                  <p>{editorDraft.isMeeting ? "Edit the meeting directly from the calendar." : "Adjust the essentials without leaving the planner."}</p>
                </div>
                <button className="small-button" type="button" onClick={() => setSelectedItemId(null)}>
                  Close
                </button>
              </div>

              <div className="field">
                <label htmlFor="calendar-edit-title">Title</label>
                <input
                  id="calendar-edit-title"
                  value={editorDraft.title}
                  onChange={(event) => setEditorDraft({ ...editorDraft, title: event.target.value })}
                />
              </div>

              <div className="inline-row">
                <div className="field">
                  <label htmlFor="calendar-edit-date">Date</label>
                  <input
                    id="calendar-edit-date"
                    type="date"
                    value={editorDraft.doOn}
                    onChange={(event) => setEditorDraft({ ...editorDraft, doOn: event.target.value })}
                  />
                </div>
                <label className="compact-private-toggle">
                  <input
                    type="checkbox"
                    checked={editorDraft.isPrivate}
                    onChange={(event) => setEditorDraft({ ...editorDraft, isPrivate: event.target.checked })}
                  />
                  <span>Private</span>
                </label>
              </div>

              {editorDraft.isMeeting ? (
                <div className="inline-row">
                  <div className="field">
                    <label htmlFor="calendar-edit-start">Start</label>
                    <input
                      id="calendar-edit-start"
                      type="time"
                      step={300}
                      value={editorDraft.startTime}
                      onChange={(event) => {
                        const nextStart = event.target.value;
                        const nextDuration = durationFromTimes(editorDraft.startTime || nextStart, editorDraft.endTime || nextStart) || editorDraft.durationSlots;
                        const nextEnd = slotToTimeLabel(timeToSlot(nextStart) + Math.max(1, nextDuration));
                        setEditorDraft({ ...editorDraft, startTime: nextStart, endTime: nextEnd });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="calendar-edit-end">End</label>
                    <input
                      id="calendar-edit-end"
                      type="time"
                      step={300}
                      value={editorDraft.endTime}
                      onChange={(event) => setEditorDraft({ ...editorDraft, endTime: event.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="calendar-edit-time">Time</label>
                  <input
                    id="calendar-edit-time"
                    type="time"
                    step={300}
                    value={editorDraft.startTime}
                    onChange={(event) => setEditorDraft({ ...editorDraft, startTime: event.target.value })}
                  />
                </div>
              )}

              <div className="metadata-triplet-grid">
                <div className="field metadata-subfield">
                  <label htmlFor="calendar-edit-domain">Domain</label>
                  <input
                    id="calendar-edit-domain"
                    value={editorDraft.domain}
                    onChange={(event) => setEditorDraft({ ...editorDraft, domain: event.target.value })}
                  />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="calendar-edit-project">Project</label>
                  <input
                    id="calendar-edit-project"
                    value={editorDraft.project}
                    onChange={(event) => setEditorDraft({ ...editorDraft, project: event.target.value })}
                  />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="calendar-edit-activity">Activity</label>
                  <input
                    id="calendar-edit-activity"
                    value={editorDraft.activity}
                    onChange={(event) => setEditorDraft({ ...editorDraft, activity: event.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="calendar-edit-due">Due date</label>
                <input
                  id="calendar-edit-due"
                  type="date"
                  value={editorDraft.dueDate}
                  onChange={(event) => setEditorDraft({ ...editorDraft, dueDate: event.target.value })}
                />
              </div>

              <div className="calendar-editor-meta">
                <span className="status-chip">{editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity"}</span>
                {editorDraft.isPrivate ? <span className="status-chip">Private</span> : null}
                {editorDraft.domain ? <span className="status-chip">{editorDraft.domain}</span> : null}
                {editorDraft.project ? <span className="status-chip">{editorDraft.project}</span> : null}
              </div>

              <div className="calendar-editor-actions">
                <button className="primary-button" type="button" onClick={handleSaveEditor}>
                  Save calendar edits
                </button>
                <button
                  className="shell-button"
                  type="button"
                  onClick={() => {
                    if (editorDraft.targetType === "todo") {
                      onOpenTodoWorkspace();
                      return;
                    }
                    onOpenActivityWorkspace(editorDraft.targetId);
                  }}
                >
                  Open full {editorDraft.targetType === "todo" ? "todo" : "activity"}
                </button>
                {editorDraft.targetType === "activity" && linkedSessionIdsByActivity[editorDraft.targetId] ? (
                  <button
                    className="shell-button"
                    type="button"
                    onClick={() => {
                      const linkedSessionId = linkedSessionIdsByActivity[editorDraft.targetId];
                      if (linkedSessionId) {
                        onOpenSession(linkedSessionId);
                      }
                    }}
                  >
                    Open linked meeting session
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="stack">
              <h3>Calendar item</h3>
              <p className="muted">Select a scheduled block to edit it here. Meetings now stand out more clearly and can be adjusted directly in Calendar.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
