import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { DateInput } from "../../../components/DateInput";
import { calculateLiveDurationMinutes, formatTrackedMinutes, isTimeLogRunning } from "../../../lib/time/tracking";
const formatDateInput = (date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
const shiftDays = (value, days) => {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return formatDateInput(date);
};
const formatMinutes = (minutes) => formatTrackedMinutes(minutes);
const getWeekStart = (value) => {
    const date = new Date(`${value}T00:00:00`);
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    return date;
};
const getWeekKey = (value) => {
    const weekStart = getWeekStart(value);
    const thursday = new Date(weekStart);
    thursday.setDate(weekStart.getDate() + 3);
    const year = thursday.getFullYear();
    const januaryFourth = new Date(year, 0, 4);
    const januaryFourthWeekStart = getWeekStart(formatDateInput(januaryFourth));
    const diffDays = Math.round((weekStart.getTime() - januaryFourthWeekStart.getTime()) / 86400000);
    const weekNumber = Math.floor(diffDays / 7) + 1;
    return `${year}-W${String(weekNumber).padStart(2, "0")}`;
};
const getMonthKey = (value) => value.slice(0, 7);
const buildRangeFromPreset = (preset, now = new Date()) => {
    const today = formatDateInput(now);
    if (preset === "30d")
        return { fromDate: shiftDays(today, -29), toDate: today };
    if (preset === "90d")
        return { fromDate: shiftDays(today, -89), toDate: today };
    return { fromDate: shiftDays(today, -364), toDate: today };
};
const formatBucketLabel = (bucketKey, granularity) => {
    if (granularity === "daily")
        return bucketKey;
    if (granularity === "weekly")
        return bucketKey.replace("-W", " week ");
    return bucketKey;
};
const buildBucketKey = (value, granularity) => {
    if (granularity === "daily")
        return value;
    if (granularity === "weekly")
        return getWeekKey(value);
    return getMonthKey(value);
};
const topSlice = (entries, count = 10) => entries.slice(0, count);
export const AnalyticsWorkspace = ({ todos, archivedTasks, activities, timeLogs, onOpenTodoDetail, onOpenActivityDetail, }) => {
    const defaultRange = buildRangeFromPreset("90d");
    const [timelineGranularity, setTimelineGranularity] = useState("weekly");
    const [rangePreset, setRangePreset] = useState("90d");
    const [fromDate, setFromDate] = useState(defaultRange.fromDate);
    const [toDate, setToDate] = useState(defaultRange.toDate);
    const [projectFilter, setProjectFilter] = useState("all");
    const [domainFilter, setDomainFilter] = useState("all");
    const [activityFilter, setActivityFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const hasRunningLog = timeLogs.some((entry) => isTimeLogRunning(entry));
        if (!hasRunningLog)
            return;
        const intervalId = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(intervalId);
    }, [timeLogs]);
    const todoLookup = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo])), [todos]);
    const archivedTaskLookup = useMemo(() => Object.fromEntries(archivedTasks.map((task) => [task.id, task])), [archivedTasks]);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
    const enrichedLogs = useMemo(() => timeLogs.map((log) => {
        if (log.targetType === "todo") {
            const todo = todoLookup[log.targetId];
            const archivedTask = todo ? null : archivedTaskLookup[log.targetId];
            const linkedActivity = todo?.activityId ? activityLookup[todo.activityId] : null;
            return {
                ...log,
                title: todo?.description || archivedTask?.title || "Deleted task",
                contextLabel: linkedActivity?.description ||
                    todo?.project ||
                    archivedTask?.project ||
                    todo?.domain ||
                    archivedTask?.domain ||
                    "Archived task",
                domain: linkedActivity?.domain || todo?.domain || archivedTask?.domain || "No domain",
                project: linkedActivity?.project || todo?.project || archivedTask?.project || "No project",
                activityLabel: linkedActivity?.description || todo?.activity || archivedTask?.activity || "No activity",
                workKind: "Task",
                effectiveMinutes: isTimeLogRunning(log) ? calculateLiveDurationMinutes(log, now) : log.durationMinutes,
                isArchivedTarget: !todo && Boolean(archivedTask),
            };
        }
        const activity = activityLookup[log.targetId];
        return {
            ...log,
            title: activity?.description || "Deleted activity",
            contextLabel: activity?.project || activity?.domain || "Activity",
            domain: activity?.domain || "No domain",
            project: activity?.project || "No project",
            activityLabel: activity?.description || "No activity",
            workKind: activity?.type === "meeting" ? "Meeting" : "Activity",
            effectiveMinutes: isTimeLogRunning(log) ? calculateLiveDurationMinutes(log, now) : log.durationMinutes,
        };
    }), [activityLookup, archivedTaskLookup, now, timeLogs, todoLookup]);
    const projectOptions = useMemo(() => Array.from(new Set(enrichedLogs.map((log) => log.project || "No project"))).sort(), [enrichedLogs]);
    const domainOptions = useMemo(() => Array.from(new Set(enrichedLogs.map((log) => log.domain || "No domain"))).sort(), [enrichedLogs]);
    const activityOptions = useMemo(() => Array.from(new Set(enrichedLogs.map((log) => log.activityLabel || "No activity"))).sort(), [enrichedLogs]);
    const filteredLogs = useMemo(() => enrichedLogs.filter((log) => {
        if (fromDate && log.date < fromDate)
            return false;
        if (toDate && log.date > toDate)
            return false;
        if (projectFilter !== "all" && log.project !== projectFilter)
            return false;
        if (domainFilter !== "all" && log.domain !== domainFilter)
            return false;
        if (activityFilter !== "all" && log.activityLabel !== activityFilter)
            return false;
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLocaleLowerCase();
            const haystack = `${log.title} ${log.contextLabel} ${log.project} ${log.domain} ${log.activityLabel} ${log.notes}`.toLocaleLowerCase();
            if (!haystack.includes(query))
                return false;
        }
        return true;
    }), [activityFilter, domainFilter, enrichedLogs, fromDate, projectFilter, searchQuery, toDate]);
    const totalMinutes = useMemo(() => filteredLogs.reduce((sum, log) => sum + log.effectiveMinutes, 0), [filteredLogs]);
    const activeDays = useMemo(() => new Set(filteredLogs.map((log) => log.date)).size, [filteredLogs]);
    const averagePerActiveDay = activeDays ? Math.round(totalMinutes / activeDays) : 0;
    const runningLogs = useMemo(() => filteredLogs.filter((log) => isTimeLogRunning(log)), [filteredLogs]);
    const timelineBuckets = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => {
            const key = buildBucketKey(log.date, timelineGranularity);
            grouped.set(key, (grouped.get(key) || 0) + log.effectiveMinutes);
        });
        return Array.from(grouped.entries())
            .map(([bucketKey, minutes]) => ({
            bucketKey,
            label: formatBucketLabel(bucketKey, timelineGranularity),
            minutes,
        }))
            .sort((left, right) => left.bucketKey.localeCompare(right.bucketKey));
    }, [filteredLogs, timelineGranularity]);
    const topItems = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => {
            const key = `${log.targetType}:${log.targetId}`;
            const existing = grouped.get(key) || {
                label: log.title,
                contextLabel: log.contextLabel,
                minutes: 0,
                targetType: log.targetType,
                targetId: log.targetId,
                isArchivedTarget: log.isArchivedTarget,
            };
            existing.minutes += log.effectiveMinutes;
            grouped.set(key, existing);
        });
        return Array.from(grouped.values()).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [filteredLogs]);
    const topProjects = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => grouped.set(log.project, (grouped.get(log.project) || 0) + log.effectiveMinutes));
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [filteredLogs]);
    const topDomains = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => grouped.set(log.domain, (grouped.get(log.domain) || 0) + log.effectiveMinutes));
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [filteredLogs]);
    const topActivities = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => grouped.set(log.activityLabel, (grouped.get(log.activityLabel) || 0) + log.effectiveMinutes));
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [filteredLogs]);
    const workKindTotals = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => grouped.set(log.workKind, (grouped.get(log.workKind) || 0) + log.effectiveMinutes));
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [filteredLogs]);
    const busiestBucket = timelineBuckets.length
        ? timelineBuckets.reduce((best, entry) => (entry.minutes > best.minutes ? entry : best), timelineBuckets[0])
        : null;
    const topItem = topItems[0] ?? null;
    const maxBucketMinutes = Math.max(1, ...timelineBuckets.map((entry) => entry.minutes));
    const totalTrackedLabel = timelineGranularity === "daily" ? "Average active day" : timelineGranularity === "weekly" ? "Average active week" : "Average active month";
    const averagePerBucket = timelineBuckets.length ? Math.round(totalMinutes / timelineBuckets.length) : 0;
    const applyRangePreset = (preset) => {
        const nextRange = buildRangeFromPreset(preset);
        setRangePreset(preset);
        setFromDate(nextRange.fromDate);
        setToDate(nextRange.toDate);
    };
    return (_jsxs("div", { className: "card analytics-workspace-card", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsxs("div", { children: [_jsx("h2", { children: "Analytics" }), _jsx("p", { className: "muted", children: "Timelog summaries, trends, and rollups across tasks, meetings, projects, and domains." })] }) }), _jsxs("div", { className: "analytics-toolbar", children: [_jsxs("div", { className: "analytics-toolbar-group", children: [_jsx("span", { className: "tiny-text analytics-toolbar-label", children: "Timeline" }), _jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", "data-active": timelineGranularity === "daily", type: "button", onClick: () => setTimelineGranularity("daily"), children: "Daily" }), _jsx("button", { className: "segment-button", "data-active": timelineGranularity === "weekly", type: "button", onClick: () => setTimelineGranularity("weekly"), children: "Weekly" }), _jsx("button", { className: "segment-button", "data-active": timelineGranularity === "monthly", type: "button", onClick: () => setTimelineGranularity("monthly"), children: "Monthly" })] })] }), _jsxs("div", { className: "analytics-toolbar-group", children: [_jsx("span", { className: "tiny-text analytics-toolbar-label", children: "Window" }), _jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", "data-active": rangePreset === "30d", type: "button", onClick: () => applyRangePreset("30d"), children: "30 days" }), _jsx("button", { className: "segment-button", "data-active": rangePreset === "90d", type: "button", onClick: () => applyRangePreset("90d"), children: "90 days" }), _jsx("button", { className: "segment-button", "data-active": rangePreset === "365d", type: "button", onClick: () => applyRangePreset("365d"), children: "12 months" }), _jsx("button", { className: "segment-button", "data-active": rangePreset === "custom", type: "button", onClick: () => setRangePreset("custom"), children: "Custom" })] })] })] }), _jsxs("div", { className: "analytics-filter-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-from-date", children: "From" }), _jsx(DateInput, { id: "analytics-from-date", value: fromDate, onChange: (event) => {
                                    setRangePreset("custom");
                                    setFromDate(event.target.value);
                                } })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-to-date", children: "To" }), _jsx(DateInput, { id: "analytics-to-date", value: toDate, onChange: (event) => {
                                    setRangePreset("custom");
                                    setToDate(event.target.value);
                                } })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-project-filter", children: "Project" }), _jsxs("select", { id: "analytics-project-filter", value: projectFilter, onChange: (event) => setProjectFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), projectOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-domain-filter", children: "Domain" }), _jsxs("select", { id: "analytics-domain-filter", value: domainFilter, onChange: (event) => setDomainFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), domainOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-activity-filter", children: "Activity" }), _jsxs("select", { id: "analytics-activity-filter", value: activityFilter, onChange: (event) => setActivityFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), activityOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "analytics-search", children: "Search" }), _jsx("input", { id: "analytics-search", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "Filter by title, project, domain, activity, or comment" })] })] }), _jsxs("div", { className: "analytics-summary-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Total tracked" }), _jsx("div", { className: "time-summary-stat", children: formatMinutes(totalMinutes) }), _jsxs("p", { className: "muted", children: ["Across ", filteredLogs.length, " timelogs in the selected range."] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: totalTrackedLabel }), _jsx("div", { className: "time-summary-stat", children: formatMinutes(averagePerBucket) }), _jsx("p", { className: "muted", children: timelineBuckets.length ? `${timelineBuckets.length} ${timelineGranularity} buckets in view.` : "No buckets in view yet." })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Average active day" }), _jsx("div", { className: "time-summary-stat", children: formatMinutes(averagePerActiveDay) }), _jsxs("p", { className: "muted", children: [activeDays, " active day", activeDays === 1 ? "" : "s", " with logged time."] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Top item" }), _jsx("div", { className: "analytics-highlight-value", children: topItem?.label || "No data" }), _jsx("p", { className: "muted", children: topItem ? `${formatMinutes(topItem.minutes)} • ${topItem.contextLabel}` : "No logs in this range yet." })] }), _jsxs("div", { className: "sidebar-card", children: [_jsxs("h3", { children: ["Busiest ", timelineGranularity.slice(0, -2)] }), _jsx("div", { className: "analytics-highlight-value", children: busiestBucket?.label || "No data" }), _jsx("p", { className: "muted", children: busiestBucket ? `${formatMinutes(busiestBucket.minutes)} logged.` : "No logs in this range yet." })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Running now" }), _jsx("div", { className: "time-summary-stat", children: runningLogs.length }), _jsx("p", { className: "muted", children: runningLogs.length ? "Live timelogs are included in the totals above." : "No live timelog right now." })] })] }), _jsxs("div", { className: "analytics-chart-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsxs("h3", { children: [timelineGranularity[0].toUpperCase() + timelineGranularity.slice(1), " trend"] }), _jsx("p", { className: "muted", children: "Time spent over time for the selected range and filters." })] }) }), _jsx("div", { className: "analytics-bar-chart", children: timelineBuckets.length ? (timelineBuckets.map((entry) => (_jsxs("div", { className: "analytics-bar-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: entry.label }), _jsx("div", { className: "time-trend-bar analytics-bar-track", children: _jsx("span", { style: { width: `${(entry.minutes / maxBucketMinutes) * 100}%` } }) }), _jsx("strong", { children: formatMinutes(entry.minutes) })] }, entry.bucketKey)))) : (_jsx("p", { className: "muted", children: "No timelogs match the current filters." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Work mix" }), _jsx("p", { className: "muted", children: "How time is distributed across tasks, meetings, and other activities." })] }) }), _jsx("div", { className: "time-stacked-strip analytics-stacked-strip", children: workKindTotals.map((entry) => (_jsx("span", { title: `${entry.label}: ${formatMinutes(entry.minutes)}`, style: { width: `${totalMinutes ? (entry.minutes / totalMinutes) * 100 : 0}%` } }, entry.label))) }), _jsx("div", { className: "section-list", children: workKindTotals.length ? (workKindTotals.map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No work mix yet for this range." })) })] })] }), _jsxs("div", { className: "analytics-table-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Top items" }), _jsx("p", { className: "muted", children: "Your most time-consuming tasks and meetings in the selected range." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topItems).length ? (topSlice(topItems).map((entry) => (_jsxs("button", { className: "list-item list-item-button", type: "button", disabled: Boolean(entry.isArchivedTarget), onClick: () => (entry.targetType === "todo" ? onOpenTodoDetail(entry.targetId) : onOpenActivityDetail(entry.targetId)), children: [_jsxs("div", { className: "analytics-list-main", children: [_jsx("strong", { children: entry.label }), _jsx("span", { className: "tiny-text", children: entry.contextLabel })] }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, `${entry.targetType}-${entry.targetId}`)))) : (_jsx("p", { className: "muted", children: "No matching items yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Projects" }), _jsx("p", { className: "muted", children: "Where most tracked time is landing at project level." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topProjects).length ? (topSlice(topProjects).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No project totals yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Domains" }), _jsx("p", { className: "muted", children: "Useful for understanding where attention is going at a higher level." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topDomains).length ? (topSlice(topDomains).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No domain totals yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Activities" }), _jsx("p", { className: "muted", children: "This helps surface the repeat themes behind the raw work items." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topActivities).length ? (topSlice(topActivities).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No activity totals yet." })) })] })] })] }));
};
