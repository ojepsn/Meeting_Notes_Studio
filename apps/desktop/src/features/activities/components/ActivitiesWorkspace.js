import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const createBlankActivityDraft = (description = "") => ({
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
const createBlankTimeLogDraft = (targetId) => {
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
const calculateDurationMinutes = (date, startTime, endTime) => {
    const start = new Date(`${date}T${startTime || "00:00"}:00`);
    const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
};
export const ActivitiesWorkspace = ({ activities, todos, timeLogs, linkedSessionIdsByActivity, requestedActivityId, onEditorClose, onToggle, onAdd, onAddChildTodo, onAddChildMeeting, onSave, onDelete, onCreateLinkedMeetingSession, onOpenSession, onOpenTodoDetail, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, }) => {
    const [draft, setDraft] = useState("");
    const [draftType, setDraftType] = useState("task");
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState("dueDate");
    const [editingActivityId, setEditingActivityId] = useState(null);
    const [editingDraft, setEditingDraft] = useState(createBlankActivityDraft());
    const [childTodoDraft, setChildTodoDraft] = useState("");
    const [childMeetingDraft, setChildMeetingDraft] = useState("");
    const [editingTimeLogId, setEditingTimeLogId] = useState(null);
    const [timeLogDraft, setTimeLogDraft] = useState(null);
    const detailsEditorRef = useRef(null);
    const topLevelActivities = useMemo(() => activities.filter((entry) => !entry.parentActivityId), [activities]);
    const childActivitiesByParent = useMemo(() => {
        const grouped = new Map();
        activities.filter((entry) => entry.parentActivityId).forEach((entry) => {
            grouped.set(entry.parentActivityId, [...(grouped.get(entry.parentActivityId) || []), entry]);
        });
        return grouped;
    }, [activities]);
    const childTodosByActivity = useMemo(() => {
        const grouped = new Map();
        todos.filter((todo) => todo.activityId).forEach((todo) => {
            grouped.set(todo.activityId, [...(grouped.get(todo.activityId) || []), todo]);
        });
        return grouped;
    }, [todos]);
    const activityTimeLogsById = useMemo(() => {
        const grouped = new Map();
        timeLogs.filter((entry) => entry.targetType === "activity").forEach((entry) => {
            grouped.set(entry.targetId, [...(grouped.get(entry.targetId) || []), entry]);
        });
        return grouped;
    }, [timeLogs]);
    useEffect(() => {
        if (requestedActivityId)
            setEditingActivityId(requestedActivityId);
    }, [requestedActivityId]);
    useEffect(() => {
        if (!editingActivityId)
            return;
        const entry = activities.find((activity) => activity.id === editingActivityId);
        if (!entry) {
            setEditingActivityId(null);
            setEditingDraft(createBlankActivityDraft());
            return;
        }
        setEditingDraft(entry);
    }, [activities, editingActivityId]);
    useEffect(() => {
        if (!detailsEditorRef.current)
            return;
        const nextHtml = editingDraft.detailsHtml || "<p></p>";
        if (detailsEditorRef.current.innerHTML !== nextHtml) {
            detailsEditorRef.current.innerHTML = nextHtml;
        }
    }, [editingActivityId, editingDraft.detailsHtml]);
    const filteredActivities = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        const filtered = !normalized
            ? topLevelActivities
            : topLevelActivities.filter((entry) => [entry.description, entry.domain, entry.project, entry.dueDate, entry.createdAt].join(" ").toLowerCase().includes(normalized));
        const valueForSort = (entry) => {
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
        if (!nextValue)
            return;
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
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsx("div", { children: _jsx("h2", { children: "Activities" }) }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activities-workspace-type", children: "Type" }), _jsxs("select", { id: "activities-workspace-type", value: draftType, onChange: (event) => setDraftType(event.target.value), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "activities-workspace-draft", children: "New activity" }), _jsx("input", { id: "activities-workspace-draft", value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        submitDraft();
                                    }
                                } })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitDraft, children: "Add" })] }), _jsxs("div", { className: "todos-workspace-toolbar", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "activities-workspace-filter", children: "Search" }), _jsx("input", { id: "activities-workspace-filter", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Filter activities" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activities-workspace-sort", children: "Sort by" }), _jsxs("select", { id: "activities-workspace-sort", value: sortKey, onChange: (event) => setSortKey(event.target.value), children: [_jsx("option", { value: "dueDate", children: "Due date" }), _jsx("option", { value: "description", children: "Title" }), _jsx("option", { value: "type", children: "Type" }), _jsx("option", { value: "domain", children: "Domain" }), _jsx("option", { value: "project", children: "Project" }), _jsx("option", { value: "actualTimeSpentMinutes", children: "Time spent" }), _jsx("option", { value: "createdAt", children: "Created" })] })] })] }), _jsxs("div", { className: "todos-workspace-table", children: [_jsxs("div", { className: "todos-workspace-row activities-workspace-row-header", children: [_jsx("span", { children: "Done" }), _jsx("span", { children: "Activity" }), _jsx("span", { children: "Type" }), _jsx("span", { children: "Domain" }), _jsx("span", { children: "Project" }), _jsx("span", { children: "Todos" }), _jsx("span", { children: "Meetings" }), _jsx("span", { children: "Due" }), _jsx("span", { children: "Time" }), _jsx("span", {}), _jsx("span", {})] }), filteredActivities.length ? filteredActivities.map((entry) => (_jsxs("div", { className: "todos-workspace-row activities-workspace-row", onDoubleClick: () => setEditingActivityId(entry.id), role: "button", tabIndex: 0, children: [_jsx("span", { children: _jsx("input", { type: "checkbox", checked: entry.isDone, onChange: () => onToggle({ ...entry, isDone: !entry.isDone }) }) }), _jsx("span", { className: "todos-cell-strong", children: entry.description }), _jsx("span", { children: entry.type === "meeting" ? "Meeting" : "Task" }), _jsx("span", { children: entry.domain || "-" }), _jsx("span", { children: entry.project || "-" }), _jsx("span", { children: (childTodosByActivity.get(entry.id) || []).length }), _jsx("span", { children: (childActivitiesByParent.get(entry.id) || []).length }), _jsx("span", { children: entry.dueDate || "-" }), _jsx("span", { children: entry.actualTimeSpentMinutes ? `${entry.actualTimeSpentMinutes}m` : "-" }), _jsx("span", { children: entry.createdAt.slice(0, 10) }), _jsx("span", { children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: (event) => { event.stopPropagation(); onDelete(entry.id); }, children: "Delete" }) })] }, entry.id))) : _jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No activities" }), _jsx("p", { children: "Create activities here, then add todos and meetings inside them from the detail card." })] })] }), editingActivityId ? (_jsx("div", { className: "overlay-backdrop todos-editor-backdrop", role: "presentation", onClick: closeEditor, children: _jsxs("div", { className: "overlay-surface todos-editor-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsx("div", { children: _jsx("strong", { children: "Edit activity" }) }), _jsx("button", { className: "small-button", type: "button", onClick: closeEditor, children: "Close" })] }), _jsxs("div", { className: "stack", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-description", children: "Activity" }), _jsx("input", { id: "activity-edit-description", value: editingDraft.description, onChange: (event) => setEditingDraft({ ...editingDraft, description: event.target.value }) })] }), _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-type", children: "Type" }), _jsxs("select", { id: "activity-edit-type", value: editingDraft.type, onChange: (event) => setEditingDraft({ ...editingDraft, type: event.target.value === "meeting" ? "meeting" : "task" }), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-domain", children: "Domain" }), _jsx("input", { id: "activity-edit-domain", value: editingDraft.domain, onChange: (event) => setEditingDraft({ ...editingDraft, domain: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-project", children: "Project" }), _jsx("input", { id: "activity-edit-project", value: editingDraft.project, onChange: (event) => setEditingDraft({ ...editingDraft, project: event.target.value }) })] })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-do-on", children: "Do on" }), _jsx("input", { id: "activity-edit-do-on", type: "date", value: editingDraft.doOn, onChange: (event) => setEditingDraft({ ...editingDraft, doOn: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-due-date", children: "Due date" }), _jsx("input", { id: "activity-edit-due-date", type: "date", value: editingDraft.dueDate, onChange: (event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-time-required", children: "Time required (min)" }), _jsx("input", { id: "activity-edit-time-required", type: "number", min: "0", value: editingDraft.timeRequiredMinutes || "", onChange: (event) => setEditingDraft({ ...editingDraft, timeRequiredMinutes: Number(event.target.value) || 0 }) })] })] }), editingDraft.type === "meeting" ? _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-start-time", children: "Start time" }), _jsx("input", { id: "activity-edit-start-time", type: "time", value: editingDraft.startTime, onChange: (event) => setEditingDraft({ ...editingDraft, startTime: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-end-time", children: "End time" }), _jsx("input", { id: "activity-edit-end-time", type: "time", value: editingDraft.endTime, onChange: (event) => setEditingDraft({ ...editingDraft, endTime: event.target.value }) })] })] }) : null, editingDraft.type === "meeting" ? _jsxs("div", { className: "field", children: [_jsx("label", { children: "Meeting session" }), _jsx("div", { className: "prompt-actions-row", children: linkedSessionIdsByActivity[editingDraft.id] ? (_jsx("button", { className: "small-button", type: "button", onClick: () => onOpenSession(linkedSessionIdsByActivity[editingDraft.id]), children: "Open linked Meeting Session" })) : (_jsx("button", { className: "small-button", type: "button", onClick: () => onCreateLinkedMeetingSession(editingDraft.id), children: "Create linked Meeting Session" })) })] }) : null, _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field todo-private-field", children: [_jsx("span", { children: "Private" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "activity-edit-private", type: "checkbox", checked: editingDraft.isPrivate, onChange: (event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked }) }), _jsx("label", { htmlFor: "activity-edit-private", className: "checkbox-label", children: "Private" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-time-spent", children: "Actual time spent (min)" }), _jsx("input", { id: "activity-edit-time-spent", type: "number", min: "0", value: editingDraft.actualTimeSpentMinutes || "", onChange: (event) => setEditingDraft({ ...editingDraft, actualTimeSpentMinutes: Number(event.target.value) || 0 }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-details", children: "Details" }), _jsx("div", { id: "activity-edit-details", ref: detailsEditorRef, className: "rich-text-surface todo-rich-text-surface", contentEditable: true, suppressContentEditableWarning: true, onInput: (event) => setEditingDraft({ ...editingDraft, detailsHtml: event.currentTarget.innerHTML }) })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Fast add inside this activity" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "child-todo-draft", children: "Add todo" }), _jsx("input", { id: "child-todo-draft", value: childTodoDraft, onChange: (event) => setChildTodoDraft(event.target.value), onKeyDown: (event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey && childTodoDraft.trim()) {
                                                                            event.preventDefault();
                                                                            onAddChildTodo(childTodoDraft.trim(), editingDraft.id);
                                                                            setChildTodoDraft("");
                                                                        }
                                                                    } })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => { if (!childTodoDraft.trim())
                                                                return; onAddChildTodo(childTodoDraft.trim(), editingDraft.id); setChildTodoDraft(""); }, children: "Add todo" })] }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "child-meeting-draft", children: "Add meeting" }), _jsx("input", { id: "child-meeting-draft", value: childMeetingDraft, onChange: (event) => setChildMeetingDraft(event.target.value), onKeyDown: (event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey && childMeetingDraft.trim()) {
                                                                            event.preventDefault();
                                                                            onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id);
                                                                            setChildMeetingDraft("");
                                                                        }
                                                                    } })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => { if (!childMeetingDraft.trim())
                                                                return; onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id); setChildMeetingDraft(""); }, children: "Add meeting" })] })] })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Child todos" }), _jsx("div", { className: "workspace-disclosure-body stack", children: currentChildTodos.length ? currentChildTodos.map((todo) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: [_jsx("strong", { children: todo.description }), _jsx("span", { children: todo.isDone ? "Done" : "Open" })] }, todo.id))) : _jsx("p", { className: "muted", children: "No todos yet inside this activity." }) })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Child meetings" }), _jsx("div", { className: "workspace-disclosure-body stack", children: currentChildMeetings.length ? currentChildMeetings.map((activity) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => setEditingActivityId(activity.id), children: [_jsx("strong", { children: activity.description }), _jsxs("span", { children: [activity.doOn || "No date", " ", activity.startTime ? `· ${activity.startTime}` : ""] })] }, activity.id))) : _jsx("p", { className: "muted", children: "No meetings yet inside this activity." }) })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Time logs" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => hasOpenTimer ? onStopTracking("activity", editingDraft.id) : onStartTracking("activity", editingDraft.id), children: hasOpenTimer ? "Stop" : "Start" }), _jsx("button", { className: "small-button", type: "button", onClick: () => { const nextDraft = createBlankTimeLogDraft(editingDraft.id); setEditingTimeLogId(nextDraft.id); setTimeLogDraft(nextDraft); }, children: "Add manual log" })] }), timeLogDraft ? _jsxs("div", { className: "list-item timelog-editor-card", children: [_jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Date" }), _jsx("input", { type: "date", value: timeLogDraft.date, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, date: event.target.value, durationMinutes: calculateDurationMinutes(event.target.value, timeLogDraft.startTime, timeLogDraft.endTime) }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Start" }), _jsx("input", { type: "time", value: timeLogDraft.startTime, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, startTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, event.target.value, timeLogDraft.endTime) }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "End" }), _jsx("input", { type: "time", value: timeLogDraft.endTime, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, endTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, event.target.value) }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Notes" }), _jsx("input", { value: timeLogDraft.notes, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, notes: event.target.value }) })] }), _jsxs("div", { className: "page-actions", children: [_jsxs("span", { className: "status-chip", children: [timeLogDraft.durationMinutes, " min"] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => { onSaveTimeLog({ ...timeLogDraft, durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, timeLogDraft.endTime) }); setEditingTimeLogId(null); setTimeLogDraft(null); }, children: "Save log" }), _jsx("button", { className: "small-button", type: "button", onClick: () => { setEditingTimeLogId(null); setTimeLogDraft(null); }, children: "Cancel" })] })] }) : null, currentTimeLogs.length ? currentTimeLogs.map((entry) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => { setEditingTimeLogId(entry.id); setTimeLogDraft(entry); }, children: [_jsx("strong", { children: entry.date }), _jsxs("span", { children: [entry.startTime, " to ", entry.endTime] }), _jsxs("span", { children: [entry.durationMinutes, " min"] })] }, entry.id))) : _jsx("p", { className: "muted", children: "No time logged yet for this activity." }), editingTimeLogId && timeLogDraft && currentTimeLogs.some((entry) => entry.id === editingTimeLogId) ? (_jsx("div", { className: "page-actions", children: _jsx("button", { className: "danger-button small-button", type: "button", onClick: () => { onDeleteTimeLog(editingTimeLogId); setEditingTimeLogId(null); setTimeLogDraft(null); }, children: "Delete selected log" }) })) : null] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => { onSave({ ...editingDraft }); closeEditor(); }, children: "Save" }), _jsx("button", { className: "small-button", type: "button", onClick: closeEditor, children: "Cancel" })] })] })] }) })) : null] }));
};
