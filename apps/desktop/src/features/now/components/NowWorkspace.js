import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { formatStockholmDate } from "../../../lib/time/stockholm";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "../../../lib/time/tracking";
const RECENT_TASK_WINDOW_DAYS = 60;
const UPCOMING_MEETING_LIMIT = 12;
const COMMON_ACTIVITY_LIMIT = 18;
const COMMON_PROJECT_LIMIT = 18;
const addDays = (value, days) => {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
};
const daysBetween = (fromDate, toDate) => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
};
const formatDateLabel = (value) => {
    if (!value)
        return "No date";
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
};
const formatTimeLabel = (value) => (value || "").slice(0, 5);
const formatSlotTime = (slot) => `${String(Math.floor(slot / 12)).padStart(2, "0")}:${String((slot % 12) * 5).padStart(2, "0")}`;
const formatMeetingLabel = (date, time) => `${formatDateLabel(date)}${time ? ` - ${formatTimeLabel(time)}` : ""}`;
const scoreToSize = (rank, total, running) => {
    if (running || rank === 0)
        return "hero";
    if (rank <= Math.max(2, Math.floor(total * 0.18)))
        return "large";
    if (rank <= Math.max(5, Math.floor(total * 0.45)))
        return "medium";
    return "small";
};
const safeTitle = (value, fallback) => value?.trim() || fallback;
const buildRecentEntryMeta = (parts) => parts.filter((part) => Boolean(part && part.trim()));
export const NowWorkspace = ({ todos, activities, timeLogs, calendarItems, settings, onStartTracking, onStopTracking, onOpenTodoDetail, onOpenActivityDetail, onOpenProject, onSaveSettings, }) => {
    const [now, setNow] = useState(() => new Date());
    const [showPrivateItems, setShowPrivateItems] = useState(settings.calendarShowPrivate ?? (settings.calendarVisibilityFilter === "public" ? false : true));
    const [showBusinessItems, setShowBusinessItems] = useState(settings.calendarShowBusiness ?? (settings.calendarVisibilityFilter === "private" ? false : true));
    useEffect(() => {
        const hasRunningLog = timeLogs.some((entry) => isTimeLogRunning(entry));
        if (!hasRunningLog)
            return;
        const intervalId = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(intervalId);
    }, [timeLogs]);
    useEffect(() => {
        setShowPrivateItems(settings.calendarShowPrivate ?? (settings.calendarVisibilityFilter === "public" ? false : true));
        setShowBusinessItems(settings.calendarShowBusiness ?? (settings.calendarVisibilityFilter === "private" ? false : true));
    }, [settings.calendarShowBusiness, settings.calendarShowPrivate, settings.calendarVisibilityFilter]);
    useEffect(() => {
        if (settings.calendarShowPrivate === showPrivateItems &&
            settings.calendarShowBusiness === showBusinessItems) {
            return;
        }
        onSaveSettings({
            ...settings,
            calendarShowPrivate: showPrivateItems,
            calendarShowBusiness: showBusinessItems,
            calendarVisibilityFilter: showPrivateItems && showBusinessItems
                ? "all"
                : showPrivateItems
                    ? "private"
                    : showBusinessItems
                        ? "public"
                        : settings.calendarVisibilityFilter ?? "all",
        });
    }, [onSaveSettings, settings, showBusinessItems, showPrivateItems]);
    const today = formatStockholmDate(now);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
    const todoLookup = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo])), [todos]);
    const timeLogsByTarget = useMemo(() => {
        const grouped = new Map();
        timeLogs.forEach((entry) => {
            const key = `${entry.targetType}:${entry.targetId}`;
            const current = grouped.get(key) || [];
            current.push(entry);
            grouped.set(key, current);
        });
        return grouped;
    }, [timeLogs]);
    const isVisibleByPrivacy = (isPrivate) => isPrivate ? showPrivateItems : showBusinessItems;
    const recentTaskEntries = useMemo(() => {
        const cutoffDate = addDays(today, -RECENT_TASK_WINDOW_DAYS);
        const scored = todos
            .filter((todo) => !todo.isDone && isVisibleByPrivacy(Boolean(todo.isPrivate)))
            .map((todo) => {
            const logs = timeLogsByTarget.get(`todo:${todo.id}`) || [];
            const runningLog = getRunningTimeLog(logs);
            const effectiveMinutes = logs.reduce((sum, entry) => sum + (runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes), 0);
            const recencyScore = logs.reduce((sum, entry) => {
                const logMinutes = runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes;
                return sum + logMinutes / (1 + daysBetween(entry.date, today) * 0.16);
            }, 0);
            const scheduledDate = todo.doOn || todo.dueDate || "";
            const scheduledBoost = scheduledDate && scheduledDate <= today ? 120 : scheduledDate && scheduledDate <= addDays(today, 7) ? 70 : 0;
            const priorityBoost = todo.isPriority ? 90 : 0;
            const runningBoost = runningLog ? 320 : 0;
            const linkedActivity = todo.activityId ? activityLookup[todo.activityId] : null;
            const score = recencyScore + scheduledBoost + priorityBoost + runningBoost;
            const include = Boolean(runningLog) || score > 0 || scheduledDate >= cutoffDate || effectiveMinutes > 0;
            return {
                id: todo.id,
                title: safeTitle(todo.description, "Untitled task"),
                project: linkedActivity?.project || todo.project || "No project",
                activity: linkedActivity?.description || todo.activity || "Unassigned",
                dateLabel: scheduledDate ? formatDateLabel(scheduledDate) : "No date",
                score,
                totalMinutes: effectiveMinutes,
                running: Boolean(runningLog),
                runningLabel: runningLog ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now)) : "",
                isPriority: Boolean(todo.isPriority),
                include,
            };
        })
            .filter((entry) => entry.include)
            .sort((left, right) => right.score - left.score || right.totalMinutes - left.totalMinutes || left.title.localeCompare(right.title));
        return scored.map((entry, index, all) => ({
            id: entry.id,
            title: entry.title,
            project: entry.project,
            activity: entry.activity,
            dateLabel: entry.dateLabel,
            score: entry.score,
            totalMinutes: entry.totalMinutes,
            running: entry.running,
            runningLabel: entry.runningLabel,
            isPriority: entry.isPriority,
            size: scoreToSize(index, all.length, entry.running),
        }));
    }, [activityLookup, now, showBusinessItems, showPrivateItems, timeLogsByTarget, today, todos]);
    const upcomingMeetings = useMemo(() => {
        return calendarItems
            .filter((item) => item.targetType === "activity")
            .map((item) => {
            const activity = activityLookup[item.targetId];
            if (!activity || activity.type !== "meeting" || !isVisibleByPrivacy(Boolean(activity.isPrivate)))
                return null;
            const startTime = activity.startTime || formatSlotTime(item.startSlot);
            const fallbackEndSlot = item.startSlot + Math.max(item.durationSlots, 12);
            const endTime = activity.endTime || formatSlotTime(fallbackEndSlot);
            const startDateTime = new Date(`${item.date}T${startTime || "00:00"}:00`);
            const endDateTime = new Date(`${item.date}T${endTime || startTime || "00:00"}:00`);
            const runningLog = getRunningTimeLog(timeLogsByTarget.get(`activity:${activity.id}`) || []);
            if (!runningLog && endDateTime.getTime() < now.getTime())
                return null;
            const hoursUntilStart = Math.max(0, (startDateTime.getTime() - now.getTime()) / 3600000);
            return {
                id: activity.id,
                title: safeTitle(activity.description, "Meeting"),
                project: activity.project || "No project",
                whenLabel: formatMeetingLabel(item.date, startTime),
                running: Boolean(runningLog),
                runningLabel: runningLog ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now)) : "",
                score: (runningLog ? 420 : 240) - Math.min(220, hoursUntilStart * 5),
                startTimestamp: startDateTime.getTime(),
            };
        })
            .filter((entry) => Boolean(entry))
            .sort((left, right) => {
            if (left.running !== right.running)
                return left.running ? -1 : 1;
            return left.startTimestamp - right.startTimestamp;
        })
            .slice(0, UPCOMING_MEETING_LIMIT)
            .map(({ startTimestamp: _ignored, ...entry }) => entry);
    }, [activityLookup, calendarItems, now, showBusinessItems, showPrivateItems, timeLogsByTarget]);
    const commonActivities = useMemo(() => {
        return activities
            .filter((activity) => activity.type !== "meeting" && isVisibleByPrivacy(Boolean(activity.isPrivate)))
            .map((activity) => {
            const directLogs = timeLogsByTarget.get(`activity:${activity.id}`) || [];
            const linkedTaskLogs = todos
                .filter((todo) => !todo.isDone && todo.activityId === activity.id && isVisibleByPrivacy(Boolean(todo.isPrivate)))
                .flatMap((todo) => timeLogsByTarget.get(`todo:${todo.id}`) || []);
            const allLogs = [...directLogs, ...linkedTaskLogs];
            const runningLog = getRunningTimeLog(directLogs);
            const totalMinutes = allLogs.reduce((sum, entry) => sum + (runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes), 0);
            const recencyScore = allLogs.reduce((sum, entry) => {
                const minutes = runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes;
                return sum + minutes / (1 + daysBetween(entry.date, today) * 0.16);
            }, 0);
            const openTaskCount = todos.filter((todo) => !todo.isDone && todo.activityId === activity.id && isVisibleByPrivacy(Boolean(todo.isPrivate))).length;
            const score = recencyScore + openTaskCount * 55 + (runningLog ? 280 : 0);
            return {
                id: activity.id,
                title: safeTitle(activity.description, "Activity"),
                project: activity.project || "No project",
                openTaskCount,
                totalMinutes,
                running: Boolean(runningLog),
                runningLabel: runningLog ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now)) : "",
                score,
            };
        })
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
            .slice(0, COMMON_ACTIVITY_LIMIT);
    }, [activities, now, showBusinessItems, showPrivateItems, timeLogsByTarget, today, todos]);
    const commonProjects = useMemo(() => {
        const aggregates = new Map();
        const ensure = (project) => {
            const key = safeTitle(project, "No project");
            const current = aggregates.get(key) || { project: key, totalMinutes: 0, openTaskCount: 0, upcomingMeetings: 0, score: 0 };
            aggregates.set(key, current);
            return current;
        };
        todos.forEach((todo) => {
            if (todo.isDone || !isVisibleByPrivacy(Boolean(todo.isPrivate)))
                return;
            const linkedActivity = todo.activityId ? activityLookup[todo.activityId] : null;
            ensure(linkedActivity?.project || todo.project).openTaskCount += 1;
        });
        upcomingMeetings.forEach((meeting) => {
            ensure(meeting.project).upcomingMeetings += 1;
        });
        timeLogs.forEach((log) => {
            const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
            const activity = log.targetType === "activity"
                ? activityLookup[log.targetId]
                : todo?.activityId
                    ? activityLookup[todo.activityId]
                    : null;
            const targetIsPrivate = log.targetType === "activity" ? Boolean(activity?.isPrivate) : Boolean(todo?.isPrivate);
            if (!isVisibleByPrivacy(targetIsPrivate))
                return;
            const entry = ensure(activity?.project || todo?.project || "No project");
            const minutes = isTimeLogRunning(log) ? calculateLiveDurationMinutes(log, now) : log.durationMinutes;
            entry.totalMinutes += minutes;
            entry.score += minutes / (1 + daysBetween(log.date, today) * 0.16);
        });
        return Array.from(aggregates.values())
            .map((entry) => ({
            ...entry,
            score: entry.score + entry.openTaskCount * 45 + entry.upcomingMeetings * 60,
        }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score || left.project.localeCompare(right.project))
            .slice(0, COMMON_PROJECT_LIMIT);
    }, [activityLookup, now, showBusinessItems, showPrivateItems, timeLogs, today, todoLookup, todos, upcomingMeetings]);
    const activeTimeLog = useMemo(() => timeLogs.find((entry) => isTimeLogRunning(entry)) || null, [timeLogs]);
    const runningLogSummary = useMemo(() => {
        if (!activeTimeLog)
            return null;
        if (activeTimeLog.targetType === "todo") {
            const todo = todoLookup[activeTimeLog.targetId];
            if (!todo)
                return null;
            if (!isVisibleByPrivacy(Boolean(todo.isPrivate)))
                return null;
            const linkedActivity = todo.activityId ? activityLookup[todo.activityId] : null;
            return {
                kind: "task",
                title: safeTitle(todo.description, "Untitled task"),
                domain: linkedActivity?.domain || todo.domain || "No domain",
                project: linkedActivity?.project || todo.project || "No project",
                activity: linkedActivity?.description || todo.activity || "Unassigned",
                elapsedLabel: formatTrackedMinutes(calculateLiveDurationMinutes(activeTimeLog, now)),
                targetType: "todo",
                targetId: todo.id,
            };
        }
        const activity = activityLookup[activeTimeLog.targetId];
        if (!activity)
            return null;
        if (!isVisibleByPrivacy(Boolean(activity.isPrivate)))
            return null;
        return {
            kind: activity.type === "meeting" ? "meeting" : "activity",
            title: safeTitle(activity.description, activity.type === "meeting" ? "Meeting" : "Activity"),
            domain: activity.domain || "No domain",
            project: activity.project || "No project",
            activity: activity.activity || "Unassigned",
            elapsedLabel: formatTrackedMinutes(calculateLiveDurationMinutes(activeTimeLog, now)),
            targetType: "activity",
            targetId: activity.id,
        };
    }, [activeTimeLog, activityLookup, now, showBusinessItems, showPrivateItems, todoLookup]);
    const recentEntries = useMemo(() => {
        const rawEntries = [
            ...recentTaskEntries.map((task) => ({
                key: `task:${task.id}`,
                kind: "task",
                title: task.title,
                meta: buildRecentEntryMeta([
                    task.activity,
                    task.project,
                    task.dateLabel,
                    task.running ? `Running - ${task.runningLabel}` : task.totalMinutes ? formatTrackedMinutes(task.totalMinutes) : "No time yet",
                ]),
                score: task.score,
                running: task.running,
                size: task.size,
                isPriority: task.isPriority,
                taskId: task.id,
            })),
            ...upcomingMeetings.map((meeting) => ({
                key: `meeting:${meeting.id}`,
                kind: "meeting",
                title: meeting.title,
                meta: buildRecentEntryMeta([
                    meeting.project,
                    meeting.whenLabel,
                    meeting.running ? `Running - ${meeting.runningLabel}` : "Scheduled",
                ]),
                score: meeting.score,
                running: meeting.running,
                size: "small",
                isPriority: false,
                activityId: meeting.id,
            })),
            ...commonActivities.map((activity) => ({
                key: `activity:${activity.id}`,
                kind: "activity",
                title: activity.title,
                meta: buildRecentEntryMeta([
                    activity.project,
                    activity.openTaskCount ? `${activity.openTaskCount} open tasks` : "No open tasks",
                    activity.running ? `Running - ${activity.runningLabel}` : formatTrackedMinutes(activity.totalMinutes),
                ]),
                score: activity.score,
                running: activity.running,
                size: "small",
                isPriority: false,
                activityId: activity.id,
            })),
            ...commonProjects.map((project) => ({
                key: `project:${project.project}`,
                kind: "project",
                title: project.project,
                meta: buildRecentEntryMeta([
                    project.openTaskCount ? `${project.openTaskCount} open tasks` : "No open tasks",
                    project.upcomingMeetings ? `${project.upcomingMeetings} upcoming meetings` : "No upcoming meetings",
                    formatTrackedMinutes(project.totalMinutes),
                ]),
                score: project.score,
                running: false,
                size: "small",
                isPriority: false,
                project: project.project,
            })),
        ].sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
        return rawEntries.map((entry, index, all) => ({
            ...entry,
            size: entry.kind === "task"
                ? entry.size
                : scoreToSize(index, all.length, entry.running),
        }));
    }, [commonActivities, commonProjects, recentTaskEntries, upcomingMeetings]);
    const openEntry = (entry) => {
        if (entry.kind === "task" && entry.taskId) {
            onOpenTodoDetail(entry.taskId);
            return;
        }
        if ((entry.kind === "meeting" || entry.kind === "activity") && entry.activityId) {
            onOpenActivityDetail(entry.activityId);
            return;
        }
        if (entry.kind === "project" && entry.project) {
            onOpenProject(entry.project);
        }
    };
    const renderActionButton = (entry) => {
        if (entry.kind === "project") {
            return (_jsx("button", { className: "small-button", type: "button", onClick: () => entry.project && onOpenProject(entry.project), children: "Open" }));
        }
        const targetType = entry.kind === "task" ? "todo" : "activity";
        const targetId = entry.kind === "task" ? entry.taskId : entry.activityId;
        if (!targetId)
            return null;
        return (_jsx("button", { className: `small-button${entry.running ? " primary-button" : ""}`, type: "button", onClick: () => {
                if (entry.running) {
                    onStopTracking(targetType, targetId);
                    return;
                }
                onStartTracking(targetType, targetId);
            }, children: entry.running ? "Stop" : "Start" }));
    };
    return (_jsxs("div", { className: "card now-workspace", children: [_jsxs("section", { className: "sidebar-card now-running-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { className: "now-section-copy", children: [_jsx("h3", { children: "Running now" }), _jsx("p", { className: "muted", children: "The current active timelog is always visible here." })] }) }), runningLogSummary ? (_jsxs("div", { className: "now-running-card-body", children: [_jsxs("div", { className: "now-running-card-main", children: [_jsxs("div", { className: "now-running-title-row", children: [_jsx("span", { className: "now-pill-kicker", children: runningLogSummary.kind === "meeting" ? "Meeting" : runningLogSummary.kind === "activity" ? "Activity" : "Task" }), _jsxs("span", { className: "status-chip", children: ["Running - ", runningLogSummary.elapsedLabel] })] }), _jsx("strong", { className: "now-running-title", children: runningLogSummary.title }), _jsxs("div", { className: "now-running-grid", children: [_jsxs("div", { className: "now-running-detail", children: [_jsx("span", { children: "Domain" }), _jsx("strong", { children: runningLogSummary.domain })] }), _jsxs("div", { className: "now-running-detail", children: [_jsx("span", { children: "Project" }), _jsx("strong", { children: runningLogSummary.project })] }), _jsxs("div", { className: "now-running-detail", children: [_jsx("span", { children: "Activity" }), _jsx("strong", { children: runningLogSummary.activity })] }), _jsxs("div", { className: "now-running-detail", children: [_jsx("span", { children: "Text" }), _jsx("strong", { children: runningLogSummary.title })] })] })] }), _jsxs("div", { className: "now-pill-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => onStopTracking(runningLogSummary.targetType, runningLogSummary.targetId), children: "Stop" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                            if (runningLogSummary.targetType === "todo") {
                                                onOpenTodoDetail(runningLogSummary.targetId);
                                                return;
                                            }
                                            onOpenActivityDetail(runningLogSummary.targetId);
                                        }, children: "Open" })] })] })) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No active timelog" }), _jsx("p", { children: "Start time from any recent task, meeting, or activity below and it will appear here." })] }))] }), _jsxs("section", { className: "sidebar-card now-section-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { className: "now-section-copy", children: [_jsx("h3", { children: "Recent" }), _jsx("p", { className: "muted", children: "Tasks, meetings, activities, and projects are mixed together here for quick access." })] }), _jsxs("div", { className: "page-actions now-visibility-actions", children: [_jsxs("label", { className: "compact-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showPrivateItems, onChange: (event) => setShowPrivateItems(event.target.checked) }), _jsx("span", { children: "Show private" })] }), _jsxs("label", { className: "compact-private-toggle calendar-top-filter-toggle", children: [_jsx("input", { type: "checkbox", checked: showBusinessItems, onChange: (event) => setShowBusinessItems(event.target.checked) }), _jsx("span", { children: "Show business" })] })] })] }), _jsx("div", { className: "now-pill-cloud", children: recentEntries.length ? (recentEntries.map((entry) => (_jsxs("div", { className: `now-pill-card${entry.kind === "project" ? " now-pill-card-project" : ""}`, "data-kind": entry.kind, "data-size": entry.size, "data-running": entry.running, "data-priority": entry.isPriority, children: [_jsxs("button", { type: "button", className: "now-pill-main", onClick: () => openEntry(entry), children: [_jsx("span", { className: "now-pill-kicker", children: entry.kind === "task"
                                                ? "Task"
                                                : entry.kind === "meeting"
                                                    ? "Meeting"
                                                    : entry.kind === "activity"
                                                        ? "Activity"
                                                        : "Project" }), _jsx("strong", { className: "now-pill-title", children: entry.title }), _jsx("span", { className: "now-pill-meta", children: entry.meta.map((value) => (_jsx("span", { children: value }, `${entry.key}:${value}`))) })] }), _jsx("div", { className: "now-pill-actions", children: renderActionButton(entry) })] }, entry.key)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "Nothing recent yet" }), _jsx("p", { children: "Recent tasks, meetings, activities, and projects will gather here automatically as you work." })] })) })] })] }));
};
