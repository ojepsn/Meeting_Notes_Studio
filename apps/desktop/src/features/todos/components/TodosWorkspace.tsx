import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { TokenPicker } from "../../../components/TokenPicker";
import { getActivitiesForSelection, getProjectsForDomain, type StructureOptions } from "../../../lib/structure/options";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "../../../lib/time/tracking";

type TodoSortKey = "dueDate" | "doOn" | "createdAt" | "description" | "domain" | "project" | "activity";

interface TodosWorkspaceProps {
  todos: TodoRecord[];
  activities: ActivityRecord[];
  timeLogs: TimeLogRecord[];
  structureOptions: StructureOptions;
  requestedTodoId?: string | null;
  requestedDomain?: string | null;
  requestedProject?: string | null;
  onEditorClose?: () => void;
  onToggle: (todo: TodoRecord) => void;
  onAdd: (description: string, options?: { activityId?: string }) => void;
  onSave: (todo: TodoRecord) => void;
  onDelete: (id: string) => void;
  onConvertToActivity: (todo: TodoRecord) => void;
  onSaveTimeLog: (timeLog: TimeLogRecord) => void;
  onDeleteTimeLog: (id: string) => void;
  onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onOpenActivityDetail?: (activityId: string) => void;
}

const createBlankTodoDraft = (description = ""): TodoRecord => ({
  id: "",
  description,
  isDone: false,
  isPrivate: false,
  comments: "",
  activityId: "",
  domain: "",
  project: "",
  activity: "",
  doOn: "",
  dueDate: "",
  detailsHtml: "",
  createdAt: "",
  sessionIds: [],
});

const createBlankTimeLogDraft = (targetId: string): TimeLogRecord => {
  const now = new Date();
  const date = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
  const time = `${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`;
  return {
    id: crypto.randomUUID(),
    targetType: "todo",
    targetId,
    date,
    startTime: time,
    endTime: time,
    durationMinutes: 0,
    notes: "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

const normalizeValue = (value: string) => value.trim().toLowerCase();

const calculateDurationMinutes = (date: string, startTime: string, endTime: string) => {
  const start = new Date(`${date}T${startTime || "00:00"}:00`);
  const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
};

export const TodosWorkspace = ({
  todos,
  activities,
  timeLogs,
  structureOptions,
  requestedTodoId,
  requestedDomain,
  requestedProject,
  onEditorClose,
  onToggle,
  onAdd,
  onSave,
  onDelete,
  onConvertToActivity,
  onSaveTimeLog,
  onDeleteTimeLog,
  onStartTracking,
  onStopTracking,
  onOpenActivityDetail,
}: TodosWorkspaceProps) => {
  const [draft, setDraft] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<TodoSortKey>("dueDate");
  const [domainFilter, setDomainFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<TodoRecord>(createBlankTodoDraft());
  const [editingTimeLogId, setEditingTimeLogId] = useState<string | null>(null);
  const [timeLogDraft, setTimeLogDraft] = useState<TimeLogRecord | null>(null);
  const [now, setNow] = useState(() => new Date());
  const detailsEditorRef = useRef<HTMLDivElement | null>(null);

  const activityOptions = useMemo(
    () => activities.filter((entry) => !entry.parentActivityId).sort((left, right) => left.description.localeCompare(right.description)),
    [activities],
  );

  const activityLookup = useMemo(
    () => Object.fromEntries(activities.map((activity) => [activity.id, activity])) as Record<string, ActivityRecord>,
    [activities],
  );
  const domainOptions = useMemo(() => structureOptions.domains, [structureOptions.domains]);
  const projectOptions = useMemo(
    () => getProjectsForDomain(structureOptions, domainFilter === "all" ? "" : domainFilter),
    [domainFilter, structureOptions],
  );

  const openTodos = useMemo(() => todos.filter((todo) => !todo.isDone), [todos]);
  const completedTodos = useMemo(() => todos.filter((todo) => todo.isDone).slice(0, 8), [todos]);

  const todoTimeLogs = useMemo(() => timeLogs.filter((entry) => entry.targetType === "todo"), [timeLogs]);

  const timeLogsByTodoId = useMemo(() => {
    const grouped = new Map<string, TimeLogRecord[]>();
    todoTimeLogs.forEach((entry) => grouped.set(entry.targetId, [...(grouped.get(entry.targetId) || []), entry]));
    return grouped;
  }, [todoTimeLogs]);

  const runningTodos = useMemo(
    () =>
      openTodos.filter((todo) =>
        (timeLogsByTodoId.get(todo.id) || []).some(isTimeLogRunning),
      ),
    [openTodos, timeLogsByTodoId],
  );

  useEffect(() => {
    if (!runningTodos.length) return;
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, [runningTodos.length]);

  const filteredTodos = useMemo(() => {
    const normalized = normalizeValue(query);
    const structureFiltered = openTodos.filter((todo) => {
      if (domainFilter !== "all" && todo.domain !== domainFilter) return false;
      if (projectFilter !== "all" && todo.project !== projectFilter) return false;
      return true;
    });
    const filtered = !normalized
      ? structureFiltered
      : structureFiltered.filter((todo) =>
          [
            todo.description,
            todo.domain,
            todo.project,
            todo.activity,
            todo.doOn,
            todo.dueDate,
            todo.createdAt,
            activityLookup[todo.activityId]?.description || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        );

    const valueForSort = (todo: TodoRecord) => {
      switch (sortKey) {
        case "description":
          return normalizeValue(todo.description);
        case "domain":
          return normalizeValue(todo.domain);
        case "project":
          return normalizeValue(todo.project);
        case "activity":
          return normalizeValue(activityLookup[todo.activityId]?.description || todo.activity);
        case "doOn":
          return todo.doOn || "9999-99-99";
        case "dueDate":
          return todo.dueDate || "9999-99-99";
        case "createdAt":
        default:
          return todo.createdAt;
      }
    };

    return [...filtered].sort((left, right) => valueForSort(left).localeCompare(valueForSort(right)));
  }, [activityLookup, domainFilter, openTodos, projectFilter, query, sortKey]);

  useEffect(() => {
    if (requestedDomain !== undefined && requestedDomain !== null) {
      setDomainFilter(requestedDomain || "all");
    }
  }, [requestedDomain]);

  useEffect(() => {
    if (requestedProject !== undefined && requestedProject !== null) {
      setProjectFilter(requestedProject || "all");
    }
  }, [requestedProject]);

  useEffect(() => {
    if (domainFilter === "all") return;
    if (projectFilter === "all") return;
    if (projectOptions.includes(projectFilter)) return;
    setProjectFilter("all");
  }, [domainFilter, projectFilter, projectOptions]);

  useEffect(() => {
    if (requestedTodoId) {
      setSelectedTodoId(requestedTodoId);
    }
  }, [requestedTodoId]);

  useEffect(() => {
    if (selectedTodoId && todos.some((entry) => entry.id === selectedTodoId)) {
      return;
    }
    if (requestedTodoId && todos.some((entry) => entry.id === requestedTodoId)) {
      setSelectedTodoId(requestedTodoId);
      return;
    }
    setSelectedTodoId(filteredTodos[0]?.id ?? openTodos[0]?.id ?? null);
  }, [filteredTodos, openTodos, requestedTodoId, selectedTodoId, todos]);

  useEffect(() => {
    if (!selectedTodoId) {
      setEditingDraft(createBlankTodoDraft());
      return;
    }
    const todo = todos.find((entry) => entry.id === selectedTodoId);
    if (!todo) {
      setSelectedTodoId(null);
      setEditingDraft(createBlankTodoDraft());
      return;
    }
    setEditingDraft(todo);
  }, [selectedTodoId, todos]);

  useEffect(() => {
    if (!detailsEditorRef.current) return;
    const nextHtml = editingDraft.detailsHtml || "<p></p>";
    if (detailsEditorRef.current.innerHTML !== nextHtml) {
      detailsEditorRef.current.innerHTML = nextHtml;
    }
  }, [editingDraft.detailsHtml, editingDraft.id]);

  const submitDraft = () => {
    const nextValue = draft.trim();
    if (!nextValue) return;
    onAdd(nextValue, { activityId: selectedActivityId || undefined });
    setDraft("");
  };

  const currentTimeLogs = selectedTodoId ? timeLogsByTodoId.get(selectedTodoId) || [] : [];
  const activeTimeLog = getRunningTimeLog(currentTimeLogs);
  const hasOpenTimer = Boolean(activeTimeLog);
  const currentActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
  const editorProjectOptions = getProjectsForDomain(structureOptions, editingDraft.domain);
  const editorActivityOptions = getActivitiesForSelection(structureOptions, editingDraft.domain, editingDraft.project);
  const linkedActivityOptions = activityOptions.filter((activity) => {
    if (activity.id === editingDraft.activityId) return true;
    if (editingDraft.domain && activity.domain && activity.domain !== editingDraft.domain) return false;
    if (editingDraft.project && activity.project && activity.project !== editingDraft.project) return false;
    return true;
  });

  const handleDraftDomainChange = (domain: string) => {
    const nextProjects = getProjectsForDomain(structureOptions, domain);
    const nextProject = nextProjects.includes(editingDraft.project) ? editingDraft.project : "";
    const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
    const nextActivity = nextActivities.includes(editingDraft.activity) ? editingDraft.activity : "";
    const linkedActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
    const nextActivityId =
      linkedActivity &&
      (!domain || !linkedActivity.domain || linkedActivity.domain === domain) &&
      (!nextProject || !linkedActivity.project || linkedActivity.project === nextProject)
        ? editingDraft.activityId
        : "";
    setEditingDraft({ ...editingDraft, domain, project: nextProject, activity: nextActivity, activityId: nextActivityId });
  };

  const handleDraftProjectChange = (project: string) => {
    const nextActivities = getActivitiesForSelection(structureOptions, editingDraft.domain, project);
    const nextActivity = nextActivities.includes(editingDraft.activity) ? editingDraft.activity : "";
    const linkedActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
    const nextActivityId =
      linkedActivity &&
      (!editingDraft.domain || !linkedActivity.domain || linkedActivity.domain === editingDraft.domain) &&
      (!project || !linkedActivity.project || linkedActivity.project === project)
        ? editingDraft.activityId
        : "";
    setEditingDraft({ ...editingDraft, project, activity: nextActivity, activityId: nextActivityId });
  };

  const clearSelection = () => {
    setSelectedTodoId(null);
    setEditingTimeLogId(null);
    setTimeLogDraft(null);
    onEditorClose?.();
  };

  return (
    <div className="card todos-workspace todos-workspace-minimal todos-hub-card">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Todos</h2>
          <p className="muted">Execution happens here. Start work fast, stay in context, and correct time afterward when needed.</p>
        </div>
      </div>

      <div className="todos-workspace-input-row">
        <div className="field">
          <label htmlFor="todos-workspace-activity">Activity</label>
          <select id="todos-workspace-activity" value={selectedActivityId} onChange={(event) => setSelectedActivityId(event.target.value)}>
            <option value="">Unassigned</option>
            {activityOptions.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.description}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-wide">
          <label htmlFor="todos-workspace-draft">New todo</label>
          <input
            id="todos-workspace-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitDraft();
              }
            }}
            placeholder="Add a focused next action"
          />
        </div>
        <button className="primary-button" type="button" onClick={submitDraft}>
          Add
        </button>
      </div>

      <div className="todos-hub-shell">
        <section className="todos-hub-list-panel">
          <div className="todos-workspace-toolbar">
            <div className="field field-wide">
              <label htmlFor="todos-workspace-filter">Search</label>
              <input id="todos-workspace-filter" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter todos" />
            </div>
            <div className="field">
              <label htmlFor="todos-workspace-domain">Domain</label>
              <select id="todos-workspace-domain" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
                <option value="all">All</option>
                {domainOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
                <div className="field">
                  <label htmlFor="todos-workspace-project">Project</label>
                  <select id="todos-workspace-project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">All</option>
                {projectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="todos-workspace-sort">Sort by</label>
              <select id="todos-workspace-sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as TodoSortKey)}>
                <option value="dueDate">Due date</option>
                <option value="doOn">Do on</option>
                <option value="createdAt">Created</option>
                <option value="description">Title</option>
                <option value="domain">Domain</option>
                <option value="project">Project</option>
                <option value="activity">Activity</option>
              </select>
            </div>
          </div>

          {runningTodos.length ? (
            <div className="todos-running-strip">
              <strong>Running now</strong>
              <div className="todos-running-list">
                {runningTodos.map((todo) => {
                  const runningLog = getRunningTimeLog(timeLogsByTodoId.get(todo.id) || []);
                  const elapsedLabel = runningLog
                    ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))
                    : "Running";
                  return (
                    <div key={todo.id} className="todos-running-chip">
                      <button type="button" className="status-chip" onClick={() => setSelectedTodoId(todo.id)}>
                        {todo.description} • {elapsedLabel}
                      </button>
                      <button
                        className="small-button"
                        type="button"
                        onClick={() => onStopTracking("todo", todo.id)}
                      >
                        Stop
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="todos-compact-list">
            {filteredTodos.length ? (
              filteredTodos.map((todo) => {
                const logs = timeLogsByTodoId.get(todo.id) || [];
                const totalMinutes = logs.reduce((sum, entry) => sum + entry.durationMinutes, 0);
                const runningLog = getRunningTimeLog(logs);
                const running = Boolean(runningLog);
                const elapsedLabel = runningLog
                  ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))
                  : "";
                return (
                  <button
                    key={todo.id}
                    type="button"
                    className={`todos-compact-item${selectedTodoId === todo.id ? " todos-compact-item-selected" : ""}`}
                    onClick={() => setSelectedTodoId(todo.id)}
                  >
                    <div className="todos-compact-item-main">
                      <div className="todos-compact-item-head">
                        <input
                          type="checkbox"
                          checked={todo.isDone}
                          onChange={(event) => {
                            event.stopPropagation();
                            onToggle({ ...todo, isDone: !todo.isDone });
                          }}
                        />
                        <strong>{todo.description}</strong>
                      </div>
                      <div className="todos-compact-item-meta">
                        <span>{activityLookup[todo.activityId]?.description || todo.activity || "Unassigned"}</span>
                        <span>{todo.project || "No project"}</span>
                        <span>{todo.dueDate || todo.doOn || "-"}</span>
                        <span>{running ? `Running • ${elapsedLabel}` : totalMinutes ? formatTrackedMinutes(totalMinutes) : "No time"}</span>
                      </div>
                    </div>
                    <div className="todos-compact-item-actions">
                      <button
                        className={`small-button${running ? " primary-button" : ""}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (running) {
                            onStopTracking("todo", todo.id);
                            return;
                          }
                          onStartTracking("todo", todo.id);
                        }}
                      >
                        {running ? "Stop" : "Start"}
                      </button>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="empty-state-card compact-empty-state">
                <h3>No open todos</h3>
                <p>Capture the next action here, or type `td` followed by text in any input across the app.</p>
              </div>
            )}
          </div>

          {completedTodos.length ? (
            <details className="workspace-disclosure">
              <summary>Recently completed</summary>
              <div className="workspace-disclosure-body todos-workspace-completed">
                {completedTodos.map((todo) => (
                  <label key={todo.id} className="todos-workspace-main todos-workspace-main-completed">
                    <input type="checkbox" checked={todo.isDone} onChange={() => onToggle({ ...todo, isDone: !todo.isDone })} />
                    <span className="todos-workspace-copy">
                      <strong>{todo.description}</strong>
                      <span className="muted">{todo.createdAt.slice(0, 10)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </details>
          ) : null}
        </section>
        <section className="todos-hub-detail-panel">
          {selectedTodoId ? (
            <div className="stack">
              <div className="card-header activities-detail-header">
                <div>
                  <h3>{editingDraft.description || "Todo"}</h3>
                  <div className="calendar-editor-meta">
                    {currentActivity ? <span className="status-chip">{currentActivity.description}</span> : <span className="status-chip">Unassigned</span>}
                    {editingDraft.project ? <span className="status-chip">{editingDraft.project}</span> : null}
                    {editingDraft.domain ? <span className="status-chip">{editingDraft.domain}</span> : null}
                    <span className="status-chip">{hasOpenTimer ? "Timer running" : `${currentTimeLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0)} min logged`}</span>
                  </div>
                </div>
                <div className="page-actions">
                  <button className="small-button" type="button" onClick={clearSelection}>
                    Close
                  </button>
                  <button
                    className="small-button danger-button"
                    type="button"
                    onClick={() => {
                      onDelete(editingDraft.id);
                      clearSelection();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="activities-detail-grid">
                <div className="field field-wide">
                  <label htmlFor="todo-edit-description">Todo</label>
                  <input id="todo-edit-description" value={editingDraft.description} onChange={(event) => setEditingDraft({ ...editingDraft, description: event.target.value })} />
                </div>

                <div className="field">
                  <label htmlFor="todo-edit-linked-activity">Activity</label>
                  <select
                    id="todo-edit-linked-activity"
                    value={editingDraft.activityId}
                    onChange={(event) => {
                      const nextActivity = activityLookup[event.target.value];
                      setEditingDraft({
                        ...editingDraft,
                        activityId: event.target.value,
                        domain: nextActivity?.domain || editingDraft.domain,
                        project: nextActivity?.project || editingDraft.project,
                        activity: nextActivity?.description || editingDraft.activity,
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {linkedActivityOptions.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="todo-edit-domain">Domain</label>
                  <TokenPicker
                    value={editingDraft.domain}
                    savedOptions={structureOptions.domains}
                    suggestedOptions={structureOptions.domains}
                    placeholder="Search or add domain"
                    suggestionSummary="Domains"
                    suggestionBadgeText="Available"
                    mode="single"
                    onChange={handleDraftDomainChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="todo-edit-project">Project</label>
                  <TokenPicker
                    value={editingDraft.project}
                    savedOptions={editorProjectOptions}
                    suggestedOptions={editorProjectOptions}
                    placeholder="Search or add project"
                    suggestionSummary="Projects"
                    suggestionBadgeText="Available"
                    mode="single"
                    onChange={handleDraftProjectChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="todo-edit-activity-label">Activity</label>
                  <TokenPicker
                    value={editingDraft.activity}
                    savedOptions={editorActivityOptions}
                    suggestedOptions={editorActivityOptions}
                    placeholder="Search or add activity"
                    suggestionSummary="Activities"
                    suggestionBadgeText="Available"
                    mode="single"
                    onChange={(value) => setEditingDraft({ ...editingDraft, activity: value })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="todo-edit-do-on">Do on</label>
                  <DateInput id="todo-edit-do-on" value={editingDraft.doOn} onChange={(event) => setEditingDraft({ ...editingDraft, doOn: event.target.value })} />
                </div>

                <div className="field">
                  <label htmlFor="todo-edit-due-date">Due date</label>
                  <DateInput id="todo-edit-due-date" value={editingDraft.dueDate} onChange={(event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value })} />
                </div>

                <div className="field activity-private-field">
                  <span>Private</span>
                  <div className="compact-private-toggle">
                    <input id="todo-edit-private" type="checkbox" checked={editingDraft.isPrivate} onChange={(event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked })} />
                    <label htmlFor="todo-edit-private" className="checkbox-label">Private</label>
                  </div>
                </div>
              </div>

              {currentActivity ? (
                <div className="prompt-actions-row">
                  <div className="prompt-actions-copy">
                    <strong>Linked activity</strong>
                    <span className="muted">Keep this todo inside its parent work stream, or jump there for broader planning.</span>
                  </div>
                  {onOpenActivityDetail ? (
                    <button className="small-button" type="button" onClick={() => onOpenActivityDetail(currentActivity.id)}>
                      Open activity
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="todo-edit-details">Details</label>
                <div id="todo-edit-details" ref={detailsEditorRef} className="rich-text-surface todo-rich-text-surface" contentEditable suppressContentEditableWarning onInput={(event) => setEditingDraft({ ...editingDraft, detailsHtml: (event.currentTarget as HTMLDivElement).innerHTML })} />
              </div>
              <details className="workspace-disclosure" open>
                <summary>Time logs</summary>
                <div className="workspace-disclosure-body stack">
                  <div className="page-actions">
                    <span className="status-chip">
                      {hasOpenTimer && activeTimeLog
                        ? `Running • ${formatTrackedMinutes(calculateLiveDurationMinutes(activeTimeLog, now))}`
                        : `${currentTimeLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0)} min logged`}
                    </span>
                    <button className="primary-button" type="button" onClick={() => (hasOpenTimer ? onStopTracking("todo", editingDraft.id) : onStartTracking("todo", editingDraft.id))}>
                      {hasOpenTimer ? "Stop" : "Start"}
                    </button>
                    <button className="small-button" type="button" onClick={() => {
                      const draftLog = createBlankTimeLogDraft(editingDraft.id);
                      setEditingTimeLogId(draftLog.id);
                      setTimeLogDraft(draftLog);
                    }}>
                      Add manual log
                    </button>
                  </div>
                  {timeLogDraft ? (
                    <div className="list-item timelog-editor-card">
                      <div className="metadata-triplet-grid">
                        <div className="field metadata-subfield">
                          <label>Date</label>
                          <DateInput value={timeLogDraft.date} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, date: event.target.value, durationMinutes: calculateDurationMinutes(event.target.value, timeLogDraft.startTime, timeLogDraft.endTime) })} />
                        </div>
                        <div className="field metadata-subfield">
                          <label>Start</label>
                          <input type="time" value={timeLogDraft.startTime} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, startTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, event.target.value, timeLogDraft.endTime) })} />
                        </div>
                        <div className="field metadata-subfield">
                          <label>End</label>
                          <input type="time" value={timeLogDraft.endTime} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, endTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, event.target.value) })} />
                        </div>
                      </div>
                      <div className="field">
                        <label>Notes</label>
                        <input value={timeLogDraft.notes} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, notes: event.target.value })} placeholder="Optional context" />
                      </div>
                      <div className="page-actions">
                        <span className="status-chip">{timeLogDraft.durationMinutes} min</span>
                        <button className="primary-button" type="button" onClick={() => {
                          onSaveTimeLog({
                            ...timeLogDraft,
                            durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, timeLogDraft.endTime),
                          });
                          setEditingTimeLogId(null);
                          setTimeLogDraft(null);
                        }}>
                          Save log
                        </button>
                        <button className="small-button" type="button" onClick={() => {
                          setEditingTimeLogId(null);
                          setTimeLogDraft(null);
                        }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {currentTimeLogs.length ? currentTimeLogs.map((entry) => (
                    <button
                      key={entry.id}
                      className="list-item timelog-list-item"
                      type="button"
                      onClick={() => {
                        setEditingTimeLogId(entry.id);
                        setTimeLogDraft(entry);
                      }}
                    >
                      <strong>{entry.date}</strong>
                      <span>{entry.startTime} to {entry.endTime}</span>
                      <span>{entry.durationMinutes} min</span>
                    </button>
                  )) : <p className="muted">No time logged yet. Start a timer or add a manual entry here.</p>}
                  {editingTimeLogId && timeLogDraft && currentTimeLogs.some((entry) => entry.id === editingTimeLogId) ? (
                    <div className="page-actions">
                      <button className="danger-button small-button" type="button" onClick={() => {
                        onDeleteTimeLog(editingTimeLogId);
                        setEditingTimeLogId(null);
                        setTimeLogDraft(null);
                      }}>
                        Delete selected log
                      </button>
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="page-actions">
                <button className="primary-button" type="button" onClick={() => onSave({ ...editingDraft, activity: currentActivity?.description || editingDraft.activity })}>
                  Save
                </button>
                <button className="shell-button" type="button" onClick={() => onConvertToActivity(editingDraft)}>
                  Convert to activity
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state-card compact-empty-state activities-empty-panel">
              <h3>Select a todo</h3>
              <p>Use the list on the left to keep execution, timer control, and retrospective time edits in one place.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
