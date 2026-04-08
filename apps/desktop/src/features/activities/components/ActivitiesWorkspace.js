import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const createBlankActivityDraft = (description = "") => ({
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
const normalizeValue = (value) => value.trim().toLowerCase();
export const ActivitiesWorkspace = ({ activities, linkedSessionIdsByActivity, requestedActivityId, onEditorClose, onToggle, onAdd, onSave, onDelete, onCreateLinkedMeetingSession, onOpenSession, }) => {
    const [draft, setDraft] = useState("");
    const [draftType, setDraftType] = useState("task");
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState("dueDate");
    const [editingActivityId, setEditingActivityId] = useState(null);
    const [editingDraft, setEditingDraft] = useState(createBlankActivityDraft());
    const detailsEditorRef = useRef(null);
    const openActivities = useMemo(() => activities.filter((entry) => !entry.isDone), [activities]);
    const filteredAndSortedActivities = useMemo(() => {
        const normalized = normalizeValue(query);
        const filtered = !normalized
            ? openActivities
            : openActivities.filter((entry) => [
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
                .includes(normalized));
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
        onEditorClose?.();
    };
    const sortOptions = [
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
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsx("div", { children: _jsx("h2", { children: "Activities" }) }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activities-workspace-type", children: "Type" }), _jsxs("select", { id: "activities-workspace-type", value: draftType, onChange: (event) => setDraftType(event.target.value), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "activities-workspace-draft", children: "New activity" }), _jsx("input", { id: "activities-workspace-draft", value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        submitDraft();
                                    }
                                }, placeholder: draftType === "meeting" ? "Add a meeting" : "Add a task" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitDraft, children: "Add" })] }), _jsxs("div", { className: "todos-workspace-toolbar", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "activities-workspace-filter", children: "Search" }), _jsx("input", { id: "activities-workspace-filter", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Filter activities" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activities-workspace-sort", children: "Sort by" }), _jsx("select", { id: "activities-workspace-sort", value: sortKey, onChange: (event) => setSortKey(event.target.value), children: sortOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("span", { className: "status-chip", children: [openActivities.length, " open"] }), _jsxs("span", { className: "status-chip", children: [activities.length - openActivities.length, " done"] })] }), _jsxs("div", { className: "todos-workspace-table", children: [_jsxs("div", { className: "todos-workspace-row activities-workspace-row-header", children: [_jsx("span", { children: "Done" }), _jsx("span", { children: "Activity" }), _jsx("span", { children: "Type" }), _jsx("span", { children: "Private" }), _jsx("span", { children: "Domain" }), _jsx("span", { children: "Project" }), _jsx("span", { children: "Activity type" }), _jsx("span", { children: "Do on" }), _jsx("span", { children: "Due" }), _jsx("span", { children: "Req" }), _jsx("span", { children: "Spent" }), _jsx("span", { children: "Created" }), _jsx("span", {})] }), filteredAndSortedActivities.length ? (filteredAndSortedActivities.map((entry) => (_jsxs("div", { className: "todos-workspace-row activities-workspace-row", onDoubleClick: () => setEditingActivityId(entry.id), role: "button", tabIndex: 0, onKeyDown: (event) => {
                            if (event.key === "Enter") {
                                setEditingActivityId(entry.id);
                            }
                        }, children: [_jsx("span", { children: _jsx("input", { type: "checkbox", checked: entry.isDone, onChange: () => onToggle({ ...entry, isDone: !entry.isDone }) }) }), _jsx("span", { className: "todos-cell-strong", children: entry.description }), _jsx("span", { children: entry.type === "meeting" ? "Meeting" : "Task" }), _jsx("span", { children: entry.isPrivate ? "Yes" : "No" }), _jsx("span", { children: entry.domain || "—" }), _jsx("span", { children: entry.project || "—" }), _jsx("span", { children: entry.activity || "—" }), _jsx("span", { children: entry.doOn || "—" }), _jsx("span", { children: entry.dueDate || "—" }), _jsx("span", { children: entry.timeRequiredMinutes ? `${entry.timeRequiredMinutes}m` : "—" }), _jsx("span", { children: entry.actualTimeSpentMinutes ? `${entry.actualTimeSpentMinutes}m` : "—" }), _jsx("span", { children: entry.createdAt.slice(0, 10) }), _jsx("span", { children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: (event) => {
                                        event.stopPropagation();
                                        onDelete(entry.id);
                                    }, children: "Delete" }) })] }, entry.id)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No open activities" }), _jsx("p", { children: "Promote a todo into an activity, or add a new activity here." })] }))] }), completedActivities.length ? (_jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Recently completed" }), _jsx("div", { className: "workspace-disclosure-body todos-workspace-completed", children: completedActivities.map((entry) => (_jsxs("label", { className: "todos-workspace-main todos-workspace-main-completed", children: [_jsx("input", { type: "checkbox", checked: entry.isDone, onChange: () => onToggle({ ...entry, isDone: !entry.isDone }) }), _jsxs("span", { className: "todos-workspace-copy", children: [_jsx("strong", { children: entry.description }), _jsx("span", { className: "muted", children: entry.createdAt.slice(0, 10) })] })] }, entry.id))) })] })) : null, editingActivityId ? (_jsx("div", { className: "overlay-backdrop todos-editor-backdrop", role: "presentation", onClick: closeEditor, children: _jsxs("div", { className: "overlay-surface todos-editor-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsx("div", { children: _jsx("strong", { children: "Edit activity" }) }), _jsx("button", { className: "small-button", type: "button", onClick: closeEditor, children: "Close" })] }), _jsxs("div", { className: "stack", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-description", children: "Activity" }), _jsx("input", { id: "activity-edit-description", value: editingDraft.description, onChange: (event) => setEditingDraft({ ...editingDraft, description: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-type", children: "Type" }), _jsxs("select", { id: "activity-edit-type", value: editingDraft.type, onChange: (event) => setEditingDraft({
                                                ...editingDraft,
                                                type: event.target.value === "meeting" ? "meeting" : "task",
                                            }), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), editingDraft.type === "meeting" ? (_jsxs("div", { className: "field", children: [_jsx("label", { children: "Meeting session" }), _jsx("div", { className: "prompt-actions-row", children: linkedSessionIdsByActivity[editingDraft.id] ? (_jsx("button", { className: "small-button", type: "button", onClick: () => onOpenSession(linkedSessionIdsByActivity[editingDraft.id]), children: "Open linked Meeting Session" })) : (_jsx("button", { className: "small-button", type: "button", onClick: () => onCreateLinkedMeetingSession(editingDraft.id), children: "Create linked Meeting Session" })) })] })) : null, _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-domain", children: "Domain" }), _jsx("input", { id: "activity-edit-domain", value: editingDraft.domain, onChange: (event) => setEditingDraft({ ...editingDraft, domain: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-project", children: "Project" }), _jsx("input", { id: "activity-edit-project", value: editingDraft.project, onChange: (event) => setEditingDraft({ ...editingDraft, project: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-activity", children: "Activity type" }), _jsx("input", { id: "activity-edit-activity", value: editingDraft.activity, onChange: (event) => setEditingDraft({ ...editingDraft, activity: event.target.value }) })] })] }), _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-do-on", children: "Do on" }), _jsx("input", { id: "activity-edit-do-on", type: "date", value: editingDraft.doOn, onChange: (event) => setEditingDraft({ ...editingDraft, doOn: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-due-date", children: "Due date" }), _jsx("input", { id: "activity-edit-due-date", type: "date", value: editingDraft.dueDate, onChange: (event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "activity-edit-time-required", children: "Time required (min)" }), _jsx("input", { id: "activity-edit-time-required", type: "number", min: "0", value: editingDraft.timeRequiredMinutes || "", onChange: (event) => setEditingDraft({ ...editingDraft, timeRequiredMinutes: Number(event.target.value) || 0 }) })] })] }), editingDraft.type === "meeting" ? (_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-start-time", children: "Start time" }), _jsx("input", { id: "activity-edit-start-time", type: "time", value: editingDraft.startTime, onChange: (event) => setEditingDraft({ ...editingDraft, startTime: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-end-time", children: "End time" }), _jsx("input", { id: "activity-edit-end-time", type: "time", value: editingDraft.endTime, onChange: (event) => setEditingDraft({ ...editingDraft, endTime: event.target.value }) })] })] })) : null, _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field todo-private-field", children: [_jsx("span", { children: "Private" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "activity-edit-private", type: "checkbox", checked: editingDraft.isPrivate, onChange: (event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked }) }), _jsx("label", { htmlFor: "activity-edit-private", className: "checkbox-label", children: "Private" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-time-spent", children: "Actual time spent (min)" }), _jsx("input", { id: "activity-edit-time-spent", type: "number", min: "0", value: editingDraft.actualTimeSpentMinutes || "", onChange: (event) => setEditingDraft({ ...editingDraft, actualTimeSpentMinutes: Number(event.target.value) || 0 }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-edit-details", children: "Details" }), _jsx("div", { id: "activity-edit-details", ref: detailsEditorRef, className: "rich-text-surface todo-rich-text-surface", contentEditable: true, suppressContentEditableWarning: true, onInput: (event) => setEditingDraft({ ...editingDraft, detailsHtml: event.currentTarget.innerHTML }) })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => { onSave({ ...editingDraft }); closeEditor(); }, children: "Save" }), _jsx("button", { className: "small-button", type: "button", onClick: closeEditor, children: "Cancel" })] })] })] }) })) : null] }));
};
