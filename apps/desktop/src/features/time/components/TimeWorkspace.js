import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { saveTextFile } from "../../../lib/storage/desktopStorage";
const formatMinutes = (minutes) => {
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
const calculateDurationMinutes = (date, startTime, endTime) => {
    const start = new Date(`${date}T${startTime || "00:00"}:00`);
    const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
};
const buildExportFilename = (kind, now = new Date()) => `notesmith-time-report-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${kind}`;
const csvCell = (value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
export const TimeWorkspace = ({ todos, activities, timeLogs, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onOpenTodoDetail, onOpenActivityDetail, }) => {
    const [selectedLogId, setSelectedLogId] = useState(null);
    const todoLookup = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo])), [todos]);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
    const enrichedLogs = useMemo(() => {
        return [...timeLogs]
            .map((log) => {
            if (log.targetType === "todo") {
                const todo = todoLookup[log.targetId];
                const linkedActivity = todo?.activityId ? activityLookup[todo.activityId] : null;
                return {
                    ...log,
                    title: todo?.description || "Deleted todo",
                    contextLabel: linkedActivity?.description || todo?.project || todo?.domain || "Unassigned todo",
                };
            }
            const activity = activityLookup[log.targetId];
            return {
                ...log,
                title: activity?.description || "Deleted activity",
                contextLabel: activity?.project || activity?.domain || (activity?.type === "meeting" ? "Meeting" : "Activity"),
            };
        })
            .sort((left, right) => `${right.date} ${right.startTime}`.localeCompare(`${left.date} ${left.startTime}`));
    }, [activityLookup, timeLogs, todoLookup]);
    const runningLogs = useMemo(() => enrichedLogs.filter((log) => log.startTime === log.endTime), [enrichedLogs]);
    const recentLogs = useMemo(() => enrichedLogs.slice(0, 24), [enrichedLogs]);
    const dailyTotals = useMemo(() => {
        const grouped = new Map();
        enrichedLogs.forEach((log) => grouped.set(log.date, (grouped.get(log.date) || 0) + log.durationMinutes));
        return Array.from(grouped.entries())
            .map(([date, minutes]) => ({ date, minutes }))
            .sort((left, right) => right.date.localeCompare(left.date));
    }, [enrichedLogs]);
    const activityTotals = useMemo(() => {
        const grouped = new Map();
        enrichedLogs.forEach((log) => {
            const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
            const linkedActivity = todo?.activityId ? activityLookup[todo.activityId] : null;
            const directActivity = log.targetType === "activity" ? activityLookup[log.targetId] : null;
            const aggregateActivity = linkedActivity || directActivity;
            const key = aggregateActivity ? `activity:${aggregateActivity.id}` : `${log.targetType}:${log.targetId}`;
            const label = aggregateActivity?.description || log.title;
            const existing = grouped.get(key) || {
                label,
                domain: aggregateActivity?.domain || todo?.domain || "",
                project: aggregateActivity?.project || todo?.project || "",
                minutes: 0,
                targetType: aggregateActivity ? "activity" : log.targetType,
                targetId: aggregateActivity?.id || log.targetId,
            };
            existing.minutes += log.durationMinutes;
            grouped.set(key, existing);
        });
        return Array.from(grouped.values()).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [activityLookup, enrichedLogs, todoLookup]);
    const projectTotals = useMemo(() => {
        const grouped = new Map();
        activityTotals.forEach((entry) => {
            const key = entry.project || "No project";
            grouped.set(key, (grouped.get(key) || 0) + entry.minutes);
        });
        return Array.from(grouped.entries())
            .map(([label, minutes]) => ({ label, minutes }))
            .sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [activityTotals]);
    const domainTotals = useMemo(() => {
        const grouped = new Map();
        activityTotals.forEach((entry) => {
            const key = entry.domain || "No domain";
            grouped.set(key, (grouped.get(key) || 0) + entry.minutes);
        });
        return Array.from(grouped.entries())
            .map(([label, minutes]) => ({ label, minutes }))
            .sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [activityTotals]);
    const selectedLog = useMemo(() => (selectedLogId ? enrichedLogs.find((log) => log.id === selectedLogId) ?? null : recentLogs[0] ?? null), [enrichedLogs, recentLogs, selectedLogId]);
    const openSelectedTarget = () => {
        if (!selectedLog)
            return;
        if (selectedLog.targetType === "todo") {
            onOpenTodoDetail(selectedLog.targetId);
            return;
        }
        onOpenActivityDetail(selectedLog.targetId);
    };
    const exportCsv = async () => {
        const rows = [
            ["Date", "Start", "End", "Minutes", "Type", "Title", "Context"],
            ...enrichedLogs.map((log) => [
                log.date,
                log.startTime,
                log.endTime,
                log.durationMinutes,
                log.targetType,
                log.title,
                log.contextLabel,
            ]),
        ];
        const content = rows.map((row) => row.map(csvCell).join(",")).join("\n");
        await saveTextFile({
            content,
            defaultFilename: buildExportFilename("csv"),
            filters: [{ name: "CSV report", extensions: ["csv"] }],
        });
    };
    const exportMarkdown = async () => {
        const content = [
            "# Time report",
            "",
            "## Active timers",
            ...(runningLogs.length
                ? runningLogs.map((log) => `- ${log.title} (${log.contextLabel}) started ${log.date} ${log.startTime}`)
                : ["- No active timers"]),
            "",
            "## Per day totals",
            ...(dailyTotals.length
                ? dailyTotals.map((entry) => `- ${entry.date}: ${formatMinutes(entry.minutes)}`)
                : ["- No logged time"]),
            "",
            "## Per activity totals",
            ...(activityTotals.length
                ? activityTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}${entry.project ? ` | ${entry.project}` : ""}`)
                : ["- No logged time"]),
            "",
            "## Per project totals",
            ...(projectTotals.length
                ? projectTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}`)
                : ["- No logged time"]),
            "",
            "## Per domain totals",
            ...(domainTotals.length
                ? domainTotals.map((entry) => `- ${entry.label}: ${formatMinutes(entry.minutes)}`)
                : ["- No logged time"]),
            "",
            "## Recent logs",
            ...(recentLogs.length
                ? recentLogs.map((log) => `- ${log.date} ${log.startTime}-${log.endTime} | ${log.title} | ${formatMinutes(log.durationMinutes)} | ${log.contextLabel}`)
                : ["- No recent logs"]),
        ].join("\n");
        await saveTextFile({
            content,
            defaultFilename: buildExportFilename("md"),
            filters: [{ name: "Markdown report", extensions: ["md"] }],
        });
    };
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal time-workspace-card", children: [_jsxs("div", { className: "card-header session-editor-header-minimal", children: [_jsxs("div", { children: [_jsx("h2", { children: "Time" }), _jsx("p", { className: "muted", children: "See what is running, correct logs in one place, and export clean summaries when you need them." })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => void exportCsv(), children: "Export CSV" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => void exportMarkdown(), children: "Export Markdown" })] })] }), _jsxs("div", { className: "time-workspace-layout", children: [_jsxs("section", { className: "time-workspace-main", children: [_jsxs("div", { className: "time-summary-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Active timers" }), _jsx("div", { className: "time-summary-stat", children: runningLogs.length }), _jsx("div", { className: "stack tight-stack", children: runningLogs.length ? (runningLogs.map((log) => (_jsxs("div", { className: "list-item", children: [_jsxs("div", { children: [_jsx("strong", { children: log.title }), _jsx("div", { className: "tiny-text", children: log.contextLabel })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => onStopTracking(log.targetType, log.targetId), children: "Stop" })] }, log.id)))) : (_jsx("p", { className: "muted", children: "No timers are running right now." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Per day" }), _jsx("div", { className: "stack tight-stack", children: dailyTotals.slice(0, 8).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.date }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.date))) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Per activity" }), _jsx("div", { className: "stack tight-stack", children: activityTotals.slice(0, 8).map((entry) => (_jsxs("button", { className: "list-item list-item-button", type: "button", onClick: () => entry.targetType === "activity"
                                                        ? onOpenActivityDetail(entry.targetId)
                                                        : onOpenTodoDetail(entry.targetId), children: [_jsxs("div", { children: [_jsx("strong", { children: entry.label }), _jsx("div", { className: "tiny-text", children: entry.project || entry.domain || "No project" })] }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, `${entry.targetType}-${entry.targetId}`))) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Per project" }), _jsx("div", { className: "stack tight-stack", children: projectTotals.slice(0, 8).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label))) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h3", { children: "Per domain" }), _jsx("div", { className: "stack tight-stack", children: domainTotals.slice(0, 8).map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.label }), _jsx("span", { children: formatMinutes(entry.minutes) })] }, entry.label))) })] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Recent logs" }), _jsx("p", { className: "muted", children: "This is the fastest place to repair missed stop times or adjust logged durations." })] }) }), _jsx("div", { className: "time-log-table", children: recentLogs.length ? (recentLogs.map((log) => (_jsxs("button", { type: "button", className: `timelog-list-item time-log-row${selectedLog?.id === log.id ? " time-log-row-selected" : ""}`, onClick: () => setSelectedLogId(log.id), children: [_jsxs("div", { children: [_jsx("strong", { children: log.title }), _jsx("div", { className: "tiny-text", children: log.contextLabel })] }), _jsx("span", { children: log.date }), _jsxs("span", { children: [log.startTime, " - ", log.endTime] }), _jsx("span", { children: formatMinutes(log.durationMinutes) })] }, log.id)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No time logs yet" }), _jsx("p", { children: "Start and stop work from Todos or Activities, then correct the logs here when needed." })] })) })] })] }), _jsx("aside", { className: "time-workspace-detail", children: selectedLog ? (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: selectedLog.title }), _jsxs("div", { className: "calendar-editor-meta", children: [_jsx("span", { className: "status-chip", children: selectedLog.targetType === "activity" ? "Activity" : "Todo" }), _jsx("span", { className: "status-chip", children: selectedLog.contextLabel })] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: openSelectedTarget, children: "Open source" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteTimeLog(selectedLog.id), children: "Delete" })] })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-log-date", children: "Date" }), _jsx("input", { id: "time-log-date", type: "date", value: selectedLog.date, onChange: (event) => onSaveTimeLog({
                                                        ...selectedLog,
                                                        date: event.target.value,
                                                        durationMinutes: calculateDurationMinutes(event.target.value, selectedLog.startTime, selectedLog.endTime),
                                                        updatedAt: new Date().toISOString(),
                                                    }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-log-start", children: "Start" }), _jsx("input", { id: "time-log-start", type: "time", step: 300, value: selectedLog.startTime, onChange: (event) => onSaveTimeLog({
                                                        ...selectedLog,
                                                        startTime: event.target.value,
                                                        durationMinutes: calculateDurationMinutes(selectedLog.date, event.target.value, selectedLog.endTime),
                                                        updatedAt: new Date().toISOString(),
                                                    }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-log-end", children: "End" }), _jsx("input", { id: "time-log-end", type: "time", step: 300, value: selectedLog.endTime, onChange: (event) => onSaveTimeLog({
                                                        ...selectedLog,
                                                        endTime: event.target.value,
                                                        durationMinutes: calculateDurationMinutes(selectedLog.date, selectedLog.startTime, event.target.value),
                                                        updatedAt: new Date().toISOString(),
                                                    }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "time-log-notes", children: "Notes" }), _jsx("textarea", { id: "time-log-notes", rows: 5, value: selectedLog.notes, onChange: (event) => onSaveTimeLog({
                                                ...selectedLog,
                                                notes: event.target.value,
                                                updatedAt: new Date().toISOString(),
                                            }) })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "sidebar-card compact-metric-card", children: [_jsx("span", { className: "tiny-text", children: "Duration" }), _jsx("strong", { children: formatMinutes(selectedLog.durationMinutes) })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onStartTracking(selectedLog.targetType, selectedLog.targetId), children: "Start" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onStopTracking(selectedLog.targetType, selectedLog.targetId), children: "Stop" })] })] })] })) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "Select a time log" }), _jsx("p", { children: "Choose a recent log to correct its timing, notes, or source context." })] })) })] })] }));
};
