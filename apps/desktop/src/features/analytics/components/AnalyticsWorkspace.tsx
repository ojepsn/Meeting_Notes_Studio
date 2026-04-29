import { useEffect, useMemo, useState } from "react";
import type { ActivityRecord, ArchivedTaskRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { calculateLiveDurationMinutes, formatTrackedMinutes, isTimeLogRunning } from "../../../lib/time/tracking";

type AnalyticsWorkspaceProps = {
  todos: TodoRecord[];
  archivedTasks: ArchivedTaskRecord[];
  activities: ActivityRecord[];
  timeLogs: TimeLogRecord[];
  onOpenTodoDetail: (todoId: string) => void;
  onOpenActivityDetail: (activityId: string) => void;
};

type TimelineGranularity = "daily" | "weekly" | "monthly";
type AnalyticsRangePreset = "30d" | "90d" | "365d" | "custom";
type EnrichedTimeLog = TimeLogRecord & {
  title: string;
  contextLabel: string;
  domain: string;
  project: string;
  activityLabel: string;
  workKind: "Task" | "Meeting" | "Activity";
  effectiveMinutes: number;
  isArchivedTarget?: boolean;
};

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

const shiftDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const formatMinutes = (minutes: number) => formatTrackedMinutes(minutes);

const getWeekStart = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
};

const getWeekKey = (value: string) => {
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

const getMonthKey = (value: string) => value.slice(0, 7);

const buildRangeFromPreset = (preset: Exclude<AnalyticsRangePreset, "custom">, now = new Date()) => {
  const today = formatDateInput(now);
  if (preset === "30d") return { fromDate: shiftDays(today, -29), toDate: today };
  if (preset === "90d") return { fromDate: shiftDays(today, -89), toDate: today };
  return { fromDate: shiftDays(today, -364), toDate: today };
};

const formatBucketLabel = (bucketKey: string, granularity: TimelineGranularity) => {
  if (granularity === "daily") return bucketKey;
  if (granularity === "weekly") return bucketKey.replace("-W", " week ");
  return bucketKey;
};

const buildBucketKey = (value: string, granularity: TimelineGranularity) => {
  if (granularity === "daily") return value;
  if (granularity === "weekly") return getWeekKey(value);
  return getMonthKey(value);
};

const topSlice = <T,>(entries: T[], count = 10) => entries.slice(0, count);

export const AnalyticsWorkspace = ({
  todos,
  archivedTasks,
  activities,
  timeLogs,
  onOpenTodoDetail,
  onOpenActivityDetail,
}: AnalyticsWorkspaceProps) => {
  const defaultRange = buildRangeFromPreset("90d");
  const [timelineGranularity, setTimelineGranularity] = useState<TimelineGranularity>("weekly");
  const [rangePreset, setRangePreset] = useState<AnalyticsRangePreset>("90d");
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [projectFilter, setProjectFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const hasRunningLog = timeLogs.some((entry) => isTimeLogRunning(entry));
    if (!hasRunningLog) return;
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, [timeLogs]);

  const todoLookup = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo])) as Record<string, TodoRecord>, [todos]);
  const archivedTaskLookup = useMemo(
    () => Object.fromEntries(archivedTasks.map((task) => [task.id, task])) as Record<string, ArchivedTaskRecord>,
    [archivedTasks],
  );
  const activityLookup = useMemo(
    () => Object.fromEntries(activities.map((activity) => [activity.id, activity])) as Record<string, ActivityRecord>,
    [activities],
  );

  const enrichedLogs = useMemo<EnrichedTimeLog[]>(
    () =>
      timeLogs.map((log) => {
        if (log.targetType === "todo") {
          const todo = todoLookup[log.targetId];
          const archivedTask = todo ? null : archivedTaskLookup[log.targetId];
          const linkedActivity = todo?.activityId ? activityLookup[todo.activityId] : null;
          return {
            ...log,
            title: todo?.description || archivedTask?.title || "Deleted task",
            contextLabel:
              linkedActivity?.description ||
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
      }),
    [activityLookup, archivedTaskLookup, now, timeLogs, todoLookup],
  );

  const projectOptions = useMemo(
    () => Array.from(new Set(enrichedLogs.map((log) => log.project || "No project"))).sort(),
    [enrichedLogs],
  );
  const domainOptions = useMemo(
    () => Array.from(new Set(enrichedLogs.map((log) => log.domain || "No domain"))).sort(),
    [enrichedLogs],
  );
  const activityOptions = useMemo(
    () => Array.from(new Set(enrichedLogs.map((log) => log.activityLabel || "No activity"))).sort(),
    [enrichedLogs],
  );

  const filteredLogs = useMemo(
    () =>
      enrichedLogs.filter((log) => {
        if (fromDate && log.date < fromDate) return false;
        if (toDate && log.date > toDate) return false;
        if (projectFilter !== "all" && log.project !== projectFilter) return false;
        if (domainFilter !== "all" && log.domain !== domainFilter) return false;
        if (activityFilter !== "all" && log.activityLabel !== activityFilter) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.trim().toLocaleLowerCase();
          const haystack = `${log.title} ${log.contextLabel} ${log.project} ${log.domain} ${log.activityLabel} ${log.notes}`.toLocaleLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [activityFilter, domainFilter, enrichedLogs, fromDate, projectFilter, searchQuery, toDate],
  );

  const totalMinutes = useMemo(() => filteredLogs.reduce((sum, log) => sum + log.effectiveMinutes, 0), [filteredLogs]);
  const activeDays = useMemo(() => new Set(filteredLogs.map((log) => log.date)).size, [filteredLogs]);
  const averagePerActiveDay = activeDays ? Math.round(totalMinutes / activeDays) : 0;
  const runningLogs = useMemo(() => filteredLogs.filter((log) => isTimeLogRunning(log)), [filteredLogs]);

  const timelineBuckets = useMemo(() => {
    const grouped = new Map<string, number>();
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
    const grouped = new Map<
      string,
      {
        label: string;
        contextLabel: string;
        minutes: number;
        targetType: "todo" | "activity";
        targetId: string;
        isArchivedTarget?: boolean;
      }
    >();
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
    const grouped = new Map<string, number>();
    filteredLogs.forEach((log) => grouped.set(log.project, (grouped.get(log.project) || 0) + log.effectiveMinutes));
    return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
  }, [filteredLogs]);

  const topDomains = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredLogs.forEach((log) => grouped.set(log.domain, (grouped.get(log.domain) || 0) + log.effectiveMinutes));
    return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
  }, [filteredLogs]);

  const topActivities = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredLogs.forEach((log) => grouped.set(log.activityLabel, (grouped.get(log.activityLabel) || 0) + log.effectiveMinutes));
    return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
  }, [filteredLogs]);

  const workKindTotals = useMemo(() => {
    const grouped = new Map<string, number>();
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

  const applyRangePreset = (preset: Exclude<AnalyticsRangePreset, "custom">) => {
    const nextRange = buildRangeFromPreset(preset);
    setRangePreset(preset);
    setFromDate(nextRange.fromDate);
    setToDate(nextRange.toDate);
  };

  return (
    <div className="card analytics-workspace-card">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Analytics</h2>
          <p className="muted">Timelog summaries, trends, and rollups across tasks, meetings, projects, and domains.</p>
        </div>
      </div>

      <div className="analytics-toolbar">
        <div className="analytics-toolbar-group">
          <span className="tiny-text analytics-toolbar-label">Timeline</span>
          <div className="capture-density-toggle">
            <button className="segment-button" data-active={timelineGranularity === "daily"} type="button" onClick={() => setTimelineGranularity("daily")}>
              Daily
            </button>
            <button className="segment-button" data-active={timelineGranularity === "weekly"} type="button" onClick={() => setTimelineGranularity("weekly")}>
              Weekly
            </button>
            <button className="segment-button" data-active={timelineGranularity === "monthly"} type="button" onClick={() => setTimelineGranularity("monthly")}>
              Monthly
            </button>
          </div>
        </div>
        <div className="analytics-toolbar-group">
          <span className="tiny-text analytics-toolbar-label">Window</span>
          <div className="capture-density-toggle">
            <button className="segment-button" data-active={rangePreset === "30d"} type="button" onClick={() => applyRangePreset("30d")}>
              30 days
            </button>
            <button className="segment-button" data-active={rangePreset === "90d"} type="button" onClick={() => applyRangePreset("90d")}>
              90 days
            </button>
            <button className="segment-button" data-active={rangePreset === "365d"} type="button" onClick={() => applyRangePreset("365d")}>
              12 months
            </button>
            <button className="segment-button" data-active={rangePreset === "custom"} type="button" onClick={() => setRangePreset("custom")}>
              Custom
            </button>
          </div>
        </div>
      </div>

      <div className="analytics-filter-grid">
        <div className="field">
          <label htmlFor="analytics-from-date">From</label>
          <DateInput
            id="analytics-from-date"
            value={fromDate}
            onChange={(event) => {
              setRangePreset("custom");
              setFromDate(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="analytics-to-date">To</label>
          <DateInput
            id="analytics-to-date"
            value={toDate}
            onChange={(event) => {
              setRangePreset("custom");
              setToDate(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="analytics-project-filter">Project</label>
          <select id="analytics-project-filter" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">All</option>
            {projectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="analytics-domain-filter">Domain</label>
          <select id="analytics-domain-filter" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
            <option value="all">All</option>
            {domainOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="analytics-activity-filter">Activity</label>
          <select id="analytics-activity-filter" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
            <option value="all">All</option>
            {activityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-wide">
          <label htmlFor="analytics-search">Search</label>
          <input
            id="analytics-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter by title, project, domain, activity, or comment"
          />
        </div>
      </div>

      <div className="analytics-summary-grid">
        <div className="sidebar-card">
          <h3>Total tracked</h3>
          <div className="time-summary-stat">{formatMinutes(totalMinutes)}</div>
          <p className="muted">Across {filteredLogs.length} timelogs in the selected range.</p>
        </div>
        <div className="sidebar-card">
          <h3>{totalTrackedLabel}</h3>
          <div className="time-summary-stat">{formatMinutes(averagePerBucket)}</div>
          <p className="muted">{timelineBuckets.length ? `${timelineBuckets.length} ${timelineGranularity} buckets in view.` : "No buckets in view yet."}</p>
        </div>
        <div className="sidebar-card">
          <h3>Average active day</h3>
          <div className="time-summary-stat">{formatMinutes(averagePerActiveDay)}</div>
          <p className="muted">{activeDays} active day{activeDays === 1 ? "" : "s"} with logged time.</p>
        </div>
        <div className="sidebar-card">
          <h3>Top item</h3>
          <div className="analytics-highlight-value">{topItem?.label || "No data"}</div>
          <p className="muted">{topItem ? `${formatMinutes(topItem.minutes)} • ${topItem.contextLabel}` : "No logs in this range yet."}</p>
        </div>
        <div className="sidebar-card">
          <h3>Busiest {timelineGranularity.slice(0, -2)}</h3>
          <div className="analytics-highlight-value">{busiestBucket?.label || "No data"}</div>
          <p className="muted">{busiestBucket ? `${formatMinutes(busiestBucket.minutes)} logged.` : "No logs in this range yet."}</p>
        </div>
        <div className="sidebar-card">
          <h3>Running now</h3>
          <div className="time-summary-stat">{runningLogs.length}</div>
          <p className="muted">{runningLogs.length ? "Live timelogs are included in the totals above." : "No live timelog right now."}</p>
        </div>
      </div>

      <div className="analytics-chart-grid">
        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>{timelineGranularity[0].toUpperCase() + timelineGranularity.slice(1)} trend</h3>
              <p className="muted">Time spent over time for the selected range and filters.</p>
            </div>
          </div>
          <div className="analytics-bar-chart">
            {timelineBuckets.length ? (
              timelineBuckets.map((entry) => (
                <div key={entry.bucketKey} className="analytics-bar-row">
                  <span className="tiny-text analytics-bar-label">{entry.label}</span>
                  <div className="time-trend-bar analytics-bar-track">
                    <span style={{ width: `${(entry.minutes / maxBucketMinutes) * 100}%` }} />
                  </div>
                  <strong>{formatMinutes(entry.minutes)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">No timelogs match the current filters.</p>
            )}
          </div>
        </div>
        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Work mix</h3>
              <p className="muted">How time is distributed across tasks, meetings, and other activities.</p>
            </div>
          </div>
          <div className="time-stacked-strip analytics-stacked-strip">
            {workKindTotals.map((entry) => (
              <span
                key={entry.label}
                title={`${entry.label}: ${formatMinutes(entry.minutes)}`}
                style={{ width: `${totalMinutes ? (entry.minutes / totalMinutes) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className="section-list">
            {workKindTotals.length ? (
              workKindTotals.map((entry) => (
                <div key={entry.label} className="list-item">
                  <strong>{entry.label}</strong>
                  <span>{formatMinutes(entry.minutes)}</span>
                </div>
              ))
            ) : (
              <p className="muted">No work mix yet for this range.</p>
            )}
          </div>
        </div>
      </div>

      <div className="analytics-table-grid">
        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Top items</h3>
              <p className="muted">Your most time-consuming tasks and meetings in the selected range.</p>
            </div>
          </div>
          <div className="section-list">
            {topSlice(topItems).length ? (
              topSlice(topItems).map((entry) => (
                <button
                  key={`${entry.targetType}-${entry.targetId}`}
                  className="list-item list-item-button"
                  type="button"
                  disabled={Boolean(entry.isArchivedTarget)}
                  onClick={() => (entry.targetType === "todo" ? onOpenTodoDetail(entry.targetId) : onOpenActivityDetail(entry.targetId))}
                >
                  <div className="analytics-list-main">
                    <strong>{entry.label}</strong>
                    <span className="tiny-text">{entry.contextLabel}</span>
                  </div>
                  <span>{formatMinutes(entry.minutes)}</span>
                </button>
              ))
            ) : (
              <p className="muted">No matching items yet.</p>
            )}
          </div>
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Projects</h3>
              <p className="muted">Where most tracked time is landing at project level.</p>
            </div>
          </div>
          <div className="section-list">
            {topSlice(topProjects).length ? (
              topSlice(topProjects).map((entry) => (
                <div key={entry.label} className="list-item">
                  <strong>{entry.label}</strong>
                  <span>{formatMinutes(entry.minutes)}</span>
                </div>
              ))
            ) : (
              <p className="muted">No project totals yet.</p>
            )}
          </div>
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Domains</h3>
              <p className="muted">Useful for understanding where attention is going at a higher level.</p>
            </div>
          </div>
          <div className="section-list">
            {topSlice(topDomains).length ? (
              topSlice(topDomains).map((entry) => (
                <div key={entry.label} className="list-item">
                  <strong>{entry.label}</strong>
                  <span>{formatMinutes(entry.minutes)}</span>
                </div>
              ))
            ) : (
              <p className="muted">No domain totals yet.</p>
            )}
          </div>
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Activities</h3>
              <p className="muted">This helps surface the repeat themes behind the raw work items.</p>
            </div>
          </div>
          <div className="section-list">
            {topSlice(topActivities).length ? (
              topSlice(topActivities).map((entry) => (
                <div key={entry.label} className="list-item">
                  <strong>{entry.label}</strong>
                  <span>{formatMinutes(entry.minutes)}</span>
                </div>
              ))
            ) : (
              <p className="muted">No activity totals yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
