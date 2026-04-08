import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const TOTAL_SLOTS = 24 * 12;
const MINUTES_PER_SLOT = 5;
const DEFAULT_MEETING_DURATION_SLOTS = 12;
const DAYS = [3, 5, 7, 14];
const HEIGHTS = [12, 16, 22];
const MIN_PANE = 240;
const MAX_PANE = 520;
const addDays = (date, days) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
};
const clampSlot = (slot) => Math.max(0, Math.min(TOTAL_SLOTS - 1, slot));
const clampPane = (width) => Math.min(MAX_PANE, Math.max(MIN_PANE, Math.round(width)));
const durationFromTimes = (startTime, endTime) => Math.max(1, timeToSlot(endTime) - timeToSlot(startTime));
const slotToTime = (slot) => {
    const total = slot * MINUTES_PER_SLOT;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const timeToSlot = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes))
        return 0;
    return hours * 12 + Math.floor(minutes / MINUTES_PER_SLOT);
};
const formatDay = (date) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "2-digit", day: "2-digit" }).format(new Date(`${date}T00:00:00`));
const durationLabel = (slots) => {
    const minutes = slots * MINUTES_PER_SLOT;
    if (minutes < 60)
        return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
};
const dayColumnWidthForView = (daysInView) => {
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
export const CalendarWorkspace = ({ todos, activities, calendarItems, settings, linkedSessionStateByActivity, onSaveSettings, onCreateFromText, onMoveItem, onSaveTodo, onDeleteTodo, onSaveActivity, onDeleteActivity, onConvertTodoToMeeting, onUpdateCalendarItem, onOpenTodoWorkspace, onOpenTodoDetail, onOpenActivityWorkspace, onOpenActivityDetail, onOpenSession, onCreateLinkedMeetingSession, onPreviewSessionOutput, onFullScreenChange, }) => {
    const today = new Date().toISOString().slice(0, 10);
    const initialIsFullScreen = settings.calendarFullScreenPreferenceInitialized ? settings.calendarIsFullScreen : true;
    const [anchorDate, setAnchorDate] = useState(today);
    const [daysInView, setDaysInView] = useState(settings.calendarDaysInView);
    const [slotHeight, setSlotHeight] = useState(settings.calendarSlotHeight);
    const [isFullScreen, setIsFullScreen] = useState(initialIsFullScreen);
    const [detailsPaneWidth, setDetailsPaneWidth] = useState(settings.calendarDetailsPaneWidth);
    const [scrollTop, setScrollTop] = useState(settings.calendarScrollTop ?? 0);
    const [scrollLeft, setScrollLeft] = useState(settings.calendarScrollLeft ?? 0);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [editorDraft, setEditorDraft] = useState(null);
    const [jumpDate, setJumpDate] = useState(today);
    const [draftCell, setDraftCell] = useState(null);
    const [draftText, setDraftText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [visibilityFilter, setVisibilityFilter] = useState("all");
    const [resizeState, setResizeState] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const layoutRef = useRef(null);
    const scrollRef = useRef(null);
    const splitterDraggingRef = useRef(false);
    const scrollPersistTimerRef = useRef(null);
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
            settings.calendarScrollLeft !== scrollLeft) {
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
    const visibleDates = useMemo(() => Array.from({ length: daysInView }, (_, index) => addDays(anchorDate, index)), [anchorDate, daysInView]);
    const dayColumnWidth = useMemo(() => dayColumnWidthForView(daysInView), [daysInView]);
    const items = useMemo(() => {
        const todoMap = new Map((Array.isArray(todos) ? todos : []).map((todo) => [todo.id, todo]));
        const activityMap = new Map((Array.isArray(activities) ? activities : []).map((activity) => [activity.id, activity]));
        const base = (Array.isArray(calendarItems) ? calendarItems : [])
            .map((item) => {
            if (item.targetType === "todo") {
                const todo = todoMap.get(item.targetId);
                if (!todo)
                    return null;
                return { id: item.id, date: item.date, startSlot: item.startSlot, durationSlots: item.durationSlots, targetType: "todo", targetId: item.targetId, title: todo.description, label: "Todo", isMeeting: false, isPrivate: todo.isPrivate, lane: 0, laneCount: 1 };
            }
            const activity = activityMap.get(item.targetId);
            if (!activity)
                return null;
            return { id: item.id, date: item.date, startSlot: item.startSlot, durationSlots: item.durationSlots, targetType: "activity", targetId: item.targetId, title: activity.description, label: activity.type === "meeting" ? "Meeting" : "Activity", isMeeting: activity.type === "meeting", isPrivate: activity.isPrivate, lane: 0, laneCount: 1 };
        })
            .filter((item) => item !== null)
            .sort((left, right) => left.date.localeCompare(right.date) || left.startSlot - right.startSlot || left.title.localeCompare(right.title));
        const grouped = new Map();
        base.forEach((item) => {
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
                const laneCount = dayItems.filter((candidate) => item.startSlot < candidate.startSlot + Math.max(1, candidate.durationSlots) && candidate.startSlot < itemEnd).length;
                result.push({ ...item, lane, laneCount: Math.max(1, laneCount) });
            });
        });
        return result.sort((left, right) => left.date.localeCompare(right.date) || left.startSlot - right.startSlot || left.lane - right.lane);
    }, [activities, calendarItems, todos]);
    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return items.filter((item) => {
            if (typeFilter === "todo" && item.targetType !== "todo")
                return false;
            if (typeFilter === "activity" && (item.targetType !== "activity" || item.isMeeting))
                return false;
            if (typeFilter === "meeting" && !item.isMeeting)
                return false;
            if (visibilityFilter === "private" && !item.isPrivate)
                return false;
            if (visibilityFilter === "public" && item.isPrivate)
                return false;
            if (!query)
                return true;
            return `${item.title} ${item.label}`.toLowerCase().includes(query);
        });
    }, [items, searchQuery, typeFilter, visibilityFilter]);
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
    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller)
            return;
        const hasSavedViewport = (settings.calendarScrollTop ?? 0) > 0 || (settings.calendarScrollLeft ?? 0) > 0;
        if (hasSavedViewport) {
            scroller.scrollTop = Math.max(0, settings.calendarScrollTop ?? 0);
            scroller.scrollLeft = Math.max(0, settings.calendarScrollLeft ?? 0);
            return;
        }
        const now = new Date();
        const currentSlot = clampSlot(now.getHours() * 12 + Math.floor(now.getMinutes() / MINUTES_PER_SLOT));
        scroller.scrollTop = Math.max(0, currentSlot * slotHeight - scroller.clientHeight / 2);
        scroller.scrollLeft = 0;
    }, [settings.calendarScrollLeft, settings.calendarScrollTop, slotHeight]);
    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller)
            return;
        const handleScroll = () => {
            if (scrollPersistTimerRef.current) {
                clearTimeout(scrollPersistTimerRef.current);
            }
            scrollPersistTimerRef.current = setTimeout(() => {
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
        };
    }, []);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key !== "Delete" || !selectedItem) {
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
            event.preventDefault();
            setPendingDelete({
                itemId: selectedItem.id,
                targetType: selectedItem.targetType,
                targetId: selectedItem.targetId,
                title: selectedItem.title,
            });
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedItem]);
    useEffect(() => {
        if (!selectedItemId) {
            setEditorDraft(null);
            return;
        }
        const calendarItem = calendarItems.find((item) => item.id === selectedItemId);
        if (!calendarItem)
            return;
        if (calendarItem.targetType === "todo") {
            const todo = todos.find((entry) => entry.id === calendarItem.targetId);
            if (!todo)
                return;
            setEditorDraft({ itemId: calendarItem.id, targetType: "todo", targetId: todo.id, title: todo.description, doOn: calendarItem.date, dueDate: todo.dueDate, startTime: slotToTime(calendarItem.startSlot), endTime: slotToTime(calendarItem.startSlot + DEFAULT_MEETING_DURATION_SLOTS), domain: todo.domain, project: todo.project, activity: todo.activity, isPrivate: todo.isPrivate, isMeeting: false });
            return;
        }
        const activity = activities.find((entry) => entry.id === calendarItem.targetId);
        if (!activity)
            return;
        setEditorDraft({ itemId: calendarItem.id, targetType: "activity", targetId: activity.id, title: activity.description, doOn: calendarItem.date, dueDate: activity.dueDate, startTime: activity.startTime || slotToTime(calendarItem.startSlot), endTime: activity.endTime || slotToTime(calendarItem.startSlot + Math.max(1, calendarItem.durationSlots)), domain: activity.domain, project: activity.project, activity: activity.activity, isPrivate: activity.isPrivate, isMeeting: activity.type === "meeting" });
    }, [activities, calendarItems, selectedItemId, todos]);
    useEffect(() => {
        if (!pendingDelete)
            return;
        if (!selectedItemId || pendingDelete.itemId !== selectedItemId) {
            setPendingDelete(null);
        }
    }, [pendingDelete, selectedItemId]);
    useEffect(() => {
        if (!resizeState)
            return;
        const handleMouseMove = (event) => {
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
            setResizeState((current) => {
                if (current)
                    onUpdateCalendarItem(current.itemId, { date: current.date, startSlot: current.startSlot, durationSlots: current.durationSlots });
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
    const moveDraftCell = (deltaDays, deltaSlots) => {
        if (!draftCell)
            return;
        setDraftCell({ date: addDays(draftCell.date, deltaDays), slot: clampSlot(draftCell.slot + deltaSlots) });
    };
    const commitDraftCell = () => {
        if (!draftCell)
            return;
        const nextValue = draftText.trim();
        if (nextValue)
            onCreateFromText(draftCell.date, draftCell.slot, nextValue);
        setDraftText("");
        setDraftCell(null);
    };
    const saveEditor = () => {
        if (!editorDraft)
            return;
        const startSlot = clampSlot(timeToSlot(editorDraft.startTime || "00:00"));
        const durationSlots = editorDraft.isMeeting ? Math.max(1, durationFromTimes(editorDraft.startTime || "00:00", editorDraft.endTime || editorDraft.startTime || "00:05")) : 1;
        if (editorDraft.targetType === "todo") {
            const todo = todos.find((entry) => entry.id === editorDraft.targetId);
            if (!todo)
                return;
            onSaveTodo({ ...todo, description: editorDraft.title.trim() || todo.description, doOn: editorDraft.doOn, dueDate: editorDraft.dueDate, domain: editorDraft.domain, project: editorDraft.project, activity: editorDraft.activity, isPrivate: editorDraft.isPrivate });
        }
        else {
            const activity = activities.find((entry) => entry.id === editorDraft.targetId);
            if (!activity)
                return;
            onSaveActivity({ ...activity, description: editorDraft.title.trim() || activity.description, doOn: editorDraft.doOn, dueDate: editorDraft.dueDate, domain: editorDraft.domain, project: editorDraft.project, activity: editorDraft.activity, isPrivate: editorDraft.isPrivate, startTime: editorDraft.isMeeting ? editorDraft.startTime : activity.startTime, endTime: editorDraft.isMeeting ? editorDraft.endTime : activity.endTime });
        }
        onUpdateCalendarItem(editorDraft.itemId, { date: editorDraft.doOn, startSlot, durationSlots });
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
    const confirmDeleteSelectedItem = () => {
        if (!pendingDelete)
            return;
        if (pendingDelete.targetType === "todo") {
            onDeleteTodo(pendingDelete.targetId);
        }
        else {
            onDeleteActivity(pendingDelete.targetId);
        }
        setPendingDelete(null);
        setSelectedItemId(null);
        setEditorDraft(null);
    };
    return (_jsxs("div", { className: `card calendar-workspace${isFullScreen ? " calendar-workspace-fullscreen" : ""}`, children: [_jsxs("div", { className: "card-header session-editor-header-minimal calendar-workspace-header", children: [_jsx("div", { children: _jsx("h2", { children: "Calendar" }) }), _jsxs("div", { className: "page-actions wrap-row", children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate((current) => addDays(current, -daysInView)), children: "Previous" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => { setAnchorDate(today); setJumpDate(today); }, children: "Today" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate((current) => addDays(current, daysInView)), children: "Next" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate((current) => addDays(current, 30)), children: "+30 days" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setIsFullScreen((current) => !current), children: isFullScreen ? "Exit full screen" : "Full screen" })] })] }), _jsxs("div", { className: `calendar-controls${isFullScreen ? " calendar-controls-compact" : ""}`, children: [_jsxs("div", { className: "calendar-calendar-summary", children: [_jsxs("div", { className: "status-chip", children: [filteredItems.length, " scheduled items"] }), _jsx("div", { className: "capture-density-toggle", children: DAYS.map((option) => _jsxs("button", { className: "segment-button", type: "button", "data-active": option === daysInView, onClick: () => setDaysInView(option), children: [option, " days"] }, `days-${option}`)) }), _jsx("div", { className: "capture-density-toggle", children: HEIGHTS.map((option) => _jsx("button", { className: "segment-button", type: "button", "data-active": option === slotHeight, onClick: () => setSlotHeight(option), children: option === 12 ? "Compact" : option === 16 ? "Default" : "Large" }, `height-${option}`)) })] }), _jsxs("div", { className: "calendar-toolbar", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-jump-date", children: "Jump to date" }), _jsx("input", { id: "calendar-jump-date", type: "date", value: jumpDate, onChange: (event) => setJumpDate(event.target.value) })] }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate(jumpDate || today), children: "Go" }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "calendar-search", children: "Search" }), _jsx("input", { id: "calendar-search", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "Search title" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-type-filter", children: "Type" }), _jsxs("select", { id: "calendar-type-filter", value: typeFilter, onChange: (event) => setTypeFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "todo", children: "Todos" }), _jsx("option", { value: "activity", children: "Activities" }), _jsx("option", { value: "meeting", children: "Meetings" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-visibility-filter", children: "Visibility" }), _jsxs("select", { id: "calendar-visibility-filter", value: visibilityFilter, onChange: (event) => setVisibilityFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "public", children: "Public" }), _jsx("option", { value: "private", children: "Private" })] })] })] })] }), _jsxs("div", { ref: layoutRef, className: `calendar-layout${isFullScreen ? " calendar-layout-fullscreen" : ""}`, style: { gridTemplateColumns: `minmax(0, 1fr) 8px ${detailsPaneWidth}px` }, children: [_jsx("div", { className: "calendar-main stack", children: _jsx("div", { ref: scrollRef, className: `calendar-scroll${isFullScreen ? " calendar-scroll-fullscreen" : ""}`, style: { ["--calendar-slot-height"]: `${slotHeight}px` }, children: _jsxs("div", { className: "calendar-surface", style: { gridTemplateColumns: `84px repeat(${visibleDates.length}, minmax(${dayColumnWidth}px, 1fr))`, gridTemplateRows: `52px repeat(${TOTAL_SLOTS}, var(--calendar-slot-height))` }, children: [_jsx("div", { className: "calendar-corner", style: { gridColumn: "1 / 2", gridRow: "1 / 2" } }), visibleDates.map((date, index) => _jsxs("div", { className: "calendar-day-header", style: { gridColumn: `${index + 2} / ${index + 3}`, gridRow: "1 / 2" }, children: [_jsx("strong", { children: date }), _jsx("span", { children: formatDay(date) })] }, date)), _jsx("div", { className: "calendar-time-column", style: { gridColumn: "1 / 2", gridRow: `2 / span ${TOTAL_SLOTS}` }, children: Array.from({ length: TOTAL_SLOTS }, (_, slot) => _jsx("div", { className: `calendar-time-cell${slot % 12 === 0 ? " calendar-time-cell-hour" : ""}`, style: { height: "var(--calendar-slot-height)" }, children: slot % 12 === 0 ? slotToTime(slot) : "" }, `time-${slot}`)) }), visibleDates.map((date, index) => {
                                        const dayItems = itemsByDate.get(date) ?? [];
                                        const active = draftCell?.date === date ? draftCell : null;
                                        return _jsxs("div", { className: "calendar-day-column", style: { gridColumn: `${index + 2} / ${index + 3}`, gridRow: `2 / span ${TOTAL_SLOTS}`, height: `calc(var(--calendar-slot-height) * ${TOTAL_SLOTS})` }, onClick: (event) => {
                                                const target = event.target;
                                                if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input"))
                                                    return;
                                                const rect = event.currentTarget.getBoundingClientRect();
                                                setSelectedItemId(null);
                                                setDraftCell({ date, slot: clampSlot(Math.floor((event.clientY - rect.top) / slotHeight)) });
                                                setDraftText("");
                                            }, onDragOver: (event) => {
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = "move";
                                            }, onDrop: (event) => {
                                                event.preventDefault();
                                                const draggedId = event.dataTransfer.getData("text/plain");
                                                if (!draggedId)
                                                    return;
                                                const rect = event.currentTarget.getBoundingClientRect();
                                                onMoveItem(draggedId, date, clampSlot(Math.floor((event.clientY - rect.top) / slotHeight)));
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
                                                        }, placeholder: "Type to add todo, act..., td..., or meet..." }) }) : null, dayItems.map((item) => {
                                                    const preview = resizeState?.itemId === item.id ? resizeState : null;
                                                    const startSlot = preview?.startSlot ?? item.startSlot;
                                                    const durationSlots = preview?.durationSlots ?? item.durationSlots;
                                                    const laneWidth = 100 / Math.max(1, item.laneCount);
                                                    const visualHeight = Math.max(slotHeight * Math.max(durationSlots, item.isMeeting ? 3 : 1) - 4, 18);
                                                    return _jsxs("button", { className: `calendar-item-block${item.isMeeting ? " calendar-item-block-meeting" : ""}${selectedItemId === item.id ? " calendar-item-block-selected" : ""}${visualHeight <= 22 ? " calendar-item-block-compact" : ""}`, type: "button", draggable: true, style: { top: `calc(var(--calendar-slot-height) * ${startSlot} + 2px)`, height: `${visualHeight}px`, width: `calc(${laneWidth}% - 8px)`, left: `calc(${item.lane * laneWidth}% + 4px)`, right: "auto" }, onDragStart: (event) => { event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }, onClick: () => { setDraftCell(null); setSelectedItemId(item.id); }, onDoubleClick: () => { if (item.targetType === "todo") {
                                                            onOpenTodoDetail(item.targetId);
                                                            return;
                                                        } onOpenActivityDetail(item.targetId); }, children: [item.isMeeting ? _jsx("span", { className: "calendar-resize-handle calendar-resize-handle-start", onMouseDown: (event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "start", date: item.date, startSlot, durationSlots }); } }) : null, _jsxs("strong", { children: [slotToTime(startSlot), " ", item.title] }), _jsx("span", { children: item.isMeeting ? `${item.label} • ${durationLabel(durationSlots)}` : item.label }), item.isMeeting ? _jsx("span", { className: "calendar-resize-handle calendar-resize-handle-end", onMouseDown: (event) => { event.preventDefault(); event.stopPropagation(); setResizeState({ itemId: item.id, edge: "end", date: item.date, startSlot, durationSlots }); } }) : null] }, item.id);
                                                })] }, `col-${date}`);
                                    })] }) }) }), _jsx("div", { className: "calendar-splitter", role: "separator", "aria-orientation": "vertical", onMouseDown: () => { splitterDraggingRef.current = true; document.body.style.cursor = "col-resize"; } }), _jsx("aside", { className: `calendar-editor-card${detailsPaneWidth <= 280 ? " calendar-editor-card-compact" : ""}`, children: editorDraft ? (_jsxs("div", { className: `stack${detailsPaneWidth <= 280 ? " calendar-editor-stack-compact" : ""}`, children: [_jsxs("div", { className: "card-header", children: [_jsx("div", { children: _jsx("h3", { children: editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity" }) }), _jsx("button", { className: "small-button", type: "button", onClick: () => setSelectedItemId(null), children: "Close" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-title", children: "Title" }), _jsx("input", { id: "calendar-edit-title", value: editorDraft.title, onChange: (event) => setEditorDraft({ ...editorDraft, title: event.target.value }) })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-date", children: "Date" }), _jsx("input", { id: "calendar-edit-date", type: "date", value: editorDraft.doOn, onChange: (event) => setEditorDraft({ ...editorDraft, doOn: event.target.value }) })] }), _jsxs("label", { className: "compact-private-toggle", children: [_jsx("input", { type: "checkbox", checked: editorDraft.isPrivate, onChange: (event) => setEditorDraft({ ...editorDraft, isPrivate: event.target.checked }) }), _jsx("span", { children: "Private" })] })] }), editorDraft.isMeeting ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-start", children: "Start" }), _jsx("input", { id: "calendar-edit-start", type: "time", step: 300, value: editorDraft.startTime, onChange: (event) => setEditorDraft({ ...editorDraft, startTime: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-end", children: "End" }), _jsx("input", { id: "calendar-edit-end", type: "time", step: 300, value: editorDraft.endTime, onChange: (event) => setEditorDraft({ ...editorDraft, endTime: event.target.value }) })] })] }), editorDraft.targetType === "activity" ? (_jsxs("div", { className: "field", children: [_jsx("label", { children: "Meeting session" }), _jsxs("div", { className: "calendar-linked-session-card", children: [_jsx("div", { className: "calendar-linked-session-status", children: linkedSessionStateByActivity[editorDraft.targetId]?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: linkedSessionStateByActivity[editorDraft.targetId]?.sessionTitle || "Linked meeting session" }), _jsx("span", { children: linkedSessionStateByActivity[editorDraft.targetId]?.hasOutput ? "Output available" : "No output yet" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: "No linked meeting session" }), _jsx("span", { children: "Create one when this calendar meeting should become a working notes session." })] })) }), _jsx("div", { className: "calendar-editor-actions", children: linkedSessionStateByActivity[editorDraft.targetId]?.sessionId ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                                            const sessionId = linkedSessionStateByActivity[editorDraft.targetId]?.sessionId;
                                                                            if (sessionId)
                                                                                onOpenSession(sessionId);
                                                                        }, children: "Open linked meeting session" }), linkedSessionStateByActivity[editorDraft.targetId]?.hasOutput ? (_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                                            const sessionId = linkedSessionStateByActivity[editorDraft.targetId]?.sessionId;
                                                                            if (sessionId)
                                                                                onPreviewSessionOutput(sessionId);
                                                                        }, children: "Open session output" })) : null] })) : (_jsx("button", { className: "shell-button", type: "button", onClick: () => onCreateLinkedMeetingSession(editorDraft.targetId), children: "Create linked meeting session" })) })] })] })) : null] })) : null, _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-domain", children: "Domain" }), _jsx("input", { id: "calendar-edit-domain", value: editorDraft.domain, onChange: (event) => setEditorDraft({ ...editorDraft, domain: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-project", children: "Project" }), _jsx("input", { id: "calendar-edit-project", value: editorDraft.project, onChange: (event) => setEditorDraft({ ...editorDraft, project: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-activity", children: "Activity" }), _jsx("input", { id: "calendar-edit-activity", value: editorDraft.activity, onChange: (event) => setEditorDraft({ ...editorDraft, activity: event.target.value }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-due", children: "Due date" }), _jsx("input", { id: "calendar-edit-due", type: "date", value: editorDraft.dueDate, onChange: (event) => setEditorDraft({ ...editorDraft, dueDate: event.target.value }) })] }), pendingDelete && pendingDelete.itemId === editorDraft.itemId ? (_jsxs("div", { className: "calendar-delete-confirmation", children: [_jsxs("strong", { children: ["Delete this ", editorDraft.isMeeting ? "meeting" : editorDraft.targetType, "?"] }), _jsxs("p", { className: "muted", children: ["\"", pendingDelete.title, "\" will be removed from the app and from the calendar."] }), _jsxs("div", { className: "calendar-delete-confirmation-actions", children: [_jsx("button", { className: "small-button danger-button", type: "button", onClick: confirmDeleteSelectedItem, children: "Delete" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setPendingDelete(null), children: "Cancel" })] })] })) : null, _jsxs("div", { className: "calendar-editor-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: saveEditor, children: "Save calendar edits" }), editorDraft.targetType === "todo" ? (_jsx("button", { className: "shell-button", type: "button", onClick: convertEditorTodoToMeeting, children: "Convert to meeting" })) : null, _jsxs("button", { className: "shell-button", type: "button", onClick: () => (editorDraft.targetType === "todo" ? onOpenTodoWorkspace() : onOpenActivityWorkspace(editorDraft.targetId)), children: ["Open full ", editorDraft.targetType === "todo" ? "todo" : "activity"] })] })] })) : (_jsxs("div", { className: "stack", children: [_jsx("h3", { children: "Calendar item" }), _jsx("p", { className: "muted", children: "Select a scheduled block to edit it here." })] })) })] })] }));
};
