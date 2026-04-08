import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";

type ActivitySortKey = "createdAt" | "description" | "type" | "domain" | "project" | "dueDate" | "actualTimeSpentMinutes";

interface ActivitiesWorkspaceProps {
  activities: ActivityRecord[];
  todos: TodoRecord[];
  timeLogs: TimeLogRecord[];
  linkedSessionIdsByActivity: Record<string, string | null>;
  requestedActivityId?: string | null;
  onEditorClose?: () => void;
  onToggle: (activity: ActivityRecord) => void;
  onAdd: (description: string, type: ActivityRecord["type"]) => void;
  onAddChildTodo: (description: string, activityId: string) => void;
  onAddChildMeeting: (description: string, activityId: string) => void;
  onSave: (activity: ActivityRecord) => void;
  onDelete: (id: string) => void;
  onCreateLinkedMeetingSession: (activityId: string) => void;
  onOpenSession: (sessionId: string) => void;
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

export const ActivitiesWorkspace = ({
  activities,
  todos,
  timeLogs,
  linkedSessionIdsByActivity,
  requestedActivityId,
  onEditorClose,
  onToggle,
  onAdd,
  onAddChildTodo,
  onAddChildMeeting,
  onSave,
  onDelete,
  onCreateLinkedMeetingSession,
  onOpenSession,
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
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<ActivityRecord>(createBlankActivityDraft());
  const [childTodoDraft, setChildTodoDraft] = useState("");
  const [childMeetingDraft, setChildMeetingDraft] = useState("");
  const [editingTimeLogId, setEditingTimeLogId] = useState<string | null>(null);
  const [timeLogDraft, setTimeLogDraft] = useState<TimeLogRecord | null>(null);
  const detailsEditorRef = useRef<HTMLDivElement | null>(null);

  const topLevelActivities = useMemo(() => activities.filter((entry) => !entry.parentActivityId), [activities]);
  const childActivitiesByParent = useMemo(() => {
    const grouped = new Map<string, ActivityRecord[]>();
    activities.filter((entry) => entry.parentActivityId).forEach((entry) => {
      grouped.set(entry.parentActivityId, [...(grouped.get(entry.parentActivityId) || []), entry]);
    });
    return grouped;
  }, [activities]);
  const childTodosByActivity = useMemo(() => {
    const grouped = new Map<string, TodoRecord[]>();
    todos.filter((todo) => todo.activityId).forEach((todo) => {
      grouped.set(todo.activityId, [...(grouped.get(todo.activityId) || []), todo]);
    });
    return grouped;
  }, [todos]);
  const activityTimeLogsById = useMemo(() => {
    const grouped = new Map<string, TimeLogRecord[]>();
    timeLogs.filter((entry) => entry.targetType === "activity").forEach((entry) => {
      grouped.set(entry.targetId, [...(grouped.get(entry.targetId) || []), entry]);
    });
    return grouped;
  }, [timeLogs]);

  useEffect(() => {
    if (requestedActivityId) setEditingActivityId(requestedActivityId);
  }, [requestedActivityId]);

  useEffect(() => {
    if (!editingActivityId) return;
    const entry = activities.find((activity) => activity.id === editingActivityId);
    if (!entry) {
      setEditingActivityId(null);
      setEditingDraft(createBlankActivityDraft());
      return;
    }
    setEditingDraft(entry);
  }, [activities, editingActivityId]);

  useEffect(() => {
    if (!detailsEditorRef.current) return;
    const nextHtml = editingDraft.detailsHtml || "<p></p>";
    if (detailsEditorRef.current.innerHTML !== nextHtml) {
      detailsEditorRef.current.innerHTML = nextHtml;
    }
  }, [editingActivityId, editingDraft.detailsHtml]);

  const filteredActivities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = !normalized
      ? topLevelActivities
      : topLevelActivities.filter((entry) =>
          [entry.description, entry.domain, entry.project, entry.dueDate, entry.createdAt].join(" ").toLowerCase().includes(normalized),
        );
    const valueForSort = (entry: ActivityRecord) => {
      switch (sortKey) {
        case "description":
          return entry.description.toLowerCase();
        case "type":
          return entry.type;
        case "domain":
          return entry.domain.toLowerCase();
        case "project":
          return entry.project.toLowerCase();
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
  }, [query, sortKey, topLevelActivities]);

  const currentChildTodos = editingActivityId ? childTodosByActivity.get(editingActivityId) || [] : [];
  const currentChildMeetings = editingActivityId ? childActivitiesByParent.get(editingActivityId) || [] : [];
  const currentTimeLogs = editingActivityId ? activityTimeLogsById.get(editingActivityId) || [] : [];
  const hasOpenTimer = currentTimeLogs.some((entry) => entry.startTime === entry.endTime);

  const submitDraft = () => {
    const nextValue = draft.trim();
    if (!nextValue) return;
    onAdd(nextValue, draftType);
    setDraft("");
    setDraftType("task");
  };

  const closeEditor = () => {
    setEditingActivityId(null);
    setChildTodoDraft("");
    setChildMeetingDraft("");
    setEditingTimeLogId(null);
    setTimeLogDraft(null);
    onEditorClose?.();
  };

  return (
    <div className="card todos-workspace todos-workspace-minimal">
      <div className="card-header session-editor-header-minimal"><div><h2>Activities</h2></div></div>
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
          <input id="activities-workspace-draft" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }} />
        </div>
        <button className="primary-button" type="button" onClick={submitDraft}>Add</button>
      </div>
      <div className="todos-workspace-toolbar">
        <div className="field field-wide">
          <label htmlFor="activities-workspace-filter">Search</label>
          <input id="activities-workspace-filter" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter activities" />
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
      <div className="todos-workspace-table">
        <div className="todos-workspace-row activities-workspace-row-header">
          <span>Done</span><span>Activity</span><span>Type</span><span>Domain</span><span>Project</span><span>Todos</span><span>Meetings</span><span>Due</span><span>Time</span><span /><span />
        </div>
        {filteredActivities.length ? filteredActivities.map((entry) => (
          <div key={entry.id} className="todos-workspace-row activities-workspace-row" onDoubleClick={() => setEditingActivityId(entry.id)} role="button" tabIndex={0}>
            <span><input type="checkbox" checked={entry.isDone} onChange={() => onToggle({ ...entry, isDone: !entry.isDone })} /></span>
            <span className="todos-cell-strong">{entry.description}</span>
            <span>{entry.type === "meeting" ? "Meeting" : "Task"}</span>
            <span>{entry.domain || "-"}</span>
            <span>{entry.project || "-"}</span>
            <span>{(childTodosByActivity.get(entry.id) || []).length}</span>
            <span>{(childActivitiesByParent.get(entry.id) || []).length}</span>
            <span>{entry.dueDate || "-"}</span>
            <span>{entry.actualTimeSpentMinutes ? `${entry.actualTimeSpentMinutes}m` : "-"}</span>
            <span>{entry.createdAt.slice(0, 10)}</span>
            <span><button className="small-button danger-button" type="button" onClick={(event) => { event.stopPropagation(); onDelete(entry.id); }}>Delete</button></span>
          </div>
        )) : <div className="empty-state-card compact-empty-state"><h3>No activities</h3><p>Create activities here, then add todos and meetings inside them from the detail card.</p></div>}
      </div>
      {editingActivityId ? (
        <div className="overlay-backdrop todos-editor-backdrop" role="presentation" onClick={closeEditor}>
          <div className="overlay-surface todos-editor-surface" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-header"><div><strong>Edit activity</strong></div><button className="small-button" type="button" onClick={closeEditor}>Close</button></div>
            <div className="stack">
              <div className="field"><label htmlFor="activity-edit-description">Activity</label><input id="activity-edit-description" value={editingDraft.description} onChange={(event) => setEditingDraft({ ...editingDraft, description: event.target.value })} /></div>
              <div className="metadata-triplet-grid">
                <div className="field metadata-subfield"><label htmlFor="activity-edit-type">Type</label><select id="activity-edit-type" value={editingDraft.type} onChange={(event) => setEditingDraft({ ...editingDraft, type: event.target.value === "meeting" ? "meeting" : "task" })}><option value="task">Task</option><option value="meeting">Meeting</option></select></div>
                <div className="field metadata-subfield"><label htmlFor="activity-edit-domain">Domain</label><input id="activity-edit-domain" value={editingDraft.domain} onChange={(event) => setEditingDraft({ ...editingDraft, domain: event.target.value })} /></div>
                <div className="field metadata-subfield"><label htmlFor="activity-edit-project">Project</label><input id="activity-edit-project" value={editingDraft.project} onChange={(event) => setEditingDraft({ ...editingDraft, project: event.target.value })} /></div>
              </div>
              <div className="inline-row">
                <div className="field"><label htmlFor="activity-edit-do-on">Do on</label><input id="activity-edit-do-on" type="date" value={editingDraft.doOn} onChange={(event) => setEditingDraft({ ...editingDraft, doOn: event.target.value })} /></div>
                <div className="field"><label htmlFor="activity-edit-due-date">Due date</label><input id="activity-edit-due-date" type="date" value={editingDraft.dueDate} onChange={(event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value })} /></div>
                <div className="field"><label htmlFor="activity-edit-time-required">Time required (min)</label><input id="activity-edit-time-required" type="number" min="0" value={editingDraft.timeRequiredMinutes || ""} onChange={(event) => setEditingDraft({ ...editingDraft, timeRequiredMinutes: Number(event.target.value) || 0 })} /></div>
              </div>
              {editingDraft.type === "meeting" ? <div className="inline-row">
                <div className="field"><label htmlFor="activity-edit-start-time">Start time</label><input id="activity-edit-start-time" type="time" value={editingDraft.startTime} onChange={(event) => setEditingDraft({ ...editingDraft, startTime: event.target.value })} /></div>
                <div className="field"><label htmlFor="activity-edit-end-time">End time</label><input id="activity-edit-end-time" type="time" value={editingDraft.endTime} onChange={(event) => setEditingDraft({ ...editingDraft, endTime: event.target.value })} /></div>
              </div> : null}
              {editingDraft.type === "meeting" ? <div className="field">
                <label>Meeting session</label>
                <div className="prompt-actions-row">
                  {linkedSessionIdsByActivity[editingDraft.id] ? (
                    <button className="small-button" type="button" onClick={() => onOpenSession(linkedSessionIdsByActivity[editingDraft.id] as string)}>Open linked Meeting Session</button>
                  ) : (
                    <button className="small-button" type="button" onClick={() => onCreateLinkedMeetingSession(editingDraft.id)}>Create linked Meeting Session</button>
                  )}
                </div>
              </div> : null}
              <div className="inline-row">
                <div className="field todo-private-field">
                  <span>Private</span>
                  <div className="compact-private-toggle">
                    <input id="activity-edit-private" type="checkbox" checked={editingDraft.isPrivate} onChange={(event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked })} />
                    <label htmlFor="activity-edit-private" className="checkbox-label">Private</label>
                  </div>
                </div>
                <div className="field"><label htmlFor="activity-edit-time-spent">Actual time spent (min)</label><input id="activity-edit-time-spent" type="number" min="0" value={editingDraft.actualTimeSpentMinutes || ""} onChange={(event) => setEditingDraft({ ...editingDraft, actualTimeSpentMinutes: Number(event.target.value) || 0 })} /></div>
              </div>
              <div className="field">
                <label htmlFor="activity-edit-details">Details</label>
                <div id="activity-edit-details" ref={detailsEditorRef} className="rich-text-surface todo-rich-text-surface" contentEditable suppressContentEditableWarning onInput={(event) => setEditingDraft({ ...editingDraft, detailsHtml: (event.currentTarget as HTMLDivElement).innerHTML })} />
              </div>
              <details className="workspace-disclosure" open>
                <summary>Fast add inside this activity</summary>
                <div className="workspace-disclosure-body stack">
                  <div className="todos-workspace-input-row">
                    <div className="field field-wide">
                      <label htmlFor="child-todo-draft">Add todo</label>
                      <input id="child-todo-draft" value={childTodoDraft} onChange={(event) => setChildTodoDraft(event.target.value)} onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && childTodoDraft.trim()) {
                          event.preventDefault();
                          onAddChildTodo(childTodoDraft.trim(), editingDraft.id);
                          setChildTodoDraft("");
                        }
                      }} />
                    </div>
                    <button className="small-button" type="button" onClick={() => { if (!childTodoDraft.trim()) return; onAddChildTodo(childTodoDraft.trim(), editingDraft.id); setChildTodoDraft(""); }}>Add todo</button>
                  </div>
                  <div className="todos-workspace-input-row">
                    <div className="field field-wide">
                      <label htmlFor="child-meeting-draft">Add meeting</label>
                      <input id="child-meeting-draft" value={childMeetingDraft} onChange={(event) => setChildMeetingDraft(event.target.value)} onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && childMeetingDraft.trim()) {
                          event.preventDefault();
                          onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id);
                          setChildMeetingDraft("");
                        }
                      }} />
                    </div>
                    <button className="small-button" type="button" onClick={() => { if (!childMeetingDraft.trim()) return; onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id); setChildMeetingDraft(""); }}>Add meeting</button>
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
                    </button>
                  )) : <p className="muted">No todos yet inside this activity.</p>}
                </div>
              </details>
              <details className="workspace-disclosure" open>
                <summary>Child meetings</summary>
                <div className="workspace-disclosure-body stack">
                  {currentChildMeetings.length ? currentChildMeetings.map((activity) => (
                    <button key={activity.id} className="list-item timelog-list-item" type="button" onClick={() => setEditingActivityId(activity.id)}>
                      <strong>{activity.description}</strong>
                      <span>{activity.doOn || "No date"} {activity.startTime ? `· ${activity.startTime}` : ""}</span>
                    </button>
                  )) : <p className="muted">No meetings yet inside this activity.</p>}
                </div>
              </details>
              <details className="workspace-disclosure" open>
                <summary>Time logs</summary>
                <div className="workspace-disclosure-body stack">
                  <div className="page-actions">
                    <button className="primary-button" type="button" onClick={() => hasOpenTimer ? onStopTracking("activity", editingDraft.id) : onStartTracking("activity", editingDraft.id)}>{hasOpenTimer ? "Stop" : "Start"}</button>
                    <button className="small-button" type="button" onClick={() => { const nextDraft = createBlankTimeLogDraft(editingDraft.id); setEditingTimeLogId(nextDraft.id); setTimeLogDraft(nextDraft); }}>Add manual log</button>
                  </div>
                  {timeLogDraft ? <div className="list-item timelog-editor-card">
                    <div className="metadata-triplet-grid">
                      <div className="field metadata-subfield"><label>Date</label><input type="date" value={timeLogDraft.date} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, date: event.target.value, durationMinutes: calculateDurationMinutes(event.target.value, timeLogDraft.startTime, timeLogDraft.endTime) })} /></div>
                      <div className="field metadata-subfield"><label>Start</label><input type="time" value={timeLogDraft.startTime} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, startTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, event.target.value, timeLogDraft.endTime) })} /></div>
                      <div className="field metadata-subfield"><label>End</label><input type="time" value={timeLogDraft.endTime} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, endTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, event.target.value) })} /></div>
                    </div>
                    <div className="field"><label>Notes</label><input value={timeLogDraft.notes} onChange={(event) => setTimeLogDraft({ ...timeLogDraft, notes: event.target.value })} /></div>
                    <div className="page-actions">
                      <span className="status-chip">{timeLogDraft.durationMinutes} min</span>
                      <button className="primary-button" type="button" onClick={() => { onSaveTimeLog({ ...timeLogDraft, durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, timeLogDraft.endTime) }); setEditingTimeLogId(null); setTimeLogDraft(null); }}>Save log</button>
                      <button className="small-button" type="button" onClick={() => { setEditingTimeLogId(null); setTimeLogDraft(null); }}>Cancel</button>
                    </div>
                  </div> : null}
                  {currentTimeLogs.length ? currentTimeLogs.map((entry) => (
                    <button key={entry.id} className="list-item timelog-list-item" type="button" onClick={() => { setEditingTimeLogId(entry.id); setTimeLogDraft(entry); }}>
                      <strong>{entry.date}</strong>
                      <span>{entry.startTime} to {entry.endTime}</span>
                      <span>{entry.durationMinutes} min</span>
                    </button>
                  )) : <p className="muted">No time logged yet for this activity.</p>}
                  {editingTimeLogId && timeLogDraft && currentTimeLogs.some((entry) => entry.id === editingTimeLogId) ? (
                    <div className="page-actions"><button className="danger-button small-button" type="button" onClick={() => { onDeleteTimeLog(editingTimeLogId); setEditingTimeLogId(null); setTimeLogDraft(null); }}>Delete selected log</button></div>
                  ) : null}
                </div>
              </details>
              <div className="page-actions">
                <button className="primary-button" type="button" onClick={() => { onSave({ ...editingDraft }); closeEditor(); }}>Save</button>
                <button className="small-button" type="button" onClick={closeEditor}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
