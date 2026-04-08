import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const createBlankTodoDraft = (description = "") => ({
    id: "",
    description,
    isDone: false,
    isPrivate: false,
    comments: "",
    domain: "",
    project: "",
    activity: "",
    doOn: "",
    dueDate: "",
    detailsHtml: "",
    createdAt: "",
    sessionIds: [],
});
const normalizeValue = (value) => value.trim().toLowerCase();
export const TodosWorkspace = ({ todos, requestedTodoId, onToggle, onAdd, onSave, onDelete, onConvertToActivity }) => {
    const [draft, setDraft] = useState("");
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState("dueDate");
    const [editingTodoId, setEditingTodoId] = useState(null);
    const [editingDraft, setEditingDraft] = useState(createBlankTodoDraft());
    const detailsEditorRef = useRef(null);
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
                    return normalizeValue(todo.activity);
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
    }, [openTodos, query, sortKey]);
    const completedTodos = useMemo(() => todos.filter((todo) => todo.isDone).slice(0, 8), [todos]);
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
        onAdd(nextValue);
        setDraft("");
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
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsx("div", { children: _jsx("h2", { children: "Todos" }) }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "todos-workspace-draft", children: "New todo" }), _jsx("input", { id: "todos-workspace-draft", value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        submitDraft();
                                    }
                                }, placeholder: "Add a focused next action" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitDraft, children: "Add" })] }), _jsxs("div", { className: "todos-workspace-toolbar", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "todos-workspace-filter", children: "Search" }), _jsx("input", { id: "todos-workspace-filter", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Filter todos" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todos-workspace-sort", children: "Sort by" }), _jsx("select", { id: "todos-workspace-sort", value: sortKey, onChange: (event) => setSortKey(event.target.value), children: sortOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("span", { className: "status-chip", children: [openTodos.length, " open"] }), _jsxs("span", { className: "status-chip", children: [todos.length - openTodos.length, " done"] })] }), _jsxs("div", { className: "todos-workspace-table", children: [_jsxs("div", { className: "todos-workspace-row todos-workspace-row-header", children: [_jsx("span", { children: "Done" }), _jsx("span", { children: "Todo" }), _jsx("span", { children: "Private" }), _jsx("span", { children: "Domain" }), _jsx("span", { children: "Project" }), _jsx("span", { children: "Activity" }), _jsx("span", { children: "Do on" }), _jsx("span", { children: "Due" }), _jsx("span", { children: "Created" }), _jsx("span", {})] }), filteredAndSortedTodos.length ? (filteredAndSortedTodos.map((todo) => (_jsxs("div", { className: "todos-workspace-row", onDoubleClick: () => setEditingTodoId(todo.id), role: "button", tabIndex: 0, onKeyDown: (event) => {
                            if (event.key === "Enter") {
                                setEditingTodoId(todo.id);
                            }
                        }, children: [_jsx("span", { children: _jsx("input", { type: "checkbox", checked: todo.isDone, onChange: () => onToggle({ ...todo, isDone: !todo.isDone }) }) }), _jsx("span", { className: "todos-cell-strong", children: todo.description }), _jsx("span", { children: todo.isPrivate ? "Yes" : "No" }), _jsx("span", { children: todo.domain || "—" }), _jsx("span", { children: todo.project || "—" }), _jsx("span", { children: todo.activity || "—" }), _jsx("span", { children: todo.doOn || "—" }), _jsx("span", { children: todo.dueDate || "—" }), _jsx("span", { children: todo.createdAt.slice(0, 10) }), _jsx("span", { children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: (event) => {
                                        event.stopPropagation();
                                        onDelete(todo.id);
                                    }, children: "Delete" }) })] }, todo.id)))) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No open todos" }), _jsx("p", { children: "Capture the next action here, or type `td` followed by text in any input across the app." })] }))] }), completedTodos.length ? (_jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Recently completed" }), _jsx("div", { className: "workspace-disclosure-body todos-workspace-completed", children: completedTodos.map((todo) => (_jsxs("label", { className: "todos-workspace-main todos-workspace-main-completed", children: [_jsx("input", { type: "checkbox", checked: todo.isDone, onChange: () => onToggle({ ...todo, isDone: !todo.isDone }) }), _jsxs("span", { className: "todos-workspace-copy", children: [_jsx("strong", { children: todo.description }), _jsx("span", { className: "muted", children: todo.createdAt.slice(0, 10) })] })] }, todo.id))) })] })) : null, editingTodoId ? (_jsx("div", { className: "overlay-backdrop todos-editor-backdrop", role: "presentation", onClick: () => setEditingTodoId(null), children: _jsxs("div", { className: "overlay-surface todos-editor-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsx("div", { children: _jsx("strong", { children: "Edit todo" }) }), _jsx("button", { className: "small-button", type: "button", onClick: () => setEditingTodoId(null), children: "Close" })] }), _jsxs("div", { className: "stack", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-description", children: "Todo" }), _jsx("input", { id: "todo-edit-description", value: editingDraft.description, onChange: (event) => setEditingDraft({ ...editingDraft, description: event.target.value }) })] }), _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "todo-edit-domain", children: "Domain" }), _jsx("input", { id: "todo-edit-domain", value: editingDraft.domain, onChange: (event) => setEditingDraft({ ...editingDraft, domain: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "todo-edit-project", children: "Project" }), _jsx("input", { id: "todo-edit-project", value: editingDraft.project, onChange: (event) => setEditingDraft({ ...editingDraft, project: event.target.value }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "todo-edit-activity", children: "Activity" }), _jsx("input", { id: "todo-edit-activity", value: editingDraft.activity, onChange: (event) => setEditingDraft({ ...editingDraft, activity: event.target.value }) })] })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-do-on", children: "Do on" }), _jsx("input", { id: "todo-edit-do-on", type: "date", value: editingDraft.doOn, onChange: (event) => setEditingDraft({ ...editingDraft, doOn: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-due-date", children: "Due date" }), _jsx("input", { id: "todo-edit-due-date", type: "date", value: editingDraft.dueDate, onChange: (event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value }) })] }), _jsxs("div", { className: "field todo-private-field", children: [_jsx("span", { children: "Private" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "todo-edit-private", type: "checkbox", checked: editingDraft.isPrivate, onChange: (event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked }) }), _jsx("label", { htmlFor: "todo-edit-private", className: "checkbox-label", children: "Private" })] })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-details", children: "Details" }), _jsx("div", { id: "todo-edit-details", ref: detailsEditorRef, className: "rich-text-surface todo-rich-text-surface", contentEditable: true, suppressContentEditableWarning: true, onInput: (event) => setEditingDraft({
                                                ...editingDraft,
                                                detailsHtml: event.currentTarget.innerHTML,
                                            }) })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                                onSave({ ...editingDraft });
                                                setEditingTodoId(null);
                                            }, children: "Save" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                                onConvertToActivity(editingDraft);
                                                setEditingTodoId(null);
                                            }, children: "Convert to activity" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setEditingTodoId(null), children: "Cancel" })] })] })] }) })) : null] }));
};
