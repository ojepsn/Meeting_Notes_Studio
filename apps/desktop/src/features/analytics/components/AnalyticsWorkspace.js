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
const timeStringToMinutes = (value) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes))
        return 0;
    return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
};
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
const ANALYTICS_SERIES_COLORS = [
    "#2f6df6",
    "#14a66c",
    "#ea952d",
    "#d95a52",
    "#7b63eb",
    "#1d9db4",
];
const BACKGROUND_FLOW_COLOR = "#8a96aa";
const buildCategorizedTimelineSeries = (logs, granularity, getLabel, limit = 5) => {
    const totalByLabel = new Map();
    logs.forEach((log) => {
        const label = getLabel(log) || "Unspecified";
        totalByLabel.set(label, (totalByLabel.get(label) || 0) + log.effectiveMinutes);
    });
    const topLabels = Array.from(totalByLabel.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([label]) => label);
    const includedLabels = new Set(topLabels);
    const bucketMap = new Map();
    logs.forEach((log) => {
        const bucketKey = buildBucketKey(log.date, granularity);
        const bucket = bucketMap.get(bucketKey) || {
            bucketKey,
            label: formatBucketLabel(bucketKey, granularity),
            totalMinutes: 0,
            series: {},
        };
        const rawLabel = getLabel(log) || "Unspecified";
        const label = includedLabels.has(rawLabel) ? rawLabel : "Other";
        bucket.totalMinutes += log.effectiveMinutes;
        bucket.series[label] = (bucket.series[label] || 0) + log.effectiveMinutes;
        bucketMap.set(bucketKey, bucket);
    });
    const orderedLabels = bucketMap.size && Array.from(bucketMap.values()).some((entry) => entry.series.Other)
        ? [...topLabels, "Other"]
        : topLabels;
    return {
        labels: orderedLabels,
        buckets: Array.from(bucketMap.values()).sort((left, right) => left.bucketKey.localeCompare(right.bucketKey)),
    };
};
const buildBinaryTimelineSeries = (logs, granularity, labels, predicate) => {
    const [positiveLabel, negativeLabel] = labels;
    const bucketMap = new Map();
    logs.forEach((log) => {
        const bucketKey = buildBucketKey(log.date, granularity);
        const bucket = bucketMap.get(bucketKey) || {
            bucketKey,
            label: formatBucketLabel(bucketKey, granularity),
            totalMinutes: 0,
            series: {},
        };
        const label = predicate(log) ? positiveLabel : negativeLabel;
        bucket.totalMinutes += log.effectiveMinutes;
        bucket.series[label] = (bucket.series[label] || 0) + log.effectiveMinutes;
        bucketMap.set(bucketKey, bucket);
    });
    return {
        labels: [positiveLabel, negativeLabel],
        buckets: Array.from(bucketMap.values()).sort((left, right) => left.bucketKey.localeCompare(right.bucketKey)),
    };
};
const getActivitySeriesLabel = (log) => log.project && log.project !== "No project" ? `${log.activityLabel} - ${log.project}` : log.activityLabel;
const getTimeLogFlowLabel = (log) => log.project && log.project !== "No project" ? `${log.project} / ${log.activityLabel}` : log.activityLabel;
const isBackgroundFlowLabel = (label) => label === "Background / Background" || label === "Background";
const getSeriesColor = (label) => {
    if (isBackgroundFlowLabel(label)) {
        return BACKGROUND_FLOW_COLOR;
    }
    let hash = 0;
    for (let index = 0; index < label.length; index += 1) {
        hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
    }
    return ANALYTICS_SERIES_COLORS[hash % ANALYTICS_SERIES_COLORS.length];
};
export const AnalyticsWorkspace = ({ todos, archivedTasks, activities, timeLogs, settings, onOpenTodoDetail, onOpenActivityDetail, }) => {
    const defaultRange = buildRangeFromPreset("90d");
    const [timelineGranularity, setTimelineGranularity] = useState("daily");
    const [rangePreset, setRangePreset] = useState("90d");
    const [fromDate, setFromDate] = useState(defaultRange.fromDate);
    const [toDate, setToDate] = useState(defaultRange.toDate);
    const [projectFilter, setProjectFilter] = useState("all");
    const [domainFilter, setDomainFilter] = useState("all");
    const [activityFilter, setActivityFilter] = useState("all");
    const [showPrivateItems, setShowPrivateItems] = useState(true);
    const [showBusinessItems, setShowBusinessItems] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [chartDisplayMode, setChartDisplayMode] = useState("hours");
    const [drilldown, setDrilldown] = useState(null);
    const [hoveredFlowSegment, setHoveredFlowSegment] = useState(null);
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
                isPrivate: Boolean(todo?.isPrivate ?? archivedTask?.isPrivate),
                isBaselineWork: false,
                isArchivedTarget: !todo && Boolean(archivedTask),
            };
        }
        const activity = activityLookup[log.targetId];
        const isBackgroundLog = Boolean(settings.baselineWorkActivityId &&
            log.targetType === "activity" &&
            log.targetId === settings.baselineWorkActivityId);
        return {
            ...log,
            title: isBackgroundLog ? "Background log" : activity?.description || "Deleted activity",
            contextLabel: isBackgroundLog
                ? "System-managed background work"
                : activity?.project || activity?.domain || (activity?.type === "meeting" ? "Meeting" : "Activity"),
            domain: isBackgroundLog ? "Background" : activity?.domain || "No domain",
            project: isBackgroundLog ? "Background" : activity?.project || "No project",
            activityLabel: isBackgroundLog ? "Background" : activity?.activity || activity?.description || "No activity",
            workKind: activity?.type === "meeting" ? "Meeting" : "Activity",
            effectiveMinutes: isTimeLogRunning(log) ? calculateLiveDurationMinutes(log, now) : log.durationMinutes,
            isPrivate: Boolean(activity?.isPrivate),
            isBaselineWork: isBackgroundLog,
        };
    }), [activityLookup, archivedTaskLookup, now, settings.baselineWorkActivityId, timeLogs, todoLookup]);
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
        if (!showPrivateItems && log.isPrivate)
            return false;
        if (!showBusinessItems && !log.isPrivate)
            return false;
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLocaleLowerCase();
            const haystack = `${log.title} ${log.contextLabel} ${log.project} ${log.domain} ${log.activityLabel} ${log.notes}`.toLocaleLowerCase();
            if (!haystack.includes(query))
                return false;
        }
        return true;
    }), [activityFilter, domainFilter, enrichedLogs, fromDate, projectFilter, searchQuery, showBusinessItems, showPrivateItems, toDate]);
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
    const activityTimelineSeries = useMemo(() => buildCategorizedTimelineSeries(filteredLogs, timelineGranularity, getActivitySeriesLabel), [filteredLogs, timelineGranularity]);
    const dailyTimeLogFlowRows = useMemo(() => {
        const grouped = new Map();
        [...filteredLogs]
            .sort((left, right) => left.date.localeCompare(right.date) ||
            left.startTime.localeCompare(right.startTime) ||
            left.title.localeCompare(right.title))
            .forEach((log) => {
            const label = getTimeLogFlowLabel(log);
            const drilldownLabel = getActivitySeriesLabel(log);
            const startMinutes = timeStringToMinutes(log.startTime);
            const measuredEndMinutes = timeStringToMinutes(log.endTime);
            const computedEndMinutes = startMinutes + Math.max(1, log.effectiveMinutes);
            const endMinutes = Math.max(startMinutes + 1, Math.min(24 * 60, measuredEndMinutes > startMinutes ? measuredEndMinutes : computedEndMinutes));
            const row = grouped.get(log.date) || {
                date: log.date,
                totalMinutes: 0,
                segments: [],
            };
            row.totalMinutes += log.effectiveMinutes;
            row.segments.push({
                id: log.id,
                label,
                drilldownLabel,
                title: `${log.startTime}-${log.endTime === log.startTime ? "(running)" : log.endTime} · ${log.title} · ${label} · ${formatMinutes(log.effectiveMinutes)}`,
                date: log.date,
                startTime: log.startTime,
                endTime: log.endTime,
                notes: log.notes,
                isBackground: log.isBaselineWork,
                startMinutes,
                endMinutes,
                effectiveMinutes: log.effectiveMinutes,
                color: getSeriesColor(label),
            });
            grouped.set(log.date, row);
        });
        return Array.from(grouped.values())
            .map((row) => ({
            ...row,
            segments: row.segments.sort((left, right) => left.startMinutes - right.startMinutes ||
                left.endMinutes - right.endMinutes ||
                left.label.localeCompare(right.label)),
        }))
            .sort((left, right) => right.date.localeCompare(left.date));
    }, [filteredLogs]);
    const dailyTimeLogFlowLegend = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => {
            const label = getTimeLogFlowLabel(log);
            const current = grouped.get(label) || { minutes: 0, drilldownLabel: getActivitySeriesLabel(log) };
            current.minutes += log.effectiveMinutes;
            grouped.set(label, current);
        });
        return Array.from(grouped.entries())
            .map(([label, entry]) => ({ label, minutes: entry.minutes, drilldownLabel: entry.drilldownLabel, color: getSeriesColor(label) }))
            .sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label))
            .slice(0, 10);
    }, [filteredLogs]);
    const projectTimelineSeries = useMemo(() => buildCategorizedTimelineSeries(filteredLogs, timelineGranularity, (log) => log.project || "No project"), [filteredLogs, timelineGranularity]);
    const privacyTimelineSeries = useMemo(() => buildBinaryTimelineSeries(filteredLogs, timelineGranularity, ["Private", "Business"], (log) => log.isPrivate), [filteredLogs, timelineGranularity]);
    const baselineTimelineSeries = useMemo(() => buildBinaryTimelineSeries(filteredLogs, timelineGranularity, ["Baseline work", "Explicit timelogs"], (log) => log.isBaselineWork), [filteredLogs, timelineGranularity]);
    const activityMaxBucketMinutes = Math.max(1, ...activityTimelineSeries.buckets.map((entry) => entry.totalMinutes));
    const projectMaxBucketMinutes = Math.max(1, ...projectTimelineSeries.buckets.map((entry) => entry.totalMinutes));
    const privacyMaxBucketMinutes = Math.max(1, ...privacyTimelineSeries.buckets.map((entry) => entry.totalMinutes));
    const baselineMaxBucketMinutes = Math.max(1, ...baselineTimelineSeries.buckets.map((entry) => entry.totalMinutes));
    const drilldownLogs = useMemo(() => {
        if (!drilldown)
            return [];
        if (drilldown.scope === "activity") {
            return filteredLogs.filter((log) => getActivitySeriesLabel(log) === drilldown.label);
        }
        if (drilldown.scope === "privacy") {
            return filteredLogs.filter((log) => (drilldown.label === "Private" ? log.isPrivate : !log.isPrivate));
        }
        return filteredLogs.filter((log) => (drilldown.label === "Baseline work" ? log.isBaselineWork : !log.isBaselineWork));
    }, [drilldown, filteredLogs]);
    useEffect(() => {
        if (!drilldown)
            return;
        if (drilldown.scope === "activity" && !activityTimelineSeries.labels.includes(drilldown.label)) {
            setDrilldown(null);
            return;
        }
        if (drilldown.scope === "privacy" &&
            !privacyTimelineSeries.labels.includes(drilldown.label)) {
            setDrilldown(null);
            return;
        }
        if (drilldown.scope === "baseline" &&
            !baselineTimelineSeries.labels.includes(drilldown.label)) {
            setDrilldown(null);
        }
    }, [activityTimelineSeries.labels, baselineTimelineSeries.labels, drilldown, privacyTimelineSeries.labels]);
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
    return (_jsxs("div", { className: "card analytics-workspace-card", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsxs("div", { children: [_jsx("h2", { children: "Analytics" }), _jsx("p", { className: "muted", children: "Timelog summaries, trends, and rollups across tasks, meetings, projects, and domains." })] }) }), _jsxs("div", { className: "analytics-toolbar", children: [_jsxs("div", { className: "analytics-toolbar-group", children: [_jsx("span", { className: "tiny-text analytics-toolbar-label", children: "Timeline" }), _jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", "data-active": timelineGranularity === "daily", type: "button", onClick: () => setTimelineGranularity("daily"), children: "Daily" }), _jsx("button", { className: "segment-button", "data-active": timelineGranularity === "weekly", type: "button", onClick: () => setTimelineGranularity("weekly"), children: "Weekly" }), _jsx("button", { className: "segment-button", "data-active": timelineGranularity === "monthly", type: "button", onClick: () => setTimelineGranularity("monthly"), children: "Monthly" })] })] }), _jsxs("div", { className: "analytics-toolbar-group", children: [_jsx("span", { className: "tiny-text analytics-toolbar-label", children: "Chart mode" }), _jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", "data-active": chartDisplayMode === "share", type: "button", onClick: () => setChartDisplayMode("share"), children: "Stacked share" }), _jsx("button", { className: "segment-button", "data-active": chartDisplayMode === "hours", type: "button", onClick: () => setChartDisplayMode("hours"), children: "Absolute hours" })] })] }), _jsxs("div", { className: "analytics-toolbar-group", children: [_jsx("span", { className: "tiny-text analytics-toolbar-label", children: "Window" }), _jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", "data-active": rangePreset === "30d", type: "button", onClick: () => applyRangePreset("30d"), children: "30 days" }), _jsx("button", { className: "segment-button", "data-active": rangePreset === "90d", type: "button", onClick: () => applyRangePreset("90d"), children: "90 days" }), _jsx("button", { className: "segment-button", "data-active": rangePreset === "365d", type: "button", onClick: () => applyRangePreset("365d"), children: "12 months" }), _jsx("button", { className: "segment-button", "data-active": rangePreset === "custom", type: "button", onClick: () => setRangePreset("custom"), children: "Custom" })] })] })] }), _jsxs("div", { className: "analytics-filter-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-from-date", children: "From" }), _jsx(DateInput, { id: "analytics-from-date", value: fromDate, onChange: (event) => {
                                    setRangePreset("custom");
                                    setFromDate(event.target.value);
                                } })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-to-date", children: "To" }), _jsx(DateInput, { id: "analytics-to-date", value: toDate, onChange: (event) => {
                                    setRangePreset("custom");
                                    setToDate(event.target.value);
                                } })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-project-filter", children: "Project" }), _jsxs("select", { id: "analytics-project-filter", value: projectFilter, onChange: (event) => setProjectFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), projectOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-domain-filter", children: "Domain" }), _jsxs("select", { id: "analytics-domain-filter", value: domainFilter, onChange: (event) => setDomainFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), domainOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "analytics-activity-filter", children: "Activity" }), _jsxs("select", { id: "analytics-activity-filter", value: activityFilter, onChange: (event) => setActivityFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), activityOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { className: "field analytics-visibility-field", children: [_jsx("label", { children: "Visibility" }), _jsxs("div", { className: "page-actions analytics-visibility-actions", children: [_jsxs("label", { className: "compact-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showPrivateItems, onChange: (event) => setShowPrivateItems(event.target.checked) }), _jsx("span", { children: "Show private" })] }), _jsxs("label", { className: "compact-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showBusinessItems, onChange: (event) => setShowBusinessItems(event.target.checked) }), _jsx("span", { children: "Show business" })] })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "analytics-search", children: "Search" }), _jsx("input", { id: "analytics-search", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "Filter by title, project, domain, activity, or comment" })] })] }), _jsx("div", { className: "analytics-chart-grid", children: _jsxs("div", { className: "sidebar-card analytics-day-flow-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Daily timelog flow" }), _jsx("p", { className: "muted", children: "Each bar shows individual timelogs in the order they happened during the day, so switching and focused stretches are visible." })] }) }), _jsxs("div", { className: "analytics-day-flow-axis", "aria-hidden": "true", children: [_jsx("span", { children: "00" }), _jsx("span", { children: "06" }), _jsx("span", { children: "12" }), _jsx("span", { children: "18" }), _jsx("span", { children: "24" })] }), _jsx("div", { className: "analytics-day-flow", children: dailyTimeLogFlowRows.length ? (dailyTimeLogFlowRows.map((row) => (_jsxs("div", { className: "analytics-day-flow-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: row.date }), _jsx("div", { className: "analytics-day-flow-track", children: row.segments.map((segment) => (_jsx("button", { type: "button", className: `analytics-day-flow-segment${segment.isBackground ? " analytics-day-flow-segment-background" : ""}`, onClick: () => setDrilldown({ scope: "activity", label: segment.drilldownLabel }), onMouseEnter: () => setHoveredFlowSegment({
                                                id: segment.id,
                                                title: segment.title,
                                                label: segment.label,
                                                date: segment.date,
                                                startTime: segment.startTime,
                                                endTime: segment.endTime,
                                                notes: segment.notes,
                                                effectiveMinutes: segment.effectiveMinutes,
                                            }), onMouseLeave: () => setHoveredFlowSegment((current) => (current?.id === segment.id ? null : current)), onFocus: () => setHoveredFlowSegment({
                                                id: segment.id,
                                                title: segment.title,
                                                label: segment.label,
                                                date: segment.date,
                                                startTime: segment.startTime,
                                                endTime: segment.endTime,
                                                notes: segment.notes,
                                                effectiveMinutes: segment.effectiveMinutes,
                                            }), onBlur: () => setHoveredFlowSegment((current) => (current?.id === segment.id ? null : current)), "aria-label": segment.title, style: {
                                                left: `${(segment.startMinutes / (24 * 60)) * 100}%`,
                                                width: `${Math.max(0.35, ((segment.endMinutes - segment.startMinutes) / (24 * 60)) * 100)}%`,
                                                background: segment.color,
                                            } }, segment.id))) }), _jsx("strong", { children: formatMinutes(row.totalMinutes) })] }, row.date)))) : (_jsx("p", { className: "muted", children: "No timelog flow matches the current filters." })) }), hoveredFlowSegment ? (_jsxs("div", { className: "analytics-flow-hover-card", children: [_jsx("strong", { children: hoveredFlowSegment.title }), _jsxs("span", { className: "tiny-text", children: [hoveredFlowSegment.date, " \u00B7 ", hoveredFlowSegment.startTime, "-", hoveredFlowSegment.endTime === hoveredFlowSegment.startTime ? "running" : hoveredFlowSegment.endTime] }), _jsxs("span", { className: "tiny-text", children: [hoveredFlowSegment.label, " \u00B7 ", formatMinutes(hoveredFlowSegment.effectiveMinutes)] }), hoveredFlowSegment.notes ? _jsx("p", { className: "tiny-text", children: hoveredFlowSegment.notes }) : _jsx("p", { className: "tiny-text muted", children: "No comment on this timelog." })] })) : null, dailyTimeLogFlowLegend.length ? (_jsx("div", { className: "analytics-series-legend", children: dailyTimeLogFlowLegend.map((entry) => (_jsxs("button", { type: "button", className: `status-chip analytics-series-chip${drilldown?.scope === "activity" && drilldown.label === entry.drilldownLabel ? " analytics-series-chip-active" : ""}`, onClick: () => setDrilldown({ scope: "activity", label: entry.drilldownLabel }), children: [_jsx("span", { className: "analytics-series-chip-swatch", style: { background: entry.color } }), entry.label] }, entry.label))) })) : null] }) }), _jsxs("div", { className: "analytics-chart-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Activity time over time" }), _jsxs("p", { className: "muted", children: ["Tracked hours summarized by ", timelineGranularity.slice(0, -2), " and split by the top activities in view."] })] }) }), _jsx("div", { className: "analytics-stacked-timeline", children: activityTimelineSeries.buckets.length ? (activityTimelineSeries.buckets.map((bucket) => (_jsxs("div", { className: "analytics-stacked-timeline-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: bucket.label }), _jsx("div", { className: "analytics-stacked-timeline-track", style: chartDisplayMode === "hours"
                                                ? { width: `${(bucket.totalMinutes / activityMaxBucketMinutes) * 100}%` }
                                                : undefined, children: activityTimelineSeries.labels.map((label, index) => {
                                                const minutes = bucket.series[label] || 0;
                                                const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : activityMaxBucketMinutes;
                                                if (!minutes || !denominator)
                                                    return null;
                                                return (_jsx("button", { type: "button", className: `analytics-segment-button${drilldown?.scope === "activity" && drilldown.label === label ? " analytics-segment-button-active" : ""}`, title: `${label}: ${formatMinutes(minutes)}`, onClick: () => setDrilldown({ scope: "activity", label }), style: {
                                                        width: `${(minutes / denominator) * 100}%`,
                                                        background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                                                    } }, `${bucket.bucketKey}-${label}`));
                                            }) }), _jsx("strong", { children: formatMinutes(bucket.totalMinutes) })] }, bucket.bucketKey)))) : (_jsx("p", { className: "muted", children: "No project time data matches the current filters." })) }), activityTimelineSeries.labels.length ? (_jsx("div", { className: "analytics-series-legend", children: activityTimelineSeries.labels.map((label, index) => (_jsxs("button", { type: "button", className: `status-chip analytics-series-chip${drilldown?.scope === "activity" && drilldown.label === label ? " analytics-series-chip-active" : ""}`, onClick: () => setDrilldown({ scope: "activity", label }), children: [_jsx("span", { className: "analytics-series-chip-swatch", style: { background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] } }), label] }, label))) })) : null] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Project time over time" }), _jsxs("p", { className: "muted", children: ["Tracked hours summarized by ", timelineGranularity.slice(0, -2), " and split by the top projects in view."] })] }) }), _jsx("div", { className: "analytics-stacked-timeline", children: projectTimelineSeries.buckets.length ? (projectTimelineSeries.buckets.map((bucket) => (_jsxs("div", { className: "analytics-stacked-timeline-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: bucket.label }), _jsx("div", { className: "analytics-stacked-timeline-track", style: chartDisplayMode === "hours"
                                                ? { width: `${(bucket.totalMinutes / projectMaxBucketMinutes) * 100}%` }
                                                : undefined, children: projectTimelineSeries.labels.map((label, index) => {
                                                const minutes = bucket.series[label] || 0;
                                                const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : projectMaxBucketMinutes;
                                                if (!minutes || !denominator)
                                                    return null;
                                                return (_jsx("button", { type: "button", className: "analytics-segment-button", title: `${label}: ${formatMinutes(minutes)}`, style: {
                                                        width: `${(minutes / denominator) * 100}%`,
                                                        background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                                                    } }, `${bucket.bucketKey}-${label}`));
                                            }) }), _jsx("strong", { children: formatMinutes(bucket.totalMinutes) })] }, bucket.bucketKey)))) : (_jsx("p", { className: "muted", children: "No project time data matches the current filters." })) }), projectTimelineSeries.labels.length ? (_jsx("div", { className: "analytics-series-legend", children: projectTimelineSeries.labels.map((label, index) => (_jsxs("span", { className: "status-chip analytics-series-chip", children: [_jsx("span", { className: "analytics-series-chip-swatch", style: { background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] } }), label] }, label))) })) : null] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Timelogs time over time" }), _jsxs("p", { className: "muted", children: ["Total logged hours summarized by ", timelineGranularity.slice(0, -2), " for the current filters."] })] }) }), _jsx("div", { className: "analytics-bar-chart", children: timelineBuckets.length ? (timelineBuckets.map((entry) => (_jsxs("div", { className: "analytics-bar-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: entry.label }), _jsx("div", { className: "time-trend-bar analytics-bar-track", children: _jsx("span", { style: { width: `${(entry.minutes / maxBucketMinutes) * 100}%` } }) }), _jsx("strong", { children: formatMinutes(entry.minutes) })] }, entry.bucketKey)))) : (_jsx("p", { className: "muted", children: "No timelog totals match the current filters." })) })] })] }), _jsxs("div", { className: "analytics-chart-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Business vs private" }), _jsx("p", { className: "muted", children: "A split of visible work over time between business and private entries." })] }) }), _jsx("div", { className: "analytics-stacked-timeline", children: privacyTimelineSeries.buckets.length ? (privacyTimelineSeries.buckets.map((bucket) => (_jsxs("div", { className: "analytics-stacked-timeline-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: bucket.label }), _jsx("div", { className: "analytics-stacked-timeline-track", style: chartDisplayMode === "hours"
                                                ? { width: `${(bucket.totalMinutes / privacyMaxBucketMinutes) * 100}%` }
                                                : undefined, children: privacyTimelineSeries.labels.map((label, index) => {
                                                const minutes = bucket.series[label] || 0;
                                                const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : privacyMaxBucketMinutes;
                                                if (!minutes || !denominator)
                                                    return null;
                                                return (_jsx("button", { type: "button", className: `analytics-segment-button${drilldown?.scope === "privacy" && drilldown.label === label ? " analytics-segment-button-active" : ""}`, title: `${label}: ${formatMinutes(minutes)}`, onClick: () => setDrilldown({ scope: "privacy", label: label }), style: {
                                                        width: `${(minutes / denominator) * 100}%`,
                                                        background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                                                    } }, `${bucket.bucketKey}-${label}`));
                                            }) }), _jsx("strong", { children: formatMinutes(bucket.totalMinutes) })] }, bucket.bucketKey)))) : (_jsx("p", { className: "muted", children: "No activity time data matches the current filters." })) }), privacyTimelineSeries.labels.length ? (_jsx("div", { className: "analytics-series-legend", children: privacyTimelineSeries.labels.map((label, index) => (_jsxs("button", { type: "button", className: `status-chip analytics-series-chip${drilldown?.scope === "privacy" && drilldown.label === label ? " analytics-series-chip-active" : ""}`, onClick: () => setDrilldown({ scope: "privacy", label: label }), children: [_jsx("span", { className: "analytics-series-chip-swatch", style: { background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] } }), label] }, label))) })) : null] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Baseline vs explicit timelogs" }), _jsx("p", { className: "muted", children: "See how much time is flowing through baseline work capture versus specific tracked work." })] }) }), _jsx("div", { className: "analytics-stacked-timeline", children: baselineTimelineSeries.buckets.length ? (baselineTimelineSeries.buckets.map((bucket) => (_jsxs("div", { className: "analytics-stacked-timeline-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: bucket.label }), _jsx("div", { className: "analytics-stacked-timeline-track", style: chartDisplayMode === "hours"
                                                ? { width: `${(bucket.totalMinutes / baselineMaxBucketMinutes) * 100}%` }
                                                : undefined, children: baselineTimelineSeries.labels.map((label, index) => {
                                                const minutes = bucket.series[label] || 0;
                                                const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : baselineMaxBucketMinutes;
                                                if (!minutes || !denominator)
                                                    return null;
                                                return (_jsx("button", { type: "button", className: `analytics-segment-button${drilldown?.scope === "baseline" && drilldown.label === label ? " analytics-segment-button-active" : ""}`, title: `${label}: ${formatMinutes(minutes)}`, onClick: () => setDrilldown({ scope: "baseline", label: label }), style: {
                                                        width: `${(minutes / denominator) * 100}%`,
                                                        background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                                                    } }, `${bucket.bucketKey}-${label}`));
                                            }) }), _jsx("strong", { children: formatMinutes(bucket.totalMinutes) })] }, bucket.bucketKey)))) : (_jsx("p", { className: "muted", children: "No timelog split data matches the current filters." })) }), baselineTimelineSeries.labels.length ? (_jsx("div", { className: "analytics-series-legend", children: baselineTimelineSeries.labels.map((label, index) => (_jsxs("button", { type: "button", className: `status-chip analytics-series-chip${drilldown?.scope === "baseline" && drilldown.label === label ? " analytics-series-chip-active" : ""}`, onClick: () => setDrilldown({ scope: "baseline", label: label }), children: [_jsx("span", { className: "analytics-series-chip-swatch", style: { background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] } }), label] }, label))) })) : null] })] }), drilldown ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: "Drill-down timelogs" }), _jsx("p", { className: "muted", children: drilldown.scope === "activity"
                                            ? `Showing timelogs for ${drilldown.label}.`
                                            : drilldown.scope === "privacy"
                                                ? `Showing ${drilldown.label.toLowerCase()} timelogs.`
                                                : `Showing ${drilldown.label.toLowerCase()} timelogs.` })] }), _jsx("div", { className: "page-actions", children: _jsx("button", { className: "small-button", type: "button", onClick: () => setDrilldown(null), children: "Clear" }) })] }), _jsx("div", { className: "section-list", children: drilldownLogs.length ? ([...drilldownLogs]
                            .sort((left, right) => right.date.localeCompare(left.date) ||
                            right.startTime.localeCompare(left.startTime) ||
                            right.effectiveMinutes - left.effectiveMinutes)
                            .map((log) => log.targetType === "todo" && !log.isArchivedTarget ? (_jsxs("button", { className: "list-item list-item-button", type: "button", onClick: () => onOpenTodoDetail(log.targetId), children: [_jsxs("div", { className: "analytics-list-main", children: [_jsx("strong", { children: log.title }), _jsxs("span", { className: "tiny-text", children: [log.date, " ", log.startTime, "-", log.endTime, " \u00B7 ", log.contextLabel] })] }), _jsx("span", { children: formatMinutes(log.effectiveMinutes) })] }, `${log.id}-${log.targetType}`)) : log.targetType === "activity" ? (_jsxs("button", { className: "list-item list-item-button", type: "button", onClick: () => onOpenActivityDetail(log.targetId), children: [_jsxs("div", { className: "analytics-list-main", children: [_jsx("strong", { children: log.title }), _jsxs("span", { className: "tiny-text", children: [log.date, " ", log.startTime, "-", log.endTime, " \u00B7 ", log.contextLabel] })] }), _jsx("span", { children: formatMinutes(log.effectiveMinutes) })] }, `${log.id}-${log.targetType}`)) : (_jsxs("div", { className: "list-item", children: [_jsxs("div", { className: "analytics-list-main", children: [_jsx("strong", { children: log.title }), _jsxs("span", { className: "tiny-text", children: [log.date, " ", log.startTime, "-", log.endTime, " \u00B7 ", log.contextLabel] })] }), _jsx("span", { children: formatMinutes(log.effectiveMinutes) })] }, `${log.id}-${log.targetType}`)))) : (_jsx("p", { className: "muted", children: "No timelogs match this drill-down." })) })] })) : null, _jsxs("div", { className: "analytics-summary-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Total tracked" }), _jsx("div", { className: "time-summary-stat", children: formatMinutes(totalMinutes) }), _jsxs("p", { className: "muted", children: ["Across ", filteredLogs.length, " timelogs in the selected range."] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: totalTrackedLabel }), _jsx("div", { className: "time-summary-stat", children: formatMinutes(averagePerBucket) }), _jsx("p", { className: "muted", children: timelineBuckets.length ? `${timelineBuckets.length} ${timelineGranularity} buckets in view.` : "No buckets in view yet." })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Average active day" }), _jsx("div", { className: "time-summary-stat", children: formatMinutes(averagePerActiveDay) }), _jsxs("p", { className: "muted", children: [activeDays, " active day", activeDays === 1 ? "" : "s", " with logged time."] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Top item" }), _jsx("div", { className: "analytics-highlight-value", children: topItem?.label || "No data" }), _jsx("p", { className: "muted", children: topItem ? `${formatMinutes(topItem.minutes)} • ${topItem.contextLabel}` : "No logs in this range yet." })] }), _jsxs("div", { className: "sidebar-card", children: [_jsxs("h3", { children: ["Busiest ", timelineGranularity.slice(0, -2)] }), _jsx("div", { className: "analytics-highlight-value", children: busiestBucket?.label || "No data" }), _jsx("p", { className: "muted", children: busiestBucket ? `${formatMinutes(busiestBucket.minutes)} logged.` : "No logs in this range yet." })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Running now" }), _jsx("div", { className: "time-summary-stat", children: runningLogs.length }), _jsx("p", { className: "muted", children: runningLogs.length ? "Live timelogs are included in the totals above." : "No live timelog right now." })] })] }), _jsxs("div", { className: "analytics-chart-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsxs("h3", { children: [timelineGranularity[0].toUpperCase() + timelineGranularity.slice(1), " trend"] }), _jsx("p", { className: "muted", children: "Time spent over time for the selected range and filters." })] }) }), _jsx("div", { className: "analytics-bar-chart", children: timelineBuckets.length ? (timelineBuckets.map((entry) => (_jsxs("div", { className: "analytics-bar-row", children: [_jsx("span", { className: "tiny-text analytics-bar-label", children: entry.label }), _jsx("div", { className: "time-trend-bar analytics-bar-track", children: _jsx("span", { style: { width: `${(entry.minutes / maxBucketMinutes) * 100}%` } }) }), _jsx("strong", { children: formatMinutes(entry.minutes) })] }, entry.bucketKey)))) : (_jsx("p", { className: "muted", children: "No timelogs match the current filters." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Work mix" }), _jsx("p", { className: "muted", children: "How time is distributed across tasks, meetings, and other activities." })] }) }), _jsx("div", { className: "time-stacked-strip analytics-stacked-strip", children: workKindTotals.map((entry) => (_jsx("span", { title: `${entry.label}: ${formatMinutes(entry.minutes)}`, style: { width: `${totalMinutes ? (entry.minutes / totalMinutes) * 100 : 0}%` } }, entry.label))) }), _jsx("div", { className: "section-list", children: workKindTotals.length ? (workKindTotals.map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No work mix yet for this range." })) })] })] }), _jsxs("div", { className: "analytics-table-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Top items" }), _jsx("p", { className: "muted", children: "Your most time-consuming tasks and meetings in the selected range." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topItems).length ? (topSlice(topItems).map((entry) => (_jsxs("button", { className: "list-item list-item-button", type: "button", disabled: Boolean(entry.isArchivedTarget), onClick: () => (entry.targetType === "todo" ? onOpenTodoDetail(entry.targetId) : onOpenActivityDetail(entry.targetId)), children: [_jsxs("div", { className: "analytics-list-main", children: [_jsx("strong", { children: entry.label }), _jsx("span", { className: "tiny-text", children: entry.contextLabel })] }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, `${entry.targetType}-${entry.targetId}`)))) : (_jsx("p", { className: "muted", children: "No matching items yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Projects" }), _jsx("p", { className: "muted", children: "Where most tracked time is landing at project level." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topProjects).length ? (topSlice(topProjects).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No project totals yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Domains" }), _jsx("p", { className: "muted", children: "Useful for understanding where attention is going at a higher level." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topDomains).length ? (topSlice(topDomains).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No domain totals yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Activities" }), _jsx("p", { className: "muted", children: "This helps surface the repeat themes behind the raw work items." })] }) }), _jsx("div", { className: "section-list", children: topSlice(topActivities).length ? (topSlice(topActivities).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label)))) : (_jsx("p", { className: "muted", children: "No activity totals yet." })) })] })] })] }));
};
