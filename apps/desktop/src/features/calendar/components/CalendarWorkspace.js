import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
const MINUTES_PER_SLOT = 5;
const RANGE_SHIFT_DAYS = 7;
const INITIAL_DAYS_BEFORE = 7;
const INITIAL_DAYS_AFTER = 21;
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
export const CalendarWorkspace = ({ todos = [], activities = [], calendarItems = [], onOpenTodoWorkspace, onOpenActivityWorkspace, }) => {
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
    return (_jsxs("div", { className: "card calendar-workspace", children: [_jsxs("div", { className: "card-header session-editor-header-minimal", children: [_jsx("div", { children: _jsx("h2", { children: "Calendar" }) }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                    setRangeStart((current) => addDays(current, -RANGE_SHIFT_DAYS));
                                    setRangeEnd((current) => addDays(current, -RANGE_SHIFT_DAYS));
                                }, children: "Previous" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                    setRangeStart(addDays(today, -INITIAL_DAYS_BEFORE));
                                    setRangeEnd(addDays(today, INITIAL_DAYS_AFTER));
                                }, children: "Today" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                    setRangeStart((current) => addDays(current, RANGE_SHIFT_DAYS));
                                    setRangeEnd((current) => addDays(current, RANGE_SHIFT_DAYS));
                                }, children: "Next" })] })] }), _jsx("div", { className: "workspace-guide-row workspace-guide-row-quiet", children: _jsx("span", { className: "tiny-text", children: "Calendar is temporarily running in a stable agenda mode while the interactive time-grid is rebuilt in smaller steps." }) }), _jsxs("div", { className: "calendar-calendar-summary", children: [_jsxs("div", { className: "status-chip", children: [dates.length, " days in view"] }), _jsxs("div", { className: "status-chip", children: [safeCalendarItems.length, " scheduled items"] }), _jsx("div", { className: "status-chip", children: "Interactive grid temporarily disabled" })] }), _jsx("div", { className: "calendar-agenda-list", children: dates.map((date) => {
                    const items = itemsByDate.get(date) ?? [];
                    return (_jsxs("div", { className: "calendar-agenda-day", children: [_jsxs("div", { className: "calendar-agenda-day-header", children: [_jsx("strong", { children: date }), _jsx("span", { children: formatDayLabel(date) })] }), items.length ? (items.map((item) => (_jsxs("button", { className: `calendar-agenda-item${item.isMeeting ? " calendar-agenda-item-meeting" : ""}`, type: "button", onClick: () => {
                                    if (item.targetType === "todo") {
                                        onOpenTodoWorkspace();
                                    }
                                    else {
                                        onOpenActivityWorkspace(item.targetId);
                                    }
                                }, children: [_jsxs("strong", { children: [slotToTimeLabel(item.startSlot), " ", item.label] }), _jsx("span", { children: item.kindLabel })] }, `agenda-item-${item.id}`)))) : (_jsx("div", { className: "calendar-agenda-empty", children: "No scheduled items" }))] }, `agenda-${date}`));
                }) })] }));
};
