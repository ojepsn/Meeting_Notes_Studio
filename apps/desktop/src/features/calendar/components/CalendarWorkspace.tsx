import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityRecord, CalendarItemRecord, LocalAppSettings, TodoRecord } from "@notesmith/domain";

const TOTAL_SLOTS = 24 * 12;
const MINUTES_PER_SLOT = 5;
const DAYS = [3, 5, 7, 14] as const;
const HEIGHTS = [12, 16, 22] as const;
const MIN_PANE = 240;
const MAX_PANE = 520;

const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};
const clampSlot = (slot: number) => Math.max(0, Math.min(TOTAL_SLOTS - 1, slot));
const clampPane = (width: number) => Math.min(MAX_PANE, Math.max(MIN_PANE, Math.round(width)));
const durationFromTimes = (startTime: string, endTime: string) => Math.max(1, timeToSlot(endTime) - timeToSlot(startTime));
const slotToTime = (slot: number) => {
  const total = slot * MINUTES_PER_SLOT;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const timeToSlot = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 12 + Math.floor(minutes / MINUTES_PER_SLOT);
};
const formatDay = (date: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", month: "2-digit", day: "2-digit" }).format(new Date(`${date}T00:00:00`));
const durationLabel = (slots: number) => {
  const minutes = slots * MINUTES_PER_SLOT;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

type Item = {
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
  lane: number;
  laneCount: number;
};

type EditorDraft = {
  itemId: string;
  targetType: "todo" | "activity";
  targetId: string;
  title: string;
  doOn: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  domain: string;
  project: string;
  activity: string;
  isPrivate: boolean;
  isMeeting: boolean;
};

interface CalendarWorkspaceProps {
  todos: TodoRecord[];
  activities: ActivityRecord[];
  calendarItems: CalendarItemRecord[];
  settings: LocalAppSettings;
  linkedSessionIdsByActivity: Record<string, string | null>;
  onSaveSettings: (settings: LocalAppSettings) => void;
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
  settings,
  linkedSessionIdsByActivity,
  onSaveSettings,
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
  const initialIsFullScreen = settings.calendarFullScreenPreferenceInitialized ? settings.calendarIsFullScreen : true;
  const [anchorDate, setAnchorDate] = useState(today);
  const [daysInView, setDaysInView] = useState<typeof DAYS[number]>(settings.calendarDaysInView);
  const [slotHeight, setSlotHeight] = useState<typeof HEIGHTS[number]>(settings.calendarSlotHeight);
  const [isFullScreen, setIsFullScreen] = useState(initialIsFullScreen);
  const [detailsPaneWidth, setDetailsPaneWidth] = useState(settings.calendarDetailsPaneWidth);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [jumpDate, setJumpDate] = useState(today);
  const [draftCell, setDraftCell] = useState<{ date: string; slot: number } | null>(null);
  const [draftText, setDraftText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "todo" | "activity" | "meeting">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [resizeState, setResizeState] = useState<null | { itemId: string; edge: "start" | "end"; date: string; startSlot: number; durationSlots: number }>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const splitterDraggingRef = useRef(false);

  useEffect(() => {
    onFullScreenChange?.(isFullScreen);
    return () => onFullScreenChange?.(false);
  }, [isFullScreen, onFullScreenChange]);

  useEffect(() => {
    if (
      settings.calendarDaysInView !== daysInView ||
      settings.calendarSlotHeight !== slotHeight ||
      settings.calendarIsFullScreen !== isFullScreen ||
      !settings.calendarFullScreenPreferenceInitialized ||
      settings.calendarDetailsPaneWidth !== detailsPaneWidth
    ) {
      onSaveSettings({
        ...settings,
        calendarDaysInView: daysInView,
        calendarSlotHeight: slotHeight,
        calendarIsFullScreen: isFullScreen,
        calendarFullScreenPreferenceInitialized: true,
        calendarDetailsPaneWidth: detailsPaneWidth,
      });
    }
  }, [daysInView, detailsPaneWidth, isFullScreen, onSaveSettings, settings, slotHeight]);

  const visibleDates = useMemo(() => Array.from({ length: daysInView }, (_, index) => addDays(anchorDate, index)), [anchorDate, daysInView]);
  const items = useMemo<Item[]>(() => {
    const todoMap = new Map((Array.isArray(todos) ? todos : []).map((todo) => [todo.id, todo]));
    const activityMap = new Map((Array.isArray(activities) ? activities : []).map((activity) => [activity.id, activity]));
    const base = (Array.isArray(calendarItems) ? calendarItems : [])
      .map((item) => {
        if (item.targetType === "todo") {
          const todo = todoMap.get(item.targetId);
          if (!todo) return null;
          return { id: item.id, date: item.date, startSlot: item.startSlot, durationSlots: item.durationSlots, targetType: "todo" as const, targetId: item.targetId, title: todo.description, label: "Todo", isMeeting: false, isPrivate: todo.isPrivate, lane: 0, laneCount: 1 };
        }
        const activity = activityMap.get(item.targetId);
        if (!activity) return null;
        return { id: item.id, date: item.date, startSlot: item.startSlot, durationSlots: item.durationSlots, targetType: "activity" as const, targetId: item.targetId, title: activity.description, label: activity.type === "meeting" ? "Meeting" : "Activity", isMeeting: activity.type === "meeting", isPrivate: activity.isPrivate, lane: 0, laneCount: 1 };
      })
      .filter((item): item is Item => item !== null)
      .sort((left, right) => left.date.localeCompare(right.date) || left.startSlot - right.startSlot || left.title.localeCompare(right.title));

    const grouped = new Map<string, Item[]>();
    base.forEach((item) => {
      const existing = grouped.get(item.date) ?? [];
      existing.push(item);
      grouped.set(item.date, existing);
    });
    const result: Item[] = [];
    grouped.forEach((dayItems) => {
      const lanesEnd: number[] = [];
      dayItems.forEach((item) => {
        const itemEnd = item.startSlot + Math.max(1, item.durationSlots);
        let lane = lanesEnd.findIndex((laneEnd) => laneEnd <= item.startSlot);
        if (lane === -1) {
          lane = lanesEnd.length;
          lanesEnd.push(itemEnd);
        } else {
          lanesEnd[lane] = itemEnd;
        }
        const laneCount = dayItems.filter((candidate) => item.startSlot < candidate.startSlot + Math.max(1, candidate.durationSlots) && candidate.startSlot < itemEnd).length;
        result.push({ ...item, lane, laneCount: Math.max(1, laneCount) });
      });
    });
    return result.sort((left, right) => left.date.localeCompare(right.date) || left.startSlot - right.startSlot || left.lane - right.lane);
  }, [activities, calendarItems, todos]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter === "todo" && item.targetType !== "todo") return false;
      if (typeFilter === "activity" && (item.targetType !== "activity" || item.isMeeting)) return false;
      if (typeFilter === "meeting" && !item.isMeeting) return false;
      if (visibilityFilter === "private" && !item.isPrivate) return false;
      if (visibilityFilter === "public" && item.isPrivate) return false;
      if (!query) return true;
      return `${item.title} ${item.label}`.toLowerCase().includes(query);
    });
  }, [items, searchQuery, typeFilter, visibilityFilter]);

  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, Item[]>();
    filteredItems.forEach((item) => {
      const existing = grouped.get(item.date) ?? [];
      existing.push(item);
      grouped.set(item.date, existing);
    });
    return grouped;
  }, [filteredItems]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const now = new Date();
    const currentSlot = clampSlot(now.getHours() * 12 + Math.floor(now.getMinutes() / MINUTES_PER_SLOT));
    scroller.scrollTop = Math.max(0, currentSlot * slotHeight - scroller.clientHeight / 2);
    scroller.scrollLeft = 0;
  }, [slotHeight]);

  useEffect(() => {
    if (!selectedItemId) {
      setEditorDraft(null);
      return;
    }
    const calendarItem = calendarItems.find((item) => item.id === selectedItemId);
    if (!calendarItem) return;
    if (calendarItem.targetType === "todo") {
      const todo = todos.find((entry) => entry.id === calendarItem.targetId);
      if (!todo) return;
      setEditorDraft({ itemId: calendarItem.id, targetType: "todo", targetId: todo.id, title: todo.description, doOn: calendarItem.date, dueDate: todo.dueDate, startTime: slotToTime(calendarItem.startSlot), endTime: slotToTime(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots)), domain: todo.domain, project: todo.project, activity: todo.activity, isPrivate: todo.isPrivate, isMeeting: false });
      return;
    }
    const activity = activities.find((entry) => entry.id === calendarItem.targetId);
    if (!activity) return;
    setEditorDraft({ itemId: calendarItem.id, targetType: "activity", targetId: activity.id, title: activity.description, doOn: calendarItem.date, dueDate: activity.dueDate, startTime: activity.startTime || slotToTime(calendarItem.startSlot), endTime: activity.endTime || slotToTime(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots)), domain: activity.domain, project: activity.project, activity: activity.activity, isPrivate: activity.isPrivate, isMeeting: activity.type === "meeting" });
  }, [activities, calendarItems, selectedItemId, todos]);

  useEffect(() => {
    if (!resizeState) return;
    const handleMouseMove = (event: MouseEvent) => {
      const deltaSlots = Math.round(event.movementY / slotHeight);
      if (deltaSlots === 0) return;
      setResizeState((current) => {
        if (!current) return current;
        if (current.edge === "end") return { ...current, durationSlots: Math.max(1, current.durationSlots + deltaSlots) };
        const endSlot = current.startSlot + current.durationSlots;
        const nextStart = clampSlot(Math.min(endSlot - 1, current.startSlot + deltaSlots));
        return { ...current, startSlot: nextStart, durationSlots: Math.max(1, endSlot - nextStart) };
      });
    };
    const handleMouseUp = () => {
      setResizeState((current) => {
        if (current) onUpdateCalendarItem(current.itemId, { date: current.date, startSlot: current.startSlot, durationSlots: current.durationSlots });
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

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!splitterDraggingRef.current || !layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      setDetailsPaneWidth(clampPane(rect.right - event.clientX));
    };
    const handleMouseUp = () => {
      splitterDraggingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const moveDraftCell = (deltaDays: number, deltaSlots: number) => {
    if (!draftCell) return;
    setDraftCell({ date: addDays(draftCell.date, deltaDays), slot: clampSlot(draftCell.slot + deltaSlots) });
  };

  const commitDraftCell = () => {
    if (!draftCell) return;
    const nextValue = draftText.trim();
    if (nextValue) onCreateFromText(draftCell.date, draftCell.slot, nextValue);
    setDraftText("");
    setDraftCell(null);
  };

  const saveEditor = () => {
    if (!editorDraft) return;
    const startSlot = clampSlot(timeToSlot(editorDraft.startTime || "00:00"));
    const durationSlots = editorDraft.isMeeting ? Math.max(1, durationFromTimes(editorDraft.startTime || "00:00", editorDraft.endTime || editorDraft.startTime || "00:05")) : 1;
    if (editorDraft.targetType === "todo") {
      const todo = todos.find((entry) => entry.id === editorDraft.targetId);
      if (!todo) return;
      onSaveTodo({ ...todo, description: editorDraft.title.trim() || todo.description, doOn: editorDraft.doOn, dueDate: editorDraft.dueDate, domain: editorDraft.domain, project: editorDraft.project, activity: editorDraft.activity, isPrivate: editorDraft.isPrivate });
    } else {
      const activity = activities.find((entry) => entry.id === editorDraft.targetId);
      if (!activity) return;
      onSaveActivity({ ...activity, description: editorDraft.title.trim() || activity.description, doOn: editorDraft.doOn, dueDate: editorDraft.dueDate, domain: editorDraft.domain, project: editorDraft.project, activity: editorDraft.activity, isPrivate: editorDraft.isPrivate, startTime: editorDraft.isMeeting ? editorDraft.startTime : activity.startTime, endTime: editorDraft.isMeeting ? editorDraft.endTime : activity.endTime });
    }
    onUpdateCalendarItem(editorDraft.itemId, { date: editorDraft.doOn, startSlot, durationSlots });
  };

  return (
    <div className={`card calendar-workspace${isFullScreen ? " calendar-workspace-fullscreen" : ""}`}>
      <div className="card-header session-editor-header-minimal calendar-workspace-header">
        <div><h2>Calendar</h2></div>
        <div className="page-actions wrap-row">
          <button className="shell-button" type="button" onClick={() => setAnchorDate((current) => addDays(current, -daysInView))}>Previous</button>
          <button className="shell-button" type="button" onClick={() => { setAnchorDate(today); setJumpDate(today); }}>Today</button>
          <button className="shell-button" type="button" onClick={() => setAnchorDate((current) => addDays(current, daysInView))}>Next</button>
          <button className="shell-button" type="button" onClick={() => setAnchorDate((current) => addDays(current, 30))}>+30 days</button>
          <button className="shell-button" type="button" onClick={() => setIsFullScreen((current) => !current)}>{isFullScreen ? "Exit full screen" : "Full screen"}</button>
        </div>
      </div>

      <div className={`calendar-controls${isFullScreen ? " calendar-controls-compact" : ""}`}>
        <div className="calendar-calendar-summary">
          <div className="status-chip">{filteredItems.length} scheduled items</div>
          <div className="capture-density-toggle">{DAYS.map((option) => <button key={`days-${option}`} className="segment-button" type="button" data-active={option === daysInView} onClick={() => setDaysInView(option)}>{option} days</button>)}</div>
          <div className="capture-density-toggle">{HEIGHTS.map((option) => <button key={`height-${option}`} className="segment-button" type="button" data-active={option === slotHeight} onClick={() => setSlotHeight(option)}>{option === 12 ? "Compact" : option === 16 ? "Default" : "Large"}</button>)}</div>
        </div>
        <div className="calendar-toolbar">
          <div className="field"><label htmlFor="calendar-jump-date">Jump to date</label><input id="calendar-jump-date" type="date" value={jumpDate} onChange={(event) => setJumpDate(event.target.value)} /></div>
          <button className="shell-button" type="button" onClick={() => setAnchorDate(jumpDate || today)}>Go</button>
          <div className="field field-wide"><label htmlFor="calendar-search">Search</label><input id="calendar-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search title" /></div>
          <div className="field"><label htmlFor="calendar-type-filter">Type</label><select id="calendar-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | "todo" | "activity" | "meeting")}><option value="all">All</option><option value="todo">Todos</option><option value="activity">Activities</option><option value="meeting">Meetings</option></select></div>
          <div className="field"><label htmlFor="calendar-visibility-filter">Visibility</label><select id="calendar-visibility-filter" value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as "all" | "public" | "private")}><option value="all">All</option><option value="public">Public</option><option value="private">Private</option></select></div>
        </div>
      </div>

      <div ref={layoutRef} className={`calendar-layout${isFullScreen ? " calendar-layout-fullscreen" : ""}`} style={{ gridTemplateColumns: `minmax(0, 1fr) 8px ${detailsPaneWidth}px` }}>
        <div className="calendar-main stack">
          <div ref={scrollRef} className={`calendar-scroll${isFullScreen ? " calendar-scroll-fullscreen" : ""}`} style={{ ["--calendar-slot-height" as string]: `${slotHeight}px` }}>
            <div className="calendar-surface" style={{ gridTemplateColumns: `84px repeat(${visibleDates.length}, minmax(220px, 1fr))`, gridTemplateRows: `52px repeat(${TOTAL_SLOTS}, var(--calendar-slot-height))` }}>
              <div className="calendar-corner" style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }} />
              {visibleDates.map((date, index) => <div key={date} className="calendar-day-header" style={{ gridColumn: `${index + 2} / ${index + 3}`, gridRow: "1 / 2" }}><strong>{date}</strong><span>{formatDay(date)}</span></div>)}
              <div className="calendar-time-column" style={{ gridColumn: "1 / 2", gridRow: `2 / span ${TOTAL_SLOTS}` }}>{Array.from({ length: TOTAL_SLOTS }, (_, slot) => <div key={`time-${slot}`} className={`calendar-time-cell${slot % 12 === 0 ? " calendar-time-cell-hour" : ""}`} style={{ height: "var(--calendar-slot-height)" }}>{slot % 12 === 0 ? slotToTime(slot) : ""}</div>)}</div>
              {visibleDates.map((date, index) => {
                const dayItems = itemsByDate.get(date) ?? [];
                const active = draftCell?.date === date ? draftCell : null;
                return <div key={`col-${date}`} className="calendar-day-column" style={{ gridColumn: `${index + 2} / ${index + 3}`, gridRow: `2 / span ${TOTAL_SLOTS}`, height: `calc(var(--calendar-slot-height) * ${TOTAL_SLOTS})` }} onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input")) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  setSelectedItemId(null);
                  setDraftCell({ date, slot: clampSlot(Math.floor((event.clientY - rect.top) / slotHeight)) });
                  setDraftText("");
                }} onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }} onDrop={(event) => {
                  event.preventDefault();
                  const draggedId = event.dataTransfer.getData("text/plain");
                  if (!draggedId) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  onMoveItem(draggedId, date, clampSlot(Math.floor((event.clientY - rect.top) / slotHeight)));
                }}>
                  <div className="calendar-day-interaction-layer" />
                  {active ? <div className="calendar-active-cell" style={{ top: `calc(var(--calendar-slot-height) * ${active.slot})`, height: "var(--calendar-slot-height)" }}><input className="calendar-cell-input" autoFocus value={draftText} onChange={(event) => setDraftText(event.target.value)} onBlur={commitDraftCell} onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); const next = active.slot; commitDraftCell(); setDraftCell({ date: active.date, slot: clampSlot(next + 1) }); }
                    if (event.key === "Escape") { setDraftText(""); setDraftCell(null); }
                    if (event.key === "ArrowDown") { event.preventDefault(); moveDraftCell(0, 1); }
                    if (event.key === "ArrowUp") { event.preventDefault(); moveDraftCell(0, -1); }
                    if (event.key === "Tab") { event.preventDefault(); moveDraftCell(event.shiftKey ? -1 : 1, 0); }
                  }} placeholder="Type to add todo, act..., td..., or meet..." /></div> : null}
                  {dayItems.map((item) => {
                    const preview = resizeState?.itemId === item.id ? resizeState : null;
                    const startSlot = preview?.startSlot ?? item.startSlot;
                    const durationSlots = preview?.durationSlots ?? item.durationSlots;
                    const laneWidth = 100 / Math.max(1, item.laneCount);
                    const visualHeight = Math.max(slotHeight * Math.max(durationSlots, item.isMeeting ? 3 : 1) - 4, 18);
                    return <button key={item.id} className={`calendar-item-block${item.isMeeting ? " calendar-item-block-meeting" : ""}${selectedItemId === item.id ? " calendar-item-block-selected" : ""}${visualHeight <= 22 ? " calendar-item-block-compact" : ""}`} type="button" draggable style={{ top: `calc(var(--calendar-slot-height) * ${startSlot} + 2px)`, height: `${visualHeight}px`, width: `calc(${laneWidth}% - 8px)`, left: `calc(${item.lane * laneWidth}% + 4px)`, right: "auto" }} onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => { setDraftCell(null); setSelectedItemId(item.id); }}>
                      {item.isMeeting ? <span className="calendar-resize-handle calendar-resize-handle-start" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "start", date: item.date, startSlot, durationSlots }); }} /> : null}
                      <strong>{slotToTime(startSlot)} {item.title}</strong>
                      <span>{item.isMeeting ? `${item.label} • ${durationLabel(durationSlots)}` : item.label}</span>
                      {item.isMeeting ? <span className="calendar-resize-handle calendar-resize-handle-end" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "end", date: item.date, startSlot, durationSlots }); }} /> : null}
                    </button>;
                  })}
                </div>;
              })}
            </div>
          </div>
        </div>
        <div className="calendar-splitter" role="separator" aria-orientation="vertical" onMouseDown={() => { splitterDraggingRef.current = true; document.body.style.cursor = "col-resize"; }} />
        <aside className="calendar-editor-card">
          {editorDraft ? <div className="stack"><div className="card-header"><div><h3>{editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity"}</h3></div><button className="small-button" type="button" onClick={() => setSelectedItemId(null)}>Close</button></div><div className="field"><label htmlFor="calendar-edit-title">Title</label><input id="calendar-edit-title" value={editorDraft.title} onChange={(event) => setEditorDraft({ ...editorDraft, title: event.target.value })} /></div><div className="inline-row"><div className="field"><label htmlFor="calendar-edit-date">Date</label><input id="calendar-edit-date" type="date" value={editorDraft.doOn} onChange={(event) => setEditorDraft({ ...editorDraft, doOn: event.target.value })} /></div><label className="compact-private-toggle"><input type="checkbox" checked={editorDraft.isPrivate} onChange={(event) => setEditorDraft({ ...editorDraft, isPrivate: event.target.checked })} /><span>Private</span></label></div>{editorDraft.isMeeting ? <div className="inline-row"><div className="field"><label htmlFor="calendar-edit-start">Start</label><input id="calendar-edit-start" type="time" step={300} value={editorDraft.startTime} onChange={(event) => setEditorDraft({ ...editorDraft, startTime: event.target.value })} /></div><div className="field"><label htmlFor="calendar-edit-end">End</label><input id="calendar-edit-end" type="time" step={300} value={editorDraft.endTime} onChange={(event) => setEditorDraft({ ...editorDraft, endTime: event.target.value })} /></div></div> : null}<div className="metadata-triplet-grid"><div className="field metadata-subfield"><label htmlFor="calendar-edit-domain">Domain</label><input id="calendar-edit-domain" value={editorDraft.domain} onChange={(event) => setEditorDraft({ ...editorDraft, domain: event.target.value })} /></div><div className="field metadata-subfield"><label htmlFor="calendar-edit-project">Project</label><input id="calendar-edit-project" value={editorDraft.project} onChange={(event) => setEditorDraft({ ...editorDraft, project: event.target.value })} /></div><div className="field metadata-subfield"><label htmlFor="calendar-edit-activity">Activity</label><input id="calendar-edit-activity" value={editorDraft.activity} onChange={(event) => setEditorDraft({ ...editorDraft, activity: event.target.value })} /></div></div><div className="field"><label htmlFor="calendar-edit-due">Due date</label><input id="calendar-edit-due" type="date" value={editorDraft.dueDate} onChange={(event) => setEditorDraft({ ...editorDraft, dueDate: event.target.value })} /></div><div className="calendar-editor-actions"><button className="primary-button" type="button" onClick={saveEditor}>Save calendar edits</button><button className="shell-button" type="button" onClick={() => editorDraft.targetType === "todo" ? onOpenTodoWorkspace() : onOpenActivityWorkspace(editorDraft.targetId)}>Open full {editorDraft.targetType === "todo" ? "todo" : "activity"}</button>{editorDraft.targetType === "activity" && linkedSessionIdsByActivity[editorDraft.targetId] ? <button className="shell-button" type="button" onClick={() => { const sessionId = linkedSessionIdsByActivity[editorDraft.targetId]; if (sessionId) onOpenSession(sessionId); }}>Open linked meeting session</button> : null}</div></div> : <div className="stack"><h3>Calendar item</h3><p className="muted">Select a scheduled block to edit it here.</p></div>}
        </aside>
      </div>
    </div>
  );
};
