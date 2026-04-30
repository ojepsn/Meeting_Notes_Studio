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
export const NowWorkspace = ({ todos, activities, timeLogs, calendarItems, onStartTracking, onStopTracking, onOpenTodoDetail, onOpenActivityDetail, onOpenProject, }) => {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const hasRunningLog = timeLogs.some((entry) => isTimeLogRunning(entry));
        if (!hasRunningLog)
            return;
        const intervalId = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(intervalId);
    }, [timeLogs]);
    const today = formatStockholmDate(now);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
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
    const recentTaskEntries = useMemo(() => {
        const cutoffDate = addDays(today, -RECENT_TASK_WINDOW_DAYS);
        const scored = todos
            .filter((todo) => !todo.isDone)
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
    }, [activityLookup, now, timeLogsByTarget, today, todos]);
    const upcomingMeetings = useMemo(() => {
        return calendarItems
            .filter((item) => item.targetType === "activity")
            .map((item) => {
            const activity = activityLookup[item.targetId];
            if (!activity || activity.type !== "meeting")
                return null;
            const startTime = activity.startTime || formatSlotTime(item.startSlot);
            const fallbackEndSlot = item.startSlot + Math.max(item.durationSlots, 12);
            const endTime = activity.endTime || formatSlotTime(fallbackEndSlot);
            const startDateTime = new Date(`${item.date}T${startTime || "00:00"}:00`);
            const endDateTime = new Date(`${item.date}T${endTime || startTime || "00:00"}:00`);
            const runningLog = getRunningTimeLog(timeLogsByTarget.get(`activity:${activity.id}`) || []);
            if (!runningLog && endDateTime.getTime() < now.getTime())
                return null;
            return {
                id: activity.id,
                title: safeTitle(activity.description, "Meeting"),
                project: activity.project || "No project",
                whenLabel: formatMeetingLabel(item.date, startTime),
                running: Boolean(runningLog),
                runningLabel: runningLog ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now)) : "",
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
    }, [activityLookup, calendarItems, now, timeLogsByTarget, today]);
    const commonActivities = useMemo(() => {
        return activities
            .filter((activity) => activity.type !== "meeting")
            .map((activity) => {
            const directLogs = timeLogsByTarget.get(`activity:${activity.id}`) || [];
            const linkedTaskLogs = todos
                .filter((todo) => !todo.isDone && todo.activityId === activity.id)
                .flatMap((todo) => timeLogsByTarget.get(`todo:${todo.id}`) || []);
            const allLogs = [...directLogs, ...linkedTaskLogs];
            const runningLog = getRunningTimeLog(directLogs);
            const totalMinutes = allLogs.reduce((sum, entry) => sum + (runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes), 0);
            const recencyScore = allLogs.reduce((sum, entry) => {
                const minutes = runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes;
                return sum + minutes / (1 + daysBetween(entry.date, today) * 0.16);
            }, 0);
            const openTaskCount = todos.filter((todo) => !todo.isDone && todo.activityId === activity.id).length;
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
    }, [activities, now, timeLogsByTarget, today, todos]);
    const commonProjects = useMemo(() => {
        const aggregates = new Map();
        const ensure = (project) => {
            const key = safeTitle(project, "No project");
            const current = aggregates.get(key) || { project: key, totalMinutes: 0, openTaskCount: 0, upcomingMeetings: 0, score: 0 };
            aggregates.set(key, current);
            return current;
        };
        todos.forEach((todo) => {
            if (todo.isDone)
                return;
            const linkedActivity = todo.activityId ? activityLookup[todo.activityId] : null;
            const project = linkedActivity?.project || todo.project;
            ensure(project).openTaskCount += 1;
        });
        upcomingMeetings.forEach((meeting) => {
            ensure(meeting.project).upcomingMeetings += 1;
        });
        timeLogs.forEach((log) => {
            const todo = log.targetType === "todo" ? todos.find((entry) => entry.id === log.targetId) : null;
            const activity = log.targetType === "activity"
                ? activityLookup[log.targetId]
                : todo?.activityId
                    ? activityLookup[todo.activityId]
                    : null;
            const project = activity?.project || todo?.project || "No project";
            const entry = ensure(project);
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
    }, [activityLookup, now, timeLogs, today, todos, upcomingMeetings]);
    const runningCount = timeLogs.filter((entry) => isTimeLogRunning(entry)).length;
    return (_jsxs("div", { className: "card now-workspace", children: [_jsxs("div", { className: "now-summary-grid", children: [_jsxs("div", { className: "sidebar-card now-summary-card", children: [_jsx("span", { className: "topbar-eyebrow", children: "Quick access" }), _jsxs("strong", { children: [recentTaskEntries.length, " recent tasks"] }), _jsx("span", { className: "tiny-text", children: "Start or stop time fast, then open the task when you need full editing." })] }), _jsxs("div", { className: "sidebar-card now-summary-card", children: [_jsx("span", { className: "topbar-eyebrow", children: "Right now" }), _jsxs("strong", { children: [runningCount, " timers running"] }), _jsxs("span", { className: "tiny-text", children: [upcomingMeetings.length, " upcoming meetings are surfaced here too."] })] }), _jsxs("div", { className: "sidebar-card now-summary-card", children: [_jsx("span", { className: "topbar-eyebrow", children: "Reusable context" }), _jsxs("strong", { children: [commonActivities.length, " common activities"] }), _jsxs("span", { className: "tiny-text", children: [commonProjects.length, " commonly used projects are one click away."] })] })] }), _jsxs("section", { className: "sidebar-card now-section-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { className: "now-section-copy", children: [_jsx("h3", { children: "Recent tasks" }), _jsx("p", { className: "muted", children: "Frequently used and recent tasks surface first and grow larger as they matter more." })] }) }), _jsx("div", { className: "now-pill-cloud", children: recentTaskEntries.length ? (recentTaskEntries.map((task) => (_jsxs("div", { className: "now-pill-card", "data-kind": "task", "data-size": task.size, "data-running": task.running, "data-priority": task.isPriority, children: [_jsxs("button", { type: "button", className: "now-pill-main", onClick: () => onOpenTodoDetail(task.id), children: [_jsx("span", { className: "now-pill-kicker", children: "Task" }), _jsx("strong", { className: "now-pill-title", children: task.title }), _jsxs("span", { className: "now-pill-meta", children: [_jsx("span", { children: task.activity }), _jsx("span", { children: task.project }), _jsx("span", { children: task.dateLabel }), _jsx("span", { children: task.running ? `Running - ${task.runningLabel}` : task.totalMinutes ? formatTrackedMinutes(task.totalMinutes) : "No time yet" })] })] }), _jsx("div", { className: "now-pill-actions", children: _jsx("button", { className: `small-button${task.running ? " primary-button" : ""}`, type: "button", onClick: () => {
                                            if (task.running) {
                                                onStopTracking("todo", task.id);
                                                return;
                                            }
                                            onStartTracking("todo", task.id);
                                        }, children: task.running ? "Stop" : "Start" }) })] }, task.id)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No recent tasks yet" }), _jsx("p", { children: "Tasks with recent time, current scheduling, or running timers will appear here automatically." })] })) })] }), _jsxs("div", { className: "now-secondary-grid", children: [_jsxs("section", { className: "sidebar-card now-section-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { className: "now-section-copy", children: [_jsx("h3", { children: "Upcoming meetings" }), _jsx("p", { className: "muted", children: "Fast access to the meetings most likely to matter next." })] }) }), _jsx("div", { className: "now-pill-cloud now-pill-cloud-compact", children: upcomingMeetings.length ? (upcomingMeetings.map((meeting) => (_jsxs("div", { className: "now-pill-card", "data-kind": "meeting", "data-size": "small", "data-running": meeting.running, children: [_jsxs("button", { type: "button", className: "now-pill-main", onClick: () => onOpenActivityDetail(meeting.id), children: [_jsx("span", { className: "now-pill-kicker", children: "Meeting" }), _jsx("strong", { className: "now-pill-title", children: meeting.title }), _jsxs("span", { className: "now-pill-meta", children: [_jsx("span", { children: meeting.project }), _jsx("span", { children: meeting.whenLabel }), _jsx("span", { children: meeting.running ? `Running - ${meeting.runningLabel}` : "Scheduled" })] })] }), _jsx("div", { className: "now-pill-actions", children: _jsx("button", { className: `small-button${meeting.running ? " primary-button" : ""}`, type: "button", onClick: () => {
                                                    if (meeting.running) {
                                                        onStopTracking("activity", meeting.id);
                                                        return;
                                                    }
                                                    onStartTracking("activity", meeting.id);
                                                }, children: meeting.running ? "Stop" : "Start" }) })] }, meeting.id)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No upcoming meetings" }), _jsx("p", { children: "Scheduled meetings from Calendar will appear here as they come into view." })] })) })] }), _jsxs("section", { className: "sidebar-card now-section-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { className: "now-section-copy", children: [_jsx("h3", { children: "Common activities" }), _jsx("p", { className: "muted", children: "The activities you return to most often, with quick time control." })] }) }), _jsx("div", { className: "now-pill-cloud now-pill-cloud-compact", children: commonActivities.length ? (commonActivities.map((activity) => (_jsxs("div", { className: "now-pill-card", "data-kind": "activity", "data-size": "small", "data-running": activity.running, children: [_jsxs("button", { type: "button", className: "now-pill-main", onClick: () => onOpenActivityDetail(activity.id), children: [_jsx("span", { className: "now-pill-kicker", children: "Activity" }), _jsx("strong", { className: "now-pill-title", children: activity.title }), _jsxs("span", { className: "now-pill-meta", children: [_jsx("span", { children: activity.project }), _jsx("span", { children: activity.openTaskCount ? `${activity.openTaskCount} open tasks` : "No open tasks" }), _jsx("span", { children: activity.running ? `Running - ${activity.runningLabel}` : formatTrackedMinutes(activity.totalMinutes) })] })] }), _jsx("div", { className: "now-pill-actions", children: _jsx("button", { className: `small-button${activity.running ? " primary-button" : ""}`, type: "button", onClick: () => {
                                                    if (activity.running) {
                                                        onStopTracking("activity", activity.id);
                                                        return;
                                                    }
                                                    onStartTracking("activity", activity.id);
                                                }, children: activity.running ? "Stop" : "Start" }) })] }, activity.id)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No common activities yet" }), _jsx("p", { children: "Once activities gather repeated use, they will be surfaced here automatically." })] })) })] })] }), _jsxs("section", { className: "sidebar-card now-section-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { className: "now-section-copy", children: [_jsx("h3", { children: "Common projects" }), _jsx("p", { className: "muted", children: "Jump straight into the Time workspace filtered to the projects you use most." })] }) }), _jsx("div", { className: "now-pill-cloud now-pill-cloud-compact", children: commonProjects.length ? (commonProjects.map((project) => (_jsx("div", { className: "now-pill-card now-pill-card-project", "data-kind": "project", "data-size": "small", children: _jsxs("button", { type: "button", className: "now-pill-main", onClick: () => onOpenProject(project.project), children: [_jsx("span", { className: "now-pill-kicker", children: "Project" }), _jsx("strong", { className: "now-pill-title", children: project.project }), _jsxs("span", { className: "now-pill-meta", children: [_jsx("span", { children: project.openTaskCount ? `${project.openTaskCount} open tasks` : "No open tasks" }), _jsx("span", { children: project.upcomingMeetings ? `${project.upcomingMeetings} upcoming meetings` : "No upcoming meetings" }), _jsx("span", { children: formatTrackedMinutes(project.totalMinutes) })] })] }) }, project.project)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No common projects yet" }), _jsx("p", { children: "Projects start appearing here once time is logged against them or tasks are actively used." })] })) })] })] }));
};
