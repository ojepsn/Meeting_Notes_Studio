import { useEffect, useMemo, useState } from "react";
import type { ActivityRecord, CalendarItemRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { formatStockholmDate } from "../../../lib/time/stockholm";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "../../../lib/time/tracking";

type NowWorkspaceProps = {
  todos: TodoRecord[];
  activities: ActivityRecord[];
  timeLogs: TimeLogRecord[];
  calendarItems: CalendarItemRecord[];
  onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onOpenTodoDetail: (todoId: string) => void;
  onOpenActivityDetail: (activityId: string) => void;
  onOpenProject: (project: string) => void;
};

type RecentTaskEntry = {
  id: string;
  title: string;
  project: string;
  activity: string;
  dateLabel: string;
  score: number;
  totalMinutes: number;
  running: boolean;
  runningLabel: string;
  size: "hero" | "large" | "medium" | "small";
  isPriority: boolean;
};

type UpcomingMeetingEntry = {
  id: string;
  title: string;
  project: string;
  whenLabel: string;
  running: boolean;
  runningLabel: string;
};

type CommonActivityEntry = {
  id: string;
  title: string;
  project: string;
  openTaskCount: number;
  totalMinutes: number;
  running: boolean;
  runningLabel: string;
  score: number;
};

type CommonProjectEntry = {
  project: string;
  totalMinutes: number;
  openTaskCount: number;
  upcomingMeetings: number;
  score: number;
};

const RECENT_TASK_WINDOW_DAYS = 60;
const UPCOMING_MEETING_LIMIT = 12;
const COMMON_ACTIVITY_LIMIT = 18;
const COMMON_PROJECT_LIMIT = 18;

const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
};

const daysBetween = (fromDate: string, toDate: string) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
};

const formatDateLabel = (value: string) => {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
};

const formatTimeLabel = (value: string) => (value || "").slice(0, 5);

const formatSlotTime = (slot: number) =>
  `${String(Math.floor(slot / 12)).padStart(2, "0")}:${String((slot % 12) * 5).padStart(2, "0")}`;

const formatMeetingLabel = (date: string, time: string) => `${formatDateLabel(date)}${time ? ` - ${formatTimeLabel(time)}` : ""}`;

const scoreToSize = (rank: number, total: number, running: boolean): RecentTaskEntry["size"] => {
  if (running || rank === 0) return "hero";
  if (rank <= Math.max(2, Math.floor(total * 0.18))) return "large";
  if (rank <= Math.max(5, Math.floor(total * 0.45))) return "medium";
  return "small";
};

const safeTitle = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

export const NowWorkspace = ({
  todos,
  activities,
  timeLogs,
  calendarItems,
  onStartTracking,
  onStopTracking,
  onOpenTodoDetail,
  onOpenActivityDetail,
  onOpenProject,
}: NowWorkspaceProps) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const hasRunningLog = timeLogs.some((entry) => isTimeLogRunning(entry));
    if (!hasRunningLog) return;
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, [timeLogs]);

  const today = formatStockholmDate(now);

  const activityLookup = useMemo(
    () => Object.fromEntries(activities.map((activity) => [activity.id, activity])) as Record<string, ActivityRecord>,
    [activities],
  );

  const timeLogsByTarget = useMemo(() => {
    const grouped = new Map<string, TimeLogRecord[]>();
    timeLogs.forEach((entry) => {
      const key = `${entry.targetType}:${entry.targetId}`;
      const current = grouped.get(key) || [];
      current.push(entry);
      grouped.set(key, current);
    });
    return grouped;
  }, [timeLogs]);

  const recentTaskEntries = useMemo<RecentTaskEntry[]>(() => {
    const cutoffDate = addDays(today, -RECENT_TASK_WINDOW_DAYS);
    const scored = todos
      .filter((todo) => !todo.isDone)
      .map((todo) => {
        const logs = timeLogsByTarget.get(`todo:${todo.id}`) || [];
        const runningLog = getRunningTimeLog(logs);
        const effectiveMinutes = logs.reduce(
          (sum, entry) => sum + (runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes),
          0,
        );
        const recencyScore = logs.reduce((sum, entry) => {
          const logMinutes = runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes;
          return sum + logMinutes / (1 + daysBetween(entry.date, today) * 0.16);
        }, 0);
        const scheduledDate = todo.doOn || todo.dueDate || "";
        const scheduledBoost =
          scheduledDate && scheduledDate <= today ? 120 : scheduledDate && scheduledDate <= addDays(today, 7) ? 70 : 0;
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

  const upcomingMeetings = useMemo<UpcomingMeetingEntry[]>(() => {
    return calendarItems
      .filter((item) => item.targetType === "activity")
      .map((item) => {
        const activity = activityLookup[item.targetId];
        if (!activity || activity.type !== "meeting") return null;
        const startTime = activity.startTime || formatSlotTime(item.startSlot);
        const fallbackEndSlot = item.startSlot + Math.max(item.durationSlots, 12);
        const endTime = activity.endTime || formatSlotTime(fallbackEndSlot);
        const startDateTime = new Date(`${item.date}T${startTime || "00:00"}:00`);
        const endDateTime = new Date(`${item.date}T${endTime || startTime || "00:00"}:00`);
        const runningLog = getRunningTimeLog(timeLogsByTarget.get(`activity:${activity.id}`) || []);
        if (!runningLog && endDateTime.getTime() < now.getTime()) return null;
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
      .filter((entry): entry is UpcomingMeetingEntry & { startTimestamp: number } => Boolean(entry))
      .sort((left, right) => {
        if (left.running !== right.running) return left.running ? -1 : 1;
        return left.startTimestamp - right.startTimestamp;
      })
      .slice(0, UPCOMING_MEETING_LIMIT)
      .map(({ startTimestamp: _ignored, ...entry }) => entry);
  }, [activityLookup, calendarItems, now, timeLogsByTarget, today]);

  const commonActivities = useMemo<CommonActivityEntry[]>(() => {
    return activities
      .filter((activity) => activity.type !== "meeting")
      .map((activity) => {
        const directLogs = timeLogsByTarget.get(`activity:${activity.id}`) || [];
        const linkedTaskLogs = todos
          .filter((todo) => !todo.isDone && todo.activityId === activity.id)
          .flatMap((todo) => timeLogsByTarget.get(`todo:${todo.id}`) || []);
        const allLogs = [...directLogs, ...linkedTaskLogs];
        const runningLog = getRunningTimeLog(directLogs);
        const totalMinutes = allLogs.reduce(
          (sum, entry) => sum + (runningLog?.id === entry.id ? calculateLiveDurationMinutes(entry, now) : entry.durationMinutes),
          0,
        );
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

  const commonProjects = useMemo<CommonProjectEntry[]>(() => {
    const aggregates = new Map<string, CommonProjectEntry>();
    const ensure = (project: string | null | undefined) => {
      const key = safeTitle(project, "No project");
      const current = aggregates.get(key) || { project: key, totalMinutes: 0, openTaskCount: 0, upcomingMeetings: 0, score: 0 };
      aggregates.set(key, current);
      return current;
    };

    todos.forEach((todo) => {
      if (todo.isDone) return;
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

  return (
    <div className="card now-workspace">
      <div className="now-summary-grid">
        <div className="sidebar-card now-summary-card">
          <span className="topbar-eyebrow">Quick access</span>
          <strong>{recentTaskEntries.length} recent tasks</strong>
          <span className="tiny-text">Start or stop time fast, then open the task when you need full editing.</span>
        </div>
        <div className="sidebar-card now-summary-card">
          <span className="topbar-eyebrow">Right now</span>
          <strong>{runningCount} timers running</strong>
          <span className="tiny-text">{upcomingMeetings.length} upcoming meetings are surfaced here too.</span>
        </div>
        <div className="sidebar-card now-summary-card">
          <span className="topbar-eyebrow">Reusable context</span>
          <strong>{commonActivities.length} common activities</strong>
          <span className="tiny-text">{commonProjects.length} commonly used projects are one click away.</span>
        </div>
      </div>

      <section className="sidebar-card now-section-card">
        <div className="card-header">
          <div className="now-section-copy">
            <h3>Recent tasks</h3>
            <p className="muted">Frequently used and recent tasks surface first and grow larger as they matter more.</p>
          </div>
        </div>
        <div className="now-pill-cloud">
          {recentTaskEntries.length ? (
            recentTaskEntries.map((task) => (
              <div
                key={task.id}
                className="now-pill-card"
                data-kind="task"
                data-size={task.size}
                data-running={task.running}
                data-priority={task.isPriority}
              >
                <button type="button" className="now-pill-main" onClick={() => onOpenTodoDetail(task.id)}>
                  <span className="now-pill-kicker">Task</span>
                  <strong className="now-pill-title">{task.title}</strong>
                  <span className="now-pill-meta">
                    <span>{task.activity}</span>
                    <span>{task.project}</span>
                    <span>{task.dateLabel}</span>
                    <span>{task.running ? `Running - ${task.runningLabel}` : task.totalMinutes ? formatTrackedMinutes(task.totalMinutes) : "No time yet"}</span>
                  </span>
                </button>
                <div className="now-pill-actions">
                  <button
                    className={`small-button${task.running ? " primary-button" : ""}`}
                    type="button"
                    onClick={() => {
                      if (task.running) {
                        onStopTracking("todo", task.id);
                        return;
                      }
                      onStartTracking("todo", task.id);
                    }}
                  >
                    {task.running ? "Stop" : "Start"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-card compact-empty-state">
              <h3>No recent tasks yet</h3>
              <p>Tasks with recent time, current scheduling, or running timers will appear here automatically.</p>
            </div>
          )}
        </div>
      </section>

      <div className="now-secondary-grid">
        <section className="sidebar-card now-section-card">
          <div className="card-header">
            <div className="now-section-copy">
              <h3>Upcoming meetings</h3>
              <p className="muted">Fast access to the meetings most likely to matter next.</p>
            </div>
          </div>
          <div className="now-pill-cloud now-pill-cloud-compact">
            {upcomingMeetings.length ? (
              upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="now-pill-card" data-kind="meeting" data-size="small" data-running={meeting.running}>
                  <button type="button" className="now-pill-main" onClick={() => onOpenActivityDetail(meeting.id)}>
                    <span className="now-pill-kicker">Meeting</span>
                    <strong className="now-pill-title">{meeting.title}</strong>
                    <span className="now-pill-meta">
                      <span>{meeting.project}</span>
                      <span>{meeting.whenLabel}</span>
                      <span>{meeting.running ? `Running - ${meeting.runningLabel}` : "Scheduled"}</span>
                    </span>
                  </button>
                  <div className="now-pill-actions">
                    <button
                      className={`small-button${meeting.running ? " primary-button" : ""}`}
                      type="button"
                      onClick={() => {
                        if (meeting.running) {
                          onStopTracking("activity", meeting.id);
                          return;
                        }
                        onStartTracking("activity", meeting.id);
                      }}
                    >
                      {meeting.running ? "Stop" : "Start"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state-card compact-empty-state">
                <h3>No upcoming meetings</h3>
                <p>Scheduled meetings from Calendar will appear here as they come into view.</p>
              </div>
            )}
          </div>
        </section>

        <section className="sidebar-card now-section-card">
          <div className="card-header">
            <div className="now-section-copy">
              <h3>Common activities</h3>
              <p className="muted">The activities you return to most often, with quick time control.</p>
            </div>
          </div>
          <div className="now-pill-cloud now-pill-cloud-compact">
            {commonActivities.length ? (
              commonActivities.map((activity) => (
                <div key={activity.id} className="now-pill-card" data-kind="activity" data-size="small" data-running={activity.running}>
                  <button type="button" className="now-pill-main" onClick={() => onOpenActivityDetail(activity.id)}>
                    <span className="now-pill-kicker">Activity</span>
                    <strong className="now-pill-title">{activity.title}</strong>
                    <span className="now-pill-meta">
                      <span>{activity.project}</span>
                      <span>{activity.openTaskCount ? `${activity.openTaskCount} open tasks` : "No open tasks"}</span>
                      <span>{activity.running ? `Running - ${activity.runningLabel}` : formatTrackedMinutes(activity.totalMinutes)}</span>
                    </span>
                  </button>
                  <div className="now-pill-actions">
                    <button
                      className={`small-button${activity.running ? " primary-button" : ""}`}
                      type="button"
                      onClick={() => {
                        if (activity.running) {
                          onStopTracking("activity", activity.id);
                          return;
                        }
                        onStartTracking("activity", activity.id);
                      }}
                    >
                      {activity.running ? "Stop" : "Start"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state-card compact-empty-state">
                <h3>No common activities yet</h3>
                <p>Once activities gather repeated use, they will be surfaced here automatically.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="sidebar-card now-section-card">
        <div className="card-header">
          <div className="now-section-copy">
            <h3>Common projects</h3>
            <p className="muted">Jump straight into the Time workspace filtered to the projects you use most.</p>
          </div>
        </div>
        <div className="now-pill-cloud now-pill-cloud-compact">
          {commonProjects.length ? (
            commonProjects.map((project) => (
              <div key={project.project} className="now-pill-card now-pill-card-project" data-kind="project" data-size="small">
                <button type="button" className="now-pill-main" onClick={() => onOpenProject(project.project)}>
                  <span className="now-pill-kicker">Project</span>
                  <strong className="now-pill-title">{project.project}</strong>
                  <span className="now-pill-meta">
                    <span>{project.openTaskCount ? `${project.openTaskCount} open tasks` : "No open tasks"}</span>
                    <span>{project.upcomingMeetings ? `${project.upcomingMeetings} upcoming meetings` : "No upcoming meetings"}</span>
                    <span>{formatTrackedMinutes(project.totalMinutes)}</span>
                  </span>
                </button>
              </div>
            ))
          ) : (
            <div className="empty-state-card compact-empty-state">
              <h3>No common projects yet</h3>
              <p>Projects start appearing here once time is logged against them or tasks are actively used.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
