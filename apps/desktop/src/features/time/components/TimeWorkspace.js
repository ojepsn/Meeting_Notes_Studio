import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateInput } from "../../../components/DateInput";
import { saveTextFile } from "../../../lib/storage/desktopStorage";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog } from "../../../lib/time/tracking";
const TIMelog_RECENT_DAYS = 7;
const TIMELOG_OLDER_BATCH_SIZE = 30;
const defaultTimeLogColumnWidths = {
    project: 160,
    activity: 180,
    source: 300,
    date: 150,
    start: 110,
    stop: 110,
    duration: 104,
    comment: 210,
    actions: 138,
};
const minTimeLogColumnWidths = {
    project: 128,
    activity: 144,
    source: 180,
    date: 150,
    start: 104,
    stop: 104,
    duration: 88,
    comment: 140,
    actions: 132,
};
export const formatMinutes = (minutes) => {
    if (!minutes)
        return "0m";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours)
        return `${rest}m`;
    if (!rest)
        return `${hours}h`;
    return `${hours}h ${rest}m`;
};
export const formatDateInput = (date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
export const shiftDays = (value, days) => {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return formatDateInput(date);
};
export const differenceInDaysInclusive = (fromDate, toDate) => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
};
export const getPresetRange = (preset, now = new Date()) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === "today") {
        const date = formatDateInput(today);
        return { fromDate: date, toDate: date, label: "Today" };
    }
    if (preset === "this-week") {
        const start = new Date(today);
        const mondayOffset = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - mondayOffset);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { fromDate: formatDateInput(start), toDate: formatDateInput(end), label: "This week" };
    }
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { fromDate: formatDateInput(start), toDate: formatDateInput(end), label: "This month" };
};
export const calculateDurationMinutes = (date, startTime, endTime) => {
    const start = new Date(`${date}T${startTime || "00:00"}:00`);
    const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
};
const formatTimestampForFilename = (date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}-${`${date.getHours()}`.padStart(2, "0")}-${`${date.getMinutes()}`.padStart(2, "0")}-${`${date.getSeconds()}`.padStart(2, "0")}`;
export const buildExportFilename = (kind, now = new Date()) => `notesmith-time-report-${formatTimestampForFilename(now)}.${kind}`;
export const buildJsonExportFilename = (now = new Date()) => `notesmith-time-report-${formatTimestampForFilename(now)}.json`;
const csvCell = (value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
export const TimeWorkspace = ({ todos, archivedTasks, activities, timeLogs, structureOptions, requestedDomain, requestedProject, reportPresets, baselineWorkActivityId, isBaselineWorkEnabled, isBaselineWorkRunning, hasSpecificRunningTimeLog, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onStartWorkBaseline, onStopWorkBaseline, onStartAdhocTimeLog, onOpenTodoDetail, onOpenActivityDetail, onSaveTodo, onSaveActivity, onSaveReportPreset, onDeleteReportPreset, }) => {
    const initialWeek = getPresetRange("this-week");
    const [datePreset, setDatePreset] = useState("this-week");
    const [fromDate, setFromDate] = useState(initialWeek.fromDate);
    const [toDate, setToDate] = useState(initialWeek.toDate);
    const [projectFilter, setProjectFilter] = useState("all");
    const [domainFilter, setDomainFilter] = useState("all");
    const [activityFilter, setActivityFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [presetDraft, setPresetDraft] = useState("");
    const [now, setNow] = useState(() => new Date());
    const [timeLogColumnWidths, setTimeLogColumnWidths] = useState(defaultTimeLogColumnWidths);
    const [olderVisibleCount, setOlderVisibleCount] = useState(TIMELOG_OLDER_BATCH_SIZE);
    const [timeLogDrafts, setTimeLogDrafts] = useState({});
    const timeLogScrollAreaRef = useRef(null);
    useEffect(() => {
        if (requestedProject !== undefined && requestedProject !== null)
            setProjectFilter(requestedProject || "all");
    }, [requestedProject]);
    useEffect(() => {
        if (requestedDomain !== undefined && requestedDomain !== null)
            setDomainFilter(requestedDomain || "all");
    }, [requestedDomain]);
    const todoLookup = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo])), [todos]);
    const archivedTaskLookup = useMemo(() => Object.fromEntries(archivedTasks.map((task) => [task.id, task])), [archivedTasks]);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
    const enrichedLogs = useMemo(() => [...timeLogs]
        .map((log) => {
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
                isArchivedTarget: !todo && Boolean(archivedTask),
                resolvedDomain: linkedActivity?.domain || todo?.domain || archivedTask?.domain || "",
                resolvedProject: linkedActivity?.project || todo?.project || archivedTask?.project || "",
                resolvedActivity: linkedActivity?.description || todo?.activity || archivedTask?.activity || "",
            };
        }
        const activity = activityLookup[log.targetId];
        const isSystemBackground = Boolean(baselineWorkActivityId &&
            log.targetType === "activity" &&
            log.targetId === baselineWorkActivityId);
        return {
            ...log,
            title: isSystemBackground ? "Background log" : activity?.description || "Deleted activity",
            contextLabel: isSystemBackground
                ? "System-managed background work"
                : activity?.project || activity?.domain || (activity?.type === "meeting" ? "Meeting" : "Activity"),
            isSystemBackground,
            resolvedDomain: isSystemBackground ? "Background" : activity?.domain || "",
            resolvedProject: isSystemBackground ? "Background" : activity?.project || "",
            resolvedActivity: isSystemBackground ? "Background" : activity?.activity || activity?.description || "",
        };
    })
        .sort((left, right) => {
        const leftRunning = left.startTime === left.endTime;
        const rightRunning = right.startTime === right.endTime;
        if (leftRunning !== rightRunning)
            return leftRunning ? -1 : 1;
        return `${right.date} ${right.startTime}`.localeCompare(`${left.date} ${left.startTime}`);
    }), [activityLookup, archivedTaskLookup, baselineWorkActivityId, timeLogs, todoLookup]);
    const projectOptions = useMemo(() => Array.from(new Set(enrichedLogs.map((log) => {
        const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
        const archivedTask = log.targetType === "todo" ? archivedTaskLookup[log.targetId] : null;
        const activity = log.targetType === "activity" ? activityLookup[log.targetId] : todo?.activityId ? activityLookup[todo.activityId] : null;
        return activity?.project || todo?.project || archivedTask?.project || "No project";
    }))).sort(), [activityLookup, archivedTaskLookup, enrichedLogs, todoLookup]);
    const domainOptions = useMemo(() => Array.from(new Set(enrichedLogs.map((log) => {
        const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
        const archivedTask = log.targetType === "todo" ? archivedTaskLookup[log.targetId] : null;
        const activity = log.targetType === "activity" ? activityLookup[log.targetId] : todo?.activityId ? activityLookup[todo.activityId] : null;
        return activity?.domain || todo?.domain || archivedTask?.domain || "No domain";
    }))).sort(), [activityLookup, archivedTaskLookup, enrichedLogs, todoLookup]);
    const activityOptions = useMemo(() => Array.from(new Set(enrichedLogs.map((log) => {
        const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
        const archivedTask = log.targetType === "todo" ? archivedTaskLookup[log.targetId] : null;
        const activity = log.targetType === "activity" ? activityLookup[log.targetId] : todo?.activityId ? activityLookup[todo.activityId] : null;
        return activity?.description || todo?.activity || archivedTask?.activity || "No activity";
    }))).sort(), [activityLookup, archivedTaskLookup, enrichedLogs, todoLookup]);
    const logsMatchingStructure = useMemo(() => enrichedLogs.filter((log) => {
        const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
        const archivedTask = log.targetType === "todo" ? archivedTaskLookup[log.targetId] : null;
        const activity = log.targetType === "activity" ? activityLookup[log.targetId] : todo?.activityId ? activityLookup[todo.activityId] : null;
        const project = activity?.project || todo?.project || archivedTask?.project || "No project";
        const domain = activity?.domain || todo?.domain || archivedTask?.domain || "No domain";
        const activityName = activity?.description || todo?.activity || archivedTask?.activity || "No activity";
        if (projectFilter !== "all" && project !== projectFilter)
            return false;
        if (domainFilter !== "all" && domain !== domainFilter)
            return false;
        if (activityFilter !== "all" && activityName !== activityFilter)
            return false;
        return true;
    }), [activityFilter, activityLookup, archivedTaskLookup, domainFilter, enrichedLogs, projectFilter, todoLookup]);
    const filteredLogs = useMemo(() => logsMatchingStructure.filter((log) => {
        if (fromDate && log.date < fromDate)
            return false;
        if (toDate && log.date > toDate)
            return false;
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLocaleLowerCase();
            const haystack = `${log.title} ${log.contextLabel} ${log.notes}`.toLocaleLowerCase();
            if (!haystack.includes(query))
                return false;
        }
        return true;
    }), [fromDate, logsMatchingStructure, searchQuery, toDate]);
    const listSearchLogs = useMemo(() => logsMatchingStructure.filter((log) => {
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLocaleLowerCase();
            const haystack = `${log.title} ${log.contextLabel} ${log.notes}`.toLocaleLowerCase();
            if (!haystack.includes(query))
                return false;
        }
        return true;
    }), [logsMatchingStructure, searchQuery]);
    const listRecentCutoffDate = useMemo(() => shiftDays(formatDateInput(now), -(TIMelog_RECENT_DAYS - 1)), [now]);
    const listRecentLogs = useMemo(() => listSearchLogs.filter((log) => log.startTime === log.endTime || log.date >= listRecentCutoffDate), [listRecentCutoffDate, listSearchLogs]);
    const listOlderLogs = useMemo(() => listSearchLogs.filter((log) => log.startTime !== log.endTime && log.date < listRecentCutoffDate), [listRecentCutoffDate, listSearchLogs]);
    const visibleListLogs = useMemo(() => [...listRecentLogs, ...listOlderLogs.slice(0, olderVisibleCount)], [listOlderLogs, listRecentLogs, olderVisibleCount]);
    const comparisonRange = useMemo(() => {
        if (!fromDate || !toDate)
            return null;
        const rangeDays = differenceInDaysInclusive(fromDate, toDate);
        const previousTo = shiftDays(fromDate, -1);
        const previousFrom = shiftDays(previousTo, -(rangeDays - 1));
        return { fromDate: previousFrom, toDate: previousTo, label: `${previousFrom} to ${previousTo}` };
    }, [fromDate, toDate]);
    const comparisonLogs = useMemo(() => comparisonRange
        ? logsMatchingStructure.filter((log) => log.date >= comparisonRange.fromDate && log.date <= comparisonRange.toDate)
        : [], [comparisonRange, logsMatchingStructure]);
    const runningLogs = useMemo(() => enrichedLogs.filter((log) => log.startTime === log.endTime), [enrichedLogs]);
    const activeLog = useMemo(() => getRunningTimeLog(enrichedLogs), [enrichedLogs]);
    const activeLogIsOutsideCurrentFilters = useMemo(() => Boolean(activeLog && !visibleListLogs.some((log) => log.id === activeLog.id)), [activeLog, visibleListLogs]);
    const recentLogs = useMemo(() => filteredLogs.slice(0, 24), [filteredLogs]);
    useEffect(() => {
        setOlderVisibleCount(TIMELOG_OLDER_BATCH_SIZE);
    }, [projectFilter, domainFilter, activityFilter, searchQuery]);
    useEffect(() => {
        setTimeLogDrafts((current) => {
            const activeLogIds = new Set(enrichedLogs.map((log) => log.id));
            let changed = false;
            const next = Object.fromEntries(Object.entries(current).filter(([id]) => {
                const keep = activeLogIds.has(id);
                if (!keep)
                    changed = true;
                return keep;
            }));
            return changed ? next : current;
        });
    }, [enrichedLogs]);
    useEffect(() => {
        const node = timeLogScrollAreaRef.current;
        if (!node)
            return;
        const handleScroll = () => {
            if (!listOlderLogs.length)
                return;
            const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
            if (remaining <= 180) {
                setOlderVisibleCount((current) => current >= listOlderLogs.length ? current : Math.min(current + TIMELOG_OLDER_BATCH_SIZE, listOlderLogs.length));
            }
        };
        node.addEventListener("scroll", handleScroll, { passive: true });
        return () => node.removeEventListener("scroll", handleScroll);
    }, [listOlderLogs.length]);
    useEffect(() => {
        if (!activeLog)
            return;
        const intervalId = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(intervalId);
    }, [activeLog]);
    const dailyTotals = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => grouped.set(log.date, (grouped.get(log.date) || 0) + log.durationMinutes));
        return Array.from(grouped.entries()).map(([date, minutes]) => ({ date, minutes })).sort((l, r) => r.date.localeCompare(l.date));
    }, [filteredLogs]);
    const activityTotals = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => {
            const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
            const archivedTask = log.targetType === "todo" ? archivedTaskLookup[log.targetId] : null;
            const linkedActivity = todo?.activityId ? activityLookup[todo.activityId] : null;
            const directActivity = log.targetType === "activity" ? activityLookup[log.targetId] : null;
            const aggregateActivity = linkedActivity || directActivity;
            const key = aggregateActivity ? `activity:${aggregateActivity.id}` : `${log.targetType}:${log.targetId}`;
            const existing = grouped.get(key) || {
                label: aggregateActivity?.description || log.title,
                domain: aggregateActivity?.domain || todo?.domain || archivedTask?.domain || "",
                project: aggregateActivity?.project || todo?.project || archivedTask?.project || "",
                minutes: 0,
                targetType: aggregateActivity ? "activity" : log.targetType,
                targetId: aggregateActivity?.id || log.targetId,
                isArchivedTarget: !aggregateActivity && log.targetType === "todo" && !todo && Boolean(archivedTask),
            };
            existing.minutes += log.durationMinutes;
            grouped.set(key, existing);
        });
        return Array.from(grouped.values()).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
    }, [activityLookup, archivedTaskLookup, filteredLogs, todoLookup]);
    const projectTotals = useMemo(() => {
        const grouped = new Map();
        activityTotals.forEach((entry) => grouped.set(entry.project || "No project", (grouped.get(entry.project || "No project") || 0) + entry.minutes));
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
    }, [activityTotals]);
    const domainTotals = useMemo(() => {
        const grouped = new Map();
        activityTotals.forEach((entry) => grouped.set(entry.domain || "No domain", (grouped.get(entry.domain || "No domain") || 0) + entry.minutes));
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
    }, [activityTotals]);
    const workspaceTotals = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => {
            const label = log.targetType === "todo" ? "Tasks workspace" : "Activities workspace";
            grouped.set(label, (grouped.get(label) || 0) + log.durationMinutes);
        });
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
    }, [filteredLogs]);
    const workTypeTotals = useMemo(() => {
        const grouped = new Map();
        filteredLogs.forEach((log) => {
            const label = log.targetType === "todo" ? "Todo" : activityLookup[log.targetId]?.type === "meeting" ? "Meeting" : "Task activity";
            grouped.set(label, (grouped.get(label) || 0) + log.durationMinutes);
        });
        return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
    }, [activityLookup, filteredLogs]);
    const currentTotalMinutes = useMemo(() => filteredLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0), [filteredLogs]);
    const comparisonTotalMinutes = useMemo(() => comparisonLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0), [comparisonLogs]);
    const comparisonDeltaMinutes = currentTotalMinutes - comparisonTotalMinutes;
    const comparisonDeltaPercent = comparisonTotalMinutes > 0 ? Math.round((comparisonDeltaMinutes / comparisonTotalMinutes) * 100) : null;
    const maxDailyMinutes = Math.max(1, ...dailyTotals.map((entry) => entry.minutes));
    const stackedSummary = useMemo(() => [...workspaceTotals, ...workTypeTotals].slice(0, 6), [workspaceTotals, workTypeTotals]);
    const stackedSummaryTotal = Math.max(1, stackedSummary.reduce((sum, entry) => sum + entry.minutes, 0));
    const applyPreset = (preset) => {
        const range = getPresetRange(preset);
        setDatePreset(preset);
        setFromDate(range.fromDate);
        setToDate(range.toDate);
    };
    const exportCsv = async () => {
        const rows = [["Date", "Start", "End", "Minutes", "Type", "Title", "Context"], ...filteredLogs.map((log) => [log.date, log.startTime, log.endTime, log.durationMinutes, log.targetType, log.title, log.contextLabel])];
        const content = rows.map((row) => row.map(csvCell).join(",")).join("\n");
        await saveTextFile({ content, defaultFilename: buildExportFilename("csv"), filters: [{ name: "CSV report", extensions: ["csv"] }] });
    };
    const exportMarkdown = async () => {
        const content = [
            "# Time report",
            "",
            `Range: ${fromDate || "All"} to ${toDate || "All"}`,
            `Project filter: ${projectFilter}`,
            `Domain filter: ${domainFilter}`,
            "",
            "## Comparison",
            comparisonRange ? `- Current range: ${formatMinutes(currentTotalMinutes)}` : "- Comparison unavailable",
            comparisonRange ? `- Previous range (${comparisonRange.label}): ${formatMinutes(comparisonTotalMinutes)}` : "",
            comparisonRange ? `- Delta: ${comparisonDeltaMinutes >= 0 ? "+" : ""}${formatMinutes(comparisonDeltaMinutes)}${comparisonDeltaPercent !== null ? ` (${comparisonDeltaPercent >= 0 ? "+" : ""}${comparisonDeltaPercent}%)` : ""}` : "",
            "",
            "## Active timers",
            ...(runningLogs.length ? runningLogs.map((log) => `- ${log.title} (${log.contextLabel}) started ${log.date} ${log.startTime}`) : ["- No active timers"]),
            "",
            "## Workspace totals",
            ...(workspaceTotals.length ? workspaceTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}`) : ["- No logged time"]),
            "",
            "## Work type totals",
            ...(workTypeTotals.length ? workTypeTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}`) : ["- No logged time"]),
            "",
            "## Per day totals",
            ...(dailyTotals.length ? dailyTotals.map((entry) => `- ${entry.date}: ${formatMinutes(entry.minutes)}`) : ["- No logged time"]),
            "",
            "## Per activity totals",
            ...(activityTotals.length ? activityTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}${entry.project ? ` | ${entry.project}` : ""}`) : ["- No logged time"]),
            "",
            "## Per project totals",
            ...(projectTotals.length ? projectTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}`) : ["- No logged time"]),
            "",
            "## Per domain totals",
            ...(domainTotals.length ? domainTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}`) : ["- No logged time"]),
            "",
            "## Recent logs",
            ...(recentLogs.length ? recentLogs.map((log) => `- ${log.date} ${log.startTime}-${log.endTime} | ${log.title} | ${formatMinutes(log.durationMinutes)} | ${log.contextLabel}`) : ["- No recent logs"]),
        ]
            .filter(Boolean)
            .join("\n");
        await saveTextFile({ content, defaultFilename: buildExportFilename("md"), filters: [{ name: "Markdown report", extensions: ["md"] }] });
    };
    const exportJson = async () => {
        const content = JSON.stringify({
            filters: { datePreset, fromDate, toDate, project: projectFilter, domain: domainFilter, activity: activityFilter },
            comparison: comparisonRange
                ? {
                    range: comparisonRange,
                    currentTotalMinutes,
                    comparisonTotalMinutes,
                    deltaMinutes: comparisonDeltaMinutes,
                    deltaPercent: comparisonDeltaPercent,
                }
                : null,
            totals: { daily: dailyTotals, activity: activityTotals, project: projectTotals, domain: domainTotals, workspace: workspaceTotals, workType: workTypeTotals },
            logs: recentLogs,
        }, null, 2);
        await saveTextFile({ content, defaultFilename: buildJsonExportFilename(), filters: [{ name: "JSON report", extensions: ["json"] }] });
    };
    const applySavedPreset = (preset) => {
        setDatePreset("custom");
        setFromDate(preset.fromDate);
        setToDate(preset.toDate);
        setDomainFilter(preset.domain || "all");
        setProjectFilter(preset.project || "all");
    };
    const startTimeLogColumnResize = (key, event) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = timeLogColumnWidths[key];
        const handlePointerMove = (moveEvent) => {
            const nextWidth = Math.max(minTimeLogColumnWidths[key], startWidth + moveEvent.clientX - startX);
            setTimeLogColumnWidths((current) => ({ ...current, [key]: nextWidth }));
        };
        const handlePointerUp = () => {
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("mouseup", handlePointerUp);
            document.body.classList.remove("timelog-column-resizing");
        };
        document.body.classList.add("timelog-column-resizing");
        window.addEventListener("mousemove", handlePointerMove);
        window.addEventListener("mouseup", handlePointerUp);
    };
    const timeLogTableStyle = {
        "--timelog-col-project": `${timeLogColumnWidths.project}px`,
        "--timelog-col-activity": `${timeLogColumnWidths.activity}px`,
        "--timelog-col-source": `${timeLogColumnWidths.source}px`,
        "--timelog-col-date": `${timeLogColumnWidths.date}px`,
        "--timelog-col-start": `${timeLogColumnWidths.start}px`,
        "--timelog-col-stop": `${timeLogColumnWidths.stop}px`,
        "--timelog-col-duration": `${timeLogColumnWidths.duration}px`,
        "--timelog-col-comment": `${timeLogColumnWidths.comment}px`,
        "--timelog-col-actions": `${timeLogColumnWidths.actions}px`,
    };
    const timeLogColumns = [
        { key: "project", label: "Project", resizable: true },
        { key: "activity", label: "Activity", resizable: true },
        { key: "source", label: "Source", resizable: true },
        { key: "date", label: "Date", resizable: true },
        { key: "start", label: "Start", resizable: true },
        { key: "stop", label: "Stop", resizable: true },
        { key: "duration", label: "Duration", resizable: true },
        { key: "comment", label: "Comment", resizable: true },
        { key: "actions", label: "Actions", align: "right" },
    ];
    const getTimeLogDraft = (log) => timeLogDrafts[log.id] ?? {
        title: log.title,
        date: log.date,
        startTime: log.startTime,
        endTime: log.endTime,
        notes: log.notes,
        project: log.resolvedProject,
        activity: log.resolvedActivity,
    };
    const updateTimeLogDraft = (log, updates) => {
        setTimeLogDrafts((current) => ({
            ...current,
            [log.id]: {
                ...getTimeLogDraft(log),
                ...updates,
            },
        }));
    };
    const clearTimeLogDraft = (logId) => {
        setTimeLogDrafts((current) => {
            if (!(logId in current))
                return current;
            const next = { ...current };
            delete next[logId];
            return next;
        });
    };
    const commitTimeLogDraft = (log) => {
        const draft = timeLogDrafts[log.id];
        if (!draft)
            return;
        if (log.isSystemBackground) {
            clearTimeLogDraft(log.id);
            return;
        }
        const nextTitle = draft.title.trim();
        const nextDate = draft.date || log.date;
        const nextStartTime = draft.startTime || log.startTime;
        const draftEndTime = draft.endTime || log.endTime;
        const running = log.startTime === log.endTime;
        const keepRunning = running &&
            draftEndTime === log.endTime &&
            (nextDate !== log.date || nextStartTime !== log.startTime);
        const nextEndTime = keepRunning ? nextStartTime : draftEndTime;
        const nextNotes = draft.notes;
        const nextProject = draft.project.trim();
        const nextActivity = draft.activity.trim();
        const changed = nextTitle !== log.title ||
            nextDate !== log.date ||
            nextStartTime !== log.startTime ||
            nextEndTime !== log.endTime ||
            nextNotes !== log.notes ||
            nextProject !== log.resolvedProject ||
            nextActivity !== log.resolvedActivity;
        clearTimeLogDraft(log.id);
        if (!changed)
            return;
        if (!log.isArchivedTarget) {
            if (log.targetType === "todo") {
                const todo = todoLookup[log.targetId];
                if (todo) {
                    const linkedActivity = todo.activityId ? activityLookup[todo.activityId] : null;
                    const keepLinkedActivity = linkedActivity &&
                        nextActivity === linkedActivity.description &&
                        nextProject === linkedActivity.project;
                    onSaveTodo({
                        ...todo,
                        description: nextTitle,
                        project: nextProject,
                        activity: nextActivity,
                        activityId: keepLinkedActivity ? todo.activityId : "",
                    });
                }
            }
            else {
                const activity = activityLookup[log.targetId];
                if (activity) {
                    onSaveActivity({
                        ...activity,
                        project: nextProject,
                        activity: nextActivity,
                    });
                }
            }
        }
        onSaveTimeLog({
            ...log,
            date: nextDate,
            startTime: nextStartTime,
            endTime: nextEndTime,
            durationMinutes: calculateDurationMinutes(nextDate, nextStartTime, nextEndTime),
            notes: nextNotes,
            updatedAt: new Date().toISOString(),
        });
    };
    const handleTimeLogDraftKeyDown = (event, log) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commitTimeLogDraft(log);
            event.currentTarget.blur();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            clearTimeLogDraft(log.id);
            event.currentTarget.blur();
        }
    };
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal time-workspace-card", children: [_jsxs("div", { className: "card-header session-editor-header-minimal", children: [_jsx("div", { children: _jsx("h2", { children: "Timelogs" }) }), _jsxs("div", { className: "page-actions time-export-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void exportCsv(), children: "CSV" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void exportMarkdown(), children: "Markdown" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void exportJson(), children: "JSON" })] })] }), _jsx("div", { className: "time-filter-stack", children: _jsxs("details", { className: "workspace-disclosure time-disclosure-card", children: [_jsx("summary", { children: "Timelogs" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "time-preset-row", children: [_jsxs("div", { className: "capture-density-toggle", children: [_jsx("button", { className: "segment-button", "data-active": datePreset === "today", type: "button", onClick: () => applyPreset("today"), children: "Today" }), _jsx("button", { className: "segment-button", "data-active": datePreset === "this-week", type: "button", onClick: () => applyPreset("this-week"), children: "This week" }), _jsx("button", { className: "segment-button", "data-active": datePreset === "this-month", type: "button", onClick: () => applyPreset("this-month"), children: "This month" }), _jsx("button", { className: "segment-button", "data-active": datePreset === "custom", type: "button", onClick: () => setDatePreset("custom"), children: "Custom" })] }), _jsxs("div", { className: "time-comparison-inline", children: [_jsx("span", { className: "tiny-text", children: "Current" }), _jsx("strong", { children: formatMinutes(currentTotalMinutes) }), comparisonRange ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "tiny-text", children: "Previous" }), _jsx("strong", { children: formatMinutes(comparisonTotalMinutes) }), _jsxs("span", { className: `tiny-text ${comparisonDeltaMinutes >= 0 ? "time-delta-positive" : "time-delta-negative"}`, children: [comparisonDeltaMinutes >= 0 ? "+" : "", formatMinutes(comparisonDeltaMinutes), comparisonDeltaPercent !== null ? ` (${comparisonDeltaPercent >= 0 ? "+" : ""}${comparisonDeltaPercent}%)` : ""] })] })) : null] })] }), _jsxs("div", { className: "time-filter-grid-compact", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-filter-from", children: "From" }), _jsx(DateInput, { id: "time-filter-from", value: fromDate, onChange: (event) => { setDatePreset("custom"); setFromDate(event.target.value); } })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-filter-to", children: "To" }), _jsx(DateInput, { id: "time-filter-to", value: toDate, onChange: (event) => { setDatePreset("custom"); setToDate(event.target.value); } })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-filter-project", children: "Project" }), _jsxs("select", { id: "time-filter-project", value: projectFilter, onChange: (event) => setProjectFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), projectOptions.map((option) => _jsx("option", { value: option, children: option }, option))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-filter-domain", children: "Domain" }), _jsxs("select", { id: "time-filter-domain", value: domainFilter, onChange: (event) => setDomainFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), domainOptions.map((option) => _jsx("option", { value: option, children: option }, option))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-filter-activity", children: "Activity" }), _jsxs("select", { id: "time-filter-activity", value: activityFilter, onChange: (event) => setActivityFilter(event.target.value), children: [_jsx("option", { value: "all", children: "All" }), activityOptions.map((option) => _jsx("option", { value: option, children: option }, option))] })] })] })] })] }) }), _jsx("div", { className: "time-workspace-layout time-workspace-layout-minimal", children: _jsxs("section", { className: "time-workspace-main time-workspace-main-full", children: [_jsxs("div", { className: "sidebar-card timelog-active-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: "Work mode" }), _jsx("p", { className: "muted", children: "Keeps a system-managed Background log running whenever no specific timelog is active." })] }), _jsx("span", { className: "status-chip", children: isBaselineWorkEnabled
                                                ? isBaselineWorkRunning
                                                    ? "Running"
                                                    : hasSpecificRunningTimeLog
                                                        ? "Paused"
                                                        : "Ready"
                                                : "Off" })] }), _jsxs("div", { className: "timelog-active-row", children: [_jsxs("div", { className: "timelog-active-copy", children: [_jsx("strong", { children: isBaselineWorkEnabled ? "Baseline work capture is enabled" : "Baseline work capture is off" }), _jsx("span", { className: "tiny-text", children: isBaselineWorkEnabled
                                                        ? isBaselineWorkRunning
                                                            ? "General work time is being logged to Background until a more specific timelog takes over."
                                                            : hasSpecificRunningTimeLog
                                                                ? `A specific timelog is active${activeLog ? ` (${activeLog.title})` : ""}, so baseline work capture is paused and will resume automatically.`
                                                                : "Baseline work capture is armed and will run when no specific timelog is active."
                                                        : "Click Start work to begin continuous baseline capture." })] }), _jsx("div", { className: "timelog-active-actions", children: _jsx("button", { className: isBaselineWorkEnabled ? "primary-button" : "shell-button", type: "button", onClick: isBaselineWorkEnabled ? onStopWorkBaseline : onStartWorkBaseline, children: isBaselineWorkEnabled ? "Stop work" : "Start work" }) })] })] }), _jsxs("div", { className: "sidebar-card timelog-active-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Active time log" }), _jsx("p", { className: "muted", children: "The running log stays pinned here so it is always easy to stop or correct." })] }) }), activeLog ? (_jsxs("div", { className: "timelog-active-row", children: [_jsxs("div", { className: "timelog-active-copy", children: [_jsx("strong", { children: activeLog.title }), _jsx("span", { className: "tiny-text", children: activeLog.contextLabel }), activeLogIsOutsideCurrentFilters ? (_jsx("span", { className: "tiny-text", children: "This running timelog is outside the current visible date/filter range, but it is still active." })) : null, _jsxs("span", { className: "status-chip", children: ["Running \u2022 ", formatTrackedMinutes(calculateLiveDurationMinutes(activeLog, now))] })] }), _jsx("div", { className: "timelog-active-actions", children: activeLog.isSystemBackground ? (_jsx("button", { className: "primary-button", type: "button", onClick: onStopWorkBaseline, children: "Stop work" })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => onStopTracking(activeLog.targetType, activeLog.targetId), children: "Stop" }), _jsx("button", { className: "small-button", type: "button", disabled: Boolean(activeLog.isArchivedTarget), onClick: () => (activeLog.targetType === "todo" ? onOpenTodoDetail(activeLog.targetId) : onOpenActivityDetail(activeLog.targetId)), children: activeLog.isArchivedTarget ? "Archived" : "Open source" })] })) })] })) : (_jsxs("div", { className: "timelog-active-empty", children: [_jsx("strong", { children: "No active time log" }), _jsx("span", { className: "muted", children: "Start a timer from Todos, Activities, Calendar, or this workspace." })] }))] }), _jsxs("div", { className: "sidebar-card time-logs-primary-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: "All time logs" }), _jsx("p", { className: "muted", children: "Most recent first. Edit date, start, stop, and comment inline." })] }), _jsxs("div", { className: "timelog-card-header-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onStartAdhocTimeLog({
                                                        domain: domainFilter === "all" ? "" : domainFilter,
                                                        project: projectFilter === "all" ? "" : projectFilter,
                                                        activity: activityFilter === "all" ? "" : activityFilter,
                                                    }), children: "New running log" }), _jsxs("span", { className: "status-chip", children: [visibleListLogs.length, " visible"] })] })] }), _jsxs("div", { ref: timeLogScrollAreaRef, className: "time-log-editor-scroll-area", style: timeLogTableStyle, children: [_jsxs("div", { className: "time-log-sticky-controls", children: [_jsx("div", { className: "time-log-toolbar", children: _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "time-log-search", children: "Search" }), _jsx("input", { id: "time-log-search", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "Filter by title or comment" })] }) }), _jsx("div", { className: "time-log-editor-header", "aria-hidden": "true", children: timeLogColumns.map((column) => (_jsxs("span", { className: `time-log-header-cell${column.align === "right" ? " time-log-header-cell-right" : ""}`, children: [_jsx("span", { children: column.label }), column.resizable ? (_jsx("button", { className: "time-log-column-resize-handle", type: "button", "aria-label": `Resize ${column.label} column`, onMouseDown: (event) => startTimeLogColumnResize(column.key, event) })) : null] }, column.key))) })] }), _jsxs("div", { className: "time-log-editor-table", children: [visibleListLogs.length ? visibleListLogs.map((log) => {
                                                    const running = log.startTime === log.endTime;
                                                    const displayedMinutes = running ? calculateLiveDurationMinutes(log, now) : log.durationMinutes;
                                                    const draft = getTimeLogDraft(log);
                                                    return (_jsxs("div", { className: `time-log-editor-row${running ? " time-log-editor-row-active" : ""}`, children: [_jsx("input", { list: "timelog-project-options", value: draft.project, onChange: (event) => updateTimeLogDraft(log, { project: event.target.value }), onBlur: () => commitTimeLogDraft(log), onKeyDown: (event) => handleTimeLogDraftKeyDown(event, log), placeholder: "Project", disabled: Boolean(log.isArchivedTarget || log.isSystemBackground), "aria-label": "Timelog project" }), _jsx("input", { list: "timelog-activity-options", value: draft.activity, onChange: (event) => updateTimeLogDraft(log, { activity: event.target.value }), onBlur: () => commitTimeLogDraft(log), onKeyDown: (event) => handleTimeLogDraftKeyDown(event, log), placeholder: "Activity", disabled: Boolean(log.isArchivedTarget || log.isSystemBackground), "aria-label": "Timelog activity" }), log.targetType === "todo" && !log.isArchivedTarget ? (_jsx("input", { value: draft.title, onChange: (event) => updateTimeLogDraft(log, { title: event.target.value }), onBlur: () => commitTimeLogDraft(log), onKeyDown: (event) => handleTimeLogDraftKeyDown(event, log), placeholder: "Title", disabled: Boolean(log.isSystemBackground), "aria-label": "Timelog title" })) : (_jsxs("button", { type: "button", className: "time-log-source-button", disabled: Boolean(log.isArchivedTarget || log.isSystemBackground), onClick: () => (log.targetType === "todo" ? onOpenTodoDetail(log.targetId) : onOpenActivityDetail(log.targetId)), children: [_jsx("strong", { children: log.title }), _jsx("span", { className: "tiny-text", children: log.contextLabel })] })), _jsx(DateInput, { value: draft.date, onChange: (event) => updateTimeLogDraft(log, { date: event.target.value }), onBlur: () => commitTimeLogDraft(log), onKeyDown: (event) => handleTimeLogDraftKeyDown(event, log), disabled: Boolean(log.isSystemBackground) }), _jsx("input", { type: "time", step: 300, value: draft.startTime, onChange: (event) => updateTimeLogDraft(log, { startTime: event.target.value }), onBlur: () => commitTimeLogDraft(log), onKeyDown: (event) => handleTimeLogDraftKeyDown(event, log), disabled: Boolean(log.isSystemBackground) }), _jsx("input", { type: "time", step: 300, value: draft.endTime, onChange: (event) => updateTimeLogDraft(log, { endTime: event.target.value }), onBlur: () => commitTimeLogDraft(log), onKeyDown: (event) => handleTimeLogDraftKeyDown(event, log), disabled: Boolean(log.isSystemBackground) }), _jsx("span", { className: "status-chip", children: running ? `Running • ${formatTrackedMinutes(displayedMinutes)}` : formatMinutes(displayedMinutes) }), _jsx("input", { value: draft.notes, onChange: (event) => updateTimeLogDraft(log, { notes: event.target.value }), onBlur: () => commitTimeLogDraft(log), onKeyDown: (event) => handleTimeLogDraftKeyDown(event, log), placeholder: "Comment", disabled: Boolean(log.isSystemBackground) }), _jsx("div", { className: "time-log-inline-actions", children: log.isSystemBackground ? (_jsx("span", { className: "status-chip", children: "Managed by Work mode" })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: `small-button${running ? " primary-button" : ""}`, type: "button", onClick: () => (running ? onStopTracking(log.targetType, log.targetId) : onStartTracking(log.targetType, log.targetId)), children: running ? "Stop" : "Start" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteTimeLog(log.id), children: "Delete" })] })) })] }, log.id));
                                                }) : _jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No time logs yet" }), _jsx("p", { children: "Start and stop work from Tasks, Meetings, or Calendar, then manage the logs here." })] }), listOlderLogs.length > visibleListLogs.length - listRecentLogs.length ? (_jsx("div", { className: "time-log-list-footnote", children: "Scroll down to load older timelogs. Showing the most recent 7 days first." })) : null, _jsx("datalist", { id: "timelog-project-options", children: structureOptions.projects.map((option) => (_jsx("option", { value: option }, option))) }), _jsx("datalist", { id: "timelog-activity-options", children: structureOptions.activities.map((option) => (_jsx("option", { value: option }, option))) })] })] })] }), _jsxs("details", { className: "workspace-disclosure time-disclosure-card", children: [_jsx("summary", { children: "Insights" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "time-summary-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Active timers" }), _jsx("div", { className: "time-summary-stat", children: runningLogs.length }), _jsx("div", { className: "stack tight-stack", children: runningLogs.length ? runningLogs.map((log) => (_jsxs("div", { className: "list-item", children: [_jsxs("div", { children: [_jsx("strong", { children: log.title }), _jsx("div", { className: "tiny-text", children: log.contextLabel })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => onStopTracking(log.targetType, log.targetId), children: "Stop" })] }, log.id))) : _jsx("p", { className: "muted", children: "No timers are running right now." }) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Compare periods" }), _jsx("div", { className: "time-summary-stat", children: formatMinutes(currentTotalMinutes) }), _jsxs("div", { className: "stack tight-stack", children: [_jsxs("div", { className: "list-item", children: [_jsx("span", { children: "Previous period" }), _jsx("strong", { children: formatMinutes(comparisonTotalMinutes) })] }), _jsxs("div", { className: "list-item", children: [_jsx("span", { children: "Delta" }), _jsxs("strong", { className: comparisonDeltaMinutes >= 0 ? "time-delta-positive" : "time-delta-negative", children: [comparisonDeltaMinutes >= 0 ? "+" : "", formatMinutes(comparisonDeltaMinutes)] })] }), comparisonRange ? _jsx("div", { className: "tiny-text", children: comparisonRange.label }) : null] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "By workspace" }), _jsx("div", { className: "stack tight-stack", children: workspaceTotals.length ? workspaceTotals.map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label))) : _jsx("p", { className: "muted", children: "No logged time in this range." }) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "By work type" }), _jsx("div", { className: "stack tight-stack", children: workTypeTotals.length ? workTypeTotals.map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label))) : _jsx("p", { className: "muted", children: "No logged time in this range." }) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Per day" }), _jsx("div", { className: "stack tight-stack", children: dailyTotals.slice(0, 8).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.date }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.date))) })] })] }), _jsxs("div", { className: "time-visual-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Daily trend" }), _jsx("p", { className: "muted", children: "A quick visual read of where time clustered across the current range." })] }) }), _jsx("div", { className: "time-trend-list", children: dailyTotals.slice(0, 10).map((entry) => (_jsxs("div", { className: "time-trend-row", children: [_jsx("span", { className: "tiny-text", children: entry.date }), _jsx("div", { className: "time-trend-bar", children: _jsx("span", { style: { width: `${(entry.minutes / maxDailyMinutes) * 100}%` } }) }), _jsx("strong", { children: formatMinutes(entry.minutes) })] }, entry.date))) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Stacked summary" }), _jsx("p", { className: "muted", children: "A compact split between workspace and work-type effort in the selected range." })] }) }), _jsx("div", { className: "time-stacked-strip", children: stackedSummary.map((entry) => (_jsx("span", { title: `${entry.label}: ${formatMinutes(entry.minutes)}`, style: { width: `${(entry.minutes / stackedSummaryTotal) * 100}%` } }, entry.label))) }), _jsx("div", { className: "section-list", children: stackedSummary.map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label))) })] })] })] })] }), _jsxs("details", { className: "workspace-disclosure time-disclosure-card", children: [_jsx("summary", { children: "Exports" }), _jsx("div", { className: "workspace-disclosure-body stack", children: _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Grouped tables" }), _jsx("p", { className: "muted", children: "Use these as dashboard tables now, and as chart-ready exports later." })] }) }), _jsxs("div", { className: "time-grouped-grid", children: [_jsxs("div", { className: "stack tight-stack", children: [_jsx("strong", { children: "Projects" }), projectTotals.slice(0, 10).map((entry) => _jsxs("div", { className: "list-item", children: [_jsx("span", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label))] }), _jsxs("div", { className: "stack tight-stack", children: [_jsx("strong", { children: "Domains" }), domainTotals.slice(0, 10).map((entry) => _jsxs("div", { className: "list-item", children: [_jsx("span", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label))] }), _jsxs("div", { className: "stack tight-stack", children: [_jsx("strong", { children: "Activities" }), activityTotals.slice(0, 10).map((entry) => (_jsxs("button", { className: "list-item list-item-button", type: "button", disabled: Boolean(entry.isArchivedTarget), onClick: () => entry.targetType === "activity" ? onOpenActivityDetail(entry.targetId) : onOpenTodoDetail(entry.targetId), children: [_jsx("span", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, `${entry.targetType}-${entry.targetId}`)))] })] })] }) })] }), _jsxs("details", { className: "workspace-disclosure time-disclosure-card", children: [_jsx("summary", { children: "Saved reports" }), _jsx("div", { className: "workspace-disclosure-body stack", children: _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Saved reports" }), _jsx("p", { className: "muted", children: "Save the current range and filters as a reusable reporting view." })] }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "time-report-preset-label", children: "Preset name" }), _jsx("input", { id: "time-report-preset-label", value: presetDraft, onChange: (event) => setPresetDraft(event.target.value), placeholder: "For example: This month - Product", onKeyDown: (event) => {
                                                                    if (event.key === "Enter" && presetDraft.trim()) {
                                                                        event.preventDefault();
                                                                        onSaveReportPreset({
                                                                            label: presetDraft.trim(),
                                                                            fromDate,
                                                                            toDate,
                                                                            domain: domainFilter === "all" ? "" : domainFilter,
                                                                            project: projectFilter === "all" ? "" : projectFilter,
                                                                        });
                                                                        setPresetDraft("");
                                                                    }
                                                                } })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                            if (!presetDraft.trim())
                                                                return;
                                                            onSaveReportPreset({
                                                                label: presetDraft.trim(),
                                                                fromDate,
                                                                toDate,
                                                                domain: domainFilter === "all" ? "" : domainFilter,
                                                                project: projectFilter === "all" ? "" : projectFilter,
                                                            });
                                                            setPresetDraft("");
                                                        }, children: "Save preset" })] }), reportPresets.length ? (_jsx("div", { className: "section-list", children: reportPresets.map((preset) => (_jsxs("div", { className: "list-item", children: [_jsx("button", { className: "list-item-button list-item-button-inline", type: "button", onClick: () => applySavedPreset(preset), children: _jsxs("span", { children: [_jsx("strong", { children: preset.label }), _jsxs("span", { className: "tiny-text", children: [preset.fromDate, " to ", preset.toDate, preset.domain ? ` - ${preset.domain}` : "", preset.project ? ` - ${preset.project}` : ""] })] }) }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteReportPreset(preset.id), children: "Delete" })] }, preset.id))) })) : (_jsx("p", { className: "muted", children: "No saved report presets yet." }))] }) })] })] }) })] }));
};
