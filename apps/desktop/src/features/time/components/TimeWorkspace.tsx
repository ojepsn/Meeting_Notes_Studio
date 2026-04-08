import { useEffect, useMemo, useState } from "react";
import type { ActivityRecord, TimeLogRecord, TimeReportPreset, TodoRecord } from "@notesmith/domain";
import { saveTextFile } from "../../../lib/storage/desktopStorage";

type TimeWorkspaceProps = {
  todos: TodoRecord[];
  activities: ActivityRecord[];
  timeLogs: TimeLogRecord[];
  requestedDomain?: string | null;
  requestedProject?: string | null;
  reportPresets: TimeReportPreset[];
  onSaveTimeLog: (timeLog: TimeLogRecord) => void;
  onDeleteTimeLog: (id: string) => void;
  onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onOpenTodoDetail: (todoId: string) => void;
  onOpenActivityDetail: (activityId: string) => void;
  onSaveReportPreset: (preset: Omit<TimeReportPreset, "id">) => void;
  onDeleteReportPreset: (presetId: string) => void;
};

type EditableTimeLogRecord = TimeLogRecord & { title: string; contextLabel: string };
type DatePreset = "today" | "this-week" | "this-month" | "custom";

const formatMinutes = (minutes: number) => {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
};

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

const shiftDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const differenceInDaysInclusive = (fromDate: string, toDate: string) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
};

const getPresetRange = (preset: Exclude<DatePreset, "custom">, now = new Date()) => {
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

const calculateDurationMinutes = (date: string, startTime: string, endTime: string) => {
  const start = new Date(`${date}T${startTime || "00:00"}:00`);
  const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
};

const buildExportFilename = (kind: "csv" | "md", now = new Date()) =>
  `notesmith-time-report-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${kind}`;
const buildJsonExportFilename = (now = new Date()) =>
  `notesmith-time-report-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
const csvCell = (value: string | number) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;

export const TimeWorkspace = ({
  todos,
  activities,
  timeLogs,
  requestedDomain,
  requestedProject,
  reportPresets,
  onSaveTimeLog,
  onDeleteTimeLog,
  onStartTracking,
  onStopTracking,
  onOpenTodoDetail,
  onOpenActivityDetail,
  onSaveReportPreset,
  onDeleteReportPreset,
}: TimeWorkspaceProps) => {
  const initialWeek = getPresetRange("this-week");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("this-week");
  const [fromDate, setFromDate] = useState(initialWeek.fromDate);
  const [toDate, setToDate] = useState(initialWeek.toDate);
  const [projectFilter, setProjectFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [presetDraft, setPresetDraft] = useState("");

  useEffect(() => {
    if (requestedProject !== undefined && requestedProject !== null) setProjectFilter(requestedProject || "all");
  }, [requestedProject]);
  useEffect(() => {
    if (requestedDomain !== undefined && requestedDomain !== null) setDomainFilter(requestedDomain || "all");
  }, [requestedDomain]);

  const todoLookup = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo])) as Record<string, TodoRecord>, [todos]);
  const activityLookup = useMemo(
    () => Object.fromEntries(activities.map((activity) => [activity.id, activity])) as Record<string, ActivityRecord>,
    [activities],
  );

  const enrichedLogs = useMemo<EditableTimeLogRecord[]>(
    () =>
      [...timeLogs]
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
        .sort((left, right) => `${right.date} ${right.startTime}`.localeCompare(`${left.date} ${left.startTime}`)),
    [activityLookup, timeLogs, todoLookup],
  );

  const projectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          enrichedLogs.map((log) => {
            const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
            const activity = log.targetType === "activity" ? activityLookup[log.targetId] : todo?.activityId ? activityLookup[todo.activityId] : null;
            return activity?.project || todo?.project || "No project";
          }),
        ),
      ).sort(),
    [activityLookup, enrichedLogs, todoLookup],
  );
  const domainOptions = useMemo(
    () =>
      Array.from(
        new Set(
          enrichedLogs.map((log) => {
            const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
            const activity = log.targetType === "activity" ? activityLookup[log.targetId] : todo?.activityId ? activityLookup[todo.activityId] : null;
            return activity?.domain || todo?.domain || "No domain";
          }),
        ),
      ).sort(),
    [activityLookup, enrichedLogs, todoLookup],
  );

  const logsMatchingStructure = useMemo(
    () =>
      enrichedLogs.filter((log) => {
        const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
        const activity = log.targetType === "activity" ? activityLookup[log.targetId] : todo?.activityId ? activityLookup[todo.activityId] : null;
        const project = activity?.project || todo?.project || "No project";
        const domain = activity?.domain || todo?.domain || "No domain";
        if (projectFilter !== "all" && project !== projectFilter) return false;
        if (domainFilter !== "all" && domain !== domainFilter) return false;
        return true;
      }),
    [activityLookup, domainFilter, enrichedLogs, projectFilter, todoLookup],
  );

  const filteredLogs = useMemo(
    () =>
      logsMatchingStructure.filter((log) => {
        if (fromDate && log.date < fromDate) return false;
        if (toDate && log.date > toDate) return false;
        return true;
      }),
    [fromDate, logsMatchingStructure, toDate],
  );

  const comparisonRange = useMemo(() => {
    if (!fromDate || !toDate) return null;
    const rangeDays = differenceInDaysInclusive(fromDate, toDate);
    const previousTo = shiftDays(fromDate, -1);
    const previousFrom = shiftDays(previousTo, -(rangeDays - 1));
    return { fromDate: previousFrom, toDate: previousTo, label: `${previousFrom} to ${previousTo}` };
  }, [fromDate, toDate]);

  const comparisonLogs = useMemo(
    () =>
      comparisonRange
        ? logsMatchingStructure.filter((log) => log.date >= comparisonRange.fromDate && log.date <= comparisonRange.toDate)
        : [],
    [comparisonRange, logsMatchingStructure],
  );

  const runningLogs = useMemo(() => filteredLogs.filter((log) => log.startTime === log.endTime), [filteredLogs]);
  const recentLogs = useMemo(() => filteredLogs.slice(0, 24), [filteredLogs]);

  const dailyTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredLogs.forEach((log) => grouped.set(log.date, (grouped.get(log.date) || 0) + log.durationMinutes));
    return Array.from(grouped.entries()).map(([date, minutes]) => ({ date, minutes })).sort((l, r) => r.date.localeCompare(l.date));
  }, [filteredLogs]);

  const activityTotals = useMemo(() => {
    const grouped = new Map<string, { label: string; domain: string; project: string; minutes: number; targetType: "activity" | "todo"; targetId: string }>();
    filteredLogs.forEach((log) => {
      const todo = log.targetType === "todo" ? todoLookup[log.targetId] : null;
      const linkedActivity = todo?.activityId ? activityLookup[todo.activityId] : null;
      const directActivity = log.targetType === "activity" ? activityLookup[log.targetId] : null;
      const aggregateActivity = linkedActivity || directActivity;
      const key = aggregateActivity ? `activity:${aggregateActivity.id}` : `${log.targetType}:${log.targetId}`;
      const existing = grouped.get(key) || {
        label: aggregateActivity?.description || log.title,
        domain: aggregateActivity?.domain || todo?.domain || "",
        project: aggregateActivity?.project || todo?.project || "",
        minutes: 0,
        targetType: aggregateActivity ? "activity" : log.targetType,
        targetId: aggregateActivity?.id || log.targetId,
      };
      existing.minutes += log.durationMinutes;
      grouped.set(key, existing);
    });
    return Array.from(grouped.values()).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
  }, [activityLookup, filteredLogs, todoLookup]);

  const projectTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    activityTotals.forEach((entry) => grouped.set(entry.project || "No project", (grouped.get(entry.project || "No project") || 0) + entry.minutes));
    return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
  }, [activityTotals]);

  const domainTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    activityTotals.forEach((entry) => grouped.set(entry.domain || "No domain", (grouped.get(entry.domain || "No domain") || 0) + entry.minutes));
    return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
  }, [activityTotals]);

  const workspaceTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredLogs.forEach((log) => {
      const label = log.targetType === "todo" ? "Todos workspace" : "Activities workspace";
      grouped.set(label, (grouped.get(label) || 0) + log.durationMinutes);
    });
    return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
  }, [filteredLogs]);

  const workTypeTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredLogs.forEach((log) => {
      const label =
        log.targetType === "todo" ? "Todo" : activityLookup[log.targetId]?.type === "meeting" ? "Meeting" : "Task activity";
      grouped.set(label, (grouped.get(label) || 0) + log.durationMinutes);
    });
    return Array.from(grouped.entries()).map(([label, minutes]) => ({ label, minutes })).sort((l, r) => r.minutes - l.minutes || l.label.localeCompare(r.label));
  }, [activityLookup, filteredLogs]);

  const currentTotalMinutes = useMemo(() => filteredLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0), [filteredLogs]);
  const comparisonTotalMinutes = useMemo(() => comparisonLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0), [comparisonLogs]);
  const comparisonDeltaMinutes = currentTotalMinutes - comparisonTotalMinutes;
  const comparisonDeltaPercent = comparisonTotalMinutes > 0 ? Math.round((comparisonDeltaMinutes / comparisonTotalMinutes) * 100) : null;
  const maxDailyMinutes = Math.max(1, ...dailyTotals.map((entry) => entry.minutes));
  const stackedSummary = useMemo(
    () => [...workspaceTotals, ...workTypeTotals].slice(0, 6),
    [workspaceTotals, workTypeTotals],
  );
  const stackedSummaryTotal = Math.max(1, stackedSummary.reduce((sum, entry) => sum + entry.minutes, 0));

  const selectedLog = useMemo(
    () => (selectedLogId ? filteredLogs.find((log) => log.id === selectedLogId) ?? null : recentLogs[0] ?? null),
    [filteredLogs, recentLogs, selectedLogId],
  );

  const applyPreset = (preset: Exclude<DatePreset, "custom">) => {
    const range = getPresetRange(preset);
    setDatePreset(preset);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const openSelectedTarget = () => {
    if (!selectedLog) return;
    if (selectedLog.targetType === "todo") {
      onOpenTodoDetail(selectedLog.targetId);
      return;
    }
    onOpenActivityDetail(selectedLog.targetId);
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
    const content = JSON.stringify(
      {
        filters: { datePreset, fromDate, toDate, project: projectFilter, domain: domainFilter },
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
      },
      null,
      2,
    );
    await saveTextFile({ content, defaultFilename: buildJsonExportFilename(), filters: [{ name: "JSON report", extensions: ["json"] }] });
  };

  const applySavedPreset = (preset: TimeReportPreset) => {
    setDatePreset("custom");
    setFromDate(preset.fromDate);
    setToDate(preset.toDate);
    setDomainFilter(preset.domain || "all");
    setProjectFilter(preset.project || "all");
  };

  return (
    <div className="card todos-workspace todos-workspace-minimal time-workspace-card">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Time</h2>
          <p className="muted">See what is running, compare periods, correct missed stop times, and export clean reporting views when needed.</p>
        </div>
        <div className="page-actions">
          <button className="shell-button" type="button" onClick={() => void exportCsv()}>Export CSV</button>
          <button className="shell-button" type="button" onClick={() => void exportMarkdown()}>Export Markdown</button>
          <button className="shell-button" type="button" onClick={() => void exportJson()}>Export JSON</button>
        </div>
      </div>

      <div className="time-filter-stack">
        <div className="time-preset-row">
          <div className="capture-density-toggle">
            <button className="segment-button" data-active={datePreset === "today"} type="button" onClick={() => applyPreset("today")}>Today</button>
            <button className="segment-button" data-active={datePreset === "this-week"} type="button" onClick={() => applyPreset("this-week")}>This week</button>
            <button className="segment-button" data-active={datePreset === "this-month"} type="button" onClick={() => applyPreset("this-month")}>This month</button>
            <button className="segment-button" data-active={datePreset === "custom"} type="button" onClick={() => setDatePreset("custom")}>Custom</button>
          </div>
          <div className="time-comparison-inline">
            <span className="tiny-text">Current</span>
            <strong>{formatMinutes(currentTotalMinutes)}</strong>
            {comparisonRange ? (
              <>
                <span className="tiny-text">Previous</span>
                <strong>{formatMinutes(comparisonTotalMinutes)}</strong>
                <span className={`tiny-text ${comparisonDeltaMinutes >= 0 ? "time-delta-positive" : "time-delta-negative"}`}>
                  {comparisonDeltaMinutes >= 0 ? "+" : ""}
                  {formatMinutes(comparisonDeltaMinutes)}
                  {comparisonDeltaPercent !== null ? ` (${comparisonDeltaPercent >= 0 ? "+" : ""}${comparisonDeltaPercent}%)` : ""}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="todos-workspace-toolbar">
          <div className="field">
            <label htmlFor="time-filter-from">From</label>
            <input id="time-filter-from" type="date" value={fromDate} onChange={(event) => { setDatePreset("custom"); setFromDate(event.target.value); }} />
          </div>
          <div className="field">
            <label htmlFor="time-filter-to">To</label>
            <input id="time-filter-to" type="date" value={toDate} onChange={(event) => { setDatePreset("custom"); setToDate(event.target.value); }} />
          </div>
          <div className="field">
            <label htmlFor="time-filter-project">Project</label>
            <select id="time-filter-project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="all">All</option>
              {projectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="time-filter-domain">Domain</label>
            <select id="time-filter-domain" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
              <option value="all">All</option>
              {domainOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>Saved reports</h3>
              <p className="muted">Save the current range and filters as a reusable reporting view.</p>
            </div>
          </div>
          <div className="todos-workspace-input-row">
            <div className="field field-wide">
              <label htmlFor="time-report-preset-label">Preset name</label>
              <input
                id="time-report-preset-label"
                value={presetDraft}
                onChange={(event) => setPresetDraft(event.target.value)}
                placeholder="For example: This month - Product"
                onKeyDown={(event) => {
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
                }}
              />
            </div>
            <button
              className="small-button"
              type="button"
              onClick={() => {
                if (!presetDraft.trim()) return;
                onSaveReportPreset({
                  label: presetDraft.trim(),
                  fromDate,
                  toDate,
                  domain: domainFilter === "all" ? "" : domainFilter,
                  project: projectFilter === "all" ? "" : projectFilter,
                });
                setPresetDraft("");
              }}
            >
              Save preset
            </button>
          </div>
          {reportPresets.length ? (
            <div className="section-list">
              {reportPresets.map((preset) => (
                <div key={preset.id} className="list-item">
                  <button className="list-item-button list-item-button-inline" type="button" onClick={() => applySavedPreset(preset)}>
                    <span>
                      <strong>{preset.label}</strong>
                      <span className="tiny-text">
                        {preset.fromDate} to {preset.toDate}
                        {preset.domain ? ` - ${preset.domain}` : ""}
                        {preset.project ? ` - ${preset.project}` : ""}
                      </span>
                    </span>
                  </button>
                  <button className="small-button danger-button" type="button" onClick={() => onDeleteReportPreset(preset.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No saved report presets yet.</p>
          )}
        </div>
      </div>
      <div className="time-workspace-layout">
        <section className="time-workspace-main">
          <div className="time-summary-grid">
            <div className="sidebar-card">
              <h3>Active timers</h3>
              <div className="time-summary-stat">{runningLogs.length}</div>
              <div className="stack tight-stack">
                {runningLogs.length ? runningLogs.map((log) => (
                  <div key={log.id} className="list-item">
                    <div><strong>{log.title}</strong><div className="tiny-text">{log.contextLabel}</div></div>
                    <button className="small-button" type="button" onClick={() => onStopTracking(log.targetType, log.targetId)}>Stop</button>
                  </div>
                )) : <p className="muted">No timers are running right now.</p>}
              </div>
            </div>
            <div className="sidebar-card">
              <h3>Compare periods</h3>
              <div className="time-summary-stat">{formatMinutes(currentTotalMinutes)}</div>
              <div className="stack tight-stack">
                <div className="list-item"><span>Previous period</span><strong>{formatMinutes(comparisonTotalMinutes)}</strong></div>
                <div className="list-item">
                  <span>Delta</span>
                  <strong className={comparisonDeltaMinutes >= 0 ? "time-delta-positive" : "time-delta-negative"}>
                    {comparisonDeltaMinutes >= 0 ? "+" : ""}{formatMinutes(comparisonDeltaMinutes)}
                  </strong>
                </div>
                {comparisonRange ? <div className="tiny-text">{comparisonRange.label}</div> : null}
              </div>
            </div>
            <div className="sidebar-card">
              <h3>By workspace</h3>
              <div className="stack tight-stack">
                {workspaceTotals.length ? workspaceTotals.map((entry) => (
                  <div key={entry.label} className="list-item"><strong>{entry.label}</strong><span>{formatMinutes(entry.minutes)}</span></div>
                )) : <p className="muted">No logged time in this range.</p>}
              </div>
            </div>
            <div className="sidebar-card">
              <h3>By work type</h3>
              <div className="stack tight-stack">
                {workTypeTotals.length ? workTypeTotals.map((entry) => (
                  <div key={entry.label} className="list-item"><strong>{entry.label}</strong><span>{formatMinutes(entry.minutes)}</span></div>
                )) : <p className="muted">No logged time in this range.</p>}
              </div>
            </div>
            <div className="sidebar-card">
              <h3>Per day</h3>
              <div className="stack tight-stack">
                {dailyTotals.slice(0, 8).map((entry) => (
                  <div key={entry.date} className="list-item"><strong>{entry.date}</strong><span>{formatMinutes(entry.minutes)}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-header">
              <div>
                <h3>Grouped tables</h3>
                <p className="muted">Use these as dashboard tables now, and as chart-ready exports later.</p>
              </div>
            </div>
            <div className="time-grouped-grid">
              <div className="stack tight-stack">
                <strong>Projects</strong>
                {projectTotals.slice(0, 10).map((entry) => <div key={entry.label} className="list-item"><span>{entry.label}</span><span>{formatMinutes(entry.minutes)}</span></div>)}
              </div>
              <div className="stack tight-stack">
                <strong>Domains</strong>
                {domainTotals.slice(0, 10).map((entry) => <div key={entry.label} className="list-item"><span>{entry.label}</span><span>{formatMinutes(entry.minutes)}</span></div>)}
              </div>
              <div className="stack tight-stack">
                <strong>Activities</strong>
                {activityTotals.slice(0, 10).map((entry) => (
                  <button key={`${entry.targetType}-${entry.targetId}`} className="list-item list-item-button" type="button" onClick={() => entry.targetType === "activity" ? onOpenActivityDetail(entry.targetId) : onOpenTodoDetail(entry.targetId)}>
                    <span>{entry.label}</span><span>{formatMinutes(entry.minutes)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="time-visual-grid">
            <div className="sidebar-card">
              <div className="card-header">
                <div>
                  <h3>Daily trend</h3>
                  <p className="muted">A quick visual read of where time clustered across the current range.</p>
                </div>
              </div>
              <div className="time-trend-list">
                {dailyTotals.slice(0, 10).map((entry) => (
                  <div key={entry.date} className="time-trend-row">
                    <span className="tiny-text">{entry.date}</span>
                    <div className="time-trend-bar">
                      <span style={{ width: `${(entry.minutes / maxDailyMinutes) * 100}%` }} />
                    </div>
                    <strong>{formatMinutes(entry.minutes)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="sidebar-card">
              <div className="card-header">
                <div>
                  <h3>Stacked summary</h3>
                  <p className="muted">A compact split between workspace and work-type effort in the selected range.</p>
                </div>
              </div>
              <div className="time-stacked-strip">
                {stackedSummary.map((entry) => (
                  <span
                    key={entry.label}
                    title={`${entry.label}: ${formatMinutes(entry.minutes)}`}
                    style={{ width: `${(entry.minutes / stackedSummaryTotal) * 100}%` }}
                  />
                ))}
              </div>
              <div className="section-list">
                {stackedSummary.map((entry) => (
                  <div key={entry.label} className="list-item">
                    <strong>{entry.label}</strong>
                    <span>{formatMinutes(entry.minutes)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="sidebar-card">
            <div className="card-header">
              <div>
                <h3>Recent logs</h3>
                <p className="muted">This is the fastest place to repair missed stop times or adjust logged durations.</p>
              </div>
            </div>
            <div className="time-log-table">
              {recentLogs.length ? recentLogs.map((log) => (
                <button key={log.id} type="button" className={`timelog-list-item time-log-row${selectedLog?.id === log.id ? " time-log-row-selected" : ""}`} onClick={() => setSelectedLogId(log.id)}>
                  <div><strong>{log.title}</strong><div className="tiny-text">{log.contextLabel}</div></div>
                  <span>{log.date}</span>
                  <span>{log.startTime} - {log.endTime}</span>
                  <span>{formatMinutes(log.durationMinutes)}</span>
                </button>
              )) : <div className="empty-state-card compact-empty-state"><h3>No time logs yet</h3><p>Start and stop work from Todos or Activities, then correct the logs here when needed.</p></div>}
            </div>
          </div>
        </section>

        <aside className="time-workspace-detail">
          {selectedLog ? (
            <div className="stack">
              <div className="card-header">
                <div>
                  <h3>{selectedLog.title}</h3>
                  <div className="calendar-editor-meta">
                    <span className="status-chip">{selectedLog.targetType === "activity" ? "Activity" : "Todo"}</span>
                    <span className="status-chip">{selectedLog.contextLabel}</span>
                  </div>
                </div>
                <div className="page-actions">
                  <button className="small-button" type="button" onClick={openSelectedTarget}>Open source</button>
                  <button className="small-button danger-button" type="button" onClick={() => onDeleteTimeLog(selectedLog.id)}>Delete</button>
                </div>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="time-log-date">Date</label>
                  <input id="time-log-date" type="date" value={selectedLog.date} onChange={(event) => onSaveTimeLog({ ...selectedLog, date: event.target.value, durationMinutes: calculateDurationMinutes(event.target.value, selectedLog.startTime, selectedLog.endTime), updatedAt: new Date().toISOString() })} />
                </div>
                <div className="field">
                  <label htmlFor="time-log-start">Start</label>
                  <input id="time-log-start" type="time" step={300} value={selectedLog.startTime} onChange={(event) => onSaveTimeLog({ ...selectedLog, startTime: event.target.value, durationMinutes: calculateDurationMinutes(selectedLog.date, event.target.value, selectedLog.endTime), updatedAt: new Date().toISOString() })} />
                </div>
                <div className="field">
                  <label htmlFor="time-log-end">End</label>
                  <input id="time-log-end" type="time" step={300} value={selectedLog.endTime} onChange={(event) => onSaveTimeLog({ ...selectedLog, endTime: event.target.value, durationMinutes: calculateDurationMinutes(selectedLog.date, selectedLog.startTime, event.target.value), updatedAt: new Date().toISOString() })} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="time-log-notes">Notes</label>
                <textarea id="time-log-notes" rows={5} value={selectedLog.notes} onChange={(event) => onSaveTimeLog({ ...selectedLog, notes: event.target.value, updatedAt: new Date().toISOString() })} />
              </div>
              <div className="inline-row">
                <div className="sidebar-card compact-metric-card"><span className="tiny-text">Duration</span><strong>{formatMinutes(selectedLog.durationMinutes)}</strong></div>
                <div className="page-actions">
                  <button className="small-button" type="button" onClick={() => onStartTracking(selectedLog.targetType, selectedLog.targetId)}>Start</button>
                  <button className="small-button" type="button" onClick={() => onStopTracking(selectedLog.targetType, selectedLog.targetId)}>Stop</button>
                </div>
              </div>
            </div>
          ) : <div className="empty-state-card compact-empty-state"><h3>Select a time log</h3><p>Choose a recent log to correct its timing, notes, or source context.</p></div>}
        </aside>
      </div>
    </div>
  );
};
