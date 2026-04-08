import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
const normalizeValue = (value) => value.trim().toLowerCase();
export const ActivitiesWorkspace = ({ activities, todos, timeLogs, linkedSessionStateByActivity, requestedActivityId, onEditorClose, onToggle, onAdd, onAddChildTodo, onAddChildMeeting, onSave, onDelete, onCreateLinkedMeetingSession, onOpenSession, onPreviewSessionOutput, onOpenTodoDetail, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, }) => {
    const [draft, setDraft] = useState("");
    const [draftType, setDraftType] = useState("task");
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState("dueDate");
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [editingDraft, setEditingDraft] = useState(createBlankActivityDraft());
    const [childTodoDraft, setChildTodoDraft] = useState("");
    const [childMeetingDraft, setChildMeetingDraft] = useState("");
    const [editingTimeLogId, setEditingTimeLogId] = useState(null);
    const [timeLogDraft, setTimeLogDraft] = useState(null);
    const detailsEditorRef = useRef(null);
    const topLevelActivities = useMemo(() => activities.filter((entry) => !entry.parentActivityId), [activities]);
    const childActivitiesByParent = useMemo(() => {
        const grouped = new Map();
        activities
            .filter((entry) => Boolean(entry.parentActivityId))
            .forEach((entry) => grouped.set(entry.parentActivityId, [...(grouped.get(entry.parentActivityId) || []), entry]));
        return grouped;
    }, [activities]);
    const childTodosByActivity = useMemo(() => {
        const grouped = new Map();
        todos
            .filter((todo) => Boolean(todo.activityId))
            .forEach((todo) => grouped.set(todo.activityId, [...(grouped.get(todo.activityId) || []), todo]));
        return grouped;
    }, [todos]);
    const activityTimeLogsById = useMemo(() => {
        const grouped = new Map();
        timeLogs
            .filter((entry) => entry.targetType === "activity")
            .forEach((entry) => grouped.set(entry.targetId, [...(grouped.get(entry.targetId) || []), entry]));
        return grouped;
    }, [timeLogs]);
    const filteredActivities = useMemo(() => {
        const normalized = normalizeValue(query);
        const filtered = !normalized
            ? topLevelActivities
            : topLevelActivities.filter((entry) => [entry.description, entry.domain, entry.project, entry.dueDate, entry.createdAt].join(" ").toLowerCase().includes(normalized));
        const valueForSort = (entry) => {
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
    }, [query, sortKey, topLevelActivities]);
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
        if (!detailsEditorRef.current)
            return;
        const nextHtml = editingDraft.detailsHtml || "<p></p>";
        if (detailsEditorRef.current.innerHTML !== nextHtml) {
            detailsEditorRef.current.innerHTML = nextHtml;
        }
    }, [editingDraft.detailsHtml, editingDraft.id]);
    const submitDraft = () => {
        const nextValue = draft.trim();
        if (!nextValue)
            return;
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
    const clearSelection = () => {
        setSelectedActivityId(null);
        setChildTodoDraft("");
        setChildMeetingDraft("");
        setEditingTimeLogId(null);
        setTimeLogDraft(null);
        onEditorClose?.();
    };
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal activities-hub-card", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsxs("div", { children: [_jsx("h2", { children: "Activities" }), _jsx("p", { className: "muted", children: "Work is anchored here. Add follow-up todos, meetings, session links, and time from one place." })] }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activities-workspace-type", children: "Type" }), _jsxs("select", { id: "activities-workspace-type", value: draftType, onChange: (event) => setDraftType(event.target.value), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "activities-workspace-draft", children: "New activity" }), _jsx("input", { id: "activities-workspace-draft", value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        submitDraft();
                                    }
                                }, placeholder: draftType === "meeting" ? "Add a meeting activity" : "Add an activity" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitDraft, children: "Add" })] }), _jsxs("div", { className: "activities-hub-shell", children: [_jsxs("section", { className: "activities-hub-list-panel", children: [_jsxs("div", { className: "todos-workspace-toolbar", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "activities-workspace-filter", children: "Search" }), _jsx("input", { id: "activities-workspace-filter", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Filter activities" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activities-workspace-sort", children: "Sort by" }), _jsxs("select", { id: "activities-workspace-sort", value: sortKey, onChange: (event) => setSortKey(event.target.value), children: [_jsx("option", { value: "dueDate", children: "Due date" }), _jsx("option", { value: "description", children: "Title" }), _jsx("option", { value: "type", children: "Type" }), _jsx("option", { value: "domain", children: "Domain" }), _jsx("option", { value: "project", children: "Project" }), _jsx("option", { value: "actualTimeSpentMinutes", children: "Time spent" }), _jsx("option", { value: "createdAt", children: "Created" })] })] })] }), _jsx("div", { className: "activities-compact-list", children: filteredActivities.length ? filteredActivities.map((entry) => (_jsxs("button", { type: "button", className: `activities-compact-item${selectedActivityId === entry.id ? " activities-compact-item-selected" : ""}`, onClick: () => setSelectedActivityId(entry.id), children: [_jsxs("div", { className: "activities-compact-item-main", children: [_jsxs("div", { className: "activities-compact-item-head", children: [_jsx("input", { type: "checkbox", checked: entry.isDone, onChange: (event) => {
                                                                event.stopPropagation();
                                                                onToggle({ ...entry, isDone: !entry.isDone });
                                                            } }), _jsx("strong", { children: entry.description })] }), _jsxs("div", { className: "activities-compact-item-meta", children: [_jsx("span", { children: entry.type === "meeting" ? "Meeting" : "Task" }), _jsx("span", { children: entry.project || "No project" }), _jsxs("span", { children: [(childTodosByActivity.get(entry.id) || []).length, " todos"] }), _jsxs("span", { children: [(childActivitiesByParent.get(entry.id) || []).length, " meetings"] }), _jsx("span", { children: entry.actualTimeSpentMinutes ? `${entry.actualTimeSpentMinutes}m` : "No time" })] })] }), _jsx("span", { className: "tiny-text", children: entry.dueDate || entry.doOn || entry.createdAt.slice(0, 10) })] }, entry.id))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No activities" }), _jsx("p", { children: "Create activities here, then run the day-to-day work from the detail area." })] })) })] }), _jsx("section", { className: "activities-hub-detail-panel", children: selectedActivityId ? (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "card-header activities-detail-header", children: [_jsxs("div", { children: [_jsx("h3", { children: editingDraft.description || "Activity" }), _jsxs("div", { className: "calendar-editor-meta", children: [_jsx("span", { className: "status-chip", children: editingDraft.type === "meeting" ? "Meeting" : "Task" }), editingDraft.domain ? _jsx("span", { className: "status-chip", children: editingDraft.domain }) : null, editingDraft.project ? _jsx("span", { className: "status-chip", children: editingDraft.project }) : null, _jsxs("span", { className: "status-chip", children: [editingDraft.actualTimeSpentMinutes || 0, " min logged"] })] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: clearSelection, children: "Close" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => {
                                                        onDelete(editingDraft.id);
                                                        clearSelection();
                                                    }, children: "Delete" })] })] }), _jsxs("div", { className: "activities-detail-grid", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "activity-edit-description", children: "Activity" }), _jsx("input", { id: "activity-edit-description", value: editingDraft.description, onChange: (event) => setEditingDraft({ ...editingDraft, description: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-type", children: "Type" }), _jsxs("select", { id: "activity-edit-type", value: editingDraft.type, onChange: (event) => setEditingDraft({ ...editingDraft, type: event.target.value === "meeting" ? "meeting" : "task" }), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-domain", children: "Domain" }), _jsx("input", { id: "activity-edit-domain", value: editingDraft.domain, onChange: (event) => setEditingDraft({ ...editingDraft, domain: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-project", children: "Project" }), _jsx("input", { id: "activity-edit-project", value: editingDraft.project, onChange: (event) => setEditingDraft({ ...editingDraft, project: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-do-on", children: "Do on" }), _jsx("input", { id: "activity-edit-do-on", type: "date", value: editingDraft.doOn, onChange: (event) => setEditingDraft({ ...editingDraft, doOn: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-due-date", children: "Due date" }), _jsx("input", { id: "activity-edit-due-date", type: "date", value: editingDraft.dueDate, onChange: (event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-time-required", children: "Time required (min)" }), _jsx("input", { id: "activity-edit-time-required", type: "number", min: "0", value: editingDraft.timeRequiredMinutes || "", onChange: (event) => setEditingDraft({ ...editingDraft, timeRequiredMinutes: Number(event.target.value) || 0 }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-time-spent", children: "Actual time spent (min)" }), _jsx("input", { id: "activity-edit-time-spent", type: "number", min: "0", value: editingDraft.actualTimeSpentMinutes || "", onChange: (event) => setEditingDraft({ ...editingDraft, actualTimeSpentMinutes: Number(event.target.value) || 0 }) })] }), _jsxs("div", { className: "field activity-private-field", children: [_jsx("span", { children: "Private" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "activity-edit-private", type: "checkbox", checked: editingDraft.isPrivate, onChange: (event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked }) }), _jsx("label", { htmlFor: "activity-edit-private", className: "checkbox-label", children: "Private" })] })] }), editingDraft.type === "meeting" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-start-time", children: "Start time" }), _jsx("input", { id: "activity-edit-start-time", type: "time", value: editingDraft.startTime, onChange: (event) => setEditingDraft({ ...editingDraft, startTime: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-end-time", children: "End time" }), _jsx("input", { id: "activity-edit-end-time", type: "time", value: editingDraft.endTime, onChange: (event) => setEditingDraft({ ...editingDraft, endTime: event.target.value }) })] })] })) : null] }), _jsxs("div", { className: "time-summary-grid", children: [_jsxs("div", { className: "sidebar-card compact-metric-card", children: [_jsx("span", { className: "tiny-text", children: "Open todos" }), _jsx("strong", { children: openChildTodos })] }), _jsxs("div", { className: "sidebar-card compact-metric-card", children: [_jsx("span", { className: "tiny-text", children: "Meetings under this activity" }), _jsx("strong", { children: currentChildMeetings.length })] }), _jsxs("div", { className: "sidebar-card compact-metric-card", children: [_jsx("span", { className: "tiny-text", children: "Next meeting" }), _jsx("strong", { children: nextChildMeeting ? nextChildMeeting.doOn || nextChildMeeting.startTime || "Planned" : "None" })] })] }), editingDraft.type === "meeting" ? (_jsxs("div", { className: "prompt-actions-row", children: [_jsxs("div", { className: "prompt-actions-copy", children: [_jsx("strong", { children: "Meeting session" }), _jsx("span", { className: "muted", children: selectedLinkedSessionId
                                                        ? selectedLinkedSessionState?.hasOutput
                                                            ? "Linked session exists and already has polished output."
                                                            : "Linked session exists. Capture and output can continue in Notes."
                                                        : "Create a session when this meeting should move into Notes." })] }), _jsx("div", { className: "page-actions", children: selectedLinkedSessionId ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onOpenSession(selectedLinkedSessionId), children: "Open linked Meeting Session" }), selectedLinkedSessionState?.hasOutput && onPreviewSessionOutput ? (_jsx("button", { className: "small-button", type: "button", onClick: () => onPreviewSessionOutput(selectedLinkedSessionId), children: "Preview output" })) : null] })) : (_jsx("button", { className: "small-button", type: "button", onClick: () => onCreateLinkedMeetingSession(editingDraft.id), children: "Create linked Meeting Session" })) })] })) : null, _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-details", children: "Details" }), _jsx("div", { id: "activity-edit-details", ref: detailsEditorRef, className: "rich-text-surface todo-rich-text-surface", contentEditable: true, suppressContentEditableWarning: true, onInput: (event) => setEditingDraft({ ...editingDraft, detailsHtml: event.currentTarget.innerHTML }) })] }), _jsxs("div", { className: "activities-detail-sections", children: [_jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Fast add inside this activity" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "child-todo-draft", children: "Add todo" }), _jsx("input", { id: "child-todo-draft", value: childTodoDraft, onChange: (event) => setChildTodoDraft(event.target.value), onKeyDown: (event) => {
                                                                                if (event.key === "Enter" && !event.shiftKey && childTodoDraft.trim()) {
                                                                                    event.preventDefault();
                                                                                    onAddChildTodo(childTodoDraft.trim(), editingDraft.id);
                                                                                    setChildTodoDraft("");
                                                                                }
                                                                            }, placeholder: "Add todo to this activity" })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        if (!childTodoDraft.trim())
                                                                            return;
                                                                        onAddChildTodo(childTodoDraft.trim(), editingDraft.id);
                                                                        setChildTodoDraft("");
                                                                    }, children: "Add todo" })] }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "child-meeting-draft", children: "Add meeting" }), _jsx("input", { id: "child-meeting-draft", value: childMeetingDraft, onChange: (event) => setChildMeetingDraft(event.target.value), onKeyDown: (event) => {
                                                                                if (event.key === "Enter" && !event.shiftKey && childMeetingDraft.trim()) {
                                                                                    event.preventDefault();
                                                                                    onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id);
                                                                                    setChildMeetingDraft("");
                                                                                }
                                                                            }, placeholder: "Add meeting under this activity" })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        if (!childMeetingDraft.trim())
                                                                            return;
                                                                        onAddChildMeeting(childMeetingDraft.trim(), editingDraft.id);
                                                                        setChildMeetingDraft("");
                                                                    }, children: "Add meeting" })] })] })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Child todos" }), _jsx("div", { className: "workspace-disclosure-body stack", children: currentChildTodos.length ? currentChildTodos.map((todo) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: [_jsx("strong", { children: todo.description }), _jsx("span", { children: todo.isDone ? "Done" : "Open" }), _jsx("span", { children: todo.dueDate || todo.doOn || "-" })] }, todo.id))) : _jsx("p", { className: "muted", children: "No todos yet inside this activity." }) })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Child meetings" }), _jsx("div", { className: "workspace-disclosure-body stack", children: currentChildMeetings.length ? currentChildMeetings.map((activity) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => setSelectedActivityId(activity.id), children: [_jsx("strong", { children: activity.description }), _jsx("span", { children: activity.doOn || "No date" }), _jsx("span", { children: activity.startTime || "-" })] }, activity.id))) : _jsx("p", { className: "muted", children: "No meetings yet inside this activity." }) })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Time logs" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => (hasOpenTimer ? onStopTracking("activity", editingDraft.id) : onStartTracking("activity", editingDraft.id)), children: hasOpenTimer ? "Stop" : "Start" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        const nextDraft = createBlankTimeLogDraft(editingDraft.id);
                                                                        setEditingTimeLogId(nextDraft.id);
                                                                        setTimeLogDraft(nextDraft);
                                                                    }, children: "Add manual log" })] }), timeLogDraft ? (_jsxs("div", { className: "list-item timelog-editor-card", children: [_jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Date" }), _jsx("input", { type: "date", value: timeLogDraft.date, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, date: event.target.value, durationMinutes: calculateDurationMinutes(event.target.value, timeLogDraft.startTime, timeLogDraft.endTime) }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Start" }), _jsx("input", { type: "time", value: timeLogDraft.startTime, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, startTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, event.target.value, timeLogDraft.endTime) }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "End" }), _jsx("input", { type: "time", value: timeLogDraft.endTime, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, endTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, event.target.value) }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Notes" }), _jsx("input", { value: timeLogDraft.notes, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, notes: event.target.value }) })] }), _jsxs("div", { className: "page-actions", children: [_jsxs("span", { className: "status-chip", children: [timeLogDraft.durationMinutes, " min"] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                                                                onSaveTimeLog({
                                                                                    ...timeLogDraft,
                                                                                    durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, timeLogDraft.endTime),
                                                                                });
                                                                                setEditingTimeLogId(null);
                                                                                setTimeLogDraft(null);
                                                                            }, children: "Save log" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                                setEditingTimeLogId(null);
                                                                                setTimeLogDraft(null);
                                                                            }, children: "Cancel" })] })] })) : null, currentTimeLogs.length ? currentTimeLogs.map((entry) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => {
                                                                setEditingTimeLogId(entry.id);
                                                                setTimeLogDraft(entry);
                                                            }, children: [_jsx("strong", { children: entry.date }), _jsxs("span", { children: [entry.startTime, " to ", entry.endTime] }), _jsxs("span", { children: [entry.durationMinutes, " min"] })] }, entry.id))) : _jsx("p", { className: "muted", children: "No time logged yet for this activity." }), editingTimeLogId && timeLogDraft && currentTimeLogs.some((entry) => entry.id === editingTimeLogId) ? (_jsx("div", { className: "page-actions", children: _jsx("button", { className: "danger-button small-button", type: "button", onClick: () => {
                                                                    onDeleteTimeLog(editingTimeLogId);
                                                                    setEditingTimeLogId(null);
                                                                    setTimeLogDraft(null);
                                                                }, children: "Delete selected log" }) })) : null] })] })] }), _jsx("div", { className: "page-actions", children: _jsx("button", { className: "primary-button", type: "button", onClick: () => onSave({ ...editingDraft }), children: "Save" }) })] })) : (_jsxs("div", { className: "empty-state-card compact-empty-state activities-empty-panel", children: [_jsx("h3", { children: "Select an activity" }), _jsx("p", { children: "Use the list on the left to open an activity and run todos, meetings, session links, and time reporting from one place." })] })) })] })] }));
};
