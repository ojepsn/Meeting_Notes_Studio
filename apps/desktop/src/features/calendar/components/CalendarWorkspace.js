import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const SLOTS_PER_HOUR = 12;
const SLOT_COUNT = 24 * SLOTS_PER_HOUR;
const MINUTES_PER_SLOT = 5;
const DAY_EXTENSION_COUNT = 7;
const INITIAL_DAYS_BEFORE = 3;
const INITIAL_DAYS_AFTER = 10;
const TIME_COLUMN_WIDTH = 82;
const DAY_WIDTHS = [180, 220, 280];
const SLOT_HEIGHTS = [14, 18, 24];
const addDays = (date, days) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
};
const buildDateRange = (startDate, endDate) => {
    const dates = [];
    let cursor = startDate;
    while (cursor <= endDate) {
        dates.push(cursor);
        cursor = addDays(cursor, 1);
    }
    return dates;
};
const formatDayLabel = (date) => new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
}).format(new Date(`${date}T00:00:00`));
const slotToTimeLabel = (slot) => {
    const totalMinutes = slot * MINUTES_PER_SLOT;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
const slotFromPointer = (clientY, element, slotHeight) => {
    const bounds = element.getBoundingClientRect();
    const offset = Math.max(0, clientY - bounds.top);
    return Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(offset / slotHeight)));
};
export const CalendarWorkspace = ({ todos = [], activities = [], calendarItems = [], onCreateFromText, onMoveItem, onOpenTodoWorkspace, onOpenActivityWorkspace, }) => {
    const today = new Date().toISOString().slice(0, 10);
    const [rangeStart, setRangeStart] = useState(addDays(today, -INITIAL_DAYS_BEFORE));
    const [rangeEnd, setRangeEnd] = useState(addDays(today, INITIAL_DAYS_AFTER));
    const [dayScaleIndex, setDayScaleIndex] = useState(1);
    const [timeScaleIndex, setTimeScaleIndex] = useState(1);
    const [activeCell, setActiveCell] = useState(null);
    const [cellDraft, setCellDraft] = useState("");
    const scrollRef = useRef(null);
    const prependAdjustmentRef = useRef(null);
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
        const grouped = new Map();
        safeCalendarItems.forEach((item) => {
            const target = item.targetType === "todo" ? todoMap.get(item.targetId) : activityMap.get(item.targetId);
            if (!target) {
                return;
            }
            const renderItem = {
                ...item,
                label: target.description,
                kindLabel: item.targetType === "todo"
                    ? "Todo"
                    : target.type === "meeting"
                        ? "Meeting"
                        : "Activity",
                isMeeting: item.targetType === "activity" && target.type === "meeting",
            };
            const existing = grouped.get(item.date) ?? [];
            existing.push(renderItem);
            grouped.set(item.date, existing);
        });
        grouped.forEach((items, date) => {
            grouped.set(date, [...items].sort((left, right) => left.startSlot - right.startSlot || right.durationSlots - left.durationSlots));
        });
        return grouped;
    }, [safeActivities, safeCalendarItems, safeTodos]);
    const surfaceStyle = {
        ["--calendar-slot-height"]: `${slotHeight}px`,
        gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${dates.length}, ${dayWidth}px)`,
        gridTemplateRows: `52px ${SLOT_COUNT * slotHeight}px`,
    };
    useEffect(() => {
        if (!scrollRef.current || initializedScrollRef.current)
            return;
        const currentHour = new Date().getHours();
        scrollRef.current.scrollTop = Math.max(0, (currentHour * SLOTS_PER_HOUR - 6) * slotHeight);
        scrollRef.current.scrollLeft = INITIAL_DAYS_BEFORE * dayWidth;
        initializedScrollRef.current = true;
    }, [dayWidth, slotHeight]);
    useEffect(() => {
        if (!scrollRef.current || prependAdjustmentRef.current == null)
            return;
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
        if (!element)
            return;
        const threshold = dayWidth * 1.5;
        if (element.scrollLeft < threshold) {
            setRangeStart((current) => {
                prependAdjustmentRef.current = dayWidth * DAY_EXTENSION_COUNT;
                return addDays(current, -DAY_EXTENSION_COUNT);
            });
        }
        else if (element.scrollWidth - element.clientWidth - element.scrollLeft < threshold) {
            setRangeEnd((current) => addDays(current, DAY_EXTENSION_COUNT));
        }
    };
    return (_jsxs("div", { className: "card calendar-workspace", children: [_jsxs("div", { className: "card-header session-editor-header-minimal", children: [_jsx("div", { children: _jsx("h2", { children: "Calendar" }) }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                    setRangeStart(addDays(today, -INITIAL_DAYS_BEFORE));
                                    setRangeEnd(addDays(today, INITIAL_DAYS_AFTER));
                                    setActiveCell(null);
                                    setCellDraft("");
                                    initializedScrollRef.current = false;
                                }, children: "Today" }), _jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", type: "button", disabled: dayScaleIndex === 0, onClick: () => setDayScaleIndex((value) => Math.max(0, value - 1)), children: "Fewer days" }), _jsx("button", { className: "segment-button", type: "button", disabled: dayScaleIndex === DAY_WIDTHS.length - 1, onClick: () => setDayScaleIndex((value) => Math.min(DAY_WIDTHS.length - 1, value + 1)), children: "More detail" })] }), _jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", type: "button", disabled: timeScaleIndex === 0, onClick: () => setTimeScaleIndex((value) => Math.max(0, value - 1)), children: "More hours" }), _jsx("button", { className: "segment-button", type: "button", disabled: timeScaleIndex === SLOT_HEIGHTS.length - 1, onClick: () => setTimeScaleIndex((value) => Math.min(SLOT_HEIGHTS.length - 1, value + 1)), children: "More time detail" })] })] })] }), _jsx("div", { className: "workspace-guide-row workspace-guide-row-quiet", children: _jsx("span", { className: "tiny-text", children: "Type directly into a slot to create a todo, or use `td`, `act`, or `meet` prefixes. Drag blocks to reschedule them." }) }), _jsx("div", { className: "calendar-scroll", ref: scrollRef, onScroll: handleScroll, children: _jsxs("div", { className: "calendar-surface", style: surfaceStyle, children: [_jsx("div", { className: "calendar-corner" }), dates.map((date) => (_jsxs("div", { className: "calendar-day-header", children: [_jsx("strong", { children: date }), _jsx("span", { children: formatDayLabel(date) })] }, `header-${date}`))), _jsx("div", { className: "calendar-time-column", children: Array.from({ length: SLOT_COUNT }, (_, slot) => (_jsx("div", { className: `calendar-time-cell${slot % SLOTS_PER_HOUR === 0 ? " calendar-time-cell-hour" : ""}`, style: { height: slotHeight }, children: _jsx("span", { children: slotToTimeLabel(slot) }) }, `time-${slot}`))) }), dates.map((date) => (_jsxs("div", { className: "calendar-day-column", style: { height: SLOT_COUNT * slotHeight }, children: [_jsx("div", { className: "calendar-day-interaction-layer", style: { height: SLOT_COUNT * slotHeight }, onClick: (event) => {
                                        const target = event.currentTarget;
                                        const slot = slotFromPointer(event.clientY, target, slotHeight);
                                        setActiveCell({ date, slot });
                                        setCellDraft("");
                                    }, onDragOver: (event) => {
                                        event.preventDefault();
                                    }, onDrop: (event) => {
                                        event.preventDefault();
                                        const itemId = event.dataTransfer.getData("text/plain");
                                        if (!itemId)
                                            return;
                                        const target = event.currentTarget;
                                        const slot = slotFromPointer(event.clientY, target, slotHeight);
                                        onMoveItem(itemId, date, slot);
                                    } }), activeCell?.date === date ? (_jsx("div", { className: "calendar-active-cell", style: {
                                        top: activeCell.slot * slotHeight,
                                        height: slotHeight,
                                    }, children: _jsx("input", { autoFocus: true, className: "calendar-cell-input", value: cellDraft, onChange: (event) => setCellDraft(event.target.value), onBlur: commitCellDraft, onKeyDown: (event) => {
                                            if (event.key === "Enter" && !event.shiftKey) {
                                                event.preventDefault();
                                                commitCellDraft();
                                            }
                                            if (event.key === "Escape") {
                                                setActiveCell(null);
                                                setCellDraft("");
                                            }
                                        }, placeholder: "Add todo, act, or meet" }) })) : null, (itemsByDate.get(date) ?? []).map((item) => (_jsxs("button", { className: `calendar-item-block${item.isMeeting ? " calendar-item-block-meeting" : ""}`, style: {
                                        top: item.startSlot * slotHeight + 1,
                                        height: Math.max(slotHeight - 2, item.durationSlots * slotHeight - 2),
                                    }, draggable: true, type: "button", onDragStart: (event) => event.dataTransfer.setData("text/plain", item.id), onDoubleClick: () => {
                                        if (item.targetType === "todo") {
                                            onOpenTodoWorkspace();
                                        }
                                        else {
                                            onOpenActivityWorkspace(item.targetId);
                                        }
                                    }, children: [_jsx("strong", { children: item.label }), _jsx("span", { children: item.kindLabel })] }, item.id)))] }, date)))] }) })] }));
};
