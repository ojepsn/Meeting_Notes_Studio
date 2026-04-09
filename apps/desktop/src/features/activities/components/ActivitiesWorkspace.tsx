import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { TokenPicker } from "../../../components/TokenPicker";
import { getProjectsForDomain, type StructureOptions } from "../../../lib/structure/options";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog } from "../../../lib/time/tracking";

type ActivitySortKey = "dueDate" | "description" | "type" | "domain" | "project" | "actualTimeSpentMinutes" | "createdAt";

interface ActivitiesWorkspaceProps {
  activities: ActivityRecord[];
  todos: TodoRecord[];
  timeLogs: TimeLogRecord[];
  structureOptions: StructureOptions;
  linkedSessionStateByActivity: Record<string, { sessionId: string | null; hasOutput: boolean; sessionTitle: string }>;
  requestedActivityId?: string | null;
  requestedDomain?: string | null;
  requestedProject?: string | null;
  onEditorClose?: () => void;
  onToggle: (activity: ActivityRecord) => void;
  onAdd: (description: string, type: ActivityRecord["type"]) => void;
  onAddChildTodo: (description: string, activityId: string) => void;
  onAddChildMeeting: (description: string, activityId: string) => void;
  onSave: (activity: ActivityRecord) => void;
  onDelete: (id: string) => void;
  onCreateLinkedMeetingSession: (activityId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onPreviewSessionOutput?: (sessionId: string) => void;
  onOpenTodoDetail: (todoId: string) => void;
  onSaveTimeLog: (timeLog: TimeLogRecord) => void;
  onDeleteTimeLog: (id: string) => void;
  onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
  onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
}

const createBlankActivityDraft = (description = ""): ActivityRecord => ({
  id: "",
  type: "task",
  parentActivityId: "",
  description,
  isDone: false,
  isPrivate: false,
  comments: "",
  domain: "",
  project: "",
  activity: "",
  doOn: "",
  dueDate: "",
  startTime: "",
  endTime: "",
  detailsHtml: "",
  timeRequiredMinutes: 0,
  actualTimeSpentMinutes: 0,
  createdAt: "",
  sessionIds: [],
});

const createBlankTimeLogDraft = (targetId: string): TimeLogRecord => {
  const now = new Date();
  const date = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
  const time = `${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`;
  return {
    id: crypto.randomUUID(),
    targetType: "activity",
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

const calculateDurationMinutes = (date: string, startTime: string, endTime: string) => {
  const start = new Date(`${date}T${startTime || "00:00"}:00`);
  const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
};

const normalizeValue = (value: string) => value.trim().toLowerCase();

export const ActivitiesWorkspace = ({
  activities,
  todos,
  timeLogs,
  structureOptions,
  linkedSessionStateByActivity,
  requestedActivityId,
  requestedDomain,
  requestedProject,
  onEditorClose,
  onToggle,
  onAdd,
  onAddChildTodo,
  onAddChildMeeting,
  onSave,
  onDelete,
  onCreateLinkedMeetingSession,
  onOpenSession,
  onPreviewSessionOutput,
  onOpenTodoDetail,
  onSaveTimeLog,
  onDeleteTimeLog,
  onStartTracking,
  onStopTracking,
}: ActivitiesWorkspaceProps) => {
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ActivityRecord["type"]>("task");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ActivitySortKey>("dueDate");
  const [domainFilter, setDomainFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<ActivityRecord>(createBlankActivityDraft());
  const [childTodoDraft, setChildTodoDraft] = useState("");
  const [childMeetingDraft, setChildMeetingDraft] = useState("");
  const [editingTimeLogId, setEditingTimeLogId] = useState<string | null>(null);
  const [timeLogDraft, setTimeLogDraft] = useState<TimeLogRecord | null>(null);
  const [now, setNow] = useState(() => new Date());
  const detailsEditorRef = useRef<HTMLDivElement | null>(null);

  const topLevelActivities = useMemo(() => activities.filter((entry) => !entry.parentActivityId), [activities]);
  const domainOptions = useMemo(() => structureOptions.domains, [structureOptions.domains]);
  const projectOptions = useMemo(
    () => getProjectsForDomain(structureOptions, domainFilter === "all" ? "" : domainFilter),
    [domainFilter, structureOptions],
  );

  const childActivitiesByParent = useMemo(() => {
    const grouped = new Map<string, ActivityRecord[]>();
    activities
      .filter((entry) => Boolean(entry.parentActivityId))
      .forEach((entry) => grouped.set(entry.parentActivityId, [...(grouped.get(entry.parentActivityId) || []), entry]));
    return grouped;
  }, [activities]);

  const childTodosByActivity = useMemo(() => {
    const grouped = new Map<string, TodoRecord[]>();
    todos
      .filter((todo) => Boolean(todo.activityId))
      .forEach((todo) => grouped.set(todo.activityId, [...(grouped.get(todo.activityId) || []), todo]));
    return grouped;
  }, [todos]);

  const activityTimeLogsById = useMemo(() => {
    const grouped = new Map<string, TimeLogRecord[]>();
    timeLogs
      .filter((entry) => entry.targetType === "activity")
      .forEach((entry) => grouped.set(entry.targetId, [...(grouped.get(entry.targetId) || []), entry]));
    return grouped;
  }, [timeLogs]);

  const runningActivities = useMemo(
    () =>
      topLevelActivities.filter((activity) =>
        Boolean(getRunningTimeLog(activityTimeLogsById.get(activity.id) || [])),
      ),
    [activityTimeLogsById, topLevelActivities],
  );

  useEffect(() => {
    if (!runningActivities.length) return;
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, [runningActivities.length]);

  const filteredActivities = useMemo(() => {
    const normalized = normalizeValue(query);
    const structureFiltered = topLevelActivities.filter((entry) => {
      if (domainFilter !== "all" && entry.domain !== domainFilter) return false;
      if (projectFilter !== "all" && entry.project !== projectFilter) return false;
      return true;
    });
    const filtered = !normalized
      ? structureFiltered
      : structureFiltered.filter((entry) =>
          [entry.description, entry.domain, entry.project, entry.dueDate, entry.createdAt].join(" ").toLowerCase().includes(normalized),
        );

    const valueForSort = (entry: ActivityRecord) => {
      switch (sortKey) {
        case "description":
          return normalizeValue(entry.description);
        case "type":
          return entry.type;
        case "domain":
          return normalizeValue(entry.domain);
        case "project":
          return normalizeValue(entry.project);
        case "actualTimeSpentMinutes":
          return String(entry.actualTimeSpentMinutes).padStart(8, "0");
        case "createdAt":
          return entry.createdAt;
        case "dueDate":
        default:
          return entry.dueDate || "9999-99-99";
      }
    };

    return [...filtered].sort((left, right) => valueForSort(left).localeCompare(valueForSort(right)));
  }, [domainFilter, projectFilter, query, sortKey, topLevelActivities]);

  useEffect(() => {
    if (requestedDomain) {
      setDomainFilter(requestedDomain);
    }
  }, [requestedDomain]);

  useEffect(() => {
    if (requestedProject) {
      setProjectFilter(requestedProject);
    }
  }, [requestedProject]);

  useEffect(() => {
    if (domainFilter === "all") return;
    if (projectFilter === "all") return;
    if (projectOptions.includes(projectFilter)) return;
    setProjectFilter("all");
  }, [domainFilter, projectFilter, projectOptions]);

  useEffect(() => {
    if (requestedActivityId) {
      setSelectedActivityId(requestedActivityId);
    }
  }, [requestedActivityId]);

  useEffect(() => {
    if (selectedActivityId && topLevelActivities.some((entry) => entry.id === selectedActivityId)) {
      return;
    }
    if (requestedActivityId && topLevelActivities.some((entry) => entry.id === requestedActivityId)) {
      setSelectedActivityId(requestedActivityId);
      return;
    }
    setSelectedActivityId(filteredActivities[0]?.id ?? topLevelActivities[0]?.id ?? null);
  }, [filteredActivities, requestedActivityId, selectedActivityId, topLevelActivities]);

  useEffect(() => {
    if (!selectedActivityId) {
      setEditingDraft(createBlankActivityDraft());
      return;
    }
    const entry = activities.find((activity) => activity.id === selectedActivityId);
    if (!entry) {
      setSelectedActivityId(null);
      setEditingDraft(createBlankActivityDraft());
      return;
    }
    setEditingDraft(entry);
  }, [activities, selectedActivityId]);

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
    onAdd(nextValue, draftType);
    setDraft("");
    setDraftType("task");
  };

  const currentChildTodos = selectedActivityId ? childTodosByActivity.get(selectedActivityId) || [] : [];
  const currentChildMeetings = selectedActivityId ? childActivitiesByParent.get(selectedActivityId) || [] : [];
  const currentTimeLogs = selectedActivityId ? activityTimeLogsById.get(selectedActivityId) || [] : [];
  const hasOpenTimer = currentTimeLogs.some((entry) => entry.startTime === entry.endTime);
  const selectedLinkedSessionState = selectedActivityId ? linkedSessionStateByActivity[selectedActivityId] : null;
  const selectedLinkedSessionId = selectedLinkedSessionState?.sessionId ?? null;
  const openChildTodos = currentChildTodos.filter((todo) => !todo.isDone).length;
  const nextChildMeeting = [...currentChildMeetings]
    .sort((left, right) => `${left.doOn} ${left.startTime}`.localeCompare(`${right.doOn} ${right.startTime}`))[0] ?? null;
  const editorProjectOptions = getProjectsForDomain(structureOptions, editingDraft.domain);

  const handleDraftDomainChange = (domain: string) => {
    const nextProjects = getProjectsForDomain(structureOptions, domain);
    const nextProject = nextProjects.includes(editingDraft.project) ? editingDraft.project : "";
    setEditingDraft({ ...editingDraft, domain, project: nextProject });
  };

  const clearSelection = () => {
    setSelectedActivityId(null);
    setChildTodoDraft("");
    setChildMeetingDraft("");
    setEditingTimeLogId(null);
    setTimeLogDraft(null);
    onEditorClose?.();
  };

  return (
    <div className="card todos-workspace todos-workspace-minimal activities-hub-card">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Activities</h2>
          <p className="muted">This is the operational hub for existing activities. Create and organize activities in Structure, then run the work here.</p>
        </div>
      </div>

      <details className="workspace-disclosure">
        <summary>Quick add standalone activity</summary>
        <div className="workspace-disclosure-body stack">
          <p className="tiny-text">Use Structure for normal project-based setup. This quick add remains here for lightweight edge cases and cleanup work.</p>
          <div className="todos-workspace-input-row">
            <div className="field">
              <label htmlFor="activities-workspace-type">Type</label>
              <select id="activities-workspace-type" value={draftType} onChange={(event) => setDraftType(event.target.value as ActivityRecord["type"])}>
                <option value="task">Task</option>
                <option value="meeting">Meeting</option>
              </select>
            </div>
            <div className="field field-wide">
              <label htmlFor="activities-workspace-draft">New activity</label>
              <input
                id="activities-workspace-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitDraft();
                  }
                }}
                placeholder={draftType === "meeting" ? "Add a meeting activity" : "Add an activity"}
              />
            </div>
            <button className="primary-button" type="button" onClick={submitDraft}>
              Add
            </button>
          </div>
        </div>
      </details>

      <div className="activities-hub-shell">
        <section className="activities-hub-list-panel">
          <div className="todos-workspace-toolbar">
            <div className="field field-wide">
              <label htmlFor="activities-workspace-filter">Search</label>
              <input id="activities-workspace-filter" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter activities" />
            </div>
            <div className="field">
              <label htmlFor="activities-workspace-domain">Domain</label>
              <select id="activities-workspace-domain" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
                <option value="all">All</option>
                {domainOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="activities-workspace-project">Project</label>
              <select id="activities-workspace-project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option value="all">All</option>
                {projectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="activities-workspace-sort">Sort by</label>
              <select id="activities-workspace-sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as ActivitySortKey)}>
                <option value="dueDate">Due date</option>
                <option value="description">Title</option>
                <option value="type">Type</option>
                <option value="domain">Domain</option>
                <option value="project">Project</option>
                <option value="actualTimeSpentMinutes">Time spent</option>
                <option value="createdAt">Created</option>
              </select>
            </div>
          </div>

          <div className="activities-compact-list">
            {filteredActivities.length ? filteredActivities.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`activities-compact-item${selectedActivityId === entry.id ? " activities-compact-item-selected" : ""}`}
                onClick={() => setSelectedActivityId(entry.id)}
              >
                <div className="activities-compact-item-main">
                  <div className="activities-compact-item-head">
                    <input
                      type="checkbox"
                      checked={entry.isDone}
                      onChange={(event) => {
                        event.stopPropagation();
                        onToggle({ ...entry, isDone: !entry.isDone });
                      }}
                    />
                    <strong>{entry.description}</strong>
                  </div>
                  <div className="activities-compact-item-meta">
                    <span>{entry.type === "meeting" ? "Meeting" : "Task"}</span>
                    <span>{entry.project || "No project"}</span>
                    <span>{(childTodosByActivity.get(entry.id) || []).length} todos</span>
                    <span>{(childActivitiesByParent.get(entry.id) || []).length} meetings</span>
                    <span>
                      {(() => {
                        const runningLog = getRunningTimeLog(activityTimeLogsById.get(entry.id) || []);
                        return runningLog
                          ? `Running • ${formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))}`
                          : entry.actualTimeSpentMinutes
                            ? `${entry.actualTimeSpentMinutes}m`
                            : "No time";
                      })()}
                    </span>
                  </div>
                </div>
                <div className="activities-compact-item-actions">
                  <span className="tiny-text">{entry.dueDate || entry.doOn || entry.createdAt.slice(0, 10)}</span>
                  <button
                    className={`small-button${getRunningTimeLog(activityTimeLogsById.get(entry.id) || []) ? " primary-button" : ""}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (getRunningTimeLog(activityTimeLogsById.get(entry.id) || [])) {
                        onStopTracking("activity", entry.id);
                        return;
                      }
                      onStartTracking("activity", entry.id);
                    }}
                  >
                    {getRunningTimeLog(activityTimeLogsById.get(entry.id) || []) ? "Stop" : "Start"}
                  </button>
                </div>
              </button>
            )) : (
              <div className="empty-state-card compact-empty-state">
                <h3>No activities</h3>
                <p>Create activities here, then run the day-to-day work from the detail area.</p>
              </div>
            )}
          </div>
        </section>
        <section className="activities-hub-detail-panel">
          {selectedActivityId ? (
            <div className="stack">
              <div className="card-header activities-detail-header">
                <div>
                  <h3>{editingDraft.description || "Activity"}</h3>
                  <div className="calendar-editor-meta">
                    <span className="status-chip">{editingDraft.type === "meeting" ? "Meeting" : "Task"}</span>
                    {editingDraft.domain ? <span className="status-chip">{editingDraft.domain}</span> : null}
                    {editingDraft.project ? <span className="status-chip">{editingDraft.project}</span> : null}
                    <span className="status-chip">{editingDraft.actualTimeSpentMinutes || 0} min logged</span>
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
                  <label htmlFor="activity-edit-description">Activity</label>
                  <input id="activity-edit-description" value={editingDraft.description} onChange={(event) => setEditingDraft({ ...editingDraft, description: event.target.value })} />
                </div>

                <div className="field">
                  <label htmlFor="activity-edit-type">Type</label>
                  <select id="activity-edit-type" value={editingDraft.type} onChange={(event) => setEditingDraft({ ...editingDraft, type: event.target.value === "meeting" ? "meeting" : "task" })}>
                    <option value="task">Task</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="activity-edit-domain">Domain</label>
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
                  <label htmlFor="activity-edit-project">Project</label>
                  <TokenPicker
                    value={editingDraft.project}
                    savedOptions={editorProjectOptions}
                    suggestedOptions={editorProjectOptions}
                    placeholder="Search or add project"
                    suggestionSummary="Projects"
                    suggestionBadgeText="Available"
                    mode="single"
                    onChange={(value) => setEditingDraft({ ...editingDraft, project: value })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="activity-edit-do-on">Do on</label>
                  <DateInput id="activity-edit-do-on" value={editingDraft.doOn} onChange={(event) => setEditingDraft({ ...editingDraft, doOn: event.target.value })} />
                </div>

                <div className="field">
                  <label htmlFor="activity-edit-due-date">Due date</label>
                  <DateInput id="activity-edit-due-date" value={editingDraft.dueDate} onChange={(event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value })} />
                </div>

                <div className="field">
                  <label htmlFor="activity-edit-time-required">Time required (min)</label>
                  <input id="activity-edit-time-required" type="number" min="0" value={editingDraft.timeRequiredMinutes || ""} onChange={(event) => setEditingDraft({ ...editingDraft, timeRequiredMinutes: Number(event.target.value) || 0 })} />
                </div>

                <div className="field">
                  <label htmlFor="activity-edit-time-spent">Actual time spent (min)</label>
                  <input id="activity-edit-time-spent" type="number" min="0" value={editingDraft.actualTimeSpentMinutes || ""} onChange={(event) => setEditingDraft({ ...editingDraft, actualTimeSpentMinutes: Number(event.target.value) || 0 })} />
                </div>

                <div className="field activity-private-field">
                  <span>Private</span>
                  <div className="compact-private-toggle">
                    <input id="activity-edit-private" type="checkbox" checked={editingDraft.isPrivate} onChange={(event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked })} />
                    <label htmlFor="activity-edit-private" className="checkbox-label">Private</label>
                  </div>
                </div>

                {editingDraft.type === "meeting" ? (
                  <>
                    <div className="field">
                      <label htmlFor="activity-edit-start-time">Start time</label>
                      <input id="activity-edit-start-time" type="time" value={editingDraft.startTime} onChange={(event) => setEditingDraft({ ...editingDraft, startTime: event.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="activity-edit-end-time">End time</label>
                      <input id="activity-edit-end-time" type="time" value={editingDraft.endTime} onChange={(event) => setEditingDraft({ ...editingDraft, endTime: event.target.value })} />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="time-summary-grid">
                <div className="sidebar-card compact-metric-card">
                  <span className="tiny-text">Open todos</span>
                  <strong>{openChildTodos}</strong>
                </div>
                <div className="sidebar-card compact-metric-card">
                  <span className="tiny-text">Meetings under this activity</span>
                  <strong>{currentChildMeetings.length}</strong>
                </div>
                <div className="sidebar-card compact-metric-card">
                  <span className="tiny-text">Next meeting</span>
                  <strong>{nextChildMeeting ? nextChildMeeting.doOn || nextChildMeeting.startTime || "Planned" : "None"}</strong>
                </div>
              </div>

              {editingDraft.type === "meeting" ? (
                <div className="prompt-actions-row">
                  <div className="prompt-actions-copy">
                    <strong>Meeting session</strong>
                    <span className="muted">
                      {selectedLinkedSessionId
                        ? selectedLinkedSessionState?.hasOutput
                          ? "Linked session exists and already has polished output."
                          : "Linked session exists. Capture and output can continue in Notes."
                        : "Create a session when this meeting should move into Notes."}
                    </span>
                  </div>
                  <div className="page-actions">
                    {selectedLinkedSessionId ? (
                      <>
                        <button className="small-button" type="button" onClick={() => onOpenSession(selectedLinkedSessionId)}>
                          Open linked Meeting Session
                        </button>
                        {selectedLinkedSessionState?.hasOutput && onPreviewSessionOutput ? (
                          <button className="small-button" type="button" onClick={() => onPreviewSessionOutput(selectedLinkedSessionId)}>
                            Preview output
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <button className="small-button" type="button" onClick={() => onCreateLinkedMeetingSession(editingDraft.id)}>
                        Create linked Meeting Session
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="activity-edit-details">Details</label>
                <div id="activity-edit-details" ref={detailsEditorRef} className="rich-text-surface todo-rich-text-surface" contentEditable suppressContentEditableWarning onInput={(event) => setEditingDraft({ ...editingDraft, detailsHtml: (event.currentTarget as HTMLDivElement).innerHTML })} />
              </div>

              <div className="activities-detail-sections">
                <details className="workspace-disclosure" open>
                  <summary>Fast add inside this activity</summary>
                  <div className="workspace-disclosure-body stack">
                    <div className="todos-workspace-input-row">
                      <div className="field field-wide">
                        <label htmlFor="child-todo-draft">Add todo</label>
                        <input
                          id="child-todo-draft"
                          value={childTodoDraft}
                          onChange={(event) => setChildTodoDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey && childTodoDraft.trim()) {
                              event.preventDefault();
                              onAddChildTodo(childTodoDraft.trim(), editingDraft.id);
                              setChildTodoDraft("");
                            }
                          }}
                          placeholder="Add todo to this activity"
                        />
                      </div>
                      <button className="small-button" type="button" onClick={() => {
                        if (!childTodoDraft.trim()) return;
                        onAddChildTodo(childTodoDraft.trim(), editingDraft.id);
                        setChildTodoDraft("");
                      }}>
                        Add todo
                      </button>
                    </div>

                    <div className="todos-workspace-input-row">
                      <div className="field field-wide">
                        <label htmlFor="child-meeting-draft">Add meeting</label>
                        <input
                          id="child-meeting-draft"
                          value={childMeetingDraft}
                          onChange={(event) => setChildMeetingDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey && childMeetingDraft.trim()) {
                              event.preventDefault();
                              onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id);
                              setChildMeetingDraft("");
                            }
                          }}
                          placeholder="Add meeting under this activity"
                        />
                      </div>
                      <button className="small-button" type="button" onClick={() => {
                        if (!childMeetingDraft.trim()) return;
                        onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id);
                        setChildMeetingDraft("");
                      }}>
                        Add meeting
                      </button>
                    </div>
                  </div>
                </details>

                <details className="workspace-disclosure" open>
                  <summary>Child todos</summary>
                  <div className="workspace-disclosure-body stack">
                    {currentChildTodos.length ? currentChildTodos.map((todo) => (
                      <button key={todo.id} className="list-item timelog-list-item" type="button" onClick={() => onOpenTodoDetail(todo.id)}>
                        <strong>{todo.description}</strong>
                        <span>{todo.isDone ? "Done" : "Open"}</span>
                        <span>{todo.dueDate || todo.doOn || "-"}</span>
                      </button>
                    )) : <p className="muted">No todos yet inside this activity.</p>}
                  </div>
                </details>

                <details className="workspace-disclosure" open>
                  <summary>Child meetings</summary>
                  <div className="workspace-disclosure-body stack">
                    {currentChildMeetings.length ? currentChildMeetings.map((activity) => (
                      <button key={activity.id} className="list-item timelog-list-item" type="button" onClick={() => setSelectedActivityId(activity.id)}>
                        <strong>{activity.description}</strong>
                        <span>{activity.doOn || "No date"}</span>
                        <span>{activity.startTime || "-"}</span>
                      </button>
                    )) : <p className="muted">No meetings yet inside this activity.</p>}
                  </div>
                </details>

                <details className="workspace-disclosure" open>
                  <summary>Time logs</summary>
                  <div className="workspace-disclosure-body stack">
                    <div className="page-actions">
                      <button className="primary-button" type="button" onClick={() => (hasOpenTimer ? onStopTracking("activity", editingDraft.id) : onStartTracking("activity", editingDraft.id))}>
                        {hasOpenTimer ? "Stop" : "Start"}
                      </button>
                      <button className="small-button" type="button" onClick={() => {
                        const nextDraft = createBlankTimeLogDraft(editingDraft.id);
                        setEditingTimeLogId(nextDraft.id);
                        setTimeLogDraft(nextDraft);
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
                          <input value={timeLogDraft.notes} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, notes: event.target.value })} />
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
                      <button key={entry.id} className="list-item timelog-list-item" type="button" onClick={() => {
                        setEditingTimeLogId(entry.id);
                        setTimeLogDraft(entry);
                      }}>
                        <strong>{entry.date}</strong>
                        <span>{entry.startTime} to {entry.endTime}</span>
                        <span>{entry.durationMinutes} min</span>
                      </button>
                    )) : <p className="muted">No time logged yet for this activity.</p>}
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
              </div>

              <div className="page-actions">
                <button className="primary-button" type="button" onClick={() => onSave({ ...editingDraft })}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state-card compact-empty-state activities-empty-panel">
              <h3>Select an activity</h3>
              <p>Use the list on the left to open an activity and run todos, meetings, session links, and time reporting from one place.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
