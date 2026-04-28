import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import type { ActivityRecord, TaskRecord, TimeLogRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { TokenPicker } from "../../../components/TokenPicker";
import { getActivitiesForSelection, getProjectsForDomain, type StructureOptions } from "../../../lib/structure/options";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "../../../lib/time/tracking";

type TodoSortKey = "createdAt" | "description" | "domain" | "project" | "activity" | "dueDate" | "details";
type TodoSortDirection = "asc" | "desc";
type TodoColumnFilters = Record<TodoSortKey, string>;
type TodoVisibilityFilter = "open" | "all" | "done";
type VisibleTodoColumnKey = Exclude<TodoSortKey, "createdAt">;
type TodoColumnWidths = Record<VisibleTodoColumnKey, number>;

interface TodosWorkspaceProps {
  todos: TaskRecord[];
  activities: ActivityRecord[];
  timeLogs: TimeLogRecord[];
  structureOptions: StructureOptions;
  requestedTodoId?: string | null;
  requestedDomain?: string | null;
  requestedProject?: string | null;
  onEditorClose?: () => void;
  onToggle: (todo: TaskRecord) => void;
  onAdd: (description: string, options?: { activityId?: string }) => void;
  onSave: (todo: TaskRecord) => void;
  onDelete: (id: string) => void;
  onConvertToActivity: (todo: TaskRecord) => void;
  onSaveTimeLog: (timeLog: TimeLogRecord) => void;
  onDeleteTimeLog: (id: string) => void;
  onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onOpenActivityDetail?: (activityId: string) => void;
}

const createBlankTodoDraft = (description = ""): TaskRecord => ({
  id: "",
  description,
  isDone: false,
  isPrivate: false,
  isPriority: false,
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

const emptyColumnFilters: TodoColumnFilters = {
  createdAt: "",
  description: "",
  domain: "",
  project: "",
  activity: "",
  dueDate: "",
  details: "",
};

const defaultColumnWidths: TodoColumnWidths = {
  description: 420,
  domain: 140,
  project: 140,
  activity: 140,
  dueDate: 130,
  details: 220,
};

const minColumnWidths: TodoColumnWidths = {
  description: 220,
  domain: 100,
  project: 100,
  activity: 100,
  dueDate: 110,
  details: 140,
};

const stripHtmlToText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const textToDetailsHtml = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : "";
};

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
  const [sortKey, setSortKey] = useState<TodoSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<TodoSortDirection>("desc");
  const [columnFilters, setColumnFilters] = useState<TodoColumnFilters>(emptyColumnFilters);
  const [columnWidths, setColumnWidths] = useState<TodoColumnWidths>(defaultColumnWidths);
  const [visibilityFilter, setVisibilityFilter] = useState<TodoVisibilityFilter>("open");
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<TaskRecord>(createBlankTodoDraft());
  const [editingTimeLogId, setEditingTimeLogId] = useState<string | null>(null);
  const [timeLogDraft, setTimeLogDraft] = useState<TimeLogRecord | null>(null);
  const [now, setNow] = useState(() => new Date());
  const detailsEditorRef = useRef<HTMLDivElement | null>(null);

  const activityLookup = useMemo(
    () => Object.fromEntries(activities.map((activity) => [activity.id, activity])) as Record<string, ActivityRecord>,
    [activities],
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

  const getTodoColumnValue = (todo: TaskRecord, key: TodoSortKey) => {
    switch (key) {
      case "createdAt":
        return todo.createdAt;
      case "description":
        return todo.description;
      case "domain":
        return todo.domain;
      case "project":
        return todo.project;
      case "activity":
        return activityLookup[todo.activityId]?.description || todo.activity;
      case "dueDate":
        return todo.dueDate || todo.doOn;
      case "details":
      default:
        return stripHtmlToText(todo.detailsHtml || todo.comments || "");
    }
  };

  const filteredTodos = useMemo(() => {
    const statusFiltered = todos.filter((todo) => {
      if (visibilityFilter === "open") return !todo.isDone;
      if (visibilityFilter === "done") return todo.isDone;
      return true;
    });
    const filtered = statusFiltered.filter((todo) =>
      (Object.entries(columnFilters) as [TodoSortKey, string][]).every(([key, filterValue]) => {
        const normalizedFilter = normalizeValue(filterValue);
        if (!normalizedFilter) return true;
        return normalizeValue(getTodoColumnValue(todo, key)).includes(normalizedFilter);
      }),
    );

    const valueForSort = (todo: TaskRecord) => {
      switch (sortKey) {
        case "createdAt":
          return todo.createdAt || "";
        case "description":
          return normalizeValue(todo.description);
        case "domain":
          return normalizeValue(todo.domain);
        case "project":
          return normalizeValue(todo.project);
        case "activity":
          return normalizeValue(activityLookup[todo.activityId]?.description || todo.activity);
        case "dueDate":
          return todo.dueDate || todo.doOn || "9999-99-99";
        case "details":
        default:
          return normalizeValue(stripHtmlToText(todo.detailsHtml || todo.comments || ""));
      }
    };

    return [...filtered].sort((left, right) => {
      const comparison = valueForSort(left).localeCompare(valueForSort(right));
      return sortDirection === "asc" ? comparison : comparison * -1;
    });
  }, [activityLookup, columnFilters, sortDirection, sortKey, todos, visibilityFilter]);

  useEffect(() => {
    if (requestedDomain !== undefined && requestedDomain !== null) {
      setColumnFilters((current) => ({ ...current, domain: requestedDomain || "" }));
    }
  }, [requestedDomain]);

  useEffect(() => {
    if (requestedProject !== undefined && requestedProject !== null) {
      setColumnFilters((current) => ({ ...current, project: requestedProject || "" }));
    }
  }, [requestedProject]);

  useEffect(() => {
    if (requestedTodoId) {
      setSelectedTodoId(requestedTodoId);
      setIsDetailOpen(true);
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
    setSelectedTodoId(null);
    setIsDetailOpen(false);
  }, [requestedTodoId, selectedTodoId, todos]);

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
    onAdd(nextValue);
    setDraft("");
  };

  const currentTimeLogs = selectedTodoId ? timeLogsByTodoId.get(selectedTodoId) || [] : [];
  const activeTimeLog = getRunningTimeLog(currentTimeLogs);
  const hasOpenTimer = Boolean(activeTimeLog);
  const currentActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
  const editorProjectOptions = getProjectsForDomain(structureOptions, editingDraft.domain);
  const editorActivityOptions = getActivitiesForSelection(structureOptions, editingDraft.domain, editingDraft.project);

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
    setIsDetailOpen(false);
    setEditingTimeLogId(null);
    setTimeLogDraft(null);
    onEditorClose?.();
  };

  const deleteSelectedTodo = () => {
    if (!selectedTodoId) return;
    onDelete(selectedTodoId);
    clearSelection();
  };

  const updateColumnFilter = (key: TodoSortKey, value: string) => {
    setColumnFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleSort = (key: TodoSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const openTodoDetail = (todoId: string) => {
    setSelectedTodoId(todoId);
    setIsDetailOpen(true);
  };

  const stopTableEditPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const saveTodoPatch = (todo: TaskRecord, patch: Partial<TaskRecord>) => {
    onSave({ ...todo, ...patch });
  };

  const startColumnResize = (key: VisibleTodoColumnKey, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[key];
    const handlePointerMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(minColumnWidths[key], startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => ({ ...current, [key]: nextWidth }));
    };
    const handlePointerUp = () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      document.body.classList.remove("todos-column-resizing");
    };
    document.body.classList.add("todos-column-resizing");
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
  };

  const tableStyle = {
    "--todo-col-description": `${columnWidths.description}px`,
    "--todo-col-domain": `${columnWidths.domain}px`,
    "--todo-col-project": `${columnWidths.project}px`,
    "--todo-col-activity": `${columnWidths.activity}px`,
    "--todo-col-dueDate": `${columnWidths.dueDate}px`,
    "--todo-col-details": `${columnWidths.details}px`,
  } as CSSProperties;

  const todoColumns: { key: VisibleTodoColumnKey; label: string; placeholder: string }[] = [
    { key: "description", label: "Task", placeholder: "Filter task" },
    { key: "domain", label: "Domain", placeholder: "Filter domain" },
    { key: "project", label: "Project", placeholder: "Filter project" },
    { key: "activity", label: "Activity", placeholder: "Filter activity" },
    { key: "dueDate", label: "Due date", placeholder: "Filter date" },
    { key: "details", label: "Details", placeholder: "Filter details" },
  ];

  return (
    <div className="card todos-workspace todos-workspace-minimal todos-hub-card">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Tasks</h2>
          <p className="muted">Execution happens here. Start work fast, stay in context, and correct time afterward when needed.</p>
        </div>
      </div>

      <form
        className="todos-workspace-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          submitDraft();
        }}
      >
        <div className="field field-wide">
          <label htmlFor="todos-workspace-draft">New task</label>
          <input
            id="todos-workspace-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitDraft();
              }
            }}
            placeholder="Add a focused next action"
          />
        </div>
        <button className="primary-button" type="submit">
          Add
        </button>
      </form>

      <div className="todos-hub-shell">
        <section className="todos-hub-list-panel todos-table-panel">
          <div className="todos-table-summary">
            <span className="status-chip">{filteredTodos.length} shown</span>
            <span className="status-chip">{openTodos.length} open</span>
            <span className="status-chip">{todos.length - openTodos.length} completed</span>
            <label className="todos-visibility-control">
              <span>Show</span>
              <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as TodoVisibilityFilter)}>
                <option value="open">Open only</option>
                <option value="all">All tasks</option>
                <option value="done">Done only</option>
              </select>
            </label>
            <button className="small-button danger-button" type="button" onClick={deleteSelectedTodo} disabled={!selectedTodoId}>
              Delete selected
            </button>
            <span className="muted">Click a row to select. Double-click to open the full task card.</span>
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

          <div className="todos-dense-table-shell">
            <table className="todos-dense-table" style={tableStyle}>
              <thead>
                <tr>
                  {todoColumns.map((column) => (
                    <th key={column.key} scope="col">
                      <div className="todos-header-cell">
                        <button className="todos-sort-button" type="button" onClick={() => toggleSort(column.key)}>
                          <span>{column.label}</span>
                          <span aria-hidden="true">{sortKey === column.key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                        </button>
                        <button
                          className="todos-column-resize-handle"
                          type="button"
                          aria-label={`Resize ${column.label} column`}
                          onMouseDown={(event) => startColumnResize(column.key, event)}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="todos-filter-row">
                  {todoColumns.map((column) => (
                    <th key={column.key} scope="col">
                      <input
                        aria-label={`Filter ${column.label}`}
                        value={columnFilters[column.key]}
                        onChange={(event) => updateColumnFilter(column.key, event.target.value)}
                        placeholder={column.placeholder}
                      />
                    </th>
                  ))}
                  <th scope="col">
                    <div className="todos-header-cell">
                      <span className="todos-sort-button">Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTodos.length ? (
                  filteredTodos.map((todo) => {
                    const logs = timeLogsByTodoId.get(todo.id) || [];
                    const totalMinutes = logs.reduce((sum, entry) => sum + entry.durationMinutes, 0);
                    const runningLog = getRunningTimeLog(logs);
                    const running = Boolean(runningLog);
                    const elapsedLabel = runningLog
                      ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))
                      : "";
                    const activityLabel = activityLookup[todo.activityId]?.description || todo.activity || "";
                    const detailsText = stripHtmlToText(todo.detailsHtml || todo.comments || "");
                    const dueDateLabel = todo.dueDate || todo.doOn || "";
                    return (
                      <tr
                        key={todo.id}
                        className={`${selectedTodoId === todo.id ? "todos-dense-row-selected" : ""}${todo.isDone ? " todos-dense-row-done" : ""}`}
                        onClick={() => setSelectedTodoId(todo.id)}
                        onDoubleClick={() => openTodoDetail(todo.id)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            openTodoDetail(todo.id);
                          }
                        }}
                      >
                        <td>
                          <div className="todos-dense-title-cell">
                            <input
                              type="checkbox"
                              aria-label={`Mark ${todo.description} ${todo.isDone ? "open" : "done"}`}
                              checked={todo.isDone}
                              onChange={(event) => {
                                event.stopPropagation();
                                onToggle({ ...todo, isDone: !todo.isDone });
                              }}
                            />
                            <div className="todos-dense-title-copy">
                              <input
                                className="todos-inline-title-input"
                                aria-label="Task title"
                                value={todo.description}
                                onClick={stopTableEditPropagation}
                                onDoubleClick={stopTableEditPropagation}
                                onKeyDown={stopTableEditPropagation}
                                onChange={(event) => saveTodoPatch(todo, { description: event.target.value })}
                                placeholder="Untitled task"
                              />
                              <span>{running ? `Running • ${elapsedLabel}` : totalMinutes ? formatTrackedMinutes(totalMinutes) : "No time logged"}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <input
                            className="todos-inline-cell-input"
                            aria-label="Task domain"
                            value={todo.domain}
                            onClick={stopTableEditPropagation}
                            onDoubleClick={stopTableEditPropagation}
                            onKeyDown={stopTableEditPropagation}
                            onChange={(event) => saveTodoPatch(todo, { domain: event.target.value })}
                            placeholder="Domain"
                          />
                        </td>
                        <td>
                          <input
                            className="todos-inline-cell-input"
                            aria-label="Task project"
                            value={todo.project}
                            onClick={stopTableEditPropagation}
                            onDoubleClick={stopTableEditPropagation}
                            onKeyDown={stopTableEditPropagation}
                            onChange={(event) => saveTodoPatch(todo, { project: event.target.value })}
                            placeholder="Project"
                          />
                        </td>
                        <td>
                          <input
                            className="todos-inline-cell-input"
                            aria-label="Task activity"
                            value={activityLabel}
                            onClick={stopTableEditPropagation}
                            onDoubleClick={stopTableEditPropagation}
                            onKeyDown={stopTableEditPropagation}
                            onChange={(event) => saveTodoPatch(todo, { activity: event.target.value, activityId: "" })}
                            placeholder="Activity"
                          />
                        </td>
                        <td>
                          <DateInput
                            id={`todo-dense-due-${todo.id}`}
                            className="todos-inline-date-input"
                            aria-label="Task due date"
                            value={dueDateLabel}
                            onClick={stopTableEditPropagation}
                            onDoubleClick={stopTableEditPropagation}
                            onKeyDown={stopTableEditPropagation}
                            onChange={(event) => saveTodoPatch(todo, { dueDate: event.target.value })}
                          />
                        </td>
                        <td>
                          <div className="todos-dense-details-cell">
                            <input
                              className="todos-inline-cell-input"
                              aria-label="Task details"
                              value={detailsText}
                              onClick={stopTableEditPropagation}
                              onDoubleClick={stopTableEditPropagation}
                              onKeyDown={stopTableEditPropagation}
                              onChange={(event) => saveTodoPatch(todo, { detailsHtml: textToDetailsHtml(event.target.value) })}
                              placeholder="No details"
                            />
                          </div>
                        </td>
                        <td>
                          <div className="todos-dense-actions-cell">
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
                            <button
                              className="small-button danger-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDelete(todo.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={todoColumns.length + 1}>
                      <div className="empty-state-card compact-empty-state">
                        <h3>No tasks match the current filters</h3>
                        <p>Clear one or more column filters, or add a new focused next action above.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
                <h3>No open tasks</h3>
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
        {isDetailOpen ? (
        <section className="todos-hub-detail-panel todos-detail-modal">
          {selectedTodoId ? (
            <div className="stack">
              <div className="card-header activities-detail-header">
                <div>
                  <h3>{editingDraft.description || "Task"}</h3>
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
                  <label htmlFor="todo-edit-description">Task</label>
                  <input id="todo-edit-description" value={editingDraft.description} onChange={(event) => setEditingDraft({ ...editingDraft, description: event.target.value })} />
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
                    <span className="muted">Keep this task inside its parent work stream, or jump there for broader planning.</span>
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
          ) : null}
        </section>
        ) : null}
      </div>
    </div>
  );
};
