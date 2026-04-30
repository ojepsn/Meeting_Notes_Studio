import { useEffect, useMemo, useState } from "react";
import type { ActivityRecord, CalendarItemRecord, LocalAppSettings, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { formatStockholmDate } from "../../../lib/time/stockholm";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "../../../lib/time/tracking";

type NowWorkspaceProps = {
  todos: TodoRecord[];
  activities: ActivityRecord[];
  timeLogs: TimeLogRecord[];
  calendarItems: CalendarItemRecord[];
  settings: LocalAppSettings;
  onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onOpenTodoDetail: (todoId: string) => void;
  onOpenActivityDetail: (activityId: string) => void;
  onOpenProject: (project: string) => void;
  onSaveSettings: (settings: LocalAppSettings) => void;
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
  score: number;
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

type RecentEntry = {
  key: string;
  kind: "task" | "meeting" | "activity" | "project";
  title: string;
  meta: string[];
  score: number;
  running: boolean;
  size: "hero" | "large" | "medium" | "small";
  isPriority: boolean;
  taskId?: string;
  activityId?: string;
  project?: string;
};

type RunningLogSummary = {
  kind: "task" | "meeting" | "activity";
  title: string;
  domain: string;
  project: string;
  activity: string;
  elapsedLabel: string;
  targetType: "todo" | "activity";
  targetId: string;
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

const scoreToSize = (rank: number, total: number, running: boolean): RecentEntry["size"] => {
  if (running || rank === 0) return "hero";
  if (rank <= Math.max(2, Math.floor(total * 0.18))) return "large";
  if (rank <= Math.max(5, Math.floor(total * 0.45))) return "medium";
  return "small";
};

const safeTitle = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

const buildRecentEntryMeta = (parts: Array<string | false | null | undefined>) =>
  parts.filter((part): part is string => Boolean(part && part.trim()));

export const NowWorkspace = ({
  todos,
  activities,
  timeLogs,
  calendarItems,
  settings,
  onStartTracking,
  onStopTracking,
  onOpenTodoDetail,
  onOpenActivityDetail,
  onOpenProject,
  onSaveSettings,
}: NowWorkspaceProps) => {
  const [now, setNow] = useState(() => new Date());
  const [showPrivateItems, setShowPrivateItems] = useState(
    settings.calendarShowPrivate ?? (settings.calendarVisibilityFilter === "public" ? false : true),
  );
  const [showBusinessItems, setShowBusinessItems] = useState(
    settings.calendarShowBusiness ?? (settings.calendarVisibilityFilter === "private" ? false : true),
  );
  const [showTasks, setShowTasks] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [showActivities, setShowActivities] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [recentFilterQuery, setRecentFilterQuery] = useState("");

  useEffect(() => {
    const hasRunningLog = timeLogs.some((entry) => isTimeLogRunning(entry));
    if (!hasRunningLog) return;
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, [timeLogs]);

  useEffect(() => {
    setShowPrivateItems(settings.calendarShowPrivate ?? (settings.calendarVisibilityFilter === "public" ? false : true));
    setShowBusinessItems(settings.calendarShowBusiness ?? (settings.calendarVisibilityFilter === "private" ? false : true));
  }, [settings.calendarShowBusiness, settings.calendarShowPrivate, settings.calendarVisibilityFilter]);

  useEffect(() => {
    if (
      settings.calendarShowPrivate === showPrivateItems &&
      settings.calendarShowBusiness === showBusinessItems
    ) {
      return;
    }
    onSaveSettings({
      ...settings,
      calendarShowPrivate: showPrivateItems,
      calendarShowBusiness: showBusinessItems,
      calendarVisibilityFilter:
        showPrivateItems && showBusinessItems
          ? "all"
          : showPrivateItems
            ? "private"
            : showBusinessItems
              ? "public"
              : settings.calendarVisibilityFilter ?? "all",
    });
  }, [onSaveSettings, settings, showBusinessItems, showPrivateItems]);

  const today = formatStockholmDate(now);

  const activityLookup = useMemo(
    () => Object.fromEntries(activities.map((activity) => [activity.id, activity])) as Record<string, ActivityRecord>,
    [activities],
  );

  const todoLookup = useMemo(
    () => Object.fromEntries(todos.map((todo) => [todo.id, todo])) as Record<string, TodoRecord>,
    [todos],
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

  const isVisibleByPrivacy = (isPrivate: boolean) =>
    isPrivate ? showPrivateItems : showBusinessItems;

  const recentTaskEntries = useMemo<RecentTaskEntry[]>(() => {
    const cutoffDate = addDays(today, -RECENT_TASK_WINDOW_DAYS);
    const scored = todos
      .filter((todo) => !todo.isDone && isVisibleByPrivacy(Boolean(todo.isPrivate)))
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
  }, [activityLookup, now, showBusinessItems, showPrivateItems, timeLogsByTarget, today, todos]);

  const upcomingMeetings = useMemo<UpcomingMeetingEntry[]>(() => {
    return calendarItems
      .filter((item) => item.targetType === "activity")
      .map((item) => {
        const activity = activityLookup[item.targetId];
        if (!activity || activity.type !== "meeting" || !isVisibleByPrivacy(Boolean(activity.isPrivate))) return null;
        const startTime = activity.startTime || formatSlotTime(item.startSlot);
        const fallbackEndSlot = item.startSlot + Math.max(item.durationSlots, 12);
        const endTime = activity.endTime || formatSlotTime(fallbackEndSlot);
        const startDateTime = new Date(`${item.date}T${startTime || "00:00"}:00`);
        const endDateTime = new Date(`${item.date}T${endTime || startTime || "00:00"}:00`);
        const runningLog = getRunningTimeLog(timeLogsByTarget.get(`activity:${activity.id}`) || []);
        if (!runningLog && endDateTime.getTime() < now.getTime()) return null;
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
      .filter((entry): entry is UpcomingMeetingEntry & { startTimestamp: number } => Boolean(entry))
      .sort((left, right) => {
        if (left.running !== right.running) return left.running ? -1 : 1;
        return left.startTimestamp - right.startTimestamp;
      })
      .slice(0, UPCOMING_MEETING_LIMIT)
      .map(({ startTimestamp: _ignored, ...entry }) => entry);
  }, [activityLookup, calendarItems, now, showBusinessItems, showPrivateItems, timeLogsByTarget]);

  const commonActivities = useMemo<CommonActivityEntry[]>(() => {
    return activities
      .filter((activity) => activity.type !== "meeting" && isVisibleByPrivacy(Boolean(activity.isPrivate)))
      .map((activity) => {
        const directLogs = timeLogsByTarget.get(`activity:${activity.id}`) || [];
        const linkedTaskLogs = todos
          .filter((todo) => !todo.isDone && todo.activityId === activity.id && isVisibleByPrivacy(Boolean(todo.isPrivate)))
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

  const commonProjects = useMemo<CommonProjectEntry[]>(() => {
    const aggregates = new Map<string, CommonProjectEntry>();
    const ensure = (project: string | null | undefined) => {
      const key = safeTitle(project, "No project");
      const current = aggregates.get(key) || { project: key, totalMinutes: 0, openTaskCount: 0, upcomingMeetings: 0, score: 0 };
      aggregates.set(key, current);
      return current;
    };

    todos.forEach((todo) => {
      if (todo.isDone || !isVisibleByPrivacy(Boolean(todo.isPrivate))) return;
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
      if (!isVisibleByPrivacy(targetIsPrivate)) return;
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

  const runningLogSummary = useMemo<RunningLogSummary | null>(() => {
    if (!activeTimeLog) return null;

    if (activeTimeLog.targetType === "todo") {
      const todo = todoLookup[activeTimeLog.targetId];
      if (!todo) return null;
      if (!isVisibleByPrivacy(Boolean(todo.isPrivate))) return null;
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
    if (!activity) return null;
    if (!isVisibleByPrivacy(Boolean(activity.isPrivate))) return null;
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

  const recentEntries = useMemo<RecentEntry[]>(() => {
    const rawEntries: RecentEntry[] = [
      ...recentTaskEntries.map((task) => ({
        key: `task:${task.id}`,
        kind: "task" as const,
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
        kind: "meeting" as const,
        title: meeting.title,
        meta: buildRecentEntryMeta([
          meeting.project,
          meeting.whenLabel,
          meeting.running ? `Running - ${meeting.runningLabel}` : "Scheduled",
        ]),
        score: meeting.score,
        running: meeting.running,
        size: "small" as const,
        isPriority: false,
        activityId: meeting.id,
      })),
      ...commonActivities.map((activity) => ({
        key: `activity:${activity.id}`,
        kind: "activity" as const,
        title: activity.title,
        meta: buildRecentEntryMeta([
          activity.project,
          activity.openTaskCount ? `${activity.openTaskCount} open tasks` : "No open tasks",
          activity.running ? `Running - ${activity.runningLabel}` : formatTrackedMinutes(activity.totalMinutes),
        ]),
        score: activity.score,
        running: activity.running,
        size: "small" as const,
        isPriority: false,
        activityId: activity.id,
      })),
      ...commonProjects.map((project) => ({
        key: `project:${project.project}`,
        kind: "project" as const,
        title: project.project,
        meta: buildRecentEntryMeta([
          project.openTaskCount ? `${project.openTaskCount} open tasks` : "No open tasks",
          project.upcomingMeetings ? `${project.upcomingMeetings} upcoming meetings` : "No upcoming meetings",
          formatTrackedMinutes(project.totalMinutes),
        ]),
        score: project.score,
        running: false,
        size: "small" as const,
        isPriority: false,
        project: project.project,
      })),
    ].sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));

    return rawEntries.map((entry, index, all) => ({
      ...entry,
      size:
        entry.kind === "task"
          ? entry.size
          : scoreToSize(index, all.length, entry.running),
    }));
  }, [commonActivities, commonProjects, recentTaskEntries, upcomingMeetings]);

  const filteredRecentEntries = useMemo(() => {
    const normalizedQuery = recentFilterQuery.trim().toLowerCase();
    return recentEntries.filter((entry) => {
      const kindVisible =
        (entry.kind === "task" && showTasks) ||
        (entry.kind === "meeting" && showMeetings) ||
        (entry.kind === "activity" && showActivities) ||
        (entry.kind === "project" && showProjects);
      if (!kindVisible) return false;
      if (!normalizedQuery) return true;
      const haystack = [entry.title, entry.kind, ...entry.meta].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [recentEntries, recentFilterQuery, showActivities, showMeetings, showProjects, showTasks]);

  const openEntry = (entry: RecentEntry) => {
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

  const renderActionButton = (entry: RecentEntry) => {
    if (entry.kind === "project") {
      return (
        <button className="small-button" type="button" onClick={() => entry.project && onOpenProject(entry.project)}>
          Open
        </button>
      );
    }

    const targetType = entry.kind === "task" ? "todo" : "activity";
    const targetId = entry.kind === "task" ? entry.taskId : entry.activityId;
    if (!targetId) return null;
    return (
      <button
        className={`small-button${entry.running ? " primary-button" : ""}`}
        type="button"
        onClick={() => {
          if (entry.running) {
            onStopTracking(targetType, targetId);
            return;
          }
          onStartTracking(targetType, targetId);
        }}
      >
        {entry.running ? "Stop" : "Start"}
      </button>
    );
  };

  return (
    <div className="card now-workspace">
      <section className="sidebar-card now-running-card">
        {runningLogSummary ? (
          <div className="now-running-inline">
            <div className="now-running-inline-primary">
              <span className="now-pill-kicker">Running now</span>
              <span className="now-pill-kicker">{runningLogSummary.kind === "meeting" ? "Meeting" : runningLogSummary.kind === "activity" ? "Activity" : "Task"}</span>
              <strong className="now-running-title">{runningLogSummary.title}</strong>
              <div className="now-running-inline-status">
                <span className="status-chip">Running - {runningLogSummary.elapsedLabel}</span>
              </div>
            </div>
            <div className="now-running-inline-details">
              <div className="now-running-inline-detail">
                <span>Domain</span>
                <strong>{runningLogSummary.domain}</strong>
              </div>
              <div className="now-running-inline-detail">
                <span>Project</span>
                <strong>{runningLogSummary.project}</strong>
              </div>
              <div className="now-running-inline-detail">
                <span>Activity</span>
                <strong>{runningLogSummary.activity}</strong>
              </div>
              <div className="now-running-inline-detail">
                <span>Text</span>
                <strong>{runningLogSummary.title}</strong>
              </div>
            </div>
            <div className="now-pill-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => onStopTracking(runningLogSummary.targetType, runningLogSummary.targetId)}
              >
                Stop
              </button>
              <button
                className="shell-button"
                type="button"
                onClick={() => {
                  if (runningLogSummary.targetType === "todo") {
                    onOpenTodoDetail(runningLogSummary.targetId);
                    return;
                  }
                  onOpenActivityDetail(runningLogSummary.targetId);
                }}
              >
                Open
              </button>
            </div>
          </div>
        ) : (
          <div className="now-running-inline now-running-inline-empty">
            <span className="now-pill-kicker">Running now</span>
            <strong className="now-running-title">No active timelog</strong>
            <span className="muted">Start time from any recent task, meeting, activity, or project context below.</span>
          </div>
        )}
      </section>

      <section className="sidebar-card now-section-card">
        <div className="card-header">
          <div className="now-section-copy">
            <h3>Recent</h3>
            <p className="muted">Tasks, meetings, activities, and projects are mixed together here for quick access.</p>
          </div>
        </div>
        <div className="page-actions now-filter-toolbar">
          <div className="page-actions now-visibility-actions">
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showTasks} onChange={(event) => setShowTasks(event.target.checked)} />
              <span>Tasks</span>
            </label>
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showMeetings} onChange={(event) => setShowMeetings(event.target.checked)} />
              <span>Meetings</span>
            </label>
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showActivities} onChange={(event) => setShowActivities(event.target.checked)} />
              <span>Activities</span>
            </label>
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showProjects} onChange={(event) => setShowProjects(event.target.checked)} />
              <span>Projects</span>
            </label>
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showPrivateItems} onChange={(event) => setShowPrivateItems(event.target.checked)} />
              <span>Show private</span>
            </label>
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showBusinessItems} onChange={(event) => setShowBusinessItems(event.target.checked)} />
              <span>Show business</span>
            </label>
          </div>
          <label className="field now-filter-search">
            <span className="sr-only">Filter recent items</span>
            <input
              type="search"
              value={recentFilterQuery}
              onChange={(event) => setRecentFilterQuery(event.target.value)}
              placeholder="Filter recent items"
            />
          </label>
        </div>
        <div className="now-pill-cloud">
          {filteredRecentEntries.length ? (
            filteredRecentEntries.map((entry) => (
              <div
                key={entry.key}
                className={`now-pill-card${entry.kind === "project" ? " now-pill-card-project" : ""}`}
                data-kind={entry.kind}
                data-size={entry.size}
                data-running={entry.running}
                data-priority={entry.isPriority}
              >
                <button type="button" className="now-pill-main" onClick={() => openEntry(entry)}>
                  <span className="now-pill-kicker">
                    {entry.kind === "task"
                      ? "Task"
                      : entry.kind === "meeting"
                        ? "Meeting"
                        : entry.kind === "activity"
                          ? "Activity"
                          : "Project"}
                  </span>
                  <strong className="now-pill-title">{entry.title}</strong>
                  <span className="now-pill-meta">
                    {entry.meta.map((value) => (
                      <span key={`${entry.key}:${value}`}>{value}</span>
                    ))}
                  </span>
                </button>
                <div className="now-pill-actions">{renderActionButton(entry)}</div>
              </div>
            ))
          ) : (
            <div className="empty-state-card compact-empty-state">
              <h3>No matching items</h3>
              <p>Adjust the type or privacy filters, or clear the text search to see more recent items.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
