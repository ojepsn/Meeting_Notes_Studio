import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { DateInput } from "../../../components/DateInput";
import { getTodoPriority } from "../../../lib/tasks/model";
import { TodoDetailsEditor } from "../../todos/components/TodoDetailsEditor";
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
export const NotebookTodosPanel = ({ todos, onAddTodo, onSaveTodo, onAddNote }) => {
    const [draft, setDraft] = useState("");
    const [sort, setSort] = useState("priority-desc");
    const [selectedTodoId, setSelectedTodoId] = useState(null);
    const openTodos = useMemo(() => todos.filter((todo) => !todo.isDone), [todos]);
    const sortedTodos = useMemo(() => sortNotebookTodos(openTodos, sort), [openTodos, sort]);
    const selectedTodo = openTodos.find((todo) => todo.id === selectedTodoId) || null;
    useEffect(() => {
        if (selectedTodoId && !openTodos.some((todo) => todo.id === selectedTodoId)) {
            setSelectedTodoId(null);
        }
    }, [openTodos, selectedTodoId]);
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
    return (_jsxs("section", { className: "notebook-todos-section", children: [_jsxs("header", { className: "notebook-todos-header", children: [_jsx("span", { children: "Todos" }), _jsxs("span", { className: "status-chip", children: [openTodos.length, " open"] })] }), _jsxs("div", { className: "notebook-todos-body", children: [_jsxs("div", { className: "notebook-todo-add-row", children: [_jsx("input", { value: draft, "aria-label": "New todo title", placeholder: "Add a todo", onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        submitTodo();
                                    }
                                } }), _jsx("button", { className: "primary-button", type: "button", onClick: submitTodo, children: "Add" })] }), _jsxs("label", { className: "notebook-todo-sort", children: [_jsx("span", { children: "Sort" }), _jsxs("select", { value: sort, onChange: (event) => setSort(event.target.value), children: [_jsx("option", { value: "priority-desc", children: "Priority: high to low" }), _jsx("option", { value: "priority-asc", children: "Priority: low to high" }), _jsx("option", { value: "title-asc", children: "Alphabetical: A to Z" }), _jsx("option", { value: "title-desc", children: "Alphabetical: Z to A" }), _jsx("option", { value: "created-desc", children: "Last added: newest first" }), _jsx("option", { value: "created-asc", children: "Last added: oldest first" }), _jsx("option", { value: "updated-desc", children: "Recently updated" }), _jsx("option", { value: "updated-asc", children: "Least recently updated" }), _jsx("option", { value: "due-asc", children: "Due date: earliest first" }), _jsx("option", { value: "due-desc", children: "Due date: latest first" })] })] }), _jsxs("div", { className: "notebook-todo-list", "aria-label": "Open todos", children: [sortedTodos.map((todo) => (_jsxs("div", { className: "notebook-todo-row", "data-selected": todo.id === selectedTodoId, children: [_jsx("input", { type: "checkbox", "aria-label": `Mark ${todo.description} done`, checked: todo.isDone, onChange: () => onSaveTodo({ ...todo, isDone: true }) }), _jsxs("button", { type: "button", onClick: () => setSelectedTodoId((current) => current === todo.id ? null : todo.id), children: [_jsx("strong", { children: todo.description }), _jsxs("span", { children: [getTodoPriority(todo), todo.isUrgent ? " | Urgent" : "", todo.doOn ? ` | ${todo.doOn}` : ""] })] })] }, todo.id))), !sortedTodos.length ? _jsx("p", { className: "tiny-text", children: "No open todos. Add one above or create it in Calendar." }) : null] }), selectedTodo ? (_jsxs("div", { className: "notebook-todo-editor", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "notebook-todo-title", children: "Todo" }), _jsx("input", { id: "notebook-todo-title", value: selectedTodo.description, onChange: (event) => saveSelected({ description: event.target.value }) })] }), _jsxs("div", { className: "notebook-todo-checks", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: !selectedTodo.isPrivate, onChange: () => saveSelected({ isPrivate: false }) }), " Business"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: selectedTodo.isPrivate, onChange: () => saveSelected({ isPrivate: true }) }), " Private"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: Boolean(selectedTodo.isUrgent), onChange: (event) => saveSelected({ isUrgent: event.target.checked }) }), " Urgent"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: selectedTodo.isDone, onChange: (event) => saveSelected({ isDone: event.target.checked }) }), " Done"] })] }), _jsxs("div", { className: "notebook-todo-meta-grid", children: [_jsxs("label", { children: [_jsx("span", { children: "Priority" }), _jsxs("select", { value: getTodoPriority(selectedTodo), onChange: (event) => {
                                                    const priority = event.target.value;
                                                    saveSelected({ priority, isPriority: priority === "high" });
                                                }, children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] })] }), _jsxs("label", { children: [_jsx("span", { children: "Do on" }), _jsx(DateInput, { id: "notebook-todo-do-on", value: selectedTodo.doOn, onChange: (event) => saveSelected({ doOn: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "Due date" }), _jsx(DateInput, { id: "notebook-todo-due", value: selectedTodo.dueDate, onChange: (event) => saveSelected({ dueDate: event.target.value }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "notebook-todo-details", children: "Details" }), _jsx(TodoDetailsEditor, { id: "notebook-todo-details", compact: true, value: selectedTodo.detailsHtml, onChange: (detailsHtml) => saveSelected({ detailsHtml }) })] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => onAddNote(selectedTodo.id), children: "Add note" })] })) : null] })] }));
};
