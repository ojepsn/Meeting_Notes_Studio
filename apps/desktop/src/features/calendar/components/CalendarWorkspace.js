import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
const TOTAL_SLOTS = 24 * 12;
const MINUTES_PER_SLOT = 5;
const DEFAULT_DAYS_IN_VIEW = 3;
const DAYS_IN_VIEW_OPTIONS = [3, 5, 7, 14];
const SLOT_HEIGHT_OPTIONS = [12, 16, 22];
const addDays = (date, days) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
};
const formatDayLabel = (date) => {
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
const slotToTimeLabel = (slot) => {
    const totalMinutes = slot * MINUTES_PER_SLOT;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
const timeToSlot = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return 0;
    }
    return hours * 12 + Math.floor(minutes / MINUTES_PER_SLOT);
};
const clampSlot = (slot) => Math.max(0, Math.min(TOTAL_SLOTS - 1, slot));
const durationFromTimes = (startTime, endTime) => Math.max(1, timeToSlot(endTime) - timeToSlot(startTime));
const durationLabel = (durationSlots) => {
    const minutes = durationSlots * MINUTES_PER_SLOT;
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
};
export const CalendarWorkspace = ({ todos, activities, calendarItems, linkedSessionIdsByActivity, onCreateFromText, onMoveItem, onSaveTodo, onSaveActivity, onUpdateCalendarItem, onOpenTodoWorkspace, onOpenActivityWorkspace, onOpenSession, onFullScreenChange, }) => {
    const today = new Date().toISOString().slice(0, 10);
    const safeTodos = Array.isArray(todos) ? todos : [];
    const safeActivities = Array.isArray(activities) ? activities : [];
    const safeCalendarItems = Array.isArray(calendarItems) ? calendarItems : [];
    const [anchorDate, setAnchorDate] = useState(today);
    const [daysInView, setDaysInView] = useState(DEFAULT_DAYS_IN_VIEW);
    const [slotHeight, setSlotHeight] = useState(16);
    const [activeCell, setActiveCell] = useState(null);
    const [draftText, setDraftText] = useState("");
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [editorDraft, setEditorDraft] = useState(null);
    const [jumpDate, setJumpDate] = useState(today);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [visibilityFilter, setVisibilityFilter] = useState("all");
    const [resizeState, setResizeState] = useState(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    useEffect(() => {
        onFullScreenChange?.(isFullScreen);
        return () => {
            onFullScreenChange?.(false);
        };
    }, [isFullScreen, onFullScreenChange]);
    const visibleDates = useMemo(() => Array.from({ length: daysInView }, (_, index) => addDays(anchorDate, index)), [anchorDate, daysInView]);
    const items = useMemo(() => {
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
                    targetType: "todo",
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
                targetType: "activity",
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
            .filter((item) => item !== null)
            .sort((left, right) => {
            if (left.date !== right.date) {
                return left.date.localeCompare(right.date);
            }
            if (left.startSlot !== right.startSlot) {
                return left.startSlot - right.startSlot;
            }
            return left.title.localeCompare(right.title);
        });
        const itemsByDate = new Map();
        baseItems.forEach((item) => {
            const existing = itemsByDate.get(item.date) ?? [];
            existing.push(item);
            itemsByDate.set(item.date, existing);
        });
        const laidOutItems = [];
        itemsByDate.forEach((dayItems) => {
            const lanesEnd = [];
            dayItems.forEach((item) => {
                const endSlot = item.startSlot + Math.max(1, item.durationSlots);
                let laneIndex = lanesEnd.findIndex((laneEnd) => laneEnd <= item.startSlot);
                if (laneIndex === -1) {
                    laneIndex = lanesEnd.length;
                    lanesEnd.push(endSlot);
                }
                else {
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
            if (!normalizedSearch)
                return true;
            return [item.title, item.domain, item.project, item.activity, item.label].join(" ").toLowerCase().includes(normalizedSearch);
        });
    }, [items, searchQuery, typeFilter, visibilityFilter]);
    const itemsByDate = useMemo(() => {
        const grouped = new Map();
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
            endTime: activity.type === "meeting"
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
        const handleMouseMove = (event) => {
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
    const handleActivateCell = (date, slot) => {
        setSelectedItemId(null);
        setActiveCell({ date, slot: clampSlot(slot) });
        setDraftText("");
    };
    const moveActiveCell = (deltaDays, deltaSlots) => {
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
        }
        else {
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
    return (_jsxs("div", { className: `card calendar-workspace${isFullScreen ? " calendar-workspace-fullscreen" : ""}`, children: [_jsxs("div", { className: "card-header session-editor-header-minimal", children: [_jsxs("div", { children: [_jsx("h2", { children: "Calendar" }), _jsx("p", { className: "tiny-text", children: "Lightweight planner grid with one active input and direct in-calendar editing." })] }), _jsxs("div", { className: "page-actions wrap-row", children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate((current) => addDays(current, -daysInView)), children: "Previous" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate(today), children: "Today" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate((current) => addDays(current, daysInView)), children: "Next" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate((current) => addDays(current, 30)), children: "+30 days" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setIsFullScreen((current) => !current), children: isFullScreen ? "Exit full screen" : "Full screen" })] })] }), _jsxs("div", { className: "calendar-calendar-summary", children: [_jsxs("div", { className: "status-chip", children: [visibleItems.length, " scheduled items"] }), _jsx("div", { className: "capture-density-toggle", role: "group", "aria-label": "Days in view", children: DAYS_IN_VIEW_OPTIONS.map((option) => (_jsxs("button", { className: "segment-button", type: "button", "data-active": option === daysInView, onClick: () => setDaysInView(option), children: [option, " days"] }, `days-${option}`))) }), _jsx("div", { className: "capture-density-toggle", role: "group", "aria-label": "Calendar scale", children: SLOT_HEIGHT_OPTIONS.map((option) => (_jsx("button", { className: "segment-button", type: "button", "data-active": option === slotHeight, onClick: () => setSlotHeight(option), children: option === 12 ? "Compact" : option === 16 ? "Default" : "Large" }, `scale-${option}`))) })] }), _jsxs("div", { className: "calendar-toolbar", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-jump-date", children: "Jump to date" }), _jsx("input", { id: "calendar-jump-date", type: "date", value: jumpDate, onChange: (event) => setJumpDate(event.target.value) })] }), _jsx("button", { className: "shell-button", type: "button", onClick: () => setAnchorDate(jumpDate || today), children: "Go" }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "calendar-search", children: "Search" }), _jsx("input", { id: "calendar-search", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "Search title, domain, project, activity" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-type-filter", children: "Type" }), _jsxs("select", { id: "calendar-type-filter", value: typeFilter, onChange: (event) => setTypeFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "todo", children: "Todos" }), _jsx("option", { value: "activity", children: "Activities" }), _jsx("option", { value: "meeting", children: "Meetings" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-visibility-filter", children: "Visibility" }), _jsxs("select", { id: "calendar-visibility-filter", value: visibilityFilter, onChange: (event) => setVisibilityFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "public", children: "Public" }), _jsx("option", { value: "private", children: "Private" })] })] })] }), _jsxs("div", { className: `calendar-layout${isFullScreen ? " calendar-layout-fullscreen" : ""}`, children: [_jsxs("div", { className: "calendar-main stack", children: [_jsx("div", { className: `calendar-scroll${isFullScreen ? " calendar-scroll-fullscreen" : ""}`, style: { ["--calendar-slot-height"]: `${slotHeight}px` }, children: _jsxs("div", { className: "calendar-surface", style: {
                                        gridTemplateColumns: `84px repeat(${visibleDates.length}, minmax(220px, 1fr))`,
                                        gridTemplateRows: `52px repeat(${TOTAL_SLOTS}, var(--calendar-slot-height))`,
                                    }, children: [_jsx("div", { className: "calendar-corner", style: { gridColumn: "1 / 2", gridRow: "1 / 2" } }), visibleDates.map((date, index) => (_jsxs("div", { className: "calendar-day-header", style: { gridColumn: `${index + 2} / ${index + 3}`, gridRow: "1 / 2" }, children: [_jsx("strong", { children: date }), _jsx("span", { children: formatDayLabel(date) })] }, `header-${date}`))), _jsx("div", { className: "calendar-time-column", style: { gridColumn: "1 / 2", gridRow: `2 / span ${TOTAL_SLOTS}` }, children: Array.from({ length: TOTAL_SLOTS }, (_, slot) => (_jsx("div", { className: `calendar-time-cell${slot % 12 === 0 ? " calendar-time-cell-hour" : ""}`, style: { height: "var(--calendar-slot-height)" }, children: slot % 12 === 0 ? slotToTimeLabel(slot) : "" }, `time-${slot}`))) }), visibleDates.map((date, index) => {
                                            const dayItems = itemsByDate.get(date) ?? [];
                                            const activeForDay = activeCell?.date === date ? activeCell : null;
                                            return (_jsxs("div", { className: "calendar-day-column", style: {
                                                    gridColumn: `${index + 2} / ${index + 3}`,
                                                    gridRow: `2 / span ${TOTAL_SLOTS}`,
                                                    height: `calc(var(--calendar-slot-height) * ${TOTAL_SLOTS})`,
                                                }, onClick: (event) => {
                                                    const target = event.target;
                                                    if (target.closest(".calendar-item-block") || target.closest(".calendar-cell-input")) {
                                                        return;
                                                    }
                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                    const clickedSlot = clampSlot(Math.floor((event.clientY - rect.top) / slotHeight));
                                                    handleActivateCell(date, clickedSlot);
                                                }, onDragOver: (event) => event.preventDefault(), onDrop: (event) => {
                                                    const draggedId = event.dataTransfer.getData("text/plain");
                                                    if (!draggedId) {
                                                        return;
                                                    }
                                                    event.preventDefault();
                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                    const nextSlot = clampSlot(Math.floor((event.clientY - rect.top) / slotHeight));
                                                    onMoveItem(draggedId, date, nextSlot);
                                                }, children: [_jsx("div", { className: "calendar-day-interaction-layer" }), activeForDay ? (_jsx("div", { className: "calendar-active-cell", style: {
                                                            top: `calc(var(--calendar-slot-height) * ${activeForDay.slot})`,
                                                            height: "var(--calendar-slot-height)",
                                                        }, children: _jsx("input", { className: "calendar-cell-input", autoFocus: true, value: draftText, onChange: (event) => setDraftText(event.target.value), onBlur: handleCommitActiveCell, onKeyDown: (event) => {
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
                                                            }, placeholder: "Type to add todo, act..., td..., or meet..." }) })) : null, dayItems.map((item) => {
                                                        const resizePreview = resizeState?.itemId === item.id
                                                            ? {
                                                                startSlot: resizeState.currentStartSlot,
                                                                durationSlots: resizeState.currentDurationSlots,
                                                            }
                                                            : null;
                                                        const startSlot = resizePreview?.startSlot ?? item.startSlot;
                                                        const durationSlots = resizePreview?.durationSlots ?? item.durationSlots;
                                                        const visualHeight = Math.max(slotHeight * Math.max(durationSlots, item.isMeeting ? 3 : 1) - 4, 18);
                                                        const laneWidth = 100 / Math.max(1, item.laneCount);
                                                        return (_jsxs("button", { className: `calendar-item-block${item.isMeeting ? " calendar-item-block-meeting" : ""}${selectedItemId === item.id ? " calendar-item-block-selected" : ""}${visualHeight <= 22 ? " calendar-item-block-compact" : ""}`, type: "button", draggable: true, style: {
                                                                top: `calc(var(--calendar-slot-height) * ${startSlot} + 2px)`,
                                                                height: `${visualHeight}px`,
                                                                width: `calc(${laneWidth}% - 8px)`,
                                                                left: `calc(${item.lane * laneWidth}% + 4px)`,
                                                                right: "auto",
                                                            }, onDragStart: (event) => {
                                                                event.dataTransfer.setData("text/plain", item.id);
                                                                event.dataTransfer.effectAllowed = "move";
                                                            }, onClick: () => {
                                                                setActiveCell(null);
                                                                setSelectedItemId(item.id);
                                                            }, children: [item.isMeeting ? (_jsx("span", { className: "calendar-resize-handle calendar-resize-handle-start", onMouseDown: (event) => {
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
                                                                    } })) : null, _jsxs("strong", { children: [slotToTimeLabel(startSlot), " ", item.title] }), _jsx("span", { children: item.isMeeting ? `${item.label} • ${durationLabel(durationSlots)}` : `${item.label}${item.isPrivate ? " • Private" : ""}` }), item.isMeeting ? (_jsx("span", { className: "calendar-resize-handle calendar-resize-handle-end", onMouseDown: (event) => {
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
                                                                    } })) : null] }, item.id));
                                                    })] }, `column-${date}`));
                                        })] }) }), _jsx("div", { className: "calendar-agenda-list", children: visibleDates.map((date) => {
                                    const itemsForDay = itemsByDate.get(date) ?? [];
                                    return (_jsxs("section", { className: "calendar-agenda-day", children: [_jsxs("div", { className: "calendar-agenda-day-header", children: [_jsx("strong", { children: formatDayLabel(date) }), _jsx("span", { children: date })] }), itemsForDay.length ? (itemsForDay.map((item) => (_jsxs("button", { className: `calendar-agenda-item${item.isMeeting ? " calendar-agenda-item-meeting" : ""}`, type: "button", onClick: () => setSelectedItemId(item.id), children: [_jsxs("strong", { children: [slotToTimeLabel(item.startSlot), " ", item.title] }), _jsx("span", { children: item.isMeeting ? `${item.label} • ${durationLabel(item.durationSlots)}` : item.label })] }, `agenda-item-${item.id}`)))) : (_jsx("div", { className: "calendar-agenda-empty", children: "No scheduled items" }))] }, `agenda-${date}`));
                                }) })] }), _jsx("aside", { className: "calendar-editor-card", children: editorDraft ? (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity" }), _jsx("p", { children: editorDraft.isMeeting ? "Edit the meeting directly from the calendar." : "Adjust the essentials without leaving the planner." })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => setSelectedItemId(null), children: "Close" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-title", children: "Title" }), _jsx("input", { id: "calendar-edit-title", value: editorDraft.title, onChange: (event) => setEditorDraft({ ...editorDraft, title: event.target.value }) })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-date", children: "Date" }), _jsx("input", { id: "calendar-edit-date", type: "date", value: editorDraft.doOn, onChange: (event) => setEditorDraft({ ...editorDraft, doOn: event.target.value }) })] }), _jsxs("label", { className: "compact-private-toggle", children: [_jsx("input", { type: "checkbox", checked: editorDraft.isPrivate, onChange: (event) => setEditorDraft({ ...editorDraft, isPrivate: event.target.checked }) }), _jsx("span", { children: "Private" })] })] }), editorDraft.isMeeting ? (_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-start", children: "Start" }), _jsx("input", { id: "calendar-edit-start", type: "time", step: 300, value: editorDraft.startTime, onChange: (event) => {
                                                        const nextStart = event.target.value;
                                                        const nextDuration = durationFromTimes(editorDraft.startTime || nextStart, editorDraft.endTime || nextStart) || editorDraft.durationSlots;
                                                        const nextEnd = slotToTimeLabel(timeToSlot(nextStart) + Math.max(1, nextDuration));
                                                        setEditorDraft({ ...editorDraft, startTime: nextStart, endTime: nextEnd });
                                                    } })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-end", children: "End" }), _jsx("input", { id: "calendar-edit-end", type: "time", step: 300, value: editorDraft.endTime, onChange: (event) => setEditorDraft({ ...editorDraft, endTime: event.target.value }) })] })] })) : (_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-time", children: "Time" }), _jsx("input", { id: "calendar-edit-time", type: "time", step: 300, value: editorDraft.startTime, onChange: (event) => setEditorDraft({ ...editorDraft, startTime: event.target.value }) })] })), _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-domain", children: "Domain" }), _jsx("input", { id: "calendar-edit-domain", value: editorDraft.domain, onChange: (event) => setEditorDraft({ ...editorDraft, domain: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-project", children: "Project" }), _jsx("input", { id: "calendar-edit-project", value: editorDraft.project, onChange: (event) => setEditorDraft({ ...editorDraft, project: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "calendar-edit-activity", children: "Activity" }), _jsx("input", { id: "calendar-edit-activity", value: editorDraft.activity, onChange: (event) => setEditorDraft({ ...editorDraft, activity: event.target.value }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "calendar-edit-due", children: "Due date" }), _jsx("input", { id: "calendar-edit-due", type: "date", value: editorDraft.dueDate, onChange: (event) => setEditorDraft({ ...editorDraft, dueDate: event.target.value }) })] }), _jsxs("div", { className: "calendar-editor-meta", children: [_jsx("span", { className: "status-chip", children: editorDraft.isMeeting ? "Meeting" : editorDraft.targetType === "todo" ? "Todo" : "Activity" }), editorDraft.isPrivate ? _jsx("span", { className: "status-chip", children: "Private" }) : null, editorDraft.domain ? _jsx("span", { className: "status-chip", children: editorDraft.domain }) : null, editorDraft.project ? _jsx("span", { className: "status-chip", children: editorDraft.project }) : null] }), _jsxs("div", { className: "calendar-editor-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: handleSaveEditor, children: "Save calendar edits" }), _jsxs("button", { className: "shell-button", type: "button", onClick: () => {
                                                if (editorDraft.targetType === "todo") {
                                                    onOpenTodoWorkspace();
                                                    return;
                                                }
                                                onOpenActivityWorkspace(editorDraft.targetId);
                                            }, children: ["Open full ", editorDraft.targetType === "todo" ? "todo" : "activity"] }), editorDraft.targetType === "activity" && linkedSessionIdsByActivity[editorDraft.targetId] ? (_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                const linkedSessionId = linkedSessionIdsByActivity[editorDraft.targetId];
                                                if (linkedSessionId) {
                                                    onOpenSession(linkedSessionId);
                                                }
                                            }, children: "Open linked meeting session" })) : null] })] })) : (_jsxs("div", { className: "stack", children: [_jsx("h3", { children: "Calendar item" }), _jsx("p", { className: "muted", children: "Select a scheduled block to edit it here. Meetings now stand out more clearly and can be adjusted directly in Calendar." })] })) })] })] }));
};
