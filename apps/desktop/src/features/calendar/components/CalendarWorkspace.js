import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DateInput } from "../../../components/DateInput";
import { DeferredTimeInput } from "../../../components/DeferredTimeInput";
import { PeoplePicker } from "../../../components/PeoplePicker";
import { TokenPicker } from "../../../components/TokenPicker";
import { getActivitiesForSelection, getProjectsForDomain } from "../../../lib/structure/options";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "../../../lib/time/tracking";
import { addDaysIso, daysBetweenIso, formatStockholmDate, formatStockholmDayLabel, getStockholmDateTimeParts, parseIsoDateUtc, } from "../../../lib/time/stockholm";
const TOTAL_SLOTS = 24 * 12;
const MINUTES_PER_SLOT = 5;
const DEFAULT_MEETING_DURATION_SLOTS = 12;
const DAYS = [3, 5, 7, 14];
const HEIGHTS = [12, 16, 22];
const MIN_PANE = 240;
const MAX_PANE = 520;
const HORIZONTAL_BUFFER_DAYS = 28;
const HORIZONTAL_EXTEND_DAYS = 14;
const HORIZONTAL_EDGE_DAYS = 7;
const DRAG_SCROLL_EDGE_PX = 56;
const DRAG_SCROLL_STEP_PX = 18;
export const addDays = addDaysIso;
export const daysBetween = daysBetweenIso;
export const clampSlot = (slot) => Math.max(0, Math.min(TOTAL_SLOTS - 1, slot));
export const clampPane = (width) => Math.min(MAX_PANE, Math.max(MIN_PANE, Math.round(width)));
export const durationFromTimes = (startTime, endTime) => Math.max(1, timeToSlot(endTime) - timeToSlot(startTime));
export const slotToTime = (slot) => {
    const total = slot * MINUTES_PER_SLOT;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
export const timeToSlot = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes))
        return 0;
    return hours * 12 + Math.floor(minutes / MINUTES_PER_SLOT);
};
export const formatDay = (date) => formatStockholmDayLabel(date);
export const getLocalDateString = (date = new Date()) => formatStockholmDate(date);
export const initialCalendarScrollTop = (date, slotHeight) => {
    const { hours, minutes } = getStockholmDateTimeParts(date);
    const currentSlot = clampSlot(hours * 12 + Math.floor(minutes / MINUTES_PER_SLOT));
    const previousHourSlot = Math.max(0, currentSlot - 12);
    return previousHourSlot * slotHeight;
};
export const durationLabel = (slots) => {
    const minutes = slots * MINUTES_PER_SLOT;
    if (minutes < 60)
        return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
};
export const dayColumnWidthForView = (daysInView) => {
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
const slotToDateTime = (date, slot) => {
    const next = parseIsoDateUtc(date);
    next.setUTCMinutes(slot * MINUTES_PER_SLOT);
    return next;
};
const WORKDAY_END_START_SLOT = 17 * 12;
const getFutureAnchoredSlot = (value = new Date()) => {
    const { hours, minutes } = getStockholmDateTimeParts(value);
    const exactSlot = (hours * 60 + minutes) / MINUTES_PER_SLOT;
    return Math.min(WORKDAY_END_START_SLOT, clampSlot(Math.ceil(exactSlot)));
};
const repositionTodaySingleRowTodos = (items, today, value = new Date()) => {
    const anchorSlot = getFutureAnchoredSlot(value);
    const occupiedSlots = new Set();
    const floatingTodos = [];
    const fixedItems = [];
    items.forEach((item) => {
        const isFloatingTodayTodo = item.targetType === "todo" && item.date === today && item.durationSlots <= 1;
        if (isFloatingTodayTodo) {
            floatingTodos.push(item);
            return;
        }
        fixedItems.push(item);
        if (item.date !== today)
            return;
        const endSlot = item.startSlot + Math.max(1, item.durationSlots);
        for (let slot = item.startSlot; slot < endSlot; slot += 1) {
            occupiedSlots.add(slot);
        }
    });
    const repositionedTodos = [...floatingTodos]
        .sort((left, right) => left.startSlot - right.startSlot || left.title.localeCompare(right.title))
        .map((item) => {
        let nextSlot = anchorSlot;
        while (occupiedSlots.has(nextSlot) && nextSlot < TOTAL_SLOTS - 1) {
            nextSlot += 1;
        }
        occupiedSlots.add(nextSlot);
        return {
            ...item,
            startSlot: nextSlot,
            durationSlots: 1,
        };
    });
    return [...fixedItems, ...repositionedTodos];
};
export const layoutCalendarItems = (items) => {
    const grouped = new Map();
    items.forEach((item) => {
        const existing = grouped.get(item.date) ?? [];
        existing.push(item);
        grouped.set(item.date, existing);
    });
    const result = [];
    grouped.forEach((dayItems) => {
        const lanesEnd = [];
        dayItems.forEach((item) => {
            const itemEnd = item.startSlot + Math.max(1, item.durationSlots);
            let lane = lanesEnd.findIndex((laneEnd) => laneEnd <= item.startSlot);
            if (lane === -1) {
                lane = lanesEnd.length;
                lanesEnd.push(itemEnd);
            }
            else {
                lanesEnd[lane] = itemEnd;
            }
            const laneCount = dayItems.filter((candidate) => item.startSlot < candidate.startSlot + Math.max(1, candidate.durationSlots) &&
                candidate.startSlot < itemEnd).length;
            result.push({ ...item, lane, laneCount: Math.max(1, laneCount) });
        });
    });
    return result.sort((left, right) => left.date.localeCompare(right.date) || left.startSlot - right.startSlot || left.lane - right.lane);
};
export const CalendarWorkspace = ({ todos, checklists, activities, timeLogs, calendarItems, settings, openRevision = 0, structureOptions, linkedSessionStateByActivity, linkedSessionStateByTodo, savedPeople, onSaveSettings, onCreateFromText, onMoveItem, onSaveTodo, onDeleteTodo, onCreateChecklist, onSaveChecklist, onDeleteChecklist, onSaveActivity, onDeleteActivity, onConvertTodoToMeeting, onUpdateCalendarItem, onSaveTimeLog, onStartTracking, onStopTracking, onOpenTodoWorkspace, onOpenTodoDetail, onOpenActivityWorkspace, onOpenActivityDetail, onOpenSession, highlightedItemId, onCreateLinkedMeetingSession, onCreateLinkedTaskSession, onPreviewSessionOutput, onFullScreenChange, }) => {
    const today = getLocalDateString();
    const runtimeTimeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown" : "unknown";
    const initialIsFullScreen = true;
    const [anchorDate, setAnchorDate] = useState(today);
    const [daysInView, setDaysInView] = useState(settings.calendarDaysInView);
    const [slotHeight, setSlotHeight] = useState(settings.calendarSlotHeight);
    const [isFullScreen] = useState(initialIsFullScreen);
    const [detailsPaneWidth, setDetailsPaneWidth] = useState(settings.calendarDetailsPaneWidth);
    const [scrollTop, setScrollTop] = useState(initialCalendarScrollTop(new Date(), settings.calendarSlotHeight));
    const [scrollLeft, setScrollLeft] = useState(settings.calendarScrollLeft ?? 0);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [editorDraft, setEditorDraft] = useState(null);
    const [timeLogNotesDrafts, setTimeLogNotesDrafts] = useState({});
    const [jumpDate, setJumpDate] = useState(today);
    const [draftCell, setDraftCell] = useState(null);
    const [draftText, setDraftText] = useState("");
    const [creationContextActivityId, setCreationContextActivityId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [showPrivateItems, setShowPrivateItems] = useState(settings.calendarShowPrivate ?? (settings.calendarVisibilityFilter === "public" ? false : true));
    const [showBusinessItems, setShowBusinessItems] = useState(settings.calendarShowBusiness ?? (settings.calendarVisibilityFilter === "private" ? false : true));
    const [showPriorityOnly, setShowPriorityOnly] = useState(Boolean(settings.calendarShowPriorityOnly));
    const [hideCompletedTodos, setHideCompletedTodos] = useState(false);
    const [checklistDraft, setChecklistDraft] = useState("");
    const [checklistItemDrafts, setChecklistItemDrafts] = useState({});
    const [inlineTodoEdit, setInlineTodoEdit] = useState(null);
    const [resizeState, setResizeState] = useState(null);
    const [marqueeSelection, setMarqueeSelection] = useState(null);
    const [now, setNow] = useState(() => new Date());
    const layoutRef = useRef(null);
    const scrollRef = useRef(null);
    const splitterDraggingRef = useRef(false);
    const didApplyInitialViewportRef = useRef(false);
    const appliedHighlightedItemIdRef = useRef(null);
    const pendingHorizontalScrollDeltaRef = useRef(0);
    const pendingScrollDateRef = useRef(null);
    const isExtendingHorizontalRangeRef = useRef(false);
    const scrollPersistTimerRef = useRef(null);
    const cellClickTimerRef = useRef(null);
    const draggedGroupRef = useRef(null);
    const pointerDragCandidateRef = useRef(null);
    const pointerDraggingItemRef = useRef(null);
    const suppressClickItemIdRef = useRef(null);
    const suppressColumnClickRef = useRef(false);
    const marqueeCandidateRef = useRef(null);
    const marqueeStateRef = useRef(null);
    const undoStackRef = useRef([]);
    const selectedItemIdsRef = useRef([]);
    const dragPointerClientRef = useRef(null);
    const autoScrollFrameRef = useRef(null);
    useEffect(() => {
        onFullScreenChange?.(isFullScreen);
        return () => onFullScreenChange?.(false);
    }, [isFullScreen, onFullScreenChange]);
    useEffect(() => {
        if (settings.calendarDaysInView !== daysInView ||
            settings.calendarSlotHeight !== slotHeight ||
            settings.calendarIsFullScreen !== isFullScreen ||
            !settings.calendarFullScreenPreferenceInitialized ||
            settings.calendarDetailsPaneWidth !== detailsPaneWidth ||
            settings.calendarScrollTop !== scrollTop ||
            settings.calendarScrollLeft !== scrollLeft ||
            settings.calendarShowPrivate !== showPrivateItems ||
            settings.calendarShowBusiness !== showBusinessItems ||
            settings.calendarShowPriorityOnly !== showPriorityOnly) {
            onSaveSettings({
                ...settings,
                calendarDaysInView: daysInView,
                calendarSlotHeight: slotHeight,
                calendarIsFullScreen: isFullScreen,
                calendarFullScreenPreferenceInitialized: true,
                calendarDetailsPaneWidth: detailsPaneWidth,
                calendarScrollTop: scrollTop,
                calendarScrollLeft: scrollLeft,
                calendarVisibilityFilter: showPrivateItems && showBusinessItems ? "all" : showPrivateItems ? "private" : showBusinessItems ? "public" : "all",
                calendarShowPrivate: showPrivateItems,
                calendarShowBusiness: showBusinessItems,
                calendarShowPriorityOnly: showPriorityOnly,
            });
        }
    }, [daysInView, detailsPaneWidth, isFullScreen, onSaveSettings, scrollLeft, scrollTop, settings, showBusinessItems, showPriorityOnly, showPrivateItems, slotHeight]);
    const visibleDates = useMemo(() => Array.from({ length: daysInView + HORIZONTAL_BUFFER_DAYS * 2 }, (_, index) => addDays(anchorDate, index - HORIZONTAL_BUFFER_DAYS)), [anchorDate, daysInView]);
    const dayColumnWidth = useMemo(() => dayColumnWidthForView(daysInView), [daysInView]);
    const topLevelActivities = useMemo(() => activities.filter((entry) => !entry.parentActivityId).sort((left, right) => left.description.localeCompare(right.description)), [activities]);
    const todoLookup = useMemo(() => Object.fromEntries((Array.isArray(todos) ? todos : []).map((todo) => [todo.id, todo])), [todos]);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
    const timeLogsByTarget = useMemo(() => {
        const grouped = new Map();
        timeLogs.forEach((entry) => {
            const key = `${entry.targetType}:${entry.targetId}`;
            grouped.set(key, [...(grouped.get(key) || []), entry]);
        });
        return grouped;
    }, [timeLogs]);
    const quickStartTodoIds = useMemo(() => Array.isArray(settings.calendarQuickStartTodoIds)
        ? Array.from(new Set(settings.calendarQuickStartTodoIds.filter((value) => typeof value === "string" && value.trim().length > 0)))
        : [], [settings.calendarQuickStartTodoIds]);
    const items = useMemo(() => {
        const activityMap = new Map((Array.isArray(activities) ? activities : []).map((activity) => [activity.id, activity]));
        return (Array.isArray(calendarItems) ? calendarItems : [])
            .map((item) => {
            if (item.targetType === "todo") {
                const todo = todoLookup[item.targetId];
                if (!todo)
                    return null;
                return {
                    id: item.id,
                    date: todo.doOn || item.date,
                    startSlot: item.startSlot,
                    durationSlots: item.durationSlots,
                    targetType: "todo",
                    targetId: item.targetId,
                    title: todo.description,
                    label: "Task",
                    isMeeting: false,
                    isPrivate: todo.isPrivate,
                    isDone: todo.isDone,
                    isPriority: Boolean(todo.isPriority),
                    lane: 0,
                    laneCount: 1,
                };
            }
            const activity = activityMap.get(item.targetId);
            if (!activity)
                return null;
            return {
                id: item.id,
                date: activity.doOn || item.date,
                startSlot: item.startSlot,
                durationSlots: item.durationSlots,
                targetType: "activity",
                targetId: item.targetId,
                title: activity.description,
                label: activity.type === "meeting" ? "Meeting" : "Task",
                isMeeting: activity.type === "meeting",
                isPrivate: activity.isPrivate,
                isDone: activity.isDone,
                isPriority: false,
                lane: 0,
                laneCount: 1,
            };
        })
            .filter((item) => item !== null)
            .sort((left, right) => left.date.localeCompare(right.date) || left.startSlot - right.startSlot || left.title.localeCompare(right.title));
    }, [activities, calendarItems, todoLookup]);
    const runningItemCount = useMemo(() => items.filter((item) => getRunningTimeLog(timeLogsByTarget.get(`${item.targetType}:${item.targetId}`) || [])).length, [items, timeLogsByTarget]);
    useEffect(() => {
        if (!runningItemCount)
            return;
        const intervalId = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(intervalId);
    }, [runningItemCount]);
    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const visibleItems = items.filter((item) => {
            if (typeFilter === "task" && item.isMeeting)
                return false;
            if (typeFilter === "meeting" && !item.isMeeting)
                return false;
            if (!showPrivateItems && item.isPrivate)
                return false;
            if (!showBusinessItems && !item.isPrivate)
                return false;
            if (showPriorityOnly && item.targetType === "todo" && !item.isPriority)
                return false;
            if (showPriorityOnly && item.targetType === "activity")
                return false;
            if (hideCompletedTodos && item.targetType === "todo" && item.isDone)
                return false;
            if (!query)
                return true;
            return `${item.title} ${item.label}`.toLowerCase().includes(query);
        });
        return layoutCalendarItems(repositionTodaySingleRowTodos(visibleItems, today, now));
    }, [hideCompletedTodos, items, now, searchQuery, showBusinessItems, showPriorityOnly, showPrivateItems, today, typeFilter]);
    const itemsByDate = useMemo(() => {
        const grouped = new Map();
        filteredItems.forEach((item) => {
            const existing = grouped.get(item.date) ?? [];
            existing.push(item);
            grouped.set(item.date, existing);
        });
        return grouped;
    }, [filteredItems]);
    const selectedItem = useMemo(() => (selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null), [items, selectedItemId]);
    const selectedCalendarRecord = useMemo(() => (selectedItemId ? calendarItems.find((item) => item.id === selectedItemId) ?? null : null), [calendarItems, selectedItemId]);
    const selectedRunningLog = useMemo(() => editorDraft ? getRunningTimeLog(timeLogsByTarget.get(`${editorDraft.targetType}:${editorDraft.targetId}`) || []) : null, [editorDraft, timeLogsByTarget]);
    const quickStartStatsByTodoId = useMemo(() => {
        const grouped = new Map();
        timeLogs.forEach((entry) => {
            if (entry.targetType !== "todo")
                return;
            const current = grouped.get(entry.targetId) ?? {
                totalMinutes: 0,
                todayMinutes: 0,
                latestTimestamp: 0,
                isRunning: false,
            };
            const latestCandidate = Date.parse(entry.updatedAt || entry.endTime || entry.startTime || entry.date || "") || 0;
            const durationMinutes = isTimeLogRunning(entry) ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes;
            current.totalMinutes += durationMinutes;
            if (entry.date === today) {
                current.todayMinutes += durationMinutes;
            }
            current.latestTimestamp = Math.max(current.latestTimestamp, latestCandidate);
            current.isRunning = current.isRunning || isTimeLogRunning(entry);
            grouped.set(entry.targetId, current);
        });
        return grouped;
    }, [now, timeLogs, today]);
    const quickStartTodos = useMemo(() => quickStartTodoIds.map((todoId) => todoLookup[todoId]).filter((todo) => Boolean(todo)), [quickStartTodoIds, todoLookup]);
    const suggestedQuickStartTodos = useMemo(() => {
        const excluded = new Set(quickStartTodoIds);
        return (Array.isArray(todos) ? todos : [])
            .filter((todo) => !todo.isDone && !excluded.has(todo.id))
            .map((todo) => {
            const stats = quickStartStatsByTodoId.get(todo.id);
            const normalizedTitle = todo.description.toLowerCase();
            const recencyScore = stats?.latestTimestamp
                ? Math.max(0, 240 - Math.round((Date.now() - stats.latestTimestamp) / 3600000))
                : 0;
            const runningBonus = stats?.isRunning ? 2000 : 0;
            const todayBonus = stats?.todayMinutes ?? 0;
            const totalBonus = stats?.totalMinutes ?? 0;
            const utilityTitleBonus = normalizedTitle.includes("planning") ||
                normalizedTitle.includes("planering") ||
                normalizedTitle.includes("teams") ||
                normalizedTitle.includes("e-mail") ||
                normalizedTitle.includes("email")
                ? 120
                : 0;
            return {
                todo,
                score: runningBonus + todayBonus * 5 + totalBonus * 2 + recencyScore + utilityTitleBonus,
            };
        })
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score || left.todo.description.localeCompare(right.todo.description))
            .slice(0, 6)
            .map((entry) => entry.todo);
    }, [quickStartStatsByTodoId, quickStartTodoIds, todos]);
    const currentTaskChecklists = useMemo(() => editorDraft?.targetType === "todo"
        ? checklists
            .filter((checklist) => checklist.ownerType === "todo" && checklist.ownerId === editorDraft.targetId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        : [], [checklists, editorDraft]);
    const editorProjectOptions = editorDraft ? getProjectsForDomain(structureOptions, editorDraft.domain) : [];
    const editorActivityOptions = editorDraft ? getActivitiesForSelection(structureOptions, editorDraft.domain, editorDraft.project) : [];
    const linkedActivityOptions = topLevelActivities.filter((activity) => {
        if (!editorDraft)
            return true;
        if (activity.id === editorDraft.targetId)
            return false;
        if (editorDraft.targetType === "activity" &&
            editorDraft.parentActivityId &&
            activity.id === editorDraft.parentActivityId) {
            return true;
        }
        if (editorDraft.targetType === "todo" &&
            editorDraft.activityId &&
            activity.id === editorDraft.activityId) {
            return true;
        }
        if (editorDraft.domain && activity.domain && activity.domain !== editorDraft.domain)
            return false;
        if (editorDraft.project && activity.project && activity.project !== editorDraft.project)
            return false;
        return true;
    });
    useEffect(() => {
        setTimeLogNotesDrafts((current) => {
            const activeLogIds = new Set(timeLogs.map((log) => log.id));
            let changed = false;
            const next = Object.fromEntries(Object.entries(current).filter(([logId]) => {
                const keep = activeLogIds.has(logId);
                if (!keep)
                    changed = true;
                return keep;
            }));
            return changed ? next : current;
        });
    }, [timeLogs]);
    const getTimeLogNotesDraft = (log) => timeLogNotesDrafts[log.id] ?? log.notes;
    const updateTimeLogNotesDraft = (logId, value) => {
        setTimeLogNotesDrafts((current) => ({
            ...current,
            [logId]: value,
        }));
    };
    const getPinnedCalendarWidth = () => {
        const layout = layoutRef.current;
        if (!layout)
            return 84;
        const timeColumn = layout.querySelector(".calendar-time-column");
        if (timeColumn) {
            return Math.round(timeColumn.getBoundingClientRect().width);
        }
        const corner = layout.querySelector(".calendar-corner");
        return Math.round(corner?.getBoundingClientRect().width || 84);
    };
    const scrollDateColumnIntoView = (date) => {
        const scroller = scrollRef.current;
        if (!scroller)
            return false;
        const column = scroller.querySelector(`.calendar-day-column[data-date="${date}"]`);
        if (!column)
            return false;
        const nextScrollLeft = Math.max(0, Math.round(column.offsetLeft - getPinnedCalendarWidth()));
        scroller.scrollLeft = nextScrollLeft;
        if (scrollLeft !== nextScrollLeft) {
            setScrollLeft(nextScrollLeft);
        }
        return true;
    };
    const clearTimeLogNotesDraft = (logId) => {
        setTimeLogNotesDrafts((current) => {
            if (!(logId in current))
                return current;
            const next = { ...current };
            delete next[logId];
            return next;
        });
    };
    const commitTimeLogNotesDraft = (log) => {
        const nextNotes = getTimeLogNotesDraft(log);
        clearTimeLogNotesDraft(log.id);
        if (nextNotes === log.notes)
            return;
        onSaveTimeLog({
            ...log,
            notes: nextNotes,
            updatedAt: new Date().toISOString(),
        });
    };
    const scrollToCurrentTime = (date = new Date()) => {
        const scroller = scrollRef.current;
        if (!scroller)
            return;
        const currentDay = getLocalDateString(date);
        if (anchorDate !== currentDay) {
            pendingScrollDateRef.current = currentDay;
            setAnchorDate(currentDay);
            setJumpDate(currentDay);
        }
        else {
            scrollDateColumnIntoView(currentDay);
        }
        const nextScrollTop = initialCalendarScrollTop(date, slotHeight);
        scroller.scrollTop = nextScrollTop;
        if (scrollTop !== nextScrollTop) {
            setScrollTop(nextScrollTop);
        }
    };
    const jumpToCalendarDate = (date) => {
        const nextDate = date || today;
        pendingScrollDateRef.current = nextDate;
        setAnchorDate(nextDate);
        setJumpDate(nextDate);
    };
    useLayoutEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller)
            return;
        const pendingDate = pendingScrollDateRef.current;
        if (pendingDate) {
            if (visibleDates.includes(pendingDate) && scrollDateColumnIntoView(pendingDate)) {
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
    }, [dayColumnWidth, scrollLeft, visibleDates]);
    useLayoutEffect(() => {
        if (didApplyInitialViewportRef.current)
            return;
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
        if (!openRevision)
            return;
        const currentDate = new Date();
        const frameId = window.requestAnimationFrame(() => {
            scrollToCurrentTime(currentDate);
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [openRevision, slotHeight]);
    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller)
            return;
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
        const handleKeyDown = (event) => {
            if (event.key !== "Delete" || event.repeat) {
                return;
            }
            const activeElement = document.activeElement;
            const tagName = activeElement?.tagName?.toLowerCase();
            const isTextInput = tagName === "input" ||
                tagName === "textarea" ||
                tagName === "select" ||
                Boolean(activeElement?.isContentEditable);
            if (isTextInput) {
                return;
            }
            const idsToDelete = selectedItemIds.length ? selectedItemIds : selectedItem ? [selectedItem.id] : [];
            if (!idsToDelete.length) {
                return;
            }
            const targets = new Map();
            idsToDelete.forEach((itemId) => {
                const item = items.find((entry) => entry.id === itemId);
                if (item)
                    targets.set(`${item.targetType}:${item.targetId}`, item);
            });
            if (!targets.size) {
                return;
            }
            event.preventDefault();
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
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [items, onDeleteActivity, onDeleteTodo, selectedItem, selectedItemIds]);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat) {
                return;
            }
            if (event.key.toLowerCase() !== "z") {
                return;
            }
            const activeElement = document.activeElement;
            const tagName = activeElement?.tagName?.toLowerCase();
            const isTextInput = tagName === "input" ||
                tagName === "textarea" ||
                tagName === "select" ||
                Boolean(activeElement?.isContentEditable);
            if (isTextInput) {
                return;
            }
            const [latestUndo, ...remaining] = undoStackRef.current;
            if (!latestUndo) {
                return;
            }
            event.preventDefault();
            undoStackRef.current = remaining;
            applyUndoEntry(latestUndo);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onUpdateCalendarItem]);
    useEffect(() => {
        if (!selectedItemId) {
            setEditorDraft(null);
            return;
        }
        const calendarItem = calendarItems.find((item) => item.id === selectedItemId);
        if (!calendarItem) {
            setEditorDraft(null);
            return;
        }
        if (calendarItem.targetType === "todo") {
            const todo = todos.find((entry) => entry.id === calendarItem.targetId);
            if (!todo)
                return;
            const nextDraft = { itemId: calendarItem.id, targetType: "todo", targetId: todo.id, title: todo.description, participantText: todo.participantText ?? "", activityId: todo.activityId, parentActivityId: "", doOn: todo.doOn || calendarItem.date, dueDate: todo.dueDate, startTime: slotToTime(calendarItem.startSlot), endTime: slotToTime(calendarItem.startSlot + DEFAULT_MEETING_DURATION_SLOTS), domain: todo.domain, project: todo.project, activity: todo.activity, isPrivate: todo.isPrivate, isDone: todo.isDone, isPriority: Boolean(todo.isPriority), isMeeting: false };
            if (editorDraft &&
                editorDraft.itemId === nextDraft.itemId &&
                editorDraft.targetType === nextDraft.targetType &&
                editorDraft.targetId === nextDraft.targetId &&
                editorDraft.title === nextDraft.title &&
                editorDraft.participantText === nextDraft.participantText &&
                editorDraft.activityId === nextDraft.activityId &&
                editorDraft.parentActivityId === nextDraft.parentActivityId &&
                editorDraft.doOn === nextDraft.doOn &&
                editorDraft.dueDate === nextDraft.dueDate &&
                editorDraft.startTime === nextDraft.startTime &&
                editorDraft.endTime === nextDraft.endTime &&
                editorDraft.domain === nextDraft.domain &&
                editorDraft.project === nextDraft.project &&
                editorDraft.activity === nextDraft.activity &&
                editorDraft.isPrivate === nextDraft.isPrivate &&
                editorDraft.isDone === nextDraft.isDone &&
                editorDraft.isPriority === nextDraft.isPriority &&
                editorDraft.isMeeting === nextDraft.isMeeting) {
                return;
            }
            setEditorDraft(nextDraft);
            return;
        }
        const activity = activities.find((entry) => entry.id === calendarItem.targetId);
        if (!activity)
            return;
        const nextDraft = { itemId: calendarItem.id, targetType: "activity", targetId: activity.id, title: activity.description, participantText: activity.participantText ?? "", activityId: "", parentActivityId: activity.parentActivityId, doOn: activity.doOn || calendarItem.date, dueDate: activity.dueDate, startTime: activity.startTime || slotToTime(calendarItem.startSlot), endTime: activity.endTime || slotToTime(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots)), domain: activity.domain, project: activity.project, activity: activity.activity, isPrivate: activity.isPrivate, isDone: activity.isDone, isPriority: false, isMeeting: activity.type === "meeting" };
        if (editorDraft &&
            editorDraft.itemId === nextDraft.itemId &&
            editorDraft.targetType === nextDraft.targetType &&
            editorDraft.targetId === nextDraft.targetId &&
            editorDraft.title === nextDraft.title &&
            editorDraft.participantText === nextDraft.participantText &&
            editorDraft.activityId === nextDraft.activityId &&
            editorDraft.parentActivityId === nextDraft.parentActivityId &&
            editorDraft.doOn === nextDraft.doOn &&
            editorDraft.dueDate === nextDraft.dueDate &&
            editorDraft.startTime === nextDraft.startTime &&
            editorDraft.endTime === nextDraft.endTime &&
            editorDraft.domain === nextDraft.domain &&
            editorDraft.project === nextDraft.project &&
            editorDraft.activity === nextDraft.activity &&
            editorDraft.isPrivate === nextDraft.isPrivate &&
            editorDraft.isDone === nextDraft.isDone &&
            editorDraft.isPriority === nextDraft.isPriority &&
            editorDraft.isMeeting === nextDraft.isMeeting) {
            return;
        }
        setEditorDraft(nextDraft);
    }, [activities, calendarItems, editorDraft?.itemId, selectedItemId, todos]);
    useEffect(() => {
        if (!inlineTodoEdit || selectedItemId === inlineTodoEdit.itemId)
            return;
        setInlineTodoEdit(null);
    }, [inlineTodoEdit, selectedItemId]);
    useEffect(() => {
        const handleKeyDown = (event) => {
            const activeElement = document.activeElement;
            const tagName = activeElement?.tagName?.toLowerCase();
            const isTextInput = tagName === "input" ||
                tagName === "textarea" ||
                tagName === "select" ||
                Boolean(activeElement?.isContentEditable);
            if (isTextInput) {
                return;
            }
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
                return;
            const candidateIds = selectedItemIds.length ? selectedItemIds : selectedItem ? [selectedItem.id] : [];
            const selectedTodoItems = candidateIds
                .map((itemId) => items.find((entry) => entry.id === itemId))
                .filter((item) => item !== undefined && item.targetType === "todo");
            if (!selectedTodoItems.length) {
                return;
            }
            if (!event.repeat && event.key.toLowerCase() === "x") {
                event.preventDefault();
                const updatedTodoStates = new Map();
                selectedTodoItems.forEach((item) => {
                    const todo = todos.find((entry) => entry.id === item.targetId);
                    if (!todo)
                        return;
                    const nextTodo = { ...todo, isDone: !todo.isDone };
                    updatedTodoStates.set(item.id, nextTodo.isDone);
                    onSaveTodo(nextTodo);
                });
                if (updatedTodoStates.size) {
                    setEditorDraft((current) => current && updatedTodoStates.has(current.itemId)
                        ? { ...current, isDone: updatedTodoStates.get(current.itemId) ?? current.isDone }
                        : current);
                }
                return;
            }
            if (inlineTodoEdit || selectedTodoItems.length !== 1 || !selectedItem || selectedItem.targetType !== "todo") {
                return;
            }
            const todo = todos.find((entry) => entry.id === selectedItem.targetId);
            if (!todo)
                return;
            if (event.key.length === 1) {
                event.preventDefault();
                setInlineTodoEdit({ itemId: selectedItem.id, todoId: todo.id, value: event.key });
            }
            else if (event.key === "Backspace") {
                event.preventDefault();
                setInlineTodoEdit({ itemId: selectedItem.id, todoId: todo.id, value: "" });
            }
            else if (event.key === "Enter") {
                event.preventDefault();
                setInlineTodoEdit({ itemId: selectedItem.id, todoId: todo.id, value: todo.description });
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [inlineTodoEdit, items, onSaveTodo, selectedItem, selectedItemIds, todos]);
    useEffect(() => {
        setSelectedItemIds((current) => current.filter((id) => items.some((item) => item.id === id)));
    }, [items]);
    useEffect(() => {
        selectedItemIdsRef.current = selectedItemIds;
    }, [selectedItemIds]);
    const getSelectedItemIntersection = (itemIds) => {
        const nextSet = new Set(itemIds);
        const existingSet = new Set(selectedItemIdsRef.current);
        const unchanged = nextSet.size === existingSet.size &&
            [...nextSet].every((itemId) => existingSet.has(itemId));
        if (unchanged) {
            return selectedItemIdsRef.current;
        }
        return itemIds;
    };
    const applySelectedItemIds = (itemIds) => {
        const nextSelected = getSelectedItemIntersection(itemIds);
        setSelectedItemIds(nextSelected);
        const nextPrimary = nextSelected[0] ?? null;
        setSelectedItemId(nextPrimary);
        if (!nextPrimary) {
            setEditorDraft(null);
        }
    };
    const captureCalendarPositions = (itemIds) => itemIds
        .map((itemId) => items.find((entry) => entry.id === itemId))
        .filter((item) => item !== undefined)
        .map((item) => ({
        id: item.id,
        date: item.date,
        startSlot: item.startSlot,
        durationSlots: Math.max(1, item.durationSlots),
    }));
    const pushUndoEntry = (entry) => {
        if (!entry.items.length)
            return;
        undoStackRef.current = [entry, ...undoStackRef.current].slice(0, 50);
    };
    const applyUndoEntry = (entry) => {
        entry.items.forEach((item) => {
            onUpdateCalendarItem(item.id, {
                date: item.date,
                startSlot: item.startSlot,
                durationSlots: item.durationSlots,
            });
        });
        applySelectedItemIds(entry.items.map((item) => item.id));
    };
    const getMarqueeRect = (selection) => ({
        left: Math.min(selection.startX, selection.currentX),
        right: Math.max(selection.startX, selection.currentX),
        top: Math.min(selection.startY, selection.currentY),
        bottom: Math.max(selection.startY, selection.currentY),
    });
    const applyMarqueeSelection = (selection) => {
        const rect = getMarqueeRect(selection);
        const selectedByRect = Array.from(scrollRef.current?.querySelectorAll(".calendar-item-block[data-item-id]") ?? [])
            .filter((element) => {
            const itemRect = element.getBoundingClientRect();
            return !(itemRect.right < rect.left ||
                itemRect.left > rect.right ||
                itemRect.bottom < rect.top ||
                itemRect.top > rect.bottom);
        })
            .map((element) => element.dataset.itemId)
            .filter((itemId) => Boolean(itemId));
        if (selection.additive) {
            const combined = Array.from(new Set([...selectedItemIdsRef.current, ...selectedByRect]));
            applySelectedItemIds(combined);
            return;
        }
        applySelectedItemIds(selectedByRect);
    };
    const stopAutoScrollLoop = () => {
        if (autoScrollFrameRef.current !== null) {
            window.cancelAnimationFrame(autoScrollFrameRef.current);
            autoScrollFrameRef.current = null;
        }
    };
    const tickAutoScroll = () => {
        const pointer = dragPointerClientRef.current;
        const scroller = scrollRef.current;
        const isDraggingItems = Boolean(pointerDraggingItemRef.current);
        const isMarqueeSelecting = Boolean(marqueeStateRef.current);
        if (!pointer || !scroller || (!isDraggingItems && !isMarqueeSelecting)) {
            stopAutoScrollLoop();
            return;
        }
        const rect = scroller.getBoundingClientRect();
        let deltaX = 0;
        let deltaY = 0;
        if (pointer.x < rect.left + DRAG_SCROLL_EDGE_PX) {
            deltaX = -DRAG_SCROLL_STEP_PX;
        }
        else if (pointer.x > rect.right - DRAG_SCROLL_EDGE_PX) {
            deltaX = DRAG_SCROLL_STEP_PX;
        }
        if (pointer.y < rect.top + DRAG_SCROLL_EDGE_PX) {
            deltaY = -DRAG_SCROLL_STEP_PX;
        }
        else if (pointer.y > rect.bottom - DRAG_SCROLL_EDGE_PX) {
            deltaY = DRAG_SCROLL_STEP_PX;
        }
        if (deltaX || deltaY) {
            scroller.scrollBy({ left: deltaX, top: deltaY });
            if (marqueeStateRef.current) {
                applyMarqueeSelection(marqueeStateRef.current);
            }
        }
        autoScrollFrameRef.current = window.requestAnimationFrame(tickAutoScroll);
    };
    const ensureAutoScrollLoop = () => {
        if (autoScrollFrameRef.current !== null)
            return;
        autoScrollFrameRef.current = window.requestAnimationFrame(tickAutoScroll);
    };
    useEffect(() => {
        if (!highlightedItemId) {
            appliedHighlightedItemIdRef.current = null;
            return;
        }
        if (appliedHighlightedItemIdRef.current === highlightedItemId)
            return;
        const highlightedItem = items.find((item) => item.id === highlightedItemId);
        if (!highlightedItem)
            return;
        appliedHighlightedItemIdRef.current = highlightedItemId;
        pendingScrollDateRef.current = highlightedItem.date;
        setAnchorDate(highlightedItem.date);
        setJumpDate(highlightedItem.date);
        setSelectedItemId(highlightedItemId);
        window.requestAnimationFrame(() => {
            const scroller = scrollRef.current;
            if (!scroller)
                return;
            scroller.scrollTop = Math.max(0, (highlightedItem.startSlot - 12) * slotHeight);
        });
    }, [highlightedItemId, items, slotHeight]);
    const selectCalendarItem = (itemId, additive) => {
        setDraftCell(null);
        if (!additive) {
            applySelectedItemIds([itemId]);
            return;
        }
        const current = selectedItemIdsRef.current;
        if (current.includes(itemId)) {
            const next = current.filter((id) => id !== itemId);
            applySelectedItemIds(next.length ? next : [itemId]);
            return;
        }
        applySelectedItemIds([...current, itemId]);
    };
    const itemIdsForDrag = (itemId) => (selectedItemIds.includes(itemId) ? selectedItemIds : [itemId]);
    const moveCalendarItemGroup = (anchorId, itemIds, targetDate, targetSlot) => {
        const anchorItem = items.find((item) => item.id === anchorId);
        if (!anchorItem)
            return;
        const dateDelta = daysBetween(anchorItem.date, targetDate);
        const slotDelta = targetSlot - anchorItem.startSlot;
        const previousPositions = captureCalendarPositions(itemIds);
        const nextPositions = previousPositions.map((item) => ({
            ...item,
            date: addDays(item.date, dateDelta),
            startSlot: clampSlot(item.startSlot + slotDelta),
        }));
        const hasChanged = nextPositions.some((item, index) => item.date !== previousPositions[index]?.date ||
            item.startSlot !== previousPositions[index]?.startSlot);
        if (!hasChanged) {
            return;
        }
        pushUndoEntry({ items: previousPositions });
        itemIds.forEach((itemId) => {
            const item = items.find((entry) => entry.id === itemId);
            if (!item)
                return;
            onMoveItem(item.id, addDays(item.date, dateDelta), clampSlot(item.startSlot + slotDelta));
        });
        applySelectedItemIds(itemIds);
    };
    const getCalendarDropTarget = (clientX, clientY) => {
        const columns = Array.from(scrollRef.current?.querySelectorAll(".calendar-day-column") ?? []);
        for (const column of columns) {
            const rect = column.getBoundingClientRect();
            if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
                continue;
            }
            const date = column.dataset.date;
            if (!date)
                return null;
            return { date, slot: clampSlot(Math.floor((clientY - rect.top) / slotHeight)) };
        }
        return null;
    };
    useEffect(() => {
        if (!resizeState)
            return;
        const previousPosition = captureCalendarPositions([resizeState.itemId])[0] ?? null;
        const handleMouseMove = (event) => {
            dragPointerClientRef.current = { x: event.clientX, y: event.clientY };
            ensureAutoScrollLoop();
            const deltaSlots = Math.round(event.movementY / slotHeight);
            if (deltaSlots === 0)
                return;
            setResizeState((current) => {
                if (!current)
                    return current;
                if (current.edge === "end")
                    return { ...current, durationSlots: Math.max(1, current.durationSlots + deltaSlots) };
                const endSlot = current.startSlot + current.durationSlots;
                const nextStart = clampSlot(Math.min(endSlot - 1, current.startSlot + deltaSlots));
                return { ...current, startSlot: nextStart, durationSlots: Math.max(1, endSlot - nextStart) };
            });
        };
        const handleMouseUp = () => {
            dragPointerClientRef.current = null;
            stopAutoScrollLoop();
            setResizeState((current) => {
                if (current) {
                    if (previousPosition &&
                        (previousPosition.date !== current.date ||
                            previousPosition.startSlot !== current.startSlot ||
                            previousPosition.durationSlots !== current.durationSlots)) {
                        pushUndoEntry({ items: [previousPosition] });
                    }
                    onUpdateCalendarItem(current.itemId, { date: current.date, startSlot: current.startSlot, durationSlots: current.durationSlots });
                }
                return null;
            });
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            dragPointerClientRef.current = null;
            stopAutoScrollLoop();
        };
    }, [onUpdateCalendarItem, resizeState, slotHeight]);
    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!splitterDraggingRef.current || !layoutRef.current)
                return;
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
        const handleMouseMove = (event) => {
            const candidate = marqueeCandidateRef.current;
            if (!candidate)
                return;
            const deltaX = Math.abs(event.clientX - candidate.startX);
            const deltaY = Math.abs(event.clientY - candidate.startY);
            if (!marqueeStateRef.current && deltaX < 5 && deltaY < 5) {
                return;
            }
            const nextSelection = {
                startX: candidate.startX,
                startY: candidate.startY,
                currentX: event.clientX,
                currentY: event.clientY,
                additive: candidate.additive,
            };
            dragPointerClientRef.current = { x: event.clientX, y: event.clientY };
            marqueeStateRef.current = nextSelection;
            suppressColumnClickRef.current = true;
            document.body.classList.add("calendar-selection-dragging");
            setMarqueeSelection(nextSelection);
            applyMarqueeSelection(nextSelection);
            ensureAutoScrollLoop();
        };
        const handleMouseUp = () => {
            marqueeCandidateRef.current = null;
            marqueeStateRef.current = null;
            dragPointerClientRef.current = null;
            stopAutoScrollLoop();
            setMarqueeSelection(null);
            window.setTimeout(() => {
                document.body.classList.remove("calendar-selection-dragging");
            }, 0);
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.classList.remove("calendar-selection-dragging");
        };
    }, [items]);
    useEffect(() => {
        const handleMouseMove = (event) => {
            const candidate = pointerDragCandidateRef.current;
            if (!candidate)
                return;
            const deltaX = Math.abs(event.clientX - candidate.startX);
            const deltaY = Math.abs(event.clientY - candidate.startY);
            if (deltaX < 5 && deltaY < 5)
                return;
            pointerDraggingItemRef.current = candidate.itemId;
            dragPointerClientRef.current = { x: event.clientX, y: event.clientY };
            document.body.classList.add("calendar-pointer-dragging");
            ensureAutoScrollLoop();
        };
        const handleMouseUp = (event) => {
            const draggingItemId = pointerDraggingItemRef.current;
            const candidate = pointerDragCandidateRef.current;
            const draggingGroup = draggedGroupRef.current;
            pointerDragCandidateRef.current = null;
            pointerDraggingItemRef.current = null;
            draggedGroupRef.current = null;
            dragPointerClientRef.current = null;
            stopAutoScrollLoop();
            document.body.classList.remove("calendar-pointer-dragging");
            if (!candidate || !draggingItemId)
                return;
            const dropTarget = getCalendarDropTarget(event.clientX, event.clientY);
            if (!dropTarget)
                return;
            moveCalendarItemGroup(draggingItemId, draggingGroup?.itemIds ?? [draggingItemId], dropTarget.date, dropTarget.slot);
            suppressClickItemIdRef.current = draggingItemId;
            window.setTimeout(() => {
                if (suppressClickItemIdRef.current === draggingItemId)
                    suppressClickItemIdRef.current = null;
            }, 0);
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            dragPointerClientRef.current = null;
            stopAutoScrollLoop();
            document.body.classList.remove("calendar-pointer-dragging");
        };
    }, [items, slotHeight]);
    const moveDraftCell = (deltaDays, deltaSlots) => {
        if (!draftCell)
            return;
        setDraftCell({ date: addDays(draftCell.date, deltaDays), slot: clampSlot(draftCell.slot + deltaSlots) });
    };
    const commitDraftCell = () => {
        if (!draftCell)
            return;
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
    const createMeetingFromGrid = async (date, slot) => {
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
    const openTodoDraftFromGrid = (date, slot) => {
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
        if (!cellClickTimerRef.current)
            return;
        clearTimeout(cellClickTimerRef.current);
        cellClickTimerRef.current = null;
    };
    const persistEditorDraft = (draft) => {
        const startSlot = clampSlot(timeToSlot(draft.startTime || "00:00"));
        const durationSlots = draft.targetType === "activity" ? Math.max(1, durationFromTimes(draft.startTime || "00:00", draft.endTime || draft.startTime || "00:05")) : 1;
        if (draft.targetType === "todo") {
            const todo = todos.find((entry) => entry.id === draft.targetId);
            if (!todo)
                return;
            const nextDescription = draft.title.trim().length ? draft.title : todo.description;
            onSaveTodo({ ...todo, description: nextDescription, participantText: draft.participantText, activityId: draft.activityId, doOn: draft.doOn, dueDate: draft.dueDate, domain: draft.domain, project: draft.project, activity: draft.activity, isPrivate: draft.isPrivate, isDone: draft.isDone, isPriority: draft.isPriority });
        }
        else {
            const activity = activities.find((entry) => entry.id === draft.targetId);
            if (!activity)
                return;
            const nextDescription = draft.title.trim().length ? draft.title : activity.description;
            onSaveActivity({ ...activity, description: nextDescription, participantText: draft.participantText, parentActivityId: draft.parentActivityId, doOn: draft.doOn, dueDate: draft.dueDate, domain: draft.domain, project: draft.project, activity: draft.activity, isPrivate: draft.isPrivate, isDone: draft.isDone, startTime: draft.startTime, endTime: draft.endTime });
        }
        onUpdateCalendarItem(draft.itemId, { date: draft.doOn, startSlot, durationSlots });
    };
    const updateEditorDraft = (draft) => {
        setEditorDraft(draft);
        persistEditorDraft(draft);
    };
    const saveMeetingStructure = (activityId, updates) => {
        const meeting = activityLookup[activityId];
        if (!meeting)
            return;
        onSaveActivity({ ...meeting, ...updates });
        setEditorDraft((current) => current?.targetType === "activity" && current.targetId === activityId
            ? { ...current, ...updates }
            : current);
    };
    const handleMeetingCardDomainChange = (activityId, domain) => {
        const meeting = activityLookup[activityId];
        if (!meeting)
            return;
        const nextProjects = getProjectsForDomain(structureOptions, domain);
        const nextProject = nextProjects.includes(meeting.project) ? meeting.project : "";
        const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
        const nextActivity = nextActivities.includes(meeting.activity) ? meeting.activity : "";
        saveMeetingStructure(activityId, { domain, project: nextProject, activity: nextActivity });
    };
    const handleMeetingCardProjectChange = (activityId, project) => {
        const meeting = activityLookup[activityId];
        if (!meeting)
            return;
        const nextActivities = getActivitiesForSelection(structureOptions, meeting.domain, project);
        const nextActivity = nextActivities.includes(meeting.activity) ? meeting.activity : "";
        saveMeetingStructure(activityId, { domain: meeting.domain, project, activity: nextActivity });
    };
    const handleMeetingCardActivityChange = (activityId, activity) => {
        const meeting = activityLookup[activityId];
        if (!meeting)
            return;
        saveMeetingStructure(activityId, { domain: meeting.domain, project: meeting.project, activity });
    };
    const handleMeetingCardTitleChange = (activityId, description) => {
        const meeting = activityLookup[activityId];
        if (!meeting)
            return;
        onSaveActivity({ ...meeting, description });
        setEditorDraft((current) => current?.targetType === "activity" && current.targetId === activityId
            ? { ...current, title: description }
            : current);
    };
    const saveChecklistItems = (checklist, items) => {
        onSaveChecklist({
            ...checklist,
            items,
            updatedAt: new Date().toISOString(),
        });
    };
    const setChecklistItemDraft = (checklistId, value) => {
        setChecklistItemDrafts((current) => ({ ...current, [checklistId]: value }));
    };
    const addChecklistItem = (checklist) => {
        const nextLabel = (checklistItemDrafts[checklist.id] || "").trim();
        if (!nextLabel)
            return;
        saveChecklistItems(checklist, [
            ...checklist.items,
            {
                id: crypto.randomUUID(),
                label: nextLabel,
                isChecked: false,
                notes: "",
                position: checklist.items.length + 1,
                checkedAt: null,
            },
        ]);
        setChecklistItemDraft(checklist.id, "");
    };
    const toggleChecklistItem = (checklist, itemId) => {
        const timestamp = new Date().toISOString();
        saveChecklistItems(checklist, checklist.items.map((item) => item.id === itemId
            ? {
                ...item,
                isChecked: !item.isChecked,
                checkedAt: item.isChecked ? null : timestamp,
            }
            : item));
    };
    const deleteChecklistItem = (checklist, itemId) => {
        saveChecklistItems(checklist, checklist.items
            .filter((item) => item.id !== itemId)
            .map((item, index) => ({ ...item, position: index + 1 })));
    };
    const moveChecklistItem = (checklist, itemId, direction) => {
        const currentIndex = checklist.items.findIndex((item) => item.id === itemId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= checklist.items.length)
            return;
        const nextItems = [...checklist.items];
        const [moved] = nextItems.splice(currentIndex, 1);
        nextItems.splice(nextIndex, 0, moved);
        saveChecklistItems(checklist, nextItems.map((item, index) => ({ ...item, position: index + 1 })));
    };
    const saveInlineTodoEdit = () => {
        if (!inlineTodoEdit)
            return;
        const todo = todos.find((entry) => entry.id === inlineTodoEdit.todoId);
        if (todo) {
            const nextTitle = inlineTodoEdit.value.trim();
            if (nextTitle && nextTitle !== todo.description) {
                onSaveTodo({ ...todo, description: nextTitle });
            }
        }
        setInlineTodoEdit(null);
    };
    const handleEditorDomainChange = (domain) => {
        if (!editorDraft)
            return;
        const nextProjects = getProjectsForDomain(structureOptions, domain);
        const nextProject = nextProjects.includes(editorDraft.project) ? editorDraft.project : "";
        const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
        const nextActivity = nextActivities.includes(editorDraft.activity) ? editorDraft.activity : "";
        const linkedId = editorDraft.targetType === "todo" ? editorDraft.activityId : editorDraft.parentActivityId;
        const linkedActivity = linkedId ? activityLookup[linkedId] : null;
        const nextLinkedId = linkedActivity &&
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
    const handleEditorProjectChange = (project) => {
        if (!editorDraft)
            return;
        const nextActivities = getActivitiesForSelection(structureOptions, editorDraft.domain, project);
        const nextActivity = nextActivities.includes(editorDraft.activity) ? editorDraft.activity : "";
        const linkedId = editorDraft.targetType === "todo" ? editorDraft.activityId : editorDraft.parentActivityId;
        const linkedActivity = linkedId ? activityLookup[linkedId] : null;
        const nextLinkedId = linkedActivity &&
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
        if (!editorDraft || editorDraft.targetType !== "todo")
            return;
        const todo = todos.find((entry) => entry.id === editorDraft.targetId);
        if (!todo)
            return;
        onConvertTodoToMeeting(todo, {
            date: editorDraft.doOn,
            startTime: editorDraft.startTime || "09:00",
            endTime: editorDraft.endTime ||
                slotToTime(timeToSlot(editorDraft.startTime || "09:00") + DEFAULT_MEETING_DURATION_SLOTS),
        });
    };
    const completedTodoCalendarItemIds = useMemo(() => items.filter((item) => item.targetType === "todo" && item.isDone).map((item) => item.id), [items]);
    const toggleCompletedTodosVisibility = () => {
        const nextHidden = !hideCompletedTodos;
        setHideCompletedTodos(nextHidden);
        if (nextHidden && completedTodoCalendarItemIds.length) {
            const hiddenIds = new Set(completedTodoCalendarItemIds);
            setSelectedItemIds((current) => current.filter((id) => !hiddenIds.has(id)));
            if (selectedItemId && hiddenIds.has(selectedItemId)) {
                setSelectedItemId(null);
                setEditorDraft(null);
            }
        }
    };
    useEffect(() => {
        if (!hideCompletedTodos || !selectedItemId)
            return;
        const selected = items.find((item) => item.id === selectedItemId);
        if (selected?.targetType === "todo" && selected.isDone) {
            setSelectedItemId(null);
            setEditorDraft(null);
        }
    }, [hideCompletedTodos, items, selectedItemId]);
    const deleteSelectedCalendarItems = () => {
        const idsToDelete = selectedItemIds.length ? selectedItemIds : selectedItemId ? [selectedItemId] : [];
        const targets = new Map();
        idsToDelete.forEach((itemId) => {
            const item = items.find((entry) => entry.id === itemId);
            if (item)
                targets.set(`${item.targetType}:${item.targetId}`, item);
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
    const saveQuickStartTodoIds = (nextIds) => {
        onSaveSettings({
            ...settings,
            calendarQuickStartTodoIds: Array.from(new Set(nextIds.filter(Boolean))),
        });
    };
    const pinQuickStartTodo = (todoId) => {
        if (quickStartTodoIds.includes(todoId))
            return;
        saveQuickStartTodoIds([...quickStartTodoIds, todoId].slice(0, 8));
    };
    const unpinQuickStartTodo = (todoId) => {
        if (!quickStartTodoIds.includes(todoId))
            return;
        saveQuickStartTodoIds(quickStartTodoIds.filter((id) => id !== todoId));
    };
    const openQuickStartTodo = (todoId) => {
        const calendarItem = items.find((item) => item.targetType === "todo" && item.targetId === todoId);
        if (calendarItem) {
            selectCalendarItem(calendarItem.id, false);
            return;
        }
        onOpenTodoDetail(todoId);
    };
    const singleRowTodoFontSize = slotHeight === 12 ? "0.42rem" : slotHeight === 16 ? "0.54rem" : "0.72rem";
    return (_jsxs("div", { className: `card calendar-workspace${isFullScreen ? " calendar-workspace-fullscreen" : ""}`, children: [_jsxs("div", { className: "card-header session-editor-header-minimal calendar-workspace-header", children: [_jsx("div", { children: _jsx("h2", { children: "Calendar" }) }), _jsxs("div", { className: "page-actions wrap-row calendar-primary-actions", children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => jumpToCalendarDate(addDays(anchorDate, -daysInView)), children: "Previous" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => { const currentDate = new Date(); jumpToCalendarDate(getLocalDateString(currentDate)); window.requestAnimationFrame(() => scrollToCurrentTime(currentDate)); }, children: "Today" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => jumpToCalendarDate(addDays(anchorDate, daysInView)), children: "Next" }), _jsxs("label", { className: "compact-private-toggle calendar-top-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showPrivateItems, onChange: (event) => setShowPrivateItems(event.target.checked) }), _jsx("span", { children: "Show private" })] }), _jsxs("label", { className: "compact-private-toggle calendar-top-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showBusinessItems, onChange: (event) => setShowBusinessItems(event.target.checked) }), _jsx("span", { children: "Show business" })] }), _jsxs("label", { className: "compact-private-toggle calendar-top-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showPriorityOnly, onChange: (event) => setShowPriorityOnly(event.target.checked) }), _jsx("span", { children: "Prio" })] }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: deleteSelectedCalendarItems, disabled: !selectedItemId && !selectedItemIds.length, children: "Delete selected" }), _jsx("button", { className: "small-button", type: "button", onClick: toggleCompletedTodosVisibility, disabled: !completedTodoCalendarItemIds.length, children: hideCompletedTodos ? "Unhide completed" : "Hide completed" })] })] }), _jsxs("div", { className: "calendar-quick-start-panel", children: [_jsx("div", { className: "calendar-quick-start-heading", children: _jsxs("div", { children: [_jsx("strong", { children: "Quick start tasks" }), _jsx("span", { className: "muted", children: "Keep frequently used work like Planning or E-mail / Teams one click away without crowding the grid." })] }) }), quickStartTodos.length ? (_jsx("div", { className: "calendar-quick-start-list", children: quickStartTodos.map((todo) => {
                            const runningLog = getRunningTimeLog(timeLogsByTarget.get(`todo:${todo.id}`) || []);
                            const stats = quickStartStatsByTodoId.get(todo.id);
                            return (_jsxs("div", { className: `calendar-quick-start-card${runningLog ? " calendar-quick-start-card-running" : ""}`, children: [_jsxs("button", { className: "calendar-quick-start-open", type: "button", onClick: () => openQuickStartTodo(todo.id), children: [_jsx("strong", { children: todo.description }), _jsx("span", { className: "tiny-text", children: runningLog
                                                    ? `Running | ${formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))}`
                                                    : `Today ${formatTrackedMinutes(stats?.todayMinutes ?? 0)}` })] }), _jsxs("div", { className: "calendar-quick-start-actions", children: [_jsx("button", { className: runningLog ? "primary-button" : "shell-button", type: "button", onClick: () => {
                                                    if (runningLog) {
                                                        onStopTracking("todo", todo.id);
                                                        return;
                                                    }
                                                    onStartTracking("todo", todo.id);
                                                }, children: runningLog ? "Stop" : "Start" }), _jsx("button", { className: "small-button", type: "button", onClick: () => unpinQuickStartTodo(todo.id), children: "Unpin" })] })] }, todo.id));
                        }) })) : (_jsx("p", { className: "muted calendar-quick-start-empty", children: "No pinned quick-start tasks yet. Pin a recurring task below or from a selected task in the Calendar pane." })), suggestedQuickStartTodos.length ? (_jsxs("div", { className: "calendar-quick-start-suggestions", children: [_jsx("span", { className: "tiny-text", children: "Suggested from recent time logging" }), _jsx("div", { className: "calendar-quick-start-suggestion-list", children: suggestedQuickStartTodos.map((todo) => (_jsxs("button", { className: "calendar-quick-start-suggestion", type: "button", onClick: () => pinQuickStartTodo(todo.id), children: [_jsx("span", { children: todo.description }), _jsx("span", { className: "tiny-text", children: "Pin" })] }, todo.id))) })] })) : null] }), _jsxs("div", { className: "calendar-controls calendar-controls-compact calendar-controls-dense", children: [_jsxs("div", { className: "calendar-calendar-summary", children: [_jsxs("div", { className: "status-chip", children: [filteredItems.length, " scheduled items"] }), _jsxs("div", { className: "field calendar-inline-filter", children: [_jsx("label", { htmlFor: "calendar-search", children: "Filter" }), _jsx("input", { id: "calendar-search", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "Filter calendar items" })] }), _jsx("div", { className: "capture-density-toggle", children: DAYS.map((option) => _jsxs("button", { className: "segment-button", type: "button", "data-active": option === daysInView, onClick: () => setDaysInView(option), children: [option, " days"] }, `days-${option}`)) }), _jsx("div", { className: "capture-density-toggle", children: HEIGHTS.map((option) => _jsx("button", { className: "segment-button", type: "button", "data-active": option === slotHeight, onClick: () => setSlotHeight(option), children: option === 12 ? "Compact" : option === 16 ? "Default" : "Large" }, `height-${option}`)) })] }), _jsxs("details", { className: "workspace-disclosure calendar-secondary-controls", children: [_jsx("summary", { children: "More calendar controls" }), _jsx("div", { className: "workspace-disclosure-body", children: _jsxs("div", { className: "calendar-toolbar calendar-toolbar-dense", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-jump-date", children: "Jump" }), _jsx(DateInput, { id: "calendar-jump-date", value: jumpDate, onChange: (event) => setJumpDate(event.target.value) })] }), _jsx("button", { className: "shell-button", type: "button", onClick: () => jumpToCalendarDate(jumpDate || today), children: "Go" }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-type-filter", children: "Type" }), _jsxs("select", { id: "calendar-type-filter", value: typeFilter, onChange: (event) => setTypeFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "task", children: "Tasks" }), _jsx("option", { value: "meeting", children: "Meetings" })] })] }), _jsxs("label", { className: "compact-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showPrivateItems, onChange: (event) => setShowPrivateItems(event.target.checked) }), _jsx("span", { children: "Show private" })] }), _jsxs("label", { className: "compact-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showBusinessItems, onChange: (event) => setShowBusinessItems(event.target.checked) }), _jsx("span", { children: "Show business" })] }), _jsxs("label", { className: "compact-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showPriorityOnly, onChange: (event) => setShowPriorityOnly(event.target.checked) }), _jsx("span", { children: "Prio" })] }), _jsxs("div", { className: "field calendar-context-field", children: [_jsx("label", { htmlFor: "calendar-creation-context", children: "Attach new entries" }), _jsxs("select", { id: "calendar-creation-context", value: creationContextActivityId, onChange: (event) => setCreationContextActivityId(event.target.value), children: [_jsx("option", { value: "", children: "No activity context" }), topLevelActivities.map((activity) => (_jsx("option", { value: activity.id, children: activity.description }, activity.id)))] })] }), _jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Calendar diagnostics" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "ai-settings-summary-grid", children: [_jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Timezone" }), _jsx("strong", { children: runtimeTimeZone }), _jsx("span", { className: "tiny-text", children: "Browser runtime timezone" })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Calendar today" }), _jsx("strong", { children: today }), _jsx("span", { className: "tiny-text", children: "Day key used by the calendar" })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Anchor date" }), _jsx("strong", { children: anchorDate }), _jsx("span", { className: "tiny-text", children: "Day aligned after the pinned time column" })] })] }), selectedItem ? (_jsxs("div", { className: "ai-settings-summary-grid", children: [_jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Rendered date" }), _jsx("strong", { children: selectedItem.date }), _jsx("span", { className: "tiny-text", children: "Date used in the calendar layout" })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Inspector date" }), _jsx("strong", { children: editorDraft?.doOn || "-" }), _jsx("span", { className: "tiny-text", children: "Date shown in the selected item editor" })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Raw calendar row date" }), _jsx("strong", { children: selectedCalendarRecord?.date || "-" }), _jsx("span", { className: "tiny-text", children: "Stored date on the backing calendar row" })] })] })) : null] })] })] }) })] })] }), _jsxs("div", { ref: layoutRef, className: `calendar-layout${isFullScreen ? " calendar-layout-fullscreen" : ""}`, style: { gridTemplateColumns: `minmax(0, 1fr) 8px ${detailsPaneWidth}px` }, children: [_jsx("div", { className: "calendar-main stack", children: _jsxs("div", { ref: scrollRef, className: `calendar-scroll${isFullScreen ? " calendar-scroll-fullscreen" : ""}`, style: {
                                ["--calendar-slot-height"]: `${slotHeight}px`,
                                ["--calendar-single-row-todo-font-size"]: singleRowTodoFontSize,
                            }, children: [_jsxs("div", { className: "calendar-surface", style: { gridTemplateColumns: `84px repeat(${visibleDates.length}, minmax(${dayColumnWidth}px, 1fr))`, gridTemplateRows: `52px repeat(${TOTAL_SLOTS}, var(--calendar-slot-height))` }, children: [_jsx("div", { className: "calendar-corner", style: { gridColumn: "1 / 2", gridRow: "1 / 2" } }), visibleDates.map((date, index) => _jsxs("div", { className: "calendar-day-header", style: { gridColumn: `${index + 2} / ${index + 3}`, gridRow: "1 / 2" }, children: [_jsx("strong", { children: date }), _jsx("span", { children: formatDay(date) })] }, date)), _jsx("div", { className: "calendar-time-column", style: { gridColumn: "1 / 2", gridRow: `2 / span ${TOTAL_SLOTS}` }, children: Array.from({ length: TOTAL_SLOTS }, (_, slot) => _jsx("div", { className: `calendar-time-cell${slot % 12 === 0 ? " calendar-time-cell-hour" : ""}`, style: { height: "var(--calendar-slot-height)" }, children: slot % 12 === 0 ? slotToTime(slot) : "" }, `time-${slot}`)) }), visibleDates.map((date, index) => {
                                            const dayItems = itemsByDate.get(date) ?? [];
                                            const active = draftCell?.date === date ? draftCell : null;
                                            return _jsxs("div", { "data-date": date, className: "calendar-day-column", style: { gridColumn: `${index + 2} / ${index + 3}`, gridRow: `2 / span ${TOTAL_SLOTS}`, height: `calc(var(--calendar-slot-height) * ${TOTAL_SLOTS})` }, onClick: (event) => {
                                                    if (suppressColumnClickRef.current) {
                                                        suppressColumnClickRef.current = false;
                                                        return;
                                                    }
                                                    if (event.detail > 1)
                                                        return;
                                                    const target = event.target;
                                                    if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input"))
                                                        return;
                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                    openTodoDraftFromGrid(date, Math.floor((event.clientY - rect.top) / slotHeight));
                                                }, onDoubleClick: (event) => {
                                                    const target = event.target;
                                                    if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input"))
                                                        return;
                                                    cancelPendingTodoDraft();
                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                    void createMeetingFromGrid(date, Math.floor((event.clientY - rect.top) / slotHeight));
                                                }, onMouseDown: (event) => {
                                                    if (event.button !== 0)
                                                        return;
                                                    const target = event.target;
                                                    if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input"))
                                                        return;
                                                    marqueeCandidateRef.current = {
                                                        startX: event.clientX,
                                                        startY: event.clientY,
                                                        additive: event.metaKey || event.ctrlKey || event.shiftKey,
                                                    };
                                                }, children: [_jsx("div", { className: "calendar-day-interaction-layer" }), active ? _jsx("div", { className: "calendar-active-cell", style: { top: `calc(var(--calendar-slot-height) * ${active.slot})`, height: "var(--calendar-slot-height)" }, children: _jsx("input", { className: "calendar-cell-input", autoFocus: true, value: draftText, onChange: (event) => setDraftText(event.target.value), onBlur: commitDraftCell, onKeyDown: (event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    const next = active.slot;
                                                                    commitDraftCell();
                                                                    setDraftCell({ date: active.date, slot: clampSlot(next + 1) });
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setDraftText("");
                                                                    setDraftCell(null);
                                                                }
                                                                if (event.key === "ArrowDown") {
                                                                    event.preventDefault();
                                                                    moveDraftCell(0, 1);
                                                                }
                                                                if (event.key === "ArrowUp") {
                                                                    event.preventDefault();
                                                                    moveDraftCell(0, -1);
                                                                }
                                                                if (event.key === "Tab") {
                                                                    event.preventDefault();
                                                                    moveDraftCell(event.shiftKey ? -1 : 1, 0);
                                                                }
                                                            }, placeholder: "Type to add task or use double-click for meeting" }) }) : null, dayItems.map((item) => {
                                                        const preview = resizeState?.itemId === item.id ? resizeState : null;
                                                        const startSlot = preview?.startSlot ?? item.startSlot;
                                                        const durationSlots = preview?.durationSlots ?? item.durationSlots;
                                                        const laneWidth = 100 / Math.max(1, item.laneCount);
                                                        const minVisualHeight = item.targetType === "todo" && !item.isMeeting ? Math.max(10, slotHeight - 2) : 18;
                                                        const visualHeight = Math.max(slotHeight * Math.max(durationSlots, item.isMeeting ? 3 : 1) - 4, minVisualHeight);
                                                        const runningLog = getRunningTimeLog(timeLogsByTarget.get(`${item.targetType}:${item.targetId}`) || []);
                                                        const linkedSessionState = item.targetType === "activity"
                                                            ? linkedSessionStateByActivity[item.targetId]
                                                            : linkedSessionStateByTodo[item.targetId];
                                                        const runningLabel = runningLog ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now)) : "";
                                                        const isSelected = selectedItemIds.includes(item.id) || selectedItemId === item.id;
                                                        const isPastCalendarItem = slotToDateTime(item.date, startSlot + Math.max(1, durationSlots)) < now;
                                                        const meetingRecord = item.isMeeting && item.targetType === "activity" ? activityLookup[item.targetId] : null;
                                                        const meetingProjectOptions = meetingRecord ? getProjectsForDomain(structureOptions, meetingRecord.domain) : [];
                                                        const meetingActivityOptions = meetingRecord ? getActivitiesForSelection(structureOptions, meetingRecord.domain, meetingRecord.project) : [];
                                                        const sizeClass = [
                                                            visualHeight <= 22 ? "calendar-item-block-tiny" : visualHeight <= 54 ? "calendar-item-block-compact" : "",
                                                            item.targetType === "todo" && durationSlots <= 1 ? "calendar-item-block-single-row-todo" : "",
                                                            item.isMeeting && durationSlots <= 12 ? "calendar-item-block-medium-meeting" : "",
                                                            item.isMeeting && durationSlots <= 6 ? "calendar-item-block-short-meeting" : "",
                                                            item.isMeeting && durationSlots <= 3 ? "calendar-item-block-micro-meeting" : "",
                                                        ].filter(Boolean).map((className) => ` ${className}`).join("");
                                                        const inlineTodoEditForItem = inlineTodoEdit?.itemId === item.id ? inlineTodoEdit : null;
                                                        const isSingleRowTodo = item.targetType === "todo" && durationSlots <= 1;
                                                        const isTodayFloatingSingleRowTodo = isSingleRowTodo && item.date === today;
                                                        return _jsxs("div", { "data-item-id": item.id, className: `calendar-item-block calendar-item-block-${item.targetType}${item.isMeeting ? " calendar-item-block-meeting" : ""}${item.targetType === "todo" && item.isPriority ? " calendar-item-block-priority-todo" : ""}${item.targetType === "todo" && item.isDone ? " calendar-item-block-completed-todo" : ""}${isPastCalendarItem ? " calendar-item-block-past" : ""}${isSelected ? " calendar-item-block-selected" : ""}${selectedItemIds.length > 1 && selectedItemIds.includes(item.id) ? " calendar-item-block-multi-selected" : ""}${inlineTodoEditForItem ? " calendar-item-block-inline-editing" : ""}${sizeClass}`, role: "button", tabIndex: 0, style: { top: `calc(var(--calendar-slot-height) * ${startSlot} + 2px)`, height: `${visualHeight}px`, width: isTodayFloatingSingleRowTodo ? "calc(100% - 8px)" : `calc(${laneWidth}% - 8px)`, left: isTodayFloatingSingleRowTodo ? "4px" : `calc(${item.lane * laneWidth}% + 4px)`, right: "auto" }, onMouseDown: (event) => {
                                                                const target = event.target;
                                                                if (target.closest(".calendar-item-inline-action") || target.closest(".calendar-resize-handle") || target.closest(".calendar-item-title-input") || target.closest(".calendar-item-structure-input"))
                                                                    return;
                                                                event.preventDefault();
                                                                marqueeCandidateRef.current = null;
                                                                pointerDragCandidateRef.current = { itemId: item.id, startX: event.clientX, startY: event.clientY };
                                                                draggedGroupRef.current = { anchorId: item.id, itemIds: itemIdsForDrag(item.id) };
                                                            }, onClick: (event) => { if (suppressClickItemIdRef.current === item.id)
                                                                return; selectCalendarItem(item.id, event.metaKey || event.ctrlKey || event.shiftKey); }, onDoubleClick: () => { if (item.targetType === "todo") {
                                                                onOpenTodoDetail(item.targetId);
                                                                return;
                                                            } onOpenActivityDetail(item.targetId); }, children: [item.isMeeting ? _jsx("span", { className: "calendar-resize-handle calendar-resize-handle-start", onMouseDown: (event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "start", date: item.date, startSlot, durationSlots }); } }) : null, _jsxs("span", { className: "calendar-item-kicker", children: [item.isMeeting ? "Meeting" : "Task", item.isPrivate ? " • Private" : ""] }), isSingleRowTodo ? (_jsxs("div", { className: "calendar-item-single-row-header", children: [inlineTodoEditForItem ? (_jsx("input", { className: "calendar-item-title calendar-item-title-input", autoFocus: true, value: inlineTodoEditForItem.value, onChange: (event) => setInlineTodoEdit((current) => current ? { ...current, value: event.target.value } : current), onBlur: saveInlineTodoEdit, onMouseDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => {
                                                                                if (event.key === "Enter") {
                                                                                    event.preventDefault();
                                                                                    saveInlineTodoEdit();
                                                                                }
                                                                                else if (event.key === "Escape") {
                                                                                    event.preventDefault();
                                                                                    setInlineTodoEdit(null);
                                                                                }
                                                                            } })) : (_jsx("strong", { className: "calendar-item-title", children: item.title })), _jsxs("span", { className: "calendar-item-single-row-actions", children: [_jsx("span", { className: `calendar-item-inline-action${runningLog ? " calendar-item-inline-action-active" : ""}`, role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                                        event.preventDefault();
                                                                                        event.stopPropagation();
                                                                                    }, onClick: (event) => {
                                                                                        event.preventDefault();
                                                                                        event.stopPropagation();
                                                                                        if (runningLog) {
                                                                                            onStopTracking(item.targetType, item.targetId);
                                                                                            return;
                                                                                        }
                                                                                        onStartTracking(item.targetType, item.targetId);
                                                                                    }, children: runningLog ? "Stop" : "Start" }), linkedSessionState?.sessionId ? (_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                                        event.preventDefault();
                                                                                        event.stopPropagation();
                                                                                    }, onClick: (event) => {
                                                                                        event.preventDefault();
                                                                                        event.stopPropagation();
                                                                                        onOpenSession(linkedSessionState.sessionId, item.id);
                                                                                    }, children: "Session" })) : (_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                                        event.preventDefault();
                                                                                        event.stopPropagation();
                                                                                    }, onClick: (event) => {
                                                                                        event.preventDefault();
                                                                                        event.stopPropagation();
                                                                                        onCreateLinkedTaskSession(item.targetId);
                                                                                    }, children: "Session" }))] })] })) : null, !isSingleRowTodo ? (inlineTodoEditForItem ? (_jsx("input", { className: "calendar-item-title calendar-item-title-input", autoFocus: true, value: inlineTodoEditForItem.value, onChange: (event) => setInlineTodoEdit((current) => current ? { ...current, value: event.target.value } : current), onBlur: saveInlineTodoEdit, onMouseDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.preventDefault();
                                                                            saveInlineTodoEdit();
                                                                        }
                                                                        else if (event.key === "Escape") {
                                                                            event.preventDefault();
                                                                            setInlineTodoEdit(null);
                                                                        }
                                                                    } })) : item.isMeeting && isSelected && meetingRecord ? (_jsx("input", { className: "calendar-item-title calendar-item-title-input", value: meetingRecord.description, placeholder: "Meeting title", onMouseDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onChange: (event) => handleMeetingCardTitleChange(item.targetId, event.target.value) })) : (_jsx("strong", { className: "calendar-item-title", children: item.isMeeting ? `${slotToTime(startSlot)} ${item.title}` : item.title }))) : null, !isSingleRowTodo ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "calendar-item-meta", children: [item.isMeeting ? durationLabel(durationSlots) : item.label, runningLog ? ` • Running ${runningLabel}` : ""] }), item.isMeeting && isSelected && meetingRecord ? (_jsxs("div", { className: "calendar-item-structure-row", children: [_jsx("input", { className: "calendar-item-structure-input", value: meetingRecord.domain, list: `calendar-meeting-domain-options-${item.id}`, placeholder: "Domain", onMouseDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onChange: (event) => handleMeetingCardDomainChange(item.targetId, event.target.value) }), _jsx("datalist", { id: `calendar-meeting-domain-options-${item.id}`, children: structureOptions.domains.map((entry) => (_jsx("option", { value: entry }, entry))) }), _jsx("input", { className: "calendar-item-structure-input", value: meetingRecord.project, list: `calendar-meeting-project-options-${item.id}`, placeholder: "Project", onMouseDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onChange: (event) => handleMeetingCardProjectChange(item.targetId, event.target.value) }), _jsx("datalist", { id: `calendar-meeting-project-options-${item.id}`, children: meetingProjectOptions.map((entry) => (_jsx("option", { value: entry }, entry))) }), _jsx("input", { className: "calendar-item-structure-input", value: meetingRecord.activity, list: `calendar-meeting-activity-options-${item.id}`, placeholder: "Activity", onMouseDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onChange: (event) => handleMeetingCardActivityChange(item.targetId, event.target.value) }), _jsx("datalist", { id: `calendar-meeting-activity-options-${item.id}`, children: meetingActivityOptions.map((entry) => (_jsx("option", { value: entry }, entry))) })] })) : linkedSessionState?.sessionId ? (_jsx("span", { className: `calendar-item-link-state${linkedSessionState.hasOutput ? " calendar-item-link-state-output" : ""}`, children: linkedSessionState.hasOutput ? "Output ready" : "Session linked" })) : (_jsx("span", { className: "calendar-item-link-state calendar-item-link-state-empty", children: item.targetType === "todo" ? "No note" : "No session" }))] })) : null, item.isMeeting ? (_jsx("div", { className: "calendar-item-launcher-row", children: linkedSessionState?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                }, onClick: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                    onOpenSession(linkedSessionState.sessionId, item.id);
                                                                                }, children: "Open session" }), linkedSessionState.hasOutput && !isSingleRowTodo ? (_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                }, onClick: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                    onPreviewSessionOutput(linkedSessionState.sessionId);
                                                                                }, children: "Output" })) : null] })) : (_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                        }, onClick: (event) => {
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                            onCreateLinkedMeetingSession(item.targetId);
                                                                        }, children: "Create session" })) })) : null, !item.isMeeting && item.targetType === "todo" ? (!isSingleRowTodo ? (_jsx("div", { className: "calendar-item-launcher-row", children: linkedSessionState?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                }, onClick: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                    onOpenSession(linkedSessionState.sessionId, item.id);
                                                                                }, children: "Session" }), linkedSessionState.hasOutput ? (_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                }, onClick: (event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                    onPreviewSessionOutput(linkedSessionState.sessionId);
                                                                                }, children: "Output" })) : null] })) : (_jsx("span", { className: "calendar-item-inline-action calendar-item-inline-action-secondary", role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                        }, onClick: (event) => {
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                            onCreateLinkedTaskSession(item.targetId);
                                                                        }, children: "Session" })) })) : null) : null, !isSingleRowTodo ? (_jsx("span", { className: `calendar-item-inline-action${runningLog ? " calendar-item-inline-action-active" : ""}`, role: "button", tabIndex: -1, onMouseDown: (event) => {
                                                                        event.preventDefault();
                                                                        event.stopPropagation();
                                                                    }, onClick: (event) => {
                                                                        event.preventDefault();
                                                                        event.stopPropagation();
                                                                        if (runningLog) {
                                                                            onStopTracking(item.targetType, item.targetId);
                                                                            return;
                                                                        }
                                                                        onStartTracking(item.targetType, item.targetId);
                                                                    }, children: runningLog ? "Stop" : "Start" })) : null, item.isMeeting ? _jsx("span", { className: "calendar-resize-handle calendar-resize-handle-end", onMouseDown: (event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "end", date: item.date, startSlot, durationSlots }); } }) : null] }, item.id);
                                                    })] }, `col-${date}`);
                                        })] }), marqueeSelection ? (_jsx("div", { className: "calendar-marquee-selection", style: {
                                        left: `${Math.min(marqueeSelection.startX, marqueeSelection.currentX)}px`,
                                        top: `${Math.min(marqueeSelection.startY, marqueeSelection.currentY)}px`,
                                        width: `${Math.abs(marqueeSelection.currentX - marqueeSelection.startX)}px`,
                                        height: `${Math.abs(marqueeSelection.currentY - marqueeSelection.startY)}px`,
                                    } })) : null] }) }), _jsx("div", { className: "calendar-splitter", role: "separator", "aria-orientation": "vertical", onMouseDown: () => { splitterDraggingRef.current = true; document.body.style.cursor = "col-resize"; } }), _jsx("aside", { className: `calendar-editor-card${detailsPaneWidth <= 340 ? " calendar-editor-card-compact" : ""}`, children: editorDraft ? (_jsxs("div", { className: `stack calendar-editor-stack${detailsPaneWidth <= 340 ? " calendar-editor-stack-compact" : ""}`, children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: editorDraft.isMeeting ? "Meeting" : "Task" }), _jsxs("div", { className: "calendar-editor-meta", children: [_jsx("span", { className: "status-chip", children: editorDraft.isMeeting ? "Meeting" : "Task" }), editorDraft.project ? _jsx("span", { className: "status-chip", children: editorDraft.project }) : null, editorDraft.domain ? _jsx("span", { className: "status-chip", children: editorDraft.domain }) : null] })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => setSelectedItemId(null), children: "Close" })] }), _jsx("div", { className: "calendar-inspector-section-label", children: "Schedule" }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-title", children: "Title" }), _jsx("input", { id: "calendar-edit-title", value: editorDraft.title, onChange: (event) => updateEditorDraft({ ...editorDraft, title: event.target.value }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "calendar-edit-participants", children: "People" }), _jsx(PeoplePicker, { value: editorDraft.participantText, savedPeople: savedPeople, suggestedPeople: savedPeople, placeholder: "Search or add people", onChange: (value) => updateEditorDraft({ ...editorDraft, participantText: value }) })] }), _jsxs("div", { className: "calendar-editor-quick-toggles", children: [editorDraft.targetType === "todo" ? (_jsxs("label", { className: "compact-private-toggle calendar-done-toggle", children: [_jsx("input", { type: "checkbox", checked: editorDraft.isDone, onChange: (event) => updateEditorDraft({ ...editorDraft, isDone: event.target.checked }) }), _jsx("span", { children: editorDraft.isDone ? "Done" : "Mark as done" })] })) : null, editorDraft.targetType === "todo" ? (_jsxs("label", { className: "compact-private-toggle calendar-done-toggle", children: [_jsx("input", { type: "checkbox", checked: editorDraft.isPriority, onChange: (event) => updateEditorDraft({ ...editorDraft, isPriority: event.target.checked }) }), _jsx("span", { children: "Prio" })] })) : null, _jsxs("label", { className: "compact-private-toggle calendar-done-toggle", children: [_jsx("input", { type: "checkbox", checked: editorDraft.isPrivate, onChange: (event) => updateEditorDraft({ ...editorDraft, isPrivate: event.target.checked }) }), _jsx("span", { children: "Private" })] })] }), editorDraft.isMeeting ? (_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-date", children: editorDraft.isMeeting ? "Date" : "Do on" }), _jsx(DateInput, { id: "calendar-edit-date", value: editorDraft.doOn, onChange: (event) => updateEditorDraft({ ...editorDraft, doOn: event.target.value }) })] })) : (_jsxs("details", { className: "workspace-disclosure calendar-inspector-disclosure", children: [_jsx("summary", { children: "Schedule details" }), _jsx("div", { className: "workspace-disclosure-body", children: _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-date", children: editorDraft.isMeeting ? "Date" : "Do on" }), _jsx(DateInput, { id: "calendar-edit-date", value: editorDraft.doOn, onChange: (event) => updateEditorDraft({ ...editorDraft, doOn: event.target.value }) })] }) })] })), editorDraft.targetType === "activity" ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "calendar-inspector-section-label", children: editorDraft.isMeeting ? "Linked session" : "Schedule time" }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-start", children: "Start" }), _jsx(DeferredTimeInput, { id: "calendar-edit-start", step: 300, value: editorDraft.startTime, onCommit: (value) => updateEditorDraft({ ...editorDraft, startTime: value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-end", children: "End" }), _jsx(DeferredTimeInput, { id: "calendar-edit-end", step: 300, value: editorDraft.endTime, onCommit: (value) => updateEditorDraft({ ...editorDraft, endTime: value }) })] })] }), editorDraft.isMeeting ? (_jsxs("div", { className: "field", children: [_jsx("label", { children: "Meeting session" }), _jsxs("div", { className: "calendar-linked-session-card", children: [_jsx("div", { className: "calendar-linked-session-status", children: linkedSessionStateByActivity[editorDraft.targetId]?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: linkedSessionStateByActivity[editorDraft.targetId]?.sessionTitle || "Linked meeting session" }), _jsx("span", { children: linkedSessionStateByActivity[editorDraft.targetId]?.hasOutput ? "Output available" : "No output yet" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: "No linked meeting session" }), _jsx("span", { children: "Create one when this calendar meeting should become a working notes session." })] })) }), _jsx("div", { className: "calendar-editor-actions", children: linkedSessionStateByActivity[editorDraft.targetId]?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                                            const sessionId = linkedSessionStateByActivity[editorDraft.targetId]?.sessionId;
                                                                            if (sessionId)
                                                                                onOpenSession(sessionId);
                                                                        }, children: "Open linked meeting session" }), linkedSessionStateByActivity[editorDraft.targetId]?.hasOutput ? (_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                                            const sessionId = linkedSessionStateByActivity[editorDraft.targetId]?.sessionId;
                                                                            if (sessionId)
                                                                                onPreviewSessionOutput(sessionId);
                                                                        }, children: "Open session output" })) : null] })) : (_jsx("button", { className: "shell-button", type: "button", onClick: () => onCreateLinkedMeetingSession(editorDraft.targetId), children: "Create linked meeting session" })) })] })] })) : null] })) : null, editorDraft.targetType === "todo" ? (_jsxs("div", { className: "field", children: [_jsx("label", { children: "Task note" }), _jsxs("div", { className: "calendar-linked-session-card", children: [_jsx("div", { className: "calendar-linked-session-status", children: linkedSessionStateByTodo[editorDraft.targetId]?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: linkedSessionStateByTodo[editorDraft.targetId]?.sessionTitle || "Linked task note" }), _jsx("span", { children: linkedSessionStateByTodo[editorDraft.targetId]?.hasOutput ? "Output available" : "No output yet" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: "No linked task note" }), _jsx("span", { children: "Create one when this task should open as a personal note session." })] })) }), _jsx("div", { className: "calendar-editor-actions", children: linkedSessionStateByTodo[editorDraft.targetId]?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                                    const sessionId = linkedSessionStateByTodo[editorDraft.targetId]?.sessionId;
                                                                    if (sessionId)
                                                                        onOpenSession(sessionId);
                                                                }, children: "Open linked task note" }), linkedSessionStateByTodo[editorDraft.targetId]?.hasOutput ? (_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                                    const sessionId = linkedSessionStateByTodo[editorDraft.targetId]?.sessionId;
                                                                    if (sessionId)
                                                                        onPreviewSessionOutput(sessionId);
                                                                }, children: "Open note output" })) : null] })) : (_jsx("button", { className: "shell-button", type: "button", onClick: () => onCreateLinkedTaskSession(editorDraft.targetId), children: "Create linked task note" })) })] })] })) : null, editorDraft.targetType === "todo" ? (_jsxs("details", { className: "workspace-disclosure calendar-inspector-disclosure", open: true, children: [_jsx("summary", { children: "Checklists" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsx("div", { className: "page-actions", children: _jsxs("span", { className: "status-chip", children: [currentTaskChecklists.length, " checklists"] }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "calendar-checklist-draft", children: "New checklist" }), _jsx("input", { id: "calendar-checklist-draft", value: checklistDraft, onChange: (event) => setChecklistDraft(event.target.value), onKeyDown: (event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                                            event.preventDefault();
                                                                            const nextTitle = checklistDraft.trim();
                                                                            if (!nextTitle)
                                                                                return;
                                                                            onCreateChecklist(editorDraft.targetId, nextTitle);
                                                                            setChecklistDraft("");
                                                                        }
                                                                    }, placeholder: "For example: Monthly reporting staff" })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                const nextTitle = checklistDraft.trim();
                                                                if (!nextTitle)
                                                                    return;
                                                                onCreateChecklist(editorDraft.targetId, nextTitle);
                                                                setChecklistDraft("");
                                                            }, children: "Add" })] }), currentTaskChecklists.length ? (_jsx("div", { className: "structure-checklist-list", children: currentTaskChecklists.map((checklist) => {
                                                        const checkedCount = checklist.items.filter((item) => item.isChecked).length;
                                                        return (_jsxs("details", { className: "structure-checklist-card", open: true, children: [_jsxs("summary", { children: [_jsx("span", { children: checklist.title }), _jsxs("span", { className: "tiny-text", children: [checkedCount, "/", checklist.items.length] })] }), _jsxs("div", { className: "structure-checklist-body", children: [_jsx("div", { className: "page-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteChecklist(checklist.id), children: "Delete checklist" }) }), checklist.items.length ? (_jsx("div", { className: "section-list", children: checklist.items.map((item) => (_jsxs("div", { className: "list-item structure-checklist-row", children: [_jsxs("label", { className: "structure-checklist-item", children: [_jsx("input", { type: "checkbox", checked: item.isChecked, onChange: () => toggleChecklistItem(checklist, item.id) }), _jsx("span", { children: item.label })] }), _jsxs("div", { className: "page-actions structure-checklist-actions", children: [_jsx("button", { className: "small-button structure-checklist-action-button", type: "button", onClick: () => moveChecklistItem(checklist, item.id, -1), disabled: item.position <= 1, children: "Up" }), _jsx("button", { className: "small-button structure-checklist-action-button", type: "button", onClick: () => moveChecklistItem(checklist, item.id, 1), disabled: item.position >= checklist.items.length, children: "Down" }), _jsx("button", { className: "small-button danger-button structure-checklist-action-button", type: "button", onClick: () => deleteChecklistItem(checklist, item.id), children: "Delete" })] })] }, item.id))) })) : (_jsx("p", { className: "muted", children: "No checklist items yet." })), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `calendar-checklist-item-${checklist.id}`, children: "New item" }), _jsx("input", { id: `calendar-checklist-item-${checklist.id}`, value: checklistItemDrafts[checklist.id] || "", onChange: (event) => setChecklistItemDraft(checklist.id, event.target.value), onKeyDown: (event) => {
                                                                                                if (event.key === "Enter" && !event.shiftKey) {
                                                                                                    event.preventDefault();
                                                                                                    addChecklistItem(checklist);
                                                                                                }
                                                                                            }, placeholder: "Add a checkbox item" })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => addChecklistItem(checklist), children: "Add item" })] })] })] }, checklist.id));
                                                    }) })) : (_jsx("p", { className: "muted", children: "No task checklists yet." }))] })] })) : null, _jsxs("details", { className: "workspace-disclosure calendar-inspector-disclosure calendar-structure-disclosure", children: [_jsx("summary", { children: editorDraft.isMeeting ? "Structure and advanced details" : "Task details" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "metadata-triplet-grid", children: [!editorDraft.isMeeting ? (_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-link", children: "Linked activity" }), _jsxs("select", { id: "calendar-edit-link", value: editorDraft.activityId, onChange: (event) => {
                                                                        const nextId = event.target.value;
                                                                        const linkedActivity = nextId ? activityLookup[nextId] : null;
                                                                        updateEditorDraft({
                                                                            ...editorDraft,
                                                                            activityId: nextId,
                                                                            domain: linkedActivity?.domain || editorDraft.domain,
                                                                            project: linkedActivity?.project || editorDraft.project,
                                                                            activity: linkedActivity?.description || editorDraft.activity,
                                                                        });
                                                                    }, children: [_jsx("option", { value: "", children: "Unassigned" }), linkedActivityOptions.map((activity) => (_jsx("option", { value: activity.id, children: activity.description }, activity.id)))] })] })) : null, _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-domain", children: "Domain" }), _jsx(TokenPicker, { value: editorDraft.domain, savedOptions: structureOptions.domains, suggestedOptions: structureOptions.domains, placeholder: "Search or add domain", suggestionSummary: "Domains", suggestionBadgeText: "Available", mode: "single", onChange: handleEditorDomainChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-project", children: "Project" }), _jsx(TokenPicker, { value: editorDraft.project, savedOptions: editorProjectOptions, suggestedOptions: editorProjectOptions, placeholder: "Search or add project", suggestionSummary: "Projects", suggestionBadgeText: "Available", mode: "single", onChange: handleEditorProjectChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-activity", children: "Activity" }), _jsx(TokenPicker, { value: editorDraft.activity, savedOptions: editorActivityOptions, suggestedOptions: editorActivityOptions, placeholder: "Search or add activity", suggestionSummary: "Activities", suggestionBadgeText: "Available", mode: "single", onChange: (value) => updateEditorDraft({ ...editorDraft, activity: value }) })] })] }), !editorDraft.isMeeting ? (_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-due", children: "Due date" }), _jsx(DateInput, { id: "calendar-edit-due", value: editorDraft.dueDate, onChange: (event) => updateEditorDraft({ ...editorDraft, dueDate: event.target.value }) })] })) : null] })] }), _jsx("div", { className: "calendar-inspector-section-label", children: "Time" }), _jsx("div", { className: "calendar-editor-actions", children: (() => {
                                        const runningLog = getRunningTimeLog(timeLogsByTarget.get(`${editorDraft.targetType}:${editorDraft.targetId}`) || []);
                                        return (_jsxs(_Fragment, { children: [_jsx("span", { className: "status-chip", children: runningLog ? `Running • ${formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))}` : "No active timer" }), _jsx("button", { className: runningLog ? "primary-button" : "shell-button", type: "button", onClick: () => {
                                                        if (runningLog) {
                                                            onStopTracking(editorDraft.targetType, editorDraft.targetId);
                                                            return;
                                                        }
                                                        onStartTracking(editorDraft.targetType, editorDraft.targetId);
                                                    }, children: runningLog ? "Stop timelog" : "Start timelog" })] }));
                                    })() }), selectedRunningLog ? (_jsxs("div", { className: "calendar-timelog-card stack", children: [_jsxs("div", { className: "calendar-timelog-summary", children: [_jsxs("span", { className: "status-chip", children: ["Started ", selectedRunningLog.startTime] }), _jsx("span", { className: "status-chip", children: selectedRunningLog.date }), _jsx("span", { className: "status-chip", children: formatTrackedMinutes(calculateLiveDurationMinutes(selectedRunningLog, now)) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `calendar-timelog-notes-${selectedRunningLog.id}`, children: "Comment" }), _jsx("input", { id: `calendar-timelog-notes-${selectedRunningLog.id}`, value: getTimeLogNotesDraft(selectedRunningLog), onChange: (event) => updateTimeLogNotesDraft(selectedRunningLog.id, event.target.value), onBlur: () => commitTimeLogNotesDraft(selectedRunningLog), onKeyDown: (event) => {
                                                        if (event.key === "Enter") {
                                                            event.preventDefault();
                                                            commitTimeLogNotesDraft(selectedRunningLog);
                                                        }
                                                        if (event.key === "Escape") {
                                                            event.preventDefault();
                                                            clearTimeLogNotesDraft(selectedRunningLog.id);
                                                        }
                                                    }, placeholder: "Add a working note" })] })] })) : null, _jsxs("div", { className: "calendar-editor-actions calendar-editor-actions-inline", children: [_jsxs("button", { className: "shell-button", type: "button", onClick: () => (editorDraft.targetType === "todo" ? onOpenTodoWorkspace() : onOpenActivityWorkspace(editorDraft.targetId)), children: ["Open full ", editorDraft.isMeeting ? "meeting" : "task"] }), editorDraft.targetType === "todo" ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => quickStartTodoIds.includes(editorDraft.targetId)
                                                        ? unpinQuickStartTodo(editorDraft.targetId)
                                                        : pinQuickStartTodo(editorDraft.targetId), children: quickStartTodoIds.includes(editorDraft.targetId) ? "Unpin quick start" : "Pin quick start" }), _jsx("button", { className: "shell-button", type: "button", onClick: convertEditorTodoToMeeting, children: "Convert to meeting" })] })) : null] })] })) : (_jsxs("div", { className: "stack", children: [_jsx("h3", { children: "Calendar item" }), _jsx("p", { className: "muted", children: "Select a scheduled block to edit it here." })] })) })] })] }));
};
