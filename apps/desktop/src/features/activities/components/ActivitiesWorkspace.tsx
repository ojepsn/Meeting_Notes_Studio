import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityRecord } from "@notesmith/domain";

type ActivitySortKey =
  | "createdAt"
  | "description"
  | "type"
  | "domain"
  | "project"
  | "activity"
  | "doOn"
  | "dueDate"
  | "timeRequiredMinutes"
  | "actualTimeSpentMinutes";

interface ActivitiesWorkspaceProps {
  activities: ActivityRecord[];
  linkedSessionIdsByActivity: Record<string, string | null>;
  requestedActivityId?: string | null;
  onToggle: (activity: ActivityRecord) => void;
  onAdd: (description: string, type: ActivityRecord["type"]) => void;
  onSave: (activity: ActivityRecord) => void;
  onDelete: (id: string) => void;
  onCreateLinkedMeetingSession: (activityId: string) => void;
  onOpenSession: (sessionId: string) => void;
}

const createBlankActivityDraft = (description = ""): ActivityRecord => ({
  id: "",
  type: "task",
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

const normalizeValue = (value: string) => value.trim().toLowerCase();

export const ActivitiesWorkspace = ({
  activities,
  linkedSessionIdsByActivity,
  requestedActivityId,
  onToggle,
  onAdd,
  onSave,
  onDelete,
  onCreateLinkedMeetingSession,
  onOpenSession,
}: ActivitiesWorkspaceProps) => {
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ActivityRecord["type"]>("task");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ActivitySortKey>("dueDate");
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<ActivityRecord>(createBlankActivityDraft());
  const detailsEditorRef = useRef<HTMLDivElement | null>(null);

  const openActivities = useMemo(() => activities.filter((entry) => !entry.isDone), [activities]);
  const filteredAndSortedActivities = useMemo(() => {
    const normalized = normalizeValue(query);
    const filtered = !normalized
      ? openActivities
      : openActivities.filter((entry) =>
          [
            entry.description,
            entry.domain,
            entry.project,
            entry.activity,
            entry.doOn,
            entry.dueDate,
            entry.createdAt,
            String(entry.timeRequiredMinutes),
            String(entry.actualTimeSpentMinutes),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
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
        case "activity":
          return normalizeValue(entry.activity);
        case "doOn":
          return entry.doOn || "9999-99-99";
        case "dueDate":
          return entry.dueDate || "9999-99-99";
        case "timeRequiredMinutes":
          return String(entry.timeRequiredMinutes).padStart(8, "0");
        case "actualTimeSpentMinutes":
          return String(entry.actualTimeSpentMinutes).padStart(8, "0");
        case "createdAt":
        default:
          return entry.createdAt;
      }
    };

    return [...filtered].sort((left, right) => valueForSort(left).localeCompare(valueForSort(right)));
  }, [openActivities, query, sortKey]);

  const completedActivities = useMemo(() => activities.filter((entry) => entry.isDone).slice(0, 8), [activities]);

  useEffect(() => {
    if (requestedActivityId) {
      setEditingActivityId(requestedActivityId);
    }
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

  const submitDraft = () => {
    const nextValue = draft.trim();
    if (!nextValue) return;
    onAdd(nextValue, draftType);
    setDraft("");
    setDraftType("task");
  };

  const sortOptions: Array<{ value: ActivitySortKey; label: string }> = [
    { value: "dueDate", label: "Due date" },
    { value: "doOn", label: "Do on" },
    { value: "createdAt", label: "Created" },
    { value: "description", label: "Title" },
    { value: "type", label: "Type" },
    { value: "domain", label: "Domain" },
    { value: "project", label: "Project" },
    { value: "activity", label: "Activity" },
    { value: "timeRequiredMinutes", label: "Time required" },
    { value: "actualTimeSpentMinutes", label: "Time spent" },
  ];

  return (
    <div className="card todos-workspace todos-workspace-minimal">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Activities</h2>
        </div>
      </div>

      <div className="todos-workspace-input-row">
        <div className="field">
          <label htmlFor="activities-workspace-type">Type</label>
          <select
            id="activities-workspace-type"
            value={draftType}
            onChange={(event) => setDraftType(event.target.value as ActivityRecord["type"])}
          >
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
            placeholder={draftType === "meeting" ? "Add a meeting" : "Add a task"}
          />
        </div>
        <button className="primary-button" type="button" onClick={submitDraft}>
          Add
        </button>
      </div>

      <div className="todos-workspace-toolbar">
        <div className="field field-wide">
          <label htmlFor="activities-workspace-filter">Search</label>
          <input
            id="activities-workspace-filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter activities"
          />
        </div>
        <div className="field">
          <label htmlFor="activities-workspace-sort">Sort by</label>
          <select id="activities-workspace-sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as ActivitySortKey)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="status-chip">{openActivities.length} open</span>
        <span className="status-chip">{activities.length - openActivities.length} done</span>
      </div>

      <div className="todos-workspace-table">
        <div className="todos-workspace-row activities-workspace-row-header">
          <span>Done</span>
          <span>Activity</span>
          <span>Type</span>
          <span>Private</span>
          <span>Domain</span>
          <span>Project</span>
          <span>Activity type</span>
          <span>Do on</span>
          <span>Due</span>
          <span>Req</span>
          <span>Spent</span>
          <span>Created</span>
          <span />
        </div>
        {filteredAndSortedActivities.length ? (
          filteredAndSortedActivities.map((entry) => (
            <div
              key={entry.id}
              className="todos-workspace-row activities-workspace-row"
              onDoubleClick={() => setEditingActivityId(entry.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setEditingActivityId(entry.id);
                }
              }}
            >
              <span>
                <input
                  type="checkbox"
                  checked={entry.isDone}
                  onChange={() => onToggle({ ...entry, isDone: !entry.isDone })}
                />
              </span>
              <span className="todos-cell-strong">{entry.description}</span>
              <span>{entry.type === "meeting" ? "Meeting" : "Task"}</span>
              <span>{entry.isPrivate ? "Yes" : "No"}</span>
              <span>{entry.domain || "—"}</span>
              <span>{entry.project || "—"}</span>
              <span>{entry.activity || "—"}</span>
              <span>{entry.doOn || "—"}</span>
              <span>{entry.dueDate || "—"}</span>
              <span>{entry.timeRequiredMinutes ? `${entry.timeRequiredMinutes}m` : "—"}</span>
              <span>{entry.actualTimeSpentMinutes ? `${entry.actualTimeSpentMinutes}m` : "—"}</span>
              <span>{entry.createdAt.slice(0, 10)}</span>
              <span>
                <button
                  className="small-button danger-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(entry.id);
                  }}
                >
                  Delete
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state-card compact-empty-state">
            <h3>No open activities</h3>
            <p>Promote a todo into an activity, or add a new activity here.</p>
          </div>
        )}
      </div>

      {completedActivities.length ? (
        <details className="workspace-disclosure">
          <summary>Recently completed</summary>
          <div className="workspace-disclosure-body todos-workspace-completed">
            {completedActivities.map((entry) => (
              <label key={entry.id} className="todos-workspace-main todos-workspace-main-completed">
                <input
                  type="checkbox"
                  checked={entry.isDone}
                  onChange={() => onToggle({ ...entry, isDone: !entry.isDone })}
                />
                <span className="todos-workspace-copy">
                  <strong>{entry.description}</strong>
                  <span className="muted">{entry.createdAt.slice(0, 10)}</span>
                </span>
              </label>
            ))}
          </div>
        </details>
      ) : null}

      {editingActivityId ? (
        <div className="overlay-backdrop todos-editor-backdrop" role="presentation" onClick={() => setEditingActivityId(null)}>
          <div className="overlay-surface todos-editor-surface" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-header">
              <div>
                <strong>Edit activity</strong>
              </div>
              <button className="small-button" type="button" onClick={() => setEditingActivityId(null)}>
                Close
              </button>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="activity-edit-description">Activity</label>
                <input
                  id="activity-edit-description"
                  value={editingDraft.description}
                  onChange={(event) => setEditingDraft({ ...editingDraft, description: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="activity-edit-type">Type</label>
                <select
                  id="activity-edit-type"
                  value={editingDraft.type}
                  onChange={(event) =>
                    setEditingDraft({
                      ...editingDraft,
                      type: event.target.value === "meeting" ? "meeting" : "task",
                    })
                  }
                >
                  <option value="task">Task</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
              {editingDraft.type === "meeting" ? (
                <div className="field">
                  <label>Meeting session</label>
                  <div className="prompt-actions-row">
                    {linkedSessionIdsByActivity[editingDraft.id] ? (
                      <button
                        className="small-button"
                        type="button"
                        onClick={() => onOpenSession(linkedSessionIdsByActivity[editingDraft.id] as string)}
                      >
                        Open linked Meeting Session
                      </button>
                    ) : (
                      <button
                        className="small-button"
                        type="button"
                        onClick={() => onCreateLinkedMeetingSession(editingDraft.id)}
                      >
                        Create linked Meeting Session
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="metadata-triplet-grid">
                <div className="field metadata-subfield">
                  <label htmlFor="activity-edit-domain">Domain</label>
                  <input id="activity-edit-domain" value={editingDraft.domain} onChange={(event) => setEditingDraft({ ...editingDraft, domain: event.target.value })} />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="activity-edit-project">Project</label>
                  <input id="activity-edit-project" value={editingDraft.project} onChange={(event) => setEditingDraft({ ...editingDraft, project: event.target.value })} />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="activity-edit-activity">Activity type</label>
                  <input id="activity-edit-activity" value={editingDraft.activity} onChange={(event) => setEditingDraft({ ...editingDraft, activity: event.target.value })} />
                </div>
              </div>
              <div className="metadata-triplet-grid">
                <div className="field metadata-subfield">
                  <label htmlFor="activity-edit-do-on">Do on</label>
                  <input id="activity-edit-do-on" type="date" value={editingDraft.doOn} onChange={(event) => setEditingDraft({ ...editingDraft, doOn: event.target.value })} />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="activity-edit-due-date">Due date</label>
                  <input id="activity-edit-due-date" type="date" value={editingDraft.dueDate} onChange={(event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value })} />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="activity-edit-time-required">Time required (min)</label>
                  <input
                    id="activity-edit-time-required"
                    type="number"
                    min="0"
                    value={editingDraft.timeRequiredMinutes || ""}
                    onChange={(event) => setEditingDraft({ ...editingDraft, timeRequiredMinutes: Number(event.target.value) || 0 })}
                  />
                </div>
              </div>
              {editingDraft.type === "meeting" ? (
                <div className="inline-row">
                  <div className="field">
                    <label htmlFor="activity-edit-start-time">Start time</label>
                    <input
                      id="activity-edit-start-time"
                      type="time"
                      value={editingDraft.startTime}
                      onChange={(event) => setEditingDraft({ ...editingDraft, startTime: event.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="activity-edit-end-time">End time</label>
                    <input
                      id="activity-edit-end-time"
                      type="time"
                      value={editingDraft.endTime}
                      onChange={(event) => setEditingDraft({ ...editingDraft, endTime: event.target.value })}
                    />
                  </div>
                </div>
              ) : null}
              <div className="inline-row">
                <div className="field todo-private-field">
                  <span>Private</span>
                  <div className="compact-private-toggle">
                    <input
                      id="activity-edit-private"
                      type="checkbox"
                      checked={editingDraft.isPrivate}
                      onChange={(event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked })}
                    />
                    <label htmlFor="activity-edit-private" className="checkbox-label">
                      Private
                    </label>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="activity-edit-time-spent">Actual time spent (min)</label>
                  <input
                    id="activity-edit-time-spent"
                    type="number"
                    min="0"
                    value={editingDraft.actualTimeSpentMinutes || ""}
                    onChange={(event) => setEditingDraft({ ...editingDraft, actualTimeSpentMinutes: Number(event.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="activity-edit-details">Details</label>
                <div
                  id="activity-edit-details"
                  ref={detailsEditorRef}
                  className="rich-text-surface todo-rich-text-surface"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) => setEditingDraft({ ...editingDraft, detailsHtml: (event.currentTarget as HTMLDivElement).innerHTML })}
                />
              </div>
              <div className="page-actions">
                <button className="primary-button" type="button" onClick={() => { onSave({ ...editingDraft }); setEditingActivityId(null); }}>
                  Save
                </button>
                <button className="small-button" type="button" onClick={() => setEditingActivityId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
