import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { DateInput } from "../../../components/DateInput";
import { getTodoPriority } from "../../../lib/tasks/model";
import { TodoDetailsEditor } from "../../todos/components/TodoDetailsEditor";
export const DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS = {
    sortField: "priority",
    sortDirection: "desc",
    showBusiness: true,
    showPrivate: true,
    showCompleted: true,
    urgentOnly: false,
    priorityFilter: "all",
};
const NOTEBOOK_TODO_VIEW_SETTINGS_KEY = "notesmith:notebook-todo-view-settings";
const TODO_SORT_FIELDS = ["priority", "title", "created", "updated", "due"];
const TODO_PRIORITIES = ["all", "low", "normal", "high"];
export const normalizeNotebookTodoViewSettings = (value) => {
    const saved = value && typeof value === "object" ? value : {};
    return {
        sortField: TODO_SORT_FIELDS.includes(saved.sortField)
            ? saved.sortField
            : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.sortField,
        sortDirection: saved.sortDirection === "asc" || saved.sortDirection === "desc"
            ? saved.sortDirection
            : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.sortDirection,
        showBusiness: typeof saved.showBusiness === "boolean" ? saved.showBusiness : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.showBusiness,
        showPrivate: typeof saved.showPrivate === "boolean" ? saved.showPrivate : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.showPrivate,
        showCompleted: typeof saved.showCompleted === "boolean" ? saved.showCompleted : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.showCompleted,
        urgentOnly: typeof saved.urgentOnly === "boolean" ? saved.urgentOnly : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.urgentOnly,
        priorityFilter: TODO_PRIORITIES.includes(saved.priorityFilter)
            ? saved.priorityFilter
            : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.priorityFilter,
    };
};
const readNotebookTodoViewSettings = () => {
    try {
        return normalizeNotebookTodoViewSettings(JSON.parse(window.localStorage.getItem(NOTEBOOK_TODO_VIEW_SETTINGS_KEY) || "null"));
    }
    catch {
        return DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS;
    }
};
const priorityRank = { low: 0, normal: 1, high: 2 };
export const sortNotebookTodos = (todos, sort) => {
    const direction = sort.endsWith("-asc") ? 1 : -1;
    return [...todos].sort((left, right) => {
        let comparison = 0;
        if (sort.startsWith("title")) {
            comparison = left.description.localeCompare(right.description, undefined, { sensitivity: "base" });
        }
        else if (sort.startsWith("created")) {
            comparison = (left.createdAt || "").localeCompare(right.createdAt || "");
        }
        else if (sort.startsWith("updated")) {
            comparison = (left.updatedAt || left.createdAt || "").localeCompare(right.updatedAt || right.createdAt || "");
        }
        else if (sort.startsWith("due")) {
            comparison = (left.dueDate || left.doOn || "9999-99-99").localeCompare(right.dueDate || right.doOn || "9999-99-99");
        }
        else {
            comparison = priorityRank[getTodoPriority(left)] - priorityRank[getTodoPriority(right)];
            if (!comparison)
                comparison = Number(Boolean(left.isUrgent)) - Number(Boolean(right.isUrgent));
        }
        if (!comparison)
            comparison = left.description.localeCompare(right.description, undefined, { sensitivity: "base" });
        return comparison * direction;
    });
};
const searchableTodoText = (todo) => [
    todo.description,
    todo.domain,
    todo.project,
    todo.activity,
    todo.detailsHtml?.replace(/<[^>]*>/g, " "),
].filter(Boolean).join(" ").toLocaleLowerCase();
export const filterNotebookTodos = (todos, filters) => {
    const query = filters.query.trim().toLocaleLowerCase();
    return todos.filter((todo) => {
        if (todo.isPrivate ? !filters.showPrivate : !filters.showBusiness)
            return false;
        if (filters.urgentOnly && !todo.isUrgent)
            return false;
        if (filters.priority !== "all" && getTodoPriority(todo) !== filters.priority)
            return false;
        return !query || searchableTodoText(todo).includes(query);
    });
};
export const applyNotebookTodoCompletionAnchors = (todos, anchors) => {
    const ordered = [...todos];
    Object.entries(anchors)
        .sort((left, right) => left[1] - right[1])
        .forEach(([todoId, targetIndex]) => {
        const currentIndex = ordered.findIndex((todo) => todo.id === todoId);
        if (currentIndex < 0)
            return;
        const [anchoredTodo] = ordered.splice(currentIndex, 1);
        ordered.splice(Math.min(targetIndex, ordered.length), 0, anchoredTodo);
    });
    return ordered;
};
export const NotebookTodosPanel = ({ todos, onAddTodo, onSaveTodo, onDeleteTodo, onAddNote, headerActions, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp, }) => {
    const [initialViewSettings] = useState(readNotebookTodoViewSettings);
    const [draft, setDraft] = useState("");
    const [query, setQuery] = useState("");
    const [sortField, setSortField] = useState(initialViewSettings.sortField);
    const [sortDirection, setSortDirection] = useState(initialViewSettings.sortDirection);
    const [showBusiness, setShowBusiness] = useState(initialViewSettings.showBusiness);
    const [showPrivate, setShowPrivate] = useState(initialViewSettings.showPrivate);
    const [showCompleted, setShowCompleted] = useState(initialViewSettings.showCompleted);
    const [urgentOnly, setUrgentOnly] = useState(initialViewSettings.urgentOnly);
    const [priorityFilter, setPriorityFilter] = useState(initialViewSettings.priorityFilter);
    const [selectedTodoId, setSelectedTodoId] = useState(null);
    const [completionAnchors, setCompletionAnchors] = useState({});
    const openTodoCount = useMemo(() => todos.filter((todo) => !todo.isDone).length, [todos]);
    const visibleByCompletion = useMemo(() => showCompleted ? todos : todos.filter((todo) => !todo.isDone), [showCompleted, todos]);
    const filteredTodos = useMemo(() => filterNotebookTodos(visibleByCompletion, { query, showBusiness, showPrivate, urgentOnly, priority: priorityFilter }), [priorityFilter, query, showBusiness, showPrivate, urgentOnly, visibleByCompletion]);
    const sort = `${sortField}-${sortDirection}`;
    const sortedTodos = useMemo(() => applyNotebookTodoCompletionAnchors(sortNotebookTodos(filteredTodos, sort), completionAnchors), [completionAnchors, filteredTodos, sort]);
    const selectedTodo = visibleByCompletion.find((todo) => todo.id === selectedTodoId) || null;
    useEffect(() => {
        if (selectedTodoId && !visibleByCompletion.some((todo) => todo.id === selectedTodoId)) {
            setSelectedTodoId(null);
        }
    }, [selectedTodoId, visibleByCompletion]);
    useEffect(() => {
        setCompletionAnchors({});
    }, [priorityFilter, query, showBusiness, showCompleted, showPrivate, sortDirection, sortField, urgentOnly]);
    useEffect(() => {
        try {
            window.localStorage.setItem(NOTEBOOK_TODO_VIEW_SETTINGS_KEY, JSON.stringify({
                sortField,
                sortDirection,
                showBusiness,
                showPrivate,
                showCompleted,
                urgentOnly,
                priorityFilter,
            }));
        }
        catch {
            // The panel remains usable when local settings storage is unavailable.
        }
    }, [priorityFilter, showBusiness, showCompleted, showPrivate, sortDirection, sortField, urgentOnly]);
    const submitTodo = () => {
        const description = draft.trim();
        if (!description)
            return;
        onAddTodo(description);
        setDraft("");
    };
    const saveSelected = (updates) => {
        if (!selectedTodo)
            return;
        onSaveTodo({ ...selectedTodo, ...updates });
    };
    const setTodoDone = (todo, isDone) => {
        if (isDone && !todo.isDone) {
            const currentIndex = sortedTodos.findIndex((entry) => entry.id === todo.id);
            if (currentIndex >= 0) {
                setCompletionAnchors((current) => ({ ...current, [todo.id]: currentIndex }));
            }
        }
        else if (!isDone) {
            setCompletionAnchors((current) => {
                const next = { ...current };
                delete next[todo.id];
                return next;
            });
        }
        onSaveTodo({ ...todo, isDone });
    };
    return (_jsxs("section", { className: "notebook-todos-section", children: [_jsxs("header", { className: "notebook-todos-header", "data-drag-handle": true, onPointerDown: onHeaderPointerDown, onPointerMove: onHeaderPointerMove, onPointerUp: onHeaderPointerUp, onPointerCancel: onHeaderPointerUp, children: [_jsxs("div", { children: [_jsx("span", { className: "notebook-todos-drag-grip", "aria-hidden": "true", children: "::" }), _jsx("strong", { children: "Todos" }), _jsxs("span", { className: "status-chip", children: [openTodoCount, " open"] })] }), headerActions] }), _jsxs("div", { className: "notebook-todos-body", children: [_jsxs("div", { className: "notebook-todos-controls", children: [_jsxs("div", { className: "notebook-todo-add-row", children: [_jsx("input", { value: draft, "aria-label": "New todo title", placeholder: "Add a todo", onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                submitTodo();
                                            }
                                        } }), _jsx("button", { className: "primary-button", type: "button", onClick: submitTodo, children: "Add" })] }), _jsxs("label", { className: "notebook-todo-search", children: [_jsx("span", { children: "Filter" }), _jsx("input", { type: "search", value: query, placeholder: "Search title, details, project...", onChange: (event) => setQuery(event.target.value) })] }), _jsxs("div", { className: "notebook-todo-control-row", children: [_jsxs("fieldset", { className: "notebook-todo-choice-group", children: [_jsx("legend", { children: "Show" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: showBusiness, onChange: (event) => setShowBusiness(event.target.checked) }), " Business"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: showPrivate, onChange: (event) => setShowPrivate(event.target.checked) }), " Private"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: showCompleted, onChange: (event) => setShowCompleted(event.target.checked) }), " Show completed"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: urgentOnly, onChange: (event) => setUrgentOnly(event.target.checked) }), " Urgent only"] })] }), _jsxs("fieldset", { className: "notebook-todo-choice-group", children: [_jsx("legend", { children: "Priority" }), ["all", "high", "normal", "low"].map((priority) => (_jsxs("label", { children: [_jsx("input", { type: "radio", name: "notebook-todo-priority-filter", checked: priorityFilter === priority, onChange: () => setPriorityFilter(priority) }), priority === "all" ? "All" : priority[0].toUpperCase() + priority.slice(1)] }, priority)))] }), _jsx("button", { className: "primary-button notebook-todo-add-note-button", type: "button", disabled: !selectedTodo, onClick: () => selectedTodo && onAddNote(selectedTodo.id), children: "Add note" })] }), _jsxs("div", { className: "notebook-todo-sort-controls", children: [_jsxs("fieldset", { className: "notebook-todo-choice-group", children: [_jsx("legend", { children: "Sort by" }), [
                                                ["priority", "Priority"],
                                                ["title", "Title"],
                                                ["created", "Added"],
                                                ["updated", "Updated"],
                                                ["due", "Due date"],
                                            ].map(([value, label]) => (_jsxs("label", { children: [_jsx("input", { type: "radio", name: "notebook-todo-sort-field", checked: sortField === value, onChange: () => setSortField(value) }), label] }, value)))] }), _jsxs("fieldset", { className: "notebook-todo-choice-group", children: [_jsx("legend", { children: "Direction" }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: "notebook-todo-sort-direction", checked: sortDirection === "asc", onChange: () => setSortDirection("asc") }), " Ascending"] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: "notebook-todo-sort-direction", checked: sortDirection === "desc", onChange: () => setSortDirection("desc") }), " Descending"] })] })] })] }), _jsxs("div", { className: "notebook-todos-work-area", children: [_jsxs("div", { className: "notebook-todo-list-pane", children: [_jsxs("div", { className: "notebook-todo-results-row", children: [_jsxs("strong", { children: [sortedTodos.length, " shown"] }), (query || urgentOnly || priorityFilter !== "all" || !showBusiness || !showPrivate || !showCompleted) ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                    setQuery("");
                                                    setShowBusiness(true);
                                                    setShowPrivate(true);
                                                    setShowCompleted(true);
                                                    setUrgentOnly(false);
                                                    setPriorityFilter("all");
                                                }, children: "Clear filters" })) : null] }), _jsxs("div", { className: "notebook-todo-list", "aria-label": "Open todos", children: [sortedTodos.map((todo) => (_jsxs("div", { className: "notebook-todo-row", "data-completed": todo.isDone, "data-selected": todo.id === selectedTodoId, children: [_jsx("button", { className: "notebook-todo-date", type: "button", title: todo.doOn ? `Do on ${todo.doOn}` : todo.dueDate ? `Due ${todo.dueDate}` : "No date set", onClick: () => setSelectedTodoId(todo.id), children: todo.doOn || todo.dueDate || "No date" }), _jsx("input", { type: "checkbox", "aria-label": `Mark ${todo.description} done`, checked: todo.isDone, onChange: (event) => setTodoDone(todo, event.target.checked) }), _jsxs("button", { className: "notebook-todo-select", type: "button", onClick: () => setSelectedTodoId(todo.id), children: [_jsx("strong", { children: todo.description }), _jsx("span", { className: "notebook-todo-priority", children: getTodoPriority(todo) }), todo.isUrgent ? _jsx("span", { className: "notebook-todo-urgent", children: "Urgent" }) : null] }), _jsx("button", { className: "notebook-todo-delete", type: "button", "aria-label": `Delete ${todo.description}`, title: "Delete todo", onClick: () => onDeleteTodo(todo.id), children: "x" })] }, todo.id))), !sortedTodos.length ? _jsx("p", { className: "tiny-text", children: "No todos match these filters." }) : null] })] }), selectedTodo ? (_jsxs("div", { className: "notebook-todo-editor", "data-expanded": "true", children: [_jsxs("div", { className: "field notebook-todo-title-field", children: [_jsx("label", { htmlFor: "notebook-todo-title", children: "Todo" }), _jsx("input", { id: "notebook-todo-title", value: selectedTodo.description, onChange: (event) => saveSelected({ description: event.target.value }) })] }), _jsxs("div", { className: "notebook-todo-checks", children: [_jsxs("div", { className: "notebook-todo-choice-group", role: "radiogroup", "aria-label": "Todo type", children: [_jsx("span", { children: "Type" }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `notebook-todo-type-${selectedTodo.id}`, checked: !selectedTodo.isPrivate, onChange: () => saveSelected({ isPrivate: false }) }), " Business"] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `notebook-todo-type-${selectedTodo.id}`, checked: selectedTodo.isPrivate, onChange: () => saveSelected({ isPrivate: true }) }), " Private"] })] }), _jsxs("div", { className: "notebook-todo-choice-group", role: "radiogroup", "aria-label": "Todo priority", children: [_jsx("span", { children: "Priority" }), ["low", "normal", "high"].map((priority) => (_jsxs("label", { children: [_jsx("input", { type: "radio", name: `notebook-todo-priority-${selectedTodo.id}`, checked: getTodoPriority(selectedTodo) === priority, onChange: () => saveSelected({ priority, isPriority: priority === "high" }) }), priority[0].toUpperCase() + priority.slice(1)] }, priority)))] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: Boolean(selectedTodo.isUrgent), onChange: (event) => saveSelected({ isUrgent: event.target.checked }) }), " Urgent"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: selectedTodo.isDone, onChange: (event) => setTodoDone(selectedTodo, event.target.checked) }), " Done"] })] }), _jsxs("div", { className: "notebook-todo-meta-grid", children: [_jsxs("label", { children: [_jsx("span", { children: "Do on" }), _jsx(DateInput, { id: "notebook-todo-do-on", value: selectedTodo.doOn, onChange: (event) => saveSelected({ doOn: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "Due date" }), _jsx(DateInput, { id: "notebook-todo-due", value: selectedTodo.dueDate, onChange: (event) => saveSelected({ dueDate: event.target.value }) })] })] }), _jsxs("div", { className: "notebook-todo-context-grid", children: [_jsxs("label", { className: "notebook-todo-context-wide", children: [_jsx("span", { children: "Participants" }), _jsx("input", { value: selectedTodo.participantText || "", placeholder: "People involved", onChange: (event) => saveSelected({ participantText: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "Domain" }), _jsx("input", { value: selectedTodo.domain, onChange: (event) => saveSelected({ domain: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "Project" }), _jsx("input", { value: selectedTodo.project, onChange: (event) => saveSelected({ project: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "Activity" }), _jsx("input", { value: selectedTodo.activity, onChange: (event) => saveSelected({ activity: event.target.value }) })] })] }), _jsxs("div", { className: "field notebook-todo-details-field", children: [_jsx("label", { htmlFor: "notebook-todo-details", children: "Todo details" }), _jsx(TodoDetailsEditor, { id: "notebook-todo-details", compact: true, value: selectedTodo.detailsHtml, onChange: (detailsHtml) => saveSelected({ detailsHtml }) })] }), _jsxs("div", { className: "notebook-todo-record-meta", "aria-label": "Todo record information", children: [_jsxs("span", { children: ["Created ", new Date(selectedTodo.createdAt).toLocaleString()] }), _jsxs("span", { children: ["Updated ", new Date(selectedTodo.updatedAt || selectedTodo.createdAt).toLocaleString()] }), _jsxs("span", { children: [selectedTodo.sessionIds.length, " linked ", selectedTodo.sessionIds.length === 1 ? "note" : "notes"] })] })] })) : (_jsxs("div", { className: "notebook-todo-empty-editor", children: [_jsx("strong", { children: "Select a todo" }), _jsx("p", { children: "Its editable fields and rich-text details will open here." })] }))] })] })] }));
};
