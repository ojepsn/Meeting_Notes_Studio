import { useEffect, useMemo, useState } from "react";
import type { ActivityRecord, ArchivedTaskRecord, LocalAppSettings, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { calculateLiveDurationMinutes, formatTrackedMinutes, isTimeLogRunning } from "../../../lib/time/tracking";

type AnalyticsWorkspaceProps = {
  todos: TodoRecord[];
  archivedTasks: ArchivedTaskRecord[];
  activities: ActivityRecord[];
  timeLogs: TimeLogRecord[];
  settings: LocalAppSettings;
  onOpenTodoDetail: (todoId: string) => void;
  onOpenActivityDetail: (activityId: string) => void;
};

type TimelineGranularity = "daily" | "weekly" | "monthly";
type AnalyticsRangePreset = "30d" | "90d" | "365d" | "custom";
type ChartDisplayMode = "share" | "hours";
type EnrichedTimeLog = TimeLogRecord & {
  title: string;
  contextLabel: string;
  domain: string;
  project: string;
  activityLabel: string;
  workKind: "Task" | "Meeting" | "Activity";
  effectiveMinutes: number;
  isPrivate: boolean;
  isBaselineWork: boolean;
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

const timeStringToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
};

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

const ANALYTICS_SERIES_COLORS = [
  "#2f6df6",
  "#14a66c",
  "#ea952d",
  "#d95a52",
  "#7b63eb",
  "#1d9db4",
];
const BACKGROUND_FLOW_COLOR = "#8a96aa";

const buildCategorizedTimelineSeries = (
  logs: EnrichedTimeLog[],
  granularity: TimelineGranularity,
  getLabel: (log: EnrichedTimeLog) => string,
  limit = 5,
) => {
  const totalByLabel = new Map<string, number>();
  logs.forEach((log) => {
    const label = getLabel(log) || "Unspecified";
    totalByLabel.set(label, (totalByLabel.get(label) || 0) + log.effectiveMinutes);
  });

  const topLabels = Array.from(totalByLabel.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label]) => label);

  const includedLabels = new Set(topLabels);
  const bucketMap = new Map<
    string,
    {
      bucketKey: string;
      label: string;
      totalMinutes: number;
      series: Record<string, number>;
    }
  >();

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

const buildBinaryTimelineSeries = (
  logs: EnrichedTimeLog[],
  granularity: TimelineGranularity,
  labels: [string, string],
  predicate: (log: EnrichedTimeLog) => boolean,
) => {
  const [positiveLabel, negativeLabel] = labels;
  const bucketMap = new Map<
    string,
    {
      bucketKey: string;
      label: string;
      totalMinutes: number;
      series: Record<string, number>;
    }
  >();

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

const getActivitySeriesLabel = (log: EnrichedTimeLog) =>
  log.project && log.project !== "No project" ? `${log.activityLabel} - ${log.project}` : log.activityLabel;

const getTimeLogFlowLabel = (log: EnrichedTimeLog) =>
  log.project && log.project !== "No project" ? `${log.project} / ${log.activityLabel}` : log.activityLabel;

const isBackgroundFlowLabel = (label: string) => label === "Background / Background" || label === "Background";

const getSeriesColor = (label: string) => {
  if (isBackgroundFlowLabel(label)) {
    return BACKGROUND_FLOW_COLOR;
  }
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return ANALYTICS_SERIES_COLORS[hash % ANALYTICS_SERIES_COLORS.length];
};

type DrilldownState =
  | {
      scope: "activity";
      label: string;
    }
  | {
      scope: "privacy";
      label: "Private" | "Business";
    }
  | {
      scope: "baseline";
      label: "Baseline work" | "Explicit timelogs";
    };

type HoveredFlowSegment = {
  id: string;
  title: string;
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  effectiveMinutes: number;
};

export const AnalyticsWorkspace = ({
  todos,
  archivedTasks,
  activities,
  timeLogs,
  settings,
  onOpenTodoDetail,
  onOpenActivityDetail,
}: AnalyticsWorkspaceProps) => {
  const defaultRange = buildRangeFromPreset("90d");
  const [timelineGranularity, setTimelineGranularity] = useState<TimelineGranularity>("daily");
  const [rangePreset, setRangePreset] = useState<AnalyticsRangePreset>("90d");
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [projectFilter, setProjectFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [showPrivateItems, setShowPrivateItems] = useState(true);
  const [showBusinessItems, setShowBusinessItems] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [chartDisplayMode, setChartDisplayMode] = useState<ChartDisplayMode>("hours");
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [hoveredFlowSegment, setHoveredFlowSegment] = useState<HoveredFlowSegment | null>(null);
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
            isPrivate: Boolean(todo?.isPrivate ?? archivedTask?.isPrivate),
            isBaselineWork: false,
            isArchivedTarget: !todo && Boolean(archivedTask),
          };
        }
        const activity = activityLookup[log.targetId];
        const isBackgroundLog = Boolean(
          settings.baselineWorkActivityId &&
          log.targetType === "activity" &&
          log.targetId === settings.baselineWorkActivityId,
        );
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
      }),
    [activityLookup, archivedTaskLookup, now, settings.baselineWorkActivityId, timeLogs, todoLookup],
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
        if (!showPrivateItems && log.isPrivate) return false;
        if (!showBusinessItems && !log.isPrivate) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.trim().toLocaleLowerCase();
          const haystack = `${log.title} ${log.contextLabel} ${log.project} ${log.domain} ${log.activityLabel} ${log.notes}`.toLocaleLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [activityFilter, domainFilter, enrichedLogs, fromDate, projectFilter, searchQuery, showBusinessItems, showPrivateItems, toDate],
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

  const activityTimelineSeries = useMemo(
    () => buildCategorizedTimelineSeries(filteredLogs, timelineGranularity, getActivitySeriesLabel),
    [filteredLogs, timelineGranularity],
  );

  const dailyTimeLogFlowRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        date: string;
        totalMinutes: number;
        segments: Array<{
          id: string;
          label: string;
          drilldownLabel: string;
          title: string;
          date: string;
          startTime: string;
          endTime: string;
          notes: string;
          isBackground: boolean;
          startMinutes: number;
          endMinutes: number;
          effectiveMinutes: number;
          color: string;
        }>;
      }
    >();

    [...filteredLogs]
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.startTime.localeCompare(right.startTime) ||
          left.title.localeCompare(right.title),
      )
      .forEach((log) => {
        const label = getTimeLogFlowLabel(log);
        const drilldownLabel = getActivitySeriesLabel(log);
        const startMinutes = timeStringToMinutes(log.startTime);
        const measuredEndMinutes = timeStringToMinutes(log.endTime);
        const computedEndMinutes = startMinutes + Math.max(1, log.effectiveMinutes);
        const endMinutes = Math.max(
          startMinutes + 1,
          Math.min(24 * 60, measuredEndMinutes > startMinutes ? measuredEndMinutes : computedEndMinutes),
        );
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
        segments: row.segments.sort(
          (left, right) =>
            left.startMinutes - right.startMinutes ||
            left.endMinutes - right.endMinutes ||
            left.label.localeCompare(right.label),
        ),
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [filteredLogs]);

  const dailyTimeLogFlowLegend = useMemo(() => {
    const grouped = new Map<string, { minutes: number; drilldownLabel: string }>();
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

  const projectTimelineSeries = useMemo(
    () => buildCategorizedTimelineSeries(filteredLogs, timelineGranularity, (log) => log.project || "No project"),
    [filteredLogs, timelineGranularity],
  );

  const privacyTimelineSeries = useMemo(
    () => buildBinaryTimelineSeries(filteredLogs, timelineGranularity, ["Private", "Business"], (log) => log.isPrivate),
    [filteredLogs, timelineGranularity],
  );

  const baselineTimelineSeries = useMemo(
    () =>
      buildBinaryTimelineSeries(
        filteredLogs,
        timelineGranularity,
        ["Baseline work", "Explicit timelogs"],
        (log) => log.isBaselineWork,
      ),
    [filteredLogs, timelineGranularity],
  );

  const activityMaxBucketMinutes = Math.max(1, ...activityTimelineSeries.buckets.map((entry) => entry.totalMinutes));
  const projectMaxBucketMinutes = Math.max(1, ...projectTimelineSeries.buckets.map((entry) => entry.totalMinutes));
  const privacyMaxBucketMinutes = Math.max(1, ...privacyTimelineSeries.buckets.map((entry) => entry.totalMinutes));
  const baselineMaxBucketMinutes = Math.max(1, ...baselineTimelineSeries.buckets.map((entry) => entry.totalMinutes));

  const drilldownLogs = useMemo(() => {
    if (!drilldown) return [];
    if (drilldown.scope === "activity") {
      return filteredLogs.filter((log) => getActivitySeriesLabel(log) === drilldown.label);
    }
    if (drilldown.scope === "privacy") {
      return filteredLogs.filter((log) => (drilldown.label === "Private" ? log.isPrivate : !log.isPrivate));
    }
    return filteredLogs.filter((log) => (drilldown.label === "Baseline work" ? log.isBaselineWork : !log.isBaselineWork));
  }, [drilldown, filteredLogs]);

  useEffect(() => {
    if (!drilldown) return;
    if (drilldown.scope === "activity" && !activityTimelineSeries.labels.includes(drilldown.label)) {
      setDrilldown(null);
      return;
    }
    if (
      drilldown.scope === "privacy" &&
      !privacyTimelineSeries.labels.includes(drilldown.label)
    ) {
      setDrilldown(null);
      return;
    }
    if (
      drilldown.scope === "baseline" &&
      !baselineTimelineSeries.labels.includes(drilldown.label)
    ) {
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
          <span className="tiny-text analytics-toolbar-label">Chart mode</span>
          <div className="capture-density-toggle">
            <button className="segment-button" data-active={chartDisplayMode === "share"} type="button" onClick={() => setChartDisplayMode("share")}>
              Stacked share
            </button>
            <button className="segment-button" data-active={chartDisplayMode === "hours"} type="button" onClick={() => setChartDisplayMode("hours")}>
              Absolute hours
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
        <div className="field analytics-visibility-field">
          <label>Visibility</label>
          <div className="page-actions analytics-visibility-actions">
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showPrivateItems} onChange={(event) => setShowPrivateItems(event.target.checked)} />
              <span>Show private</span>
            </label>
            <label className="compact-private-toggle calendar-top-filter-toggle">
              <input type="checkbox" checked={showBusinessItems} onChange={(event) => setShowBusinessItems(event.target.checked)} />
              <span>Show business</span>
            </label>
          </div>
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

      <div className="analytics-chart-grid">
        <div className="sidebar-card analytics-day-flow-card">
          <div className="card-header">
            <div>
              <h3>Daily timelog flow</h3>
              <p className="muted">Each bar shows individual timelogs in the order they happened during the day, so switching and focused stretches are visible.</p>
            </div>
          </div>
          <div className="analytics-day-flow-axis" aria-hidden="true">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
          <div className="analytics-day-flow">
            {dailyTimeLogFlowRows.length ? (
              dailyTimeLogFlowRows.map((row) => (
                <div key={row.date} className="analytics-day-flow-row">
                  <span className="tiny-text analytics-bar-label">{row.date}</span>
                  <div className="analytics-day-flow-track">
                    {row.segments.map((segment) => (
                      <button
                        key={segment.id}
                        type="button"
                        className={`analytics-day-flow-segment${segment.isBackground ? " analytics-day-flow-segment-background" : ""}`}
                        onClick={() => setDrilldown({ scope: "activity", label: segment.drilldownLabel })}
                        onMouseEnter={() =>
                          setHoveredFlowSegment({
                            id: segment.id,
                            title: segment.title,
                            label: segment.label,
                            date: segment.date,
                            startTime: segment.startTime,
                            endTime: segment.endTime,
                            notes: segment.notes,
                            effectiveMinutes: segment.effectiveMinutes,
                          })
                        }
                        onMouseLeave={() => setHoveredFlowSegment((current) => (current?.id === segment.id ? null : current))}
                        onFocus={() =>
                          setHoveredFlowSegment({
                            id: segment.id,
                            title: segment.title,
                            label: segment.label,
                            date: segment.date,
                            startTime: segment.startTime,
                            endTime: segment.endTime,
                            notes: segment.notes,
                            effectiveMinutes: segment.effectiveMinutes,
                          })
                        }
                        onBlur={() => setHoveredFlowSegment((current) => (current?.id === segment.id ? null : current))}
                        aria-label={segment.title}
                        style={{
                          left: `${(segment.startMinutes / (24 * 60)) * 100}%`,
                          width: `${Math.max(0.35, ((segment.endMinutes - segment.startMinutes) / (24 * 60)) * 100)}%`,
                          background: segment.color,
                        }}
                      />
                    ))}
                  </div>
                  <strong>{formatMinutes(row.totalMinutes)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">No timelog flow matches the current filters.</p>
            )}
          </div>
          {hoveredFlowSegment ? (
            <div className="analytics-flow-hover-card">
              <strong>{hoveredFlowSegment.title}</strong>
              <span className="tiny-text">
                {hoveredFlowSegment.date} · {hoveredFlowSegment.startTime}-{hoveredFlowSegment.endTime === hoveredFlowSegment.startTime ? "running" : hoveredFlowSegment.endTime}
              </span>
              <span className="tiny-text">
                {hoveredFlowSegment.label} · {formatMinutes(hoveredFlowSegment.effectiveMinutes)}
              </span>
              {hoveredFlowSegment.notes ? <p className="tiny-text">{hoveredFlowSegment.notes}</p> : <p className="tiny-text muted">No comment on this timelog.</p>}
            </div>
          ) : null}
          {dailyTimeLogFlowLegend.length ? (
            <div className="analytics-series-legend">
              {dailyTimeLogFlowLegend.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  className={`status-chip analytics-series-chip${drilldown?.scope === "activity" && drilldown.label === entry.drilldownLabel ? " analytics-series-chip-active" : ""}`}
                  onClick={() => setDrilldown({ scope: "activity", label: entry.drilldownLabel })}
                >
                  <span className="analytics-series-chip-swatch" style={{ background: entry.color }} />
                  {entry.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

      </div>

      <div className="analytics-chart-grid">
        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Activity time over time</h3>
              <p className="muted">Tracked hours summarized by {timelineGranularity.slice(0, -2)} and split by the top activities in view.</p>
            </div>
          </div>
          <div className="analytics-stacked-timeline">
            {activityTimelineSeries.buckets.length ? (
              activityTimelineSeries.buckets.map((bucket) => (
                <div key={bucket.bucketKey} className="analytics-stacked-timeline-row">
                  <span className="tiny-text analytics-bar-label">{bucket.label}</span>
                  <div
                    className="analytics-stacked-timeline-track"
                    style={
                      chartDisplayMode === "hours"
                        ? { width: `${(bucket.totalMinutes / activityMaxBucketMinutes) * 100}%` }
                        : undefined
                    }
                  >
                    {activityTimelineSeries.labels.map((label, index) => {
                      const minutes = bucket.series[label] || 0;
                      const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : activityMaxBucketMinutes;
                      if (!minutes || !denominator) return null;
                      return (
                        <button
                          key={`${bucket.bucketKey}-${label}`}
                          type="button"
                          className={`analytics-segment-button${drilldown?.scope === "activity" && drilldown.label === label ? " analytics-segment-button-active" : ""}`}
                          title={`${label}: ${formatMinutes(minutes)}`}
                          onClick={() => setDrilldown({ scope: "activity", label })}
                          style={{
                            width: `${(minutes / denominator) * 100}%`,
                            background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                          }}
                        />
                      );
                    })}
                  </div>
                  <strong>{formatMinutes(bucket.totalMinutes)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">No project time data matches the current filters.</p>
            )}
          </div>
          {activityTimelineSeries.labels.length ? (
            <div className="analytics-series-legend">
              {activityTimelineSeries.labels.map((label, index) => (
                <button key={label} type="button" className={`status-chip analytics-series-chip${drilldown?.scope === "activity" && drilldown.label === label ? " analytics-series-chip-active" : ""}`} onClick={() => setDrilldown({ scope: "activity", label })}>
                  <span
                    className="analytics-series-chip-swatch"
                    style={{ background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] }}
                  />
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Project time over time</h3>
              <p className="muted">Tracked hours summarized by {timelineGranularity.slice(0, -2)} and split by the top projects in view.</p>
            </div>
          </div>
          <div className="analytics-stacked-timeline">
            {projectTimelineSeries.buckets.length ? (
              projectTimelineSeries.buckets.map((bucket) => (
                <div key={bucket.bucketKey} className="analytics-stacked-timeline-row">
                  <span className="tiny-text analytics-bar-label">{bucket.label}</span>
                  <div
                    className="analytics-stacked-timeline-track"
                    style={
                      chartDisplayMode === "hours"
                        ? { width: `${(bucket.totalMinutes / projectMaxBucketMinutes) * 100}%` }
                        : undefined
                    }
                  >
                    {projectTimelineSeries.labels.map((label, index) => {
                      const minutes = bucket.series[label] || 0;
                      const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : projectMaxBucketMinutes;
                      if (!minutes || !denominator) return null;
                      return (
                        <button
                          key={`${bucket.bucketKey}-${label}`}
                          type="button"
                          className="analytics-segment-button"
                          title={`${label}: ${formatMinutes(minutes)}`}
                          style={{
                            width: `${(minutes / denominator) * 100}%`,
                            background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                          }}
                        />
                      );
                    })}
                  </div>
                  <strong>{formatMinutes(bucket.totalMinutes)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">No project time data matches the current filters.</p>
            )}
          </div>
          {projectTimelineSeries.labels.length ? (
            <div className="analytics-series-legend">
              {projectTimelineSeries.labels.map((label, index) => (
                <span key={label} className="status-chip analytics-series-chip">
                  <span
                    className="analytics-series-chip-swatch"
                    style={{ background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] }}
                  />
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Timelogs time over time</h3>
              <p className="muted">Total logged hours summarized by {timelineGranularity.slice(0, -2)} for the current filters.</p>
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
              <p className="muted">No timelog totals match the current filters.</p>
            )}
          </div>
        </div>
      </div>

      <div className="analytics-chart-grid">
        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Business vs private</h3>
              <p className="muted">A split of visible work over time between business and private entries.</p>
            </div>
          </div>
          <div className="analytics-stacked-timeline">
            {privacyTimelineSeries.buckets.length ? (
              privacyTimelineSeries.buckets.map((bucket) => (
                <div key={bucket.bucketKey} className="analytics-stacked-timeline-row">
                  <span className="tiny-text analytics-bar-label">{bucket.label}</span>
                  <div
                    className="analytics-stacked-timeline-track"
                    style={
                      chartDisplayMode === "hours"
                        ? { width: `${(bucket.totalMinutes / privacyMaxBucketMinutes) * 100}%` }
                        : undefined
                    }
                  >
                    {privacyTimelineSeries.labels.map((label, index) => {
                      const minutes = bucket.series[label] || 0;
                      const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : privacyMaxBucketMinutes;
                      if (!minutes || !denominator) return null;
                      return (
                        <button
                          key={`${bucket.bucketKey}-${label}`}
                          type="button"
                          className={`analytics-segment-button${drilldown?.scope === "privacy" && drilldown.label === label ? " analytics-segment-button-active" : ""}`}
                          title={`${label}: ${formatMinutes(minutes)}`}
                          onClick={() => setDrilldown({ scope: "privacy", label: label as "Private" | "Business" })}
                          style={{
                            width: `${(minutes / denominator) * 100}%`,
                            background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                          }}
                        />
                      );
                    })}
                  </div>
                  <strong>{formatMinutes(bucket.totalMinutes)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">No activity time data matches the current filters.</p>
            )}
          </div>
          {privacyTimelineSeries.labels.length ? (
            <div className="analytics-series-legend">
              {privacyTimelineSeries.labels.map((label, index) => (
                <button key={label} type="button" className={`status-chip analytics-series-chip${drilldown?.scope === "privacy" && drilldown.label === label ? " analytics-series-chip-active" : ""}`} onClick={() => setDrilldown({ scope: "privacy", label: label as "Private" | "Business" })}>
                  <span
                    className="analytics-series-chip-swatch"
                    style={{ background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] }}
                  />
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Baseline vs explicit timelogs</h3>
              <p className="muted">See how much time is flowing through baseline work capture versus specific tracked work.</p>
            </div>
          </div>
          <div className="analytics-stacked-timeline">
            {baselineTimelineSeries.buckets.length ? (
              baselineTimelineSeries.buckets.map((bucket) => (
                <div key={bucket.bucketKey} className="analytics-stacked-timeline-row">
                  <span className="tiny-text analytics-bar-label">{bucket.label}</span>
                  <div
                    className="analytics-stacked-timeline-track"
                    style={
                      chartDisplayMode === "hours"
                        ? { width: `${(bucket.totalMinutes / baselineMaxBucketMinutes) * 100}%` }
                        : undefined
                    }
                  >
                    {baselineTimelineSeries.labels.map((label, index) => {
                      const minutes = bucket.series[label] || 0;
                      const denominator = chartDisplayMode === "share" ? bucket.totalMinutes : baselineMaxBucketMinutes;
                      if (!minutes || !denominator) return null;
                      return (
                        <button
                          key={`${bucket.bucketKey}-${label}`}
                          type="button"
                          className={`analytics-segment-button${drilldown?.scope === "baseline" && drilldown.label === label ? " analytics-segment-button-active" : ""}`}
                          title={`${label}: ${formatMinutes(minutes)}`}
                          onClick={() => setDrilldown({ scope: "baseline", label: label as "Baseline work" | "Explicit timelogs" })}
                          style={{
                            width: `${(minutes / denominator) * 100}%`,
                            background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
                          }}
                        />
                      );
                    })}
                  </div>
                  <strong>{formatMinutes(bucket.totalMinutes)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">No timelog split data matches the current filters.</p>
            )}
          </div>
          {baselineTimelineSeries.labels.length ? (
            <div className="analytics-series-legend">
              {baselineTimelineSeries.labels.map((label, index) => (
                <button key={label} type="button" className={`status-chip analytics-series-chip${drilldown?.scope === "baseline" && drilldown.label === label ? " analytics-series-chip-active" : ""}`} onClick={() => setDrilldown({ scope: "baseline", label: label as "Baseline work" | "Explicit timelogs" })}>
                  <span
                    className="analytics-series-chip-swatch"
                    style={{ background: ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length] }}
                  />
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {drilldown ? (
        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Drill-down timelogs</h3>
              <p className="muted">
                {drilldown.scope === "activity"
                  ? `Showing timelogs for ${drilldown.label}.`
                  : drilldown.scope === "privacy"
                    ? `Showing ${drilldown.label.toLowerCase()} timelogs.`
                    : `Showing ${drilldown.label.toLowerCase()} timelogs.`}
              </p>
            </div>
            <div className="page-actions">
              <button className="small-button" type="button" onClick={() => setDrilldown(null)}>
                Clear
              </button>
            </div>
          </div>
          <div className="section-list">
            {drilldownLogs.length ? (
              [...drilldownLogs]
                .sort(
                  (left, right) =>
                    right.date.localeCompare(left.date) ||
                    right.startTime.localeCompare(left.startTime) ||
                    right.effectiveMinutes - left.effectiveMinutes,
                )
                .map((log) =>
                log.targetType === "todo" && !log.isArchivedTarget ? (
                  <button
                    key={`${log.id}-${log.targetType}`}
                    className="list-item list-item-button"
                    type="button"
                    onClick={() => onOpenTodoDetail(log.targetId)}
                  >
                    <div className="analytics-list-main">
                      <strong>{log.title}</strong>
                      <span className="tiny-text">
                        {log.date} {log.startTime}-{log.endTime} · {log.contextLabel}
                      </span>
                    </div>
                    <span>{formatMinutes(log.effectiveMinutes)}</span>
                  </button>
                ) : log.targetType === "activity" ? (
                  <button
                    key={`${log.id}-${log.targetType}`}
                    className="list-item list-item-button"
                    type="button"
                    onClick={() => onOpenActivityDetail(log.targetId)}
                  >
                    <div className="analytics-list-main">
                      <strong>{log.title}</strong>
                      <span className="tiny-text">
                        {log.date} {log.startTime}-{log.endTime} · {log.contextLabel}
                      </span>
                    </div>
                    <span>{formatMinutes(log.effectiveMinutes)}</span>
                  </button>
                ) : (
                  <div key={`${log.id}-${log.targetType}`} className="list-item">
                    <div className="analytics-list-main">
                      <strong>{log.title}</strong>
                      <span className="tiny-text">
                        {log.date} {log.startTime}-{log.endTime} · {log.contextLabel}
                      </span>
                    </div>
                    <span>{formatMinutes(log.effectiveMinutes)}</span>
                  </div>
                ),
              )
            ) : (
              <p className="muted">No timelogs match this drill-down.</p>
            )}
          </div>
        </div>
      ) : null}

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
