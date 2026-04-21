import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ActivityRecord, CalendarItemRecord, LocalAppSettings, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { TokenPicker } from "../../../components/TokenPicker";
import { getActivitiesForSelection, getProjectsForDomain, type StructureOptions } from "../../../lib/structure/options";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog } from "../../../lib/time/tracking";

const TOTAL_SLOTS = 24 * 12;
const MINUTES_PER_SLOT = 5;
const DEFAULT_MEETING_DURATION_SLOTS = 12;
const DAYS = [3, 5, 7, 14] as const;
const HEIGHTS = [12, 16, 22] as const;
const MIN_PANE = 240;
const MAX_PANE = 520;
const HORIZONTAL_BUFFER_DAYS = 28;
const HORIZONTAL_EXTEND_DAYS = 14;
const HORIZONTAL_EDGE_DAYS = 7;

export const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, "0")}-${`${next.getDate()}`.padStart(2, "0")}`;
};
export const daysBetween = (fromDate: string, toDate: string) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
  return Number.isFinite(diff) ? diff : 0;
};
export const clampSlot = (slot: number) => Math.max(0, Math.min(TOTAL_SLOTS - 1, slot));
export const clampPane = (width: number) => Math.min(MAX_PANE, Math.max(MIN_PANE, Math.round(width)));
export const durationFromTimes = (startTime: string, endTime: string) => Math.max(1, timeToSlot(endTime) - timeToSlot(startTime));
export const slotToTime = (slot: number) => {
  const total = slot * MINUTES_PER_SLOT;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
export const timeToSlot = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 12 + Math.floor(minutes / MINUTES_PER_SLOT);
};
export const formatDay = (date: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", month: "2-digit", day: "2-digit" }).format(new Date(`${date}T00:00:00`));
export const getLocalDateString = (date = new Date()) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
export const initialCalendarScrollTop = (date: Date, slotHeight: number) => {
  const currentSlot = clampSlot(date.getHours() * 12 + Math.floor(date.getMinutes() / MINUTES_PER_SLOT));
  const previousHourSlot = Math.max(0, currentSlot - 12);
  return previousHourSlot * slotHeight;
};
export const durationLabel = (slots: number) => {
  const minutes = slots * MINUTES_PER_SLOT;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};
export const dayColumnWidthForView = (daysInView: typeof DAYS[number]) => {
  switch (daysInView) {
    case 14:
      return 118;
    case 7:
      return 156;
    case 5:
      return 220;
    case 3:
    default:
      return 280;
  }
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
  activityId: string;
  parentActivityId: string;
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
  timeLogs: import("@notesmith/domain").TimeLogRecord[];
  calendarItems: CalendarItemRecord[];
  settings: LocalAppSettings;
  structureOptions: StructureOptions;
  linkedSessionStateByActivity: Record<string, { sessionId: string | null; hasOutput: boolean; sessionTitle: string }>;
  onSaveSettings: (settings: LocalAppSettings) => void;
  onCreateFromText: (
    date: string,
    startSlot: number,
    value: string,
    options?: { activityId?: string; parentActivityId?: string; kind?: "todo" | "activity" | "meeting"; endSlot?: number },
  ) => Promise<string | null> | string | null | void;
  onMoveItem: (id: string, date: string, startSlot: number) => void;
  onSaveTodo: (todo: TodoRecord) => void;
  onDeleteTodo: (id: string) => void;
  onSaveActivity: (activity: ActivityRecord) => void;
  onDeleteActivity: (id: string) => void;
  onConvertTodoToMeeting: (todo: TodoRecord, options: { date: string; startTime: string; endTime: string }) => void;
  onUpdateCalendarItem: (id: string, updates: { date: string; startSlot: number; durationSlots: number }) => void;
  onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onOpenTodoWorkspace: () => void;
  onOpenTodoDetail: (todoId: string) => void;
  onOpenActivityWorkspace: (activityId: string) => void;
  onOpenActivityDetail: (activityId: string) => void;
  onOpenSession: (sessionId: string, calendarItemId?: string) => void;
  highlightedItemId?: string | null;
  onCreateLinkedMeetingSession: (activityId: string) => void;
  onPreviewSessionOutput: (sessionId: string) => void;
  onFullScreenChange?: (isFullScreen: boolean) => void;
}

export const CalendarWorkspace = ({
  todos,
  activities,
  timeLogs,
  calendarItems,
  settings,
  structureOptions,
  linkedSessionStateByActivity,
  onSaveSettings,
  onCreateFromText,
  onMoveItem,
  onSaveTodo,
  onDeleteTodo,
  onSaveActivity,
  onDeleteActivity,
  onConvertTodoToMeeting,
  onUpdateCalendarItem,
  onStartTracking,
  onStopTracking,
  onOpenTodoWorkspace,
  onOpenTodoDetail,
  onOpenActivityWorkspace,
  onOpenActivityDetail,
  onOpenSession,
  highlightedItemId,
  onCreateLinkedMeetingSession,
  onPreviewSessionOutput,
  onFullScreenChange,
}: CalendarWorkspaceProps) => {
  const today = getLocalDateString();
  const initialIsFullScreen = true;
  const [anchorDate, setAnchorDate] = useState(today);
  const [daysInView, setDaysInView] = useState<typeof DAYS[number]>(settings.calendarDaysInView);
  const [slotHeight, setSlotHeight] = useState<typeof HEIGHTS[number]>(settings.calendarSlotHeight);
  const [isFullScreen] = useState(initialIsFullScreen);
  const [detailsPaneWidth, setDetailsPaneWidth] = useState(settings.calendarDetailsPaneWidth);
  const [scrollTop, setScrollTop] = useState(settings.calendarScrollTop ?? 0);
  const [scrollLeft, setScrollLeft] = useState(settings.calendarScrollLeft ?? 0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [jumpDate, setJumpDate] = useState(today);
  const [draftCell, setDraftCell] = useState<{ date: string; slot: number } | null>(null);
  const [draftText, setDraftText] = useState("");
  const [creationContextActivityId, setCreationContextActivityId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "todo" | "activity" | "meeting">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [resizeState, setResizeState] = useState<null | { itemId: string; edge: "start" | "end"; date: string; startSlot: number; durationSlots: number }>(null);
  const [now, setNow] = useState(() => new Date());
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const splitterDraggingRef = useRef(false);
  const didApplyInitialViewportRef = useRef(false);
  const appliedHighlightedItemIdRef = useRef<string | null>(null);
  const pendingHorizontalScrollDeltaRef = useRef(0);
  const pendingScrollDateRef = useRef<string | null>(null);
  const isExtendingHorizontalRangeRef = useRef(false);
  const scrollPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggedGroupRef = useRef<null | { anchorId: string; itemIds: string[] }>(null);
  const pointerDragCandidateRef = useRef<null | { itemId: string; startX: number; startY: number }>(null);
  const pointerDraggingItemRef = useRef<string | null>(null);
  const suppressClickItemIdRef = useRef<string | null>(null);

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
      settings.calendarDetailsPaneWidth !== detailsPaneWidth ||
      settings.calendarScrollTop !== scrollTop ||
      settings.calendarScrollLeft !== scrollLeft
    ) {
      onSaveSettings({
        ...settings,
        calendarDaysInView: daysInView,
        calendarSlotHeight: slotHeight,
        calendarIsFullScreen: isFullScreen,
        calendarFullScreenPreferenceInitialized: true,
        calendarDetailsPaneWidth: detailsPaneWidth,
        calendarScrollTop: scrollTop,
        calendarScrollLeft: scrollLeft,
      });
    }
  }, [daysInView, detailsPaneWidth, isFullScreen, onSaveSettings, scrollLeft, scrollTop, settings, slotHeight]);

  const visibleDates = useMemo(
    () =>
      Array.from({ length: daysInView + HORIZONTAL_BUFFER_DAYS * 2 }, (_, index) =>
        addDays(anchorDate, index - HORIZONTAL_BUFFER_DAYS),
      ),
    [anchorDate, daysInView],
  );
  const dayColumnWidth = useMemo(() => dayColumnWidthForView(daysInView), [daysInView]);
  const topLevelActivities = useMemo(
    () => activities.filter((entry) => !entry.parentActivityId).sort((left, right) => left.description.localeCompare(right.description)),
    [activities],
  );
  const activityLookup = useMemo(
    () => Object.fromEntries(activities.map((activity) => [activity.id, activity])) as Record<string, ActivityRecord>,
    [activities],
  );
  const timeLogsByTarget = useMemo(() => {
    const grouped = new Map<string, import("@notesmith/domain").TimeLogRecord[]>();
    timeLogs.forEach((entry) => {
      const key = `${entry.targetType}:${entry.targetId}`;
      grouped.set(key, [...(grouped.get(key) || []), entry]);
    });
    return grouped;
  }, [timeLogs]);
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

  const runningItemCount = useMemo(
    () =>
      items.filter((item) => getRunningTimeLog(timeLogsByTarget.get(`${item.targetType}:${item.targetId}`) || [])).length,
    [items, timeLogsByTarget],
  );

  useEffect(() => {
    if (!runningItemCount) return;
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, [runningItemCount]);

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

  const selectedItem = useMemo(
    () => (selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null),
    [items, selectedItemId],
  );
  const editorProjectOptions = editorDraft ? getProjectsForDomain(structureOptions, editorDraft.domain) : [];
  const editorActivityOptions = editorDraft ? getActivitiesForSelection(structureOptions, editorDraft.domain, editorDraft.project) : [];
  const linkedActivityOptions = topLevelActivities.filter((activity) => {
    if (!editorDraft) return true;
    if (activity.id === editorDraft.targetId) return false;
    if (
      editorDraft.targetType === "activity" &&
      editorDraft.parentActivityId &&
      activity.id === editorDraft.parentActivityId
    ) {
      return true;
    }
    if (
      editorDraft.targetType === "todo" &&
      editorDraft.activityId &&
      activity.id === editorDraft.activityId
    ) {
      return true;
    }
    if (editorDraft.domain && activity.domain && activity.domain !== editorDraft.domain) return false;
    if (editorDraft.project && activity.project && activity.project !== editorDraft.project) return false;
    return true;
  });

  const scrollToCurrentTime = (date = new Date()) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const currentDay = getLocalDateString(date);
    if (anchorDate !== currentDay) {
      pendingScrollDateRef.current = currentDay;
      setAnchorDate(currentDay);
      setJumpDate(currentDay);
    }
    const nextScrollTop = initialCalendarScrollTop(date, slotHeight);
    const nextScrollLeft = HORIZONTAL_BUFFER_DAYS * dayColumnWidth;
    scroller.scrollTop = nextScrollTop;
    scroller.scrollLeft = nextScrollLeft;
    if (scrollTop !== nextScrollTop) {
      setScrollTop(nextScrollTop);
    }
    if (scrollLeft !== nextScrollLeft) {
      setScrollLeft(nextScrollLeft);
      return;
    }
  };

  const jumpToCalendarDate = (date: string) => {
    const nextDate = date || today;
    pendingScrollDateRef.current = nextDate;
    setAnchorDate(nextDate);
    setJumpDate(nextDate);
  };

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const pendingDate = pendingScrollDateRef.current;
    if (pendingDate) {
      const dateIndex = visibleDates.indexOf(pendingDate);
      if (dateIndex >= 0) {
        const nextScrollLeft = dateIndex * dayColumnWidth;
        scroller.scrollLeft = nextScrollLeft;
        setScrollLeft(nextScrollLeft);
        pendingScrollDateRef.current = null;
      }
    }

    const pendingDelta = pendingHorizontalScrollDeltaRef.current;
    if (pendingDelta) {
      const nextScrollLeft = Math.max(0, Math.round(scroller.scrollLeft + pendingDelta));
      scroller.scrollLeft = nextScrollLeft;
      setScrollLeft(nextScrollLeft);
      pendingHorizontalScrollDeltaRef.current = 0;
      isExtendingHorizontalRangeRef.current = false;
    }
  }, [dayColumnWidth, visibleDates]);

  useLayoutEffect(() => {
    if (didApplyInitialViewportRef.current) return;
    didApplyInitialViewportRef.current = true;
    const currentDate = new Date();
    scrollToCurrentTime(currentDate);
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        scrollToCurrentTime(currentDate);
      });
      return () => window.cancelAnimationFrame(secondFrame);
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [dayColumnWidth]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const handleScroll = () => {
      if (scrollPersistTimerRef.current) {
        clearTimeout(scrollPersistTimerRef.current);
      }
      scrollPersistTimerRef.current = setTimeout(() => {
        const leftEdge = HORIZONTAL_EDGE_DAYS * dayColumnWidth;
        const rightEdge = Math.max(leftEdge, scroller.scrollWidth - scroller.clientWidth - leftEdge);
        if (!isExtendingHorizontalRangeRef.current && scroller.scrollLeft <= leftEdge) {
          isExtendingHorizontalRangeRef.current = true;
          pendingHorizontalScrollDeltaRef.current = HORIZONTAL_EXTEND_DAYS * dayColumnWidth;
          setAnchorDate((current) => addDays(current, -HORIZONTAL_EXTEND_DAYS));
          return;
        }
        if (!isExtendingHorizontalRangeRef.current && scroller.scrollLeft >= rightEdge) {
          isExtendingHorizontalRangeRef.current = true;
          pendingHorizontalScrollDeltaRef.current = -HORIZONTAL_EXTEND_DAYS * dayColumnWidth;
          setAnchorDate((current) => addDays(current, HORIZONTAL_EXTEND_DAYS));
          return;
        }
        setScrollTop(Math.max(0, Math.round(scroller.scrollTop)));
        setScrollLeft(Math.max(0, Math.round(scroller.scrollLeft)));
      }, 120);
    };
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      if (scrollPersistTimerRef.current) {
        clearTimeout(scrollPersistTimerRef.current);
        scrollPersistTimerRef.current = null;
      }
      if (cellClickTimerRef.current) {
        clearTimeout(cellClickTimerRef.current);
        cellClickTimerRef.current = null;
      }
    };
  }, [dayColumnWidth]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" || !selectedItem) {
        return;
      }
      const activeElement = document.activeElement as HTMLElement | null;
      const tagName = activeElement?.tagName?.toLowerCase();
      const isTextInput =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        Boolean(activeElement?.isContentEditable);
      if (isTextInput) {
        return;
      }
      event.preventDefault();
      if (selectedItem.targetType === "todo") {
        onDeleteTodo(selectedItem.targetId);
      } else {
        onDeleteActivity(selectedItem.targetId);
      }
      setSelectedItemId(null);
      setSelectedItemIds([]);
      setEditorDraft(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDeleteActivity, onDeleteTodo, selectedItem]);

  useEffect(() => {
    if (!selectedItemId) {
      setEditorDraft(null);
      return;
    }
    if (editorDraft?.itemId === selectedItemId) {
      return;
    }
    const calendarItem = calendarItems.find((item) => item.id === selectedItemId);
    if (!calendarItem) {
      setEditorDraft(null);
      return;
    }
    if (calendarItem.targetType === "todo") {
      const todo = todos.find((entry) => entry.id === calendarItem.targetId);
      if (!todo) return;
      setEditorDraft({ itemId: calendarItem.id, targetType: "todo", targetId: todo.id, title: todo.description, activityId: todo.activityId, parentActivityId: "", doOn: calendarItem.date, dueDate: todo.dueDate, startTime: slotToTime(calendarItem.startSlot), endTime: slotToTime(calendarItem.startSlot + DEFAULT_MEETING_DURATION_SLOTS), domain: todo.domain, project: todo.project, activity: todo.activity, isPrivate: todo.isPrivate, isMeeting: false });
      return;
    }
    const activity = activities.find((entry) => entry.id === calendarItem.targetId);
    if (!activity) return;
    setEditorDraft({ itemId: calendarItem.id, targetType: "activity", targetId: activity.id, title: activity.description, activityId: "", parentActivityId: activity.parentActivityId, doOn: calendarItem.date, dueDate: activity.dueDate, startTime: activity.startTime || slotToTime(calendarItem.startSlot), endTime: activity.endTime || slotToTime(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots)), domain: activity.domain, project: activity.project, activity: activity.activity, isPrivate: activity.isPrivate, isMeeting: activity.type === "meeting" });
  }, [activities, calendarItems, editorDraft?.itemId, selectedItemId, todos]);

  useEffect(() => {
    setSelectedItemIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  useEffect(() => {
    if (!highlightedItemId) {
      appliedHighlightedItemIdRef.current = null;
      return;
    }
    if (appliedHighlightedItemIdRef.current === highlightedItemId) return;
    const calendarItem = calendarItems.find((item) => item.id === highlightedItemId);
    if (!calendarItem) return;
    appliedHighlightedItemIdRef.current = highlightedItemId;
    pendingScrollDateRef.current = calendarItem.date;
    setAnchorDate(calendarItem.date);
    setJumpDate(calendarItem.date);
    setSelectedItemId(highlightedItemId);
    window.requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      scroller.scrollTop = Math.max(0, (calendarItem.startSlot - 12) * slotHeight);
    });
  }, [calendarItems, highlightedItemId, slotHeight]);

  const selectCalendarItem = (itemId: string, additive: boolean) => {
    setDraftCell(null);
    setSelectedItemId(itemId);
    if (!additive) {
      setSelectedItemIds([itemId]);
      return;
    }
    setSelectedItemIds((current) => {
      if (current.includes(itemId)) {
        const next = current.filter((id) => id !== itemId);
        return next.length ? next : [itemId];
      }
      return [...current, itemId];
    });
  };

  const itemIdsForDrag = (itemId: string) => (selectedItemIds.includes(itemId) ? selectedItemIds : [itemId]);

  const moveCalendarItemGroup = (anchorId: string, itemIds: string[], targetDate: string, targetSlot: number) => {
    const anchorItem = items.find((item) => item.id === anchorId);
    if (!anchorItem) return;
    const dateDelta = daysBetween(anchorItem.date, targetDate);
    const slotDelta = targetSlot - anchorItem.startSlot;
    itemIds.forEach((itemId) => {
      const item = items.find((entry) => entry.id === itemId);
      if (!item) return;
      onMoveItem(item.id, addDays(item.date, dateDelta), clampSlot(item.startSlot + slotDelta));
    });
    setSelectedItemIds(itemIds);
    setSelectedItemId(anchorId);
  };

  const getCalendarDropTarget = (clientX: number, clientY: number) => {
    const columns = Array.from(scrollRef.current?.querySelectorAll<HTMLElement>(".calendar-day-column") ?? []);
    for (const column of columns) {
      const rect = column.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        continue;
      }
      const date = column.dataset.date;
      if (!date) return null;
      return { date, slot: clampSlot(Math.floor((clientY - rect.top) / slotHeight)) };
    }
    return null;
  };

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

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const candidate = pointerDragCandidateRef.current;
      if (!candidate) return;
      const deltaX = Math.abs(event.clientX - candidate.startX);
      const deltaY = Math.abs(event.clientY - candidate.startY);
      if (deltaX < 5 && deltaY < 5) return;
      pointerDraggingItemRef.current = candidate.itemId;
      document.body.classList.add("calendar-pointer-dragging");
    };

    const handleMouseUp = (event: MouseEvent) => {
      const draggingItemId = pointerDraggingItemRef.current;
      const candidate = pointerDragCandidateRef.current;
      const draggingGroup = draggedGroupRef.current;
      pointerDragCandidateRef.current = null;
      pointerDraggingItemRef.current = null;
      draggedGroupRef.current = null;
      document.body.classList.remove("calendar-pointer-dragging");
      if (!candidate || !draggingItemId) return;
      const dropTarget = getCalendarDropTarget(event.clientX, event.clientY);
      if (!dropTarget) return;
      moveCalendarItemGroup(draggingItemId, draggingGroup?.itemIds ?? [draggingItemId], dropTarget.date, dropTarget.slot);
      suppressClickItemIdRef.current = draggingItemId;
      window.setTimeout(() => {
        if (suppressClickItemIdRef.current === draggingItemId) suppressClickItemIdRef.current = null;
      }, 0);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("calendar-pointer-dragging");
    };
  }, [items, onMoveItem, selectedItemIds, slotHeight]);

  const moveDraftCell = (deltaDays: number, deltaSlots: number) => {
    if (!draftCell) return;
    setDraftCell({ date: addDays(draftCell.date, deltaDays), slot: clampSlot(draftCell.slot + deltaSlots) });
  };

  const commitDraftCell = () => {
    if (!draftCell) return;
    const nextValue = draftText.trim();
    if (nextValue) {
      onCreateFromText(draftCell.date, draftCell.slot, nextValue, {
        activityId: creationContextActivityId || undefined,
        parentActivityId: creationContextActivityId || undefined,
      });
    }
    setDraftText("");
    setDraftCell(null);
  };

  const createMeetingFromGrid = async (date: string, slot: number) => {
    const normalizedSlot = clampSlot(slot);
    cancelPendingTodoDraft();
    setDraftText("");
    setDraftCell(null);
    setSelectedItemId(null);
    const createdItemId = await onCreateFromText(date, normalizedSlot, "New meeting", {
      activityId: creationContextActivityId || undefined,
      parentActivityId: creationContextActivityId || undefined,
      kind: "meeting",
      endSlot: clampSlot(normalizedSlot + DEFAULT_MEETING_DURATION_SLOTS),
    });
    if (createdItemId) {
      setSelectedItemId(createdItemId);
    }
  };

  const openTodoDraftFromGrid = (date: string, slot: number) => {
    if (cellClickTimerRef.current) {
      clearTimeout(cellClickTimerRef.current);
    }
    cellClickTimerRef.current = setTimeout(() => {
      setSelectedItemId(null);
      setDraftCell({ date, slot: clampSlot(slot) });
      setDraftText("");
      cellClickTimerRef.current = null;
    }, 180);
  };

  const cancelPendingTodoDraft = () => {
    if (!cellClickTimerRef.current) return;
    clearTimeout(cellClickTimerRef.current);
    cellClickTimerRef.current = null;
  };

  const persistEditorDraft = (draft: EditorDraft) => {
    const startSlot = clampSlot(timeToSlot(draft.startTime || "00:00"));
    const durationSlots = draft.isMeeting ? Math.max(1, durationFromTimes(draft.startTime || "00:00", draft.endTime || draft.startTime || "00:05")) : 1;
    if (draft.targetType === "todo") {
      const todo = todos.find((entry) => entry.id === draft.targetId);
      if (!todo) return;
      onSaveTodo({ ...todo, description: draft.title.trim() || todo.description, activityId: draft.activityId, doOn: draft.doOn, dueDate: draft.dueDate, domain: draft.domain, project: draft.project, activity: draft.activity, isPrivate: draft.isPrivate });
    } else {
      const activity = activities.find((entry) => entry.id === draft.targetId);
      if (!activity) return;
      onSaveActivity({ ...activity, description: draft.title.trim() || activity.description, parentActivityId: draft.parentActivityId, doOn: draft.doOn, dueDate: draft.dueDate, domain: draft.domain, project: draft.project, activity: draft.activity, isPrivate: draft.isPrivate, startTime: draft.isMeeting ? draft.startTime : activity.startTime, endTime: draft.isMeeting ? draft.endTime : activity.endTime });
    }
    onUpdateCalendarItem(draft.itemId, { date: draft.doOn, startSlot, durationSlots });
  };

  const updateEditorDraft = (draft: EditorDraft) => {
    setEditorDraft(draft);
    persistEditorDraft(draft);
  };

  const handleEditorDomainChange = (domain: string) => {
    if (!editorDraft) return;
    const nextProjects = getProjectsForDomain(structureOptions, domain);
    const nextProject = nextProjects.includes(editorDraft.project) ? editorDraft.project : "";
    const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
    const nextActivity = nextActivities.includes(editorDraft.activity) ? editorDraft.activity : "";
    const linkedId = editorDraft.targetType === "todo" ? editorDraft.activityId : editorDraft.parentActivityId;
    const linkedActivity = linkedId ? activityLookup[linkedId] : null;
    const nextLinkedId =
      linkedActivity &&
      (!domain || !linkedActivity.domain || linkedActivity.domain === domain) &&
      (!nextProject || !linkedActivity.project || linkedActivity.project === nextProject)
        ? linkedId
        : "";
    updateEditorDraft({
      ...editorDraft,
      domain,
      project: nextProject,
      activity: nextActivity,
      activityId: editorDraft.targetType === "todo" ? nextLinkedId : editorDraft.activityId,
      parentActivityId: editorDraft.targetType === "activity" ? nextLinkedId : editorDraft.parentActivityId,
    });
  };

  const handleEditorProjectChange = (project: string) => {
    if (!editorDraft) return;
    const nextActivities = getActivitiesForSelection(structureOptions, editorDraft.domain, project);
    const nextActivity = nextActivities.includes(editorDraft.activity) ? editorDraft.activity : "";
    const linkedId = editorDraft.targetType === "todo" ? editorDraft.activityId : editorDraft.parentActivityId;
    const linkedActivity = linkedId ? activityLookup[linkedId] : null;
    const nextLinkedId =
      linkedActivity &&
      (!editorDraft.domain || !linkedActivity.domain || linkedActivity.domain === editorDraft.domain) &&
      (!project || !linkedActivity.project || linkedActivity.project === project)
        ? linkedId
        : "";
    updateEditorDraft({
      ...editorDraft,
      project,
      activity: nextActivity,
      activityId: editorDraft.targetType === "todo" ? nextLinkedId : editorDraft.activityId,
      parentActivityId: editorDraft.targetType === "activity" ? nextLinkedId : editorDraft.parentActivityId,
    });
  };

  const convertEditorTodoToMeeting = () => {
    if (!editorDraft || editorDraft.targetType !== "todo") return;
    const todo = todos.find((entry) => entry.id === editorDraft.targetId);
    if (!todo) return;
    onConvertTodoToMeeting(todo, {
      date: editorDraft.doOn,
      startTime: editorDraft.startTime || "09:00",
      endTime:
        editorDraft.endTime ||
        slotToTime(timeToSlot(editorDraft.startTime || "09:00") + DEFAULT_MEETING_DURATION_SLOTS),
    });
  };

  const deleteSelectedCalendarItems = () => {
    const idsToDelete = selectedItemIds.length ? selectedItemIds : selectedItemId ? [selectedItemId] : [];
    const targets = new Map<string, Item>();
    idsToDelete.forEach((itemId) => {
      const item = items.find((entry) => entry.id === itemId);
      if (item) targets.set(`${item.targetType}:${item.targetId}`, item);
    });
    targets.forEach((item) => {
      if (item.targetType === "todo") {
        onDeleteTodo(item.targetId);
        return;
      }
      onDeleteActivity(item.targetId);
    });
    setSelectedItemId(null);
    setSelectedItemIds([]);
    setEditorDraft(null);
  };

  return (
    <div className={`card calendar-workspace${isFullScreen ? " calendar-workspace-fullscreen" : ""}`}>
      <div className="card-header session-editor-header-minimal calendar-workspace-header">
        <div><h2>Calendar</h2></div>
        <div className="page-actions wrap-row calendar-primary-actions">
          <button className="shell-button" type="button" onClick={() => jumpToCalendarDate(addDays(anchorDate, -daysInView))}>Previous</button>
          <button className="shell-button" type="button" onClick={() => { const currentDate = new Date(); jumpToCalendarDate(getLocalDateString(currentDate)); window.requestAnimationFrame(() => scrollToCurrentTime(currentDate)); }}>Today</button>
          <button className="shell-button" type="button" onClick={() => jumpToCalendarDate(addDays(anchorDate, daysInView))}>Next</button>
          <button className="small-button danger-button" type="button" onClick={deleteSelectedCalendarItems} disabled={!selectedItemId && !selectedItemIds.length}>
            Delete selected
          </button>
        </div>
      </div>

      <div className="calendar-controls calendar-controls-compact calendar-controls-dense">
        <div className="calendar-calendar-summary">
          <div className="status-chip">{filteredItems.length} scheduled items</div>
          <div className="capture-density-toggle">{DAYS.map((option) => <button key={`days-${option}`} className="segment-button" type="button" data-active={option === daysInView} onClick={() => setDaysInView(option)}>{option} days</button>)}</div>
          <div className="capture-density-toggle">{HEIGHTS.map((option) => <button key={`height-${option}`} className="segment-button" type="button" data-active={option === slotHeight} onClick={() => setSlotHeight(option)}>{option === 12 ? "Compact" : option === 16 ? "Default" : "Large"}</button>)}</div>
        </div>
        <details className="workspace-disclosure calendar-secondary-controls">
          <summary>More calendar controls</summary>
          <div className="workspace-disclosure-body">
            <div className="calendar-toolbar calendar-toolbar-dense">
              <div className="field"><label htmlFor="calendar-jump-date">Jump</label><DateInput id="calendar-jump-date" value={jumpDate} onChange={(event) => setJumpDate(event.target.value)} /></div>
              <button className="shell-button" type="button" onClick={() => jumpToCalendarDate(jumpDate || today)}>Go</button>
              <div className="field field-wide"><label htmlFor="calendar-search">Search</label><input id="calendar-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search title" /></div>
              <div className="field"><label htmlFor="calendar-type-filter">Type</label><select id="calendar-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | "todo" | "activity" | "meeting")}><option value="all">All</option><option value="todo">Todos</option><option value="activity">Activities</option><option value="meeting">Meetings</option></select></div>
              <div className="field"><label htmlFor="calendar-visibility-filter">Private</label><select id="calendar-visibility-filter" value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as "all" | "public" | "private")}><option value="all">All</option><option value="public">Public</option><option value="private">Private</option></select></div>
              <div className="field calendar-context-field">
                <label htmlFor="calendar-creation-context">Attach new entries</label>
                <select
                  id="calendar-creation-context"
                  value={creationContextActivityId}
                  onChange={(event) => setCreationContextActivityId(event.target.value)}
                >
                  <option value="">No activity context</option>
                  {topLevelActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div ref={layoutRef} className={`calendar-layout${isFullScreen ? " calendar-layout-fullscreen" : ""}`} style={{ gridTemplateColumns: `minmax(0, 1fr) 8px ${detailsPaneWidth}px` }}>
        <div className="calendar-main stack">
          <div ref={scrollRef} className={`calendar-scroll${isFullScreen ? " calendar-scroll-fullscreen" : ""}`} style={{ ["--calendar-slot-height" as string]: `${slotHeight}px` }}>
            <div className="calendar-surface" style={{ gridTemplateColumns: `84px repeat(${visibleDates.length}, minmax(${dayColumnWidth}px, 1fr))`, gridTemplateRows: `52px repeat(${TOTAL_SLOTS}, var(--calendar-slot-height))` }}>
              <div className="calendar-corner" style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }} />
              {visibleDates.map((date, index) => <div key={date} className="calendar-day-header" style={{ gridColumn: `${index + 2} / ${index + 3}`, gridRow: "1 / 2" }}><strong>{date}</strong><span>{formatDay(date)}</span></div>)}
              <div className="calendar-time-column" style={{ gridColumn: "1 / 2", gridRow: `2 / span ${TOTAL_SLOTS}` }}>{Array.from({ length: TOTAL_SLOTS }, (_, slot) => <div key={`time-${slot}`} className={`calendar-time-cell${slot % 12 === 0 ? " calendar-time-cell-hour" : ""}`} style={{ height: "var(--calendar-slot-height)" }}>{slot % 12 === 0 ? slotToTime(slot) : ""}</div>)}</div>
              {visibleDates.map((date, index) => {
                const dayItems = itemsByDate.get(date) ?? [];
                const active = draftCell?.date === date ? draftCell : null;
                return <div key={`col-${date}`} data-date={date} className="calendar-day-column" style={{ gridColumn: `${index + 2} / ${index + 3}`, gridRow: `2 / span ${TOTAL_SLOTS}`, height: `calc(var(--calendar-slot-height) * ${TOTAL_SLOTS})` }} onClick={(event) => {
                  if (event.detail > 1) return;
                  const target = event.target as HTMLElement;
                  if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input")) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  openTodoDraftFromGrid(date, Math.floor((event.clientY - rect.top) / slotHeight));
                }} onDoubleClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input")) return;
                  cancelPendingTodoDraft();
                  const rect = event.currentTarget.getBoundingClientRect();
                  void createMeetingFromGrid(date, Math.floor((event.clientY - rect.top) / slotHeight));
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
                    const minVisualHeight =
                      item.targetType === "todo" && !item.isMeeting ? Math.max(10, slotHeight - 2) : 18;
                    const visualHeight = Math.max(
                      slotHeight * Math.max(durationSlots, item.isMeeting ? 3 : 1) - 4,
                      minVisualHeight,
                    );
                    const runningLog = getRunningTimeLog(timeLogsByTarget.get(`${item.targetType}:${item.targetId}`) || []);
                    const linkedSessionState =
                      item.isMeeting && item.targetType === "activity" ? linkedSessionStateByActivity[item.targetId] : undefined;
                    const runningLabel = runningLog ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now)) : "";
                    const isSelected = selectedItemIds.includes(item.id) || selectedItemId === item.id;
                    const sizeClass = [
                      visualHeight <= 22 ? "calendar-item-block-tiny" : visualHeight <= 54 ? "calendar-item-block-compact" : "",
                      item.targetType === "todo" && durationSlots <= 1 ? "calendar-item-block-single-row-todo" : "",
                      item.isMeeting && durationSlots <= 12 ? "calendar-item-block-medium-meeting" : "",
                      item.isMeeting && durationSlots <= 6 ? "calendar-item-block-short-meeting" : "",
                      item.isMeeting && durationSlots <= 3 ? "calendar-item-block-micro-meeting" : "",
                    ].filter(Boolean).map((className) => ` ${className}`).join("");
                    return <button key={item.id} className={`calendar-item-block calendar-item-block-${item.targetType}${item.isMeeting ? " calendar-item-block-meeting" : ""}${isSelected ? " calendar-item-block-selected" : ""}${selectedItemIds.length > 1 && selectedItemIds.includes(item.id) ? " calendar-item-block-multi-selected" : ""}${sizeClass}`} type="button" style={{ top: `calc(var(--calendar-slot-height) * ${startSlot} + 2px)`, height: `${visualHeight}px`, width: `calc(${laneWidth}% - 8px)`, left: `calc(${item.lane * laneWidth}% + 4px)`, right: "auto" }} onMouseDown={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest(".calendar-item-inline-action") || target.closest(".calendar-resize-handle")) return;
                      event.preventDefault();
                      pointerDragCandidateRef.current = { itemId: item.id, startX: event.clientX, startY: event.clientY };
                      draggedGroupRef.current = { anchorId: item.id, itemIds: itemIdsForDrag(item.id) };
                    }} onClick={(event) => { if (suppressClickItemIdRef.current === item.id) return; selectCalendarItem(item.id, event.metaKey || event.ctrlKey || event.shiftKey); }} onDoubleClick={() => { if (item.targetType === "todo") { onOpenTodoDetail(item.targetId); return; } onOpenActivityDetail(item.targetId); }}>
                      {item.isMeeting ? <span className="calendar-resize-handle calendar-resize-handle-start" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "start", date: item.date, startSlot, durationSlots }); }} /> : null}
                      <span className="calendar-item-kicker">
                        {item.isMeeting ? "Meeting" : item.targetType === "todo" ? "Todo" : "Activity"}
                        {item.isPrivate ? " • Private" : ""}
                      </span>
                      <strong className="calendar-item-title">{slotToTime(startSlot)} {item.title}</strong>
                      <span className="calendar-item-meta">{item.isMeeting ? durationLabel(durationSlots) : item.label}{runningLog ? ` • Running ${runningLabel}` : ""}</span>
                      {linkedSessionState?.sessionId ? (
                        <span className={`calendar-item-link-state${linkedSessionState.hasOutput ? " calendar-item-link-state-output" : ""}`}>
                          {linkedSessionState.hasOutput ? "Output ready" : "Session linked"}
                        </span>
                      ) : item.isMeeting ? (
                        <span className="calendar-item-link-state calendar-item-link-state-empty">No session</span>
                      ) : null}
                      {item.isMeeting ? (
                        <div className="calendar-item-launcher-row">
                          {linkedSessionState?.sessionId ? (
                            <>
                              <span
                                className="calendar-item-inline-action calendar-item-inline-action-secondary"
                                role="button"
                                tabIndex={-1}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onOpenSession(linkedSessionState.sessionId!, item.id);
                                }}
                              >
                                Open session
                              </span>
                              {linkedSessionState.hasOutput ? (
                                <span
                                  className="calendar-item-inline-action calendar-item-inline-action-secondary"
                                  role="button"
                                  tabIndex={-1}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                  }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onPreviewSessionOutput(linkedSessionState.sessionId!);
                                  }}
                                >
                                  Output
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span
                              className="calendar-item-inline-action calendar-item-inline-action-secondary"
                              role="button"
                              tabIndex={-1}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onCreateLinkedMeetingSession(item.targetId);
                              }}
                            >
                              Create session
                            </span>
                          )}
                        </div>
                      ) : null}
                      <span
                        className={`calendar-item-inline-action${runningLog ? " calendar-item-inline-action-active" : ""}`}
                        role="button"
                        tabIndex={-1}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (runningLog) {
                            onStopTracking(item.targetType, item.targetId);
                            return;
                          }
                          onStartTracking(item.targetType, item.targetId);
                        }}
                      >
                        {runningLog ? "Stop" : "Start"}
                      </span>
                      {item.isMeeting ? <span className="calendar-resize-handle calendar-resize-handle-end" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "end", date: item.date, startSlot, durationSlots }); }} /> : null}
                    </button>;
                  })}
                </div>;
              })}
            </div>
          </div>
        </div>
        <div className="calendar-splitter" role="separator" aria-orientation="vertical" onMouseDown={() => { splitterDraggingRef.current = true; document.body.style.cursor = "col-resize"; }} />
        <aside className={`calendar-editor-card${detailsPaneWidth <= 340 ? " calendar-editor-card-compact" : ""}`}>
          {editorDraft ? (
            <div className={`stack calendar-editor-stack${detailsPaneWidth <= 340 ? " calendar-editor-stack-compact" : ""}`}>
              <div className="card-header">
                <div>
                  <h3>{editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity"}</h3>
                  <div className="calendar-editor-meta">
                    <span className="status-chip">{editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity"}</span>
                    {editorDraft.project ? <span className="status-chip">{editorDraft.project}</span> : null}
                    {editorDraft.domain ? <span className="status-chip">{editorDraft.domain}</span> : null}
                  </div>
                </div>
                <button className="small-button" type="button" onClick={() => setSelectedItemId(null)}>
                  Close
                </button>
              </div>
              <div className="calendar-inspector-section-label">Schedule</div>
              <div className="field">
                <label htmlFor="calendar-edit-title">Title</label>
                <input
                  id="calendar-edit-title"
                  value={editorDraft.title}
                  onChange={(event) => updateEditorDraft({ ...editorDraft, title: event.target.value })}
                />
              </div>
              {editorDraft.isMeeting ? (
                <div className="inline-row">
                  <div className="field">
                    <label htmlFor="calendar-edit-date">Date</label>
                    <DateInput
                      id="calendar-edit-date"
                      value={editorDraft.doOn}
                      onChange={(event) => updateEditorDraft({ ...editorDraft, doOn: event.target.value })}
                    />
                  </div>
                  <label className="compact-private-toggle">
                    <input
                      type="checkbox"
                      checked={editorDraft.isPrivate}
                      onChange={(event) => updateEditorDraft({ ...editorDraft, isPrivate: event.target.checked })}
                    />
                    <span>Private</span>
                  </label>
                </div>
              ) : (
                <details className="workspace-disclosure calendar-inspector-disclosure">
                  <summary>Schedule details</summary>
                  <div className="workspace-disclosure-body">
                    <div className="inline-row">
                      <div className="field">
                        <label htmlFor="calendar-edit-date">Date</label>
                        <DateInput
                          id="calendar-edit-date"
                          value={editorDraft.doOn}
                          onChange={(event) => updateEditorDraft({ ...editorDraft, doOn: event.target.value })}
                        />
                      </div>
                      <label className="compact-private-toggle">
                        <input
                          type="checkbox"
                          checked={editorDraft.isPrivate}
                          onChange={(event) => updateEditorDraft({ ...editorDraft, isPrivate: event.target.checked })}
                        />
                        <span>Private</span>
                      </label>
                    </div>
                  </div>
                </details>
              )}
              {editorDraft.isMeeting ? (
                <>
                  <div className="calendar-inspector-section-label">Linked session</div>
                  <div className="inline-row">
                    <div className="field">
                      <label htmlFor="calendar-edit-start">Start</label>
                      <input
                        id="calendar-edit-start"
                        type="time"
                        step={300}
                        value={editorDraft.startTime}
                        onChange={(event) => updateEditorDraft({ ...editorDraft, startTime: event.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="calendar-edit-end">End</label>
                      <input
                        id="calendar-edit-end"
                        type="time"
                        step={300}
                        value={editorDraft.endTime}
                        onChange={(event) => updateEditorDraft({ ...editorDraft, endTime: event.target.value })}
                      />
                    </div>
                  </div>
                  {editorDraft.targetType === "activity" ? (
                    <div className="field">
                      <label>Meeting session</label>
                      <div className="calendar-linked-session-card">
                        <div className="calendar-linked-session-status">
                          {linkedSessionStateByActivity[editorDraft.targetId]?.sessionId ? (
                            <>
                              <strong>{linkedSessionStateByActivity[editorDraft.targetId]?.sessionTitle || "Linked meeting session"}</strong>
                              <span>
                                {linkedSessionStateByActivity[editorDraft.targetId]?.hasOutput ? "Output available" : "No output yet"}
                              </span>
                            </>
                          ) : (
                            <>
                              <strong>No linked meeting session</strong>
                              <span>Create one when this calendar meeting should become a working notes session.</span>
                            </>
                          )}
                        </div>
                        <div className="calendar-editor-actions">
                          {linkedSessionStateByActivity[editorDraft.targetId]?.sessionId ? (
                            <>
                              <button
                                className="shell-button"
                                type="button"
                                onClick={() => {
                                  const sessionId = linkedSessionStateByActivity[editorDraft.targetId]?.sessionId;
                                  if (sessionId) onOpenSession(sessionId);
                                }}
                              >
                                Open linked meeting session
                              </button>
                              {linkedSessionStateByActivity[editorDraft.targetId]?.hasOutput ? (
                                <button
                                  className="shell-button"
                                  type="button"
                                  onClick={() => {
                                    const sessionId = linkedSessionStateByActivity[editorDraft.targetId]?.sessionId;
                                    if (sessionId) onPreviewSessionOutput(sessionId);
                                  }}
                                >
                                  Open session output
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <button
                              className="shell-button"
                              type="button"
                              onClick={() => onCreateLinkedMeetingSession(editorDraft.targetId)}
                            >
                              Create linked meeting session
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
              <details className="workspace-disclosure calendar-inspector-disclosure calendar-structure-disclosure">
                <summary>{editorDraft.isMeeting ? "Structure and advanced details" : "More details"}</summary>
                <div className="workspace-disclosure-body stack">
              <div className="metadata-triplet-grid">
                {!editorDraft.isMeeting ? (
                  <div className="field metadata-subfield">
                    <label htmlFor="calendar-edit-link">Activity link</label>
                    <select
                      id="calendar-edit-link"
                      value={editorDraft.activityId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        const linkedActivity = nextId ? activityLookup[nextId] : null;
                        updateEditorDraft({
                          ...editorDraft,
                          activityId: nextId,
                          domain: linkedActivity?.domain || editorDraft.domain,
                          project: linkedActivity?.project || editorDraft.project,
                          activity: linkedActivity?.description || editorDraft.activity,
                        });
                      }}
                    >
                      <option value="">Unassigned</option>
                      {linkedActivityOptions.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.description}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="field metadata-subfield">
                  <label htmlFor="calendar-edit-domain">Domain</label>
                  <TokenPicker
                    value={editorDraft.domain}
                    savedOptions={structureOptions.domains}
                    suggestedOptions={structureOptions.domains}
                    placeholder="Search or add domain"
                    suggestionSummary="Domains"
                    suggestionBadgeText="Available"
                    mode="single"
                    onChange={handleEditorDomainChange}
                  />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="calendar-edit-project">Project</label>
                  <TokenPicker
                    value={editorDraft.project}
                    savedOptions={editorProjectOptions}
                    suggestedOptions={editorProjectOptions}
                    placeholder="Search or add project"
                    suggestionSummary="Projects"
                    suggestionBadgeText="Available"
                    mode="single"
                    onChange={handleEditorProjectChange}
                  />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="calendar-edit-activity">Activity</label>
                  <TokenPicker
                    value={editorDraft.activity}
                    savedOptions={editorActivityOptions}
                    suggestedOptions={editorActivityOptions}
                    placeholder="Search or add activity"
                    suggestionSummary="Activities"
                    suggestionBadgeText="Available"
                    mode="single"
                    onChange={(value) => updateEditorDraft({ ...editorDraft, activity: value })}
                  />
                </div>
              </div>
              {!editorDraft.isMeeting ? (
                <div className="field">
                  <label htmlFor="calendar-edit-due">Due date</label>
                  <DateInput
                    id="calendar-edit-due"
                    value={editorDraft.dueDate}
                    onChange={(event) => updateEditorDraft({ ...editorDraft, dueDate: event.target.value })}
                  />
                </div>
              ) : null}
                </div>
              </details>
              <div className="calendar-inspector-section-label">Time</div>
              <div className="calendar-editor-actions">
                {(() => {
                  const runningLog = getRunningTimeLog(timeLogsByTarget.get(`${editorDraft.targetType}:${editorDraft.targetId}`) || []);
                  return (
                    <>
                      <span className="status-chip">
                        {runningLog ? `Running • ${formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))}` : "No active timer"}
                      </span>
                      <button
                        className={runningLog ? "primary-button" : "shell-button"}
                        type="button"
                        onClick={() => {
                          if (runningLog) {
                            onStopTracking(editorDraft.targetType, editorDraft.targetId);
                            return;
                          }
                          onStartTracking(editorDraft.targetType, editorDraft.targetId);
                        }}
                      >
                        {runningLog ? "Stop timelog" : "Start timelog"}
                      </button>
                    </>
                  );
                })()}
              </div>
              <div className="calendar-editor-actions calendar-editor-actions-inline">
                <button
                  className="shell-button"
                  type="button"
                  onClick={() => (editorDraft.targetType === "todo" ? onOpenTodoWorkspace() : onOpenActivityWorkspace(editorDraft.targetId))}
                >
                  Open full {editorDraft.targetType === "todo" ? "todo" : "activity"}
                </button>
                {editorDraft.targetType === "todo" ? (
                  <button className="shell-button" type="button" onClick={convertEditorTodoToMeeting}>
                    Convert to meeting
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="stack">
              <h3>Calendar item</h3>
              <p className="muted">Select a scheduled block to edit it here.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
