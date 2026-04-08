import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const createBlankTodoDraft = (description = "") => ({
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
const createBlankTimeLogDraft = (targetType, targetId) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    const hours = `${now.getHours()}`.padStart(2, "0");
    const minutes = `${now.getMinutes()}`.padStart(2, "0");
    return {
        id: crypto.randomUUID(),
        targetType,
        targetId,
        date: `${year}-${month}-${day}`,
        startTime: `${hours}:${minutes}`,
        endTime: `${hours}:${minutes}`,
        durationMinutes: 0,
        notes: "",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
};
const normalizeValue = (value) => value.trim().toLowerCase();
const calculateDurationMinutes = (date, startTime, endTime) => {
    const start = new Date(`${date}T${startTime || "00:00"}:00`);
    const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
};
export const TodosWorkspace = ({ todos, activities, timeLogs, requestedTodoId, onEditorClose, onToggle, onAdd, onSave, onDelete, onConvertToActivity, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, }) => {
    const [draft, setDraft] = useState("");
    const [selectedActivityId, setSelectedActivityId] = useState("");
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState("dueDate");
    const [editingTodoId, setEditingTodoId] = useState(null);
    const [editingDraft, setEditingDraft] = useState(createBlankTodoDraft());
    const [editingTimeLogId, setEditingTimeLogId] = useState(null);
    const [timeLogDraft, setTimeLogDraft] = useState(null);
    const detailsEditorRef = useRef(null);
    const activityOptions = useMemo(() => activities
        .filter((entry) => !entry.parentActivityId)
        .sort((left, right) => left.description.localeCompare(right.description)), [activities]);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
    const openTodos = useMemo(() => todos.filter((todo) => !todo.isDone), [todos]);
    const filteredAndSortedTodos = useMemo(() => {
        const normalized = normalizeValue(query);
        const filtered = !normalized
            ? openTodos
            : openTodos.filter((todo) => [
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
                .includes(normalized));
        const valueForSort = (todo) => {
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
    }, [activityLookup, openTodos, query, sortKey]);
    const completedTodos = useMemo(() => todos.filter((todo) => todo.isDone).slice(0, 8), [todos]);
    const todoTimeLogs = useMemo(() => timeLogs.filter((entry) => entry.targetType === "todo"), [timeLogs]);
    const timeLogsByTodoId = useMemo(() => {
        const grouped = new Map();
        todoTimeLogs.forEach((entry) => {
            const current = grouped.get(entry.targetId) || [];
            current.push(entry);
            grouped.set(entry.targetId, current);
        });
        return grouped;
    }, [todoTimeLogs]);
    useEffect(() => {
        if (requestedTodoId) {
            setEditingTodoId(requestedTodoId);
        }
    }, [requestedTodoId]);
    useEffect(() => {
        if (!editingTodoId)
            return;
        const todo = todos.find((entry) => entry.id === editingTodoId);
        if (!todo) {
            setEditingTodoId(null);
            setEditingDraft(createBlankTodoDraft());
            return;
        }
        setEditingDraft(todo);
    }, [editingTodoId, todos]);
    useEffect(() => {
        if (!detailsEditorRef.current)
            return;
        const nextHtml = editingDraft.detailsHtml || "<p></p>";
        if (detailsEditorRef.current.innerHTML !== nextHtml) {
            detailsEditorRef.current.innerHTML = nextHtml;
        }
    }, [editingTodoId, editingDraft.detailsHtml]);
    const submitDraft = () => {
        const nextValue = draft.trim();
        if (!nextValue)
            return;
        onAdd(nextValue, { activityId: selectedActivityId || undefined });
        setDraft("");
    };
    const closeEditor = () => {
        setEditingTodoId(null);
        setEditingTimeLogId(null);
        setTimeLogDraft(null);
        onEditorClose?.();
    };
    const sortOptions = [
        { value: "dueDate", label: "Due date" },
        { value: "doOn", label: "Do on" },
        { value: "createdAt", label: "Created" },
        { value: "description", label: "Title" },
        { value: "domain", label: "Domain" },
        { value: "project", label: "Project" },
        { value: "activity", label: "Activity" },
    ];
    const currentTimeLogs = editingTodoId ? timeLogsByTodoId.get(editingTodoId) || [] : [];
    const hasOpenTimer = currentTimeLogs.some((entry) => entry.startTime === entry.endTime);
    const currentActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsx("div", { children: _jsx("h2", { children: "Todos" }) }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todos-workspace-activity", children: "Activity" }), _jsxs("select", { id: "todos-workspace-activity", value: selectedActivityId, onChange: (event) => setSelectedActivityId(event.target.value), children: [_jsx("option", { value: "", children: "Unassigned" }), activityOptions.map((activity) => (_jsx("option", { value: activity.id, children: activity.description }, activity.id)))] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "todos-workspace-draft", children: "New todo" }), _jsx("input", { id: "todos-workspace-draft", value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        submitDraft();
                                    }
                                }, placeholder: "Add a focused next action" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitDraft, children: "Add" })] }), _jsxs("div", { className: "todos-workspace-toolbar", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "todos-workspace-filter", children: "Search" }), _jsx("input", { id: "todos-workspace-filter", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Filter todos" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todos-workspace-sort", children: "Sort by" }), _jsx("select", { id: "todos-workspace-sort", value: sortKey, onChange: (event) => setSortKey(event.target.value), children: sortOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("span", { className: "status-chip", children: [openTodos.length, " open"] }), _jsxs("span", { className: "status-chip", children: [todos.length - openTodos.length, " done"] })] }), _jsxs("div", { className: "todos-workspace-table", children: [_jsxs("div", { className: "todos-workspace-row todos-workspace-row-header", children: [_jsx("span", { children: "Done" }), _jsx("span", { children: "Todo" }), _jsx("span", { children: "Private" }), _jsx("span", { children: "Domain" }), _jsx("span", { children: "Project" }), _jsx("span", { children: "Activity" }), _jsx("span", { children: "Do on" }), _jsx("span", { children: "Due" }), _jsx("span", { children: "Time" }), _jsx("span", { children: "Created" }), _jsx("span", {})] }), filteredAndSortedTodos.length ? (filteredAndSortedTodos.map((todo) => {
                        const logs = timeLogsByTodoId.get(todo.id) || [];
                        const totalMinutes = logs.reduce((sum, entry) => sum + entry.durationMinutes, 0);
                        const running = logs.some((entry) => entry.startTime === entry.endTime);
                        return (_jsxs("div", { className: "todos-workspace-row", onDoubleClick: () => setEditingTodoId(todo.id), role: "button", tabIndex: 0, onKeyDown: (event) => {
                                if (event.key === "Enter") {
                                    setEditingTodoId(todo.id);
                                }
                            }, children: [_jsx("span", { children: _jsx("input", { type: "checkbox", checked: todo.isDone, onChange: () => onToggle({ ...todo, isDone: !todo.isDone }) }) }), _jsx("span", { className: "todos-cell-strong", children: todo.description }), _jsx("span", { children: todo.isPrivate ? "Yes" : "-" }), _jsx("span", { children: todo.domain || "-" }), _jsx("span", { children: todo.project || "-" }), _jsx("span", { children: activityLookup[todo.activityId]?.description || todo.activity || "-" }), _jsx("span", { children: todo.doOn || "-" }), _jsx("span", { children: todo.dueDate || "-" }), _jsx("span", { children: running ? "Running" : totalMinutes ? `${totalMinutes}m` : "-" }), _jsx("span", { children: todo.createdAt.slice(0, 10) }), _jsx("span", { children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: (event) => {
                                            event.stopPropagation();
                                            onDelete(todo.id);
                                        }, children: "Delete" }) })] }, todo.id));
                    })) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No open todos" }), _jsx("p", { children: "Capture the next action here, or type `td` followed by text in any input across the app." })] }))] }), completedTodos.length ? (_jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Recently completed" }), _jsx("div", { className: "workspace-disclosure-body todos-workspace-completed", children: completedTodos.map((todo) => (_jsxs("label", { className: "todos-workspace-main todos-workspace-main-completed", children: [_jsx("input", { type: "checkbox", checked: todo.isDone, onChange: () => onToggle({ ...todo, isDone: !todo.isDone }) }), _jsxs("span", { className: "todos-workspace-copy", children: [_jsx("strong", { children: todo.description }), _jsx("span", { className: "muted", children: todo.createdAt.slice(0, 10) })] })] }, todo.id))) })] })) : null, editingTodoId ? (_jsx("div", { className: "overlay-backdrop todos-editor-backdrop", role: "presentation", onClick: closeEditor, children: _jsxs("div", { className: "overlay-surface todos-editor-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsx("div", { children: _jsx("strong", { children: "Edit todo" }) }), _jsx("button", { className: "small-button", type: "button", onClick: closeEditor, children: "Close" })] }), _jsxs("div", { className: "stack", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-description", children: "Todo" }), _jsx("input", { id: "todo-edit-description", value: editingDraft.description, onChange: (event) => setEditingDraft({ ...editingDraft, description: event.target.value }) })] }), _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "todo-edit-linked-activity", children: "Activity" }), _jsxs("select", { id: "todo-edit-linked-activity", value: editingDraft.activityId, onChange: (event) => {
                                                        const nextActivity = activityLookup[event.target.value];
                                                        setEditingDraft({
                                                            ...editingDraft,
                                                            activityId: event.target.value,
                                                            domain: nextActivity?.domain || editingDraft.domain,
                                                            project: nextActivity?.project || editingDraft.project,
                                                            activity: nextActivity?.description || editingDraft.activity,
                                                        });
                                                    }, children: [_jsx("option", { value: "", children: "Unassigned" }), activityOptions.map((activity) => (_jsx("option", { value: activity.id, children: activity.description }, activity.id)))] })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "todo-edit-domain", children: "Domain" }), _jsx("input", { id: "todo-edit-domain", value: editingDraft.domain, onChange: (event) => setEditingDraft({ ...editingDraft, domain: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "todo-edit-project", children: "Project" }), _jsx("input", { id: "todo-edit-project", value: editingDraft.project, onChange: (event) => setEditingDraft({ ...editingDraft, project: event.target.value }) })] })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-do-on", children: "Do on" }), _jsx("input", { id: "todo-edit-do-on", type: "date", value: editingDraft.doOn, onChange: (event) => setEditingDraft({ ...editingDraft, doOn: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-due-date", children: "Due date" }), _jsx("input", { id: "todo-edit-due-date", type: "date", value: editingDraft.dueDate, onChange: (event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value }) })] }), _jsxs("div", { className: "field todo-private-field", children: [_jsx("span", { children: "Private" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "todo-edit-private", type: "checkbox", checked: editingDraft.isPrivate, onChange: (event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked }) }), _jsx("label", { htmlFor: "todo-edit-private", className: "checkbox-label", children: "Private" })] })] })] }), currentActivity ? (_jsxs("div", { className: "status-chip", children: ["Linked activity: ", currentActivity.description] })) : null, _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-details", children: "Details" }), _jsx("div", { id: "todo-edit-details", ref: detailsEditorRef, className: "rich-text-surface todo-rich-text-surface", contentEditable: true, suppressContentEditableWarning: true, onInput: (event) => setEditingDraft({
                                                ...editingDraft,
                                                detailsHtml: event.currentTarget.innerHTML,
                                            }) })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Time logs" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => hasOpenTimer
                                                                ? onStopTracking("todo", editingDraft.id)
                                                                : onStartTracking("todo", editingDraft.id), children: hasOpenTimer ? "Stop" : "Start" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                const draftLog = createBlankTimeLogDraft("todo", editingDraft.id);
                                                                setEditingTimeLogId(draftLog.id);
                                                                setTimeLogDraft(draftLog);
                                                            }, children: "Add manual log" })] }), (timeLogDraft || currentTimeLogs.length) ? (_jsxs("div", { className: "stack", children: [timeLogDraft ? (_jsxs("div", { className: "list-item timelog-editor-card", children: [_jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Date" }), _jsx("input", { type: "date", value: timeLogDraft.date, onChange: (event) => setTimeLogDraft({
                                                                                        ...timeLogDraft,
                                                                                        date: event.target.value,
                                                                                        durationMinutes: calculateDurationMinutes(event.target.value, timeLogDraft.startTime, timeLogDraft.endTime),
                                                                                    }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Start" }), _jsx("input", { type: "time", value: timeLogDraft.startTime, onChange: (event) => setTimeLogDraft({
                                                                                        ...timeLogDraft,
                                                                                        startTime: event.target.value,
                                                                                        durationMinutes: calculateDurationMinutes(timeLogDraft.date, event.target.value, timeLogDraft.endTime),
                                                                                    }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "End" }), _jsx("input", { type: "time", value: timeLogDraft.endTime, onChange: (event) => setTimeLogDraft({
                                                                                        ...timeLogDraft,
                                                                                        endTime: event.target.value,
                                                                                        durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, event.target.value),
                                                                                    }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Notes" }), _jsx("input", { value: timeLogDraft.notes, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, notes: event.target.value }), placeholder: "Optional context" })] }), _jsxs("div", { className: "page-actions", children: [_jsxs("span", { className: "status-chip", children: [timeLogDraft.durationMinutes, " min"] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                                                                onSaveTimeLog({
                                                                                    ...timeLogDraft,
                                                                                    durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, timeLogDraft.endTime),
                                                                                });
                                                                                setEditingTimeLogId(null);
                                                                                setTimeLogDraft(null);
                                                                            }, children: "Save log" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                                setEditingTimeLogId(null);
                                                                                setTimeLogDraft(null);
                                                                            }, children: "Cancel" })] })] })) : null, currentTimeLogs.map((entry) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => {
                                                                setEditingTimeLogId(entry.id);
                                                                setTimeLogDraft(entry);
                                                            }, children: [_jsx("strong", { children: entry.date }), _jsxs("span", { children: [entry.startTime, " to ", entry.endTime] }), _jsxs("span", { children: [entry.durationMinutes, " min"] })] }, entry.id)))] })) : (_jsx("p", { className: "muted", children: "No time logged yet. Start a timer or add a manual entry here." })), editingTimeLogId && timeLogDraft && currentTimeLogs.some((entry) => entry.id === editingTimeLogId) ? (_jsx("div", { className: "page-actions", children: _jsx("button", { className: "danger-button small-button", type: "button", onClick: () => {
                                                            onDeleteTimeLog(editingTimeLogId);
                                                            setEditingTimeLogId(null);
                                                            setTimeLogDraft(null);
                                                        }, children: "Delete selected log" }) })) : null] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                                onSave({ ...editingDraft, activity: currentActivity?.description || editingDraft.activity });
                                                closeEditor();
                                            }, children: "Save" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                onConvertToActivity(editingDraft);
                                                closeEditor();
                                            }, children: "Convert to activity" }), _jsx("button", { className: "small-button", type: "button", onClick: closeEditor, children: "Cancel" })] })] })] }) })) : null] }));
};
