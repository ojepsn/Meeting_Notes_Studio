import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export const TodosCard = ({ todos, onToggle, onAdd, onDelete }) => {
    const [draft, setDraft] = useState("");
    const [filter, setFilter] = useState("");
    const filteredTodos = useMemo(() => {
        const query = filter.trim().toLowerCase();
        if (!query)
            return todos;
        return todos.filter((todo) => [todo.description, todo.detailsHtml, todo.createdAt, todo.sessionIds.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(query));
    }, [filter, todos]);
    return (_jsxs("div", { className: "card", id: "desktop-todos-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Personal To-do List" }), _jsx("p", { children: "This module is already separated so it can later grow into its own assistant workflow." })] }), _jsxs("span", { className: "status-chip", children: [todos.length, " items"] })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-draft", children: "New to-do" }), _jsx("input", { id: "todo-draft", value: draft, onChange: (event) => setDraft(event.target.value), placeholder: "Add a personal action or reminder" })] }), _jsx("button", { className: "primary-button inline-action", type: "button", onClick: () => {
                            onAdd(draft);
                            setDraft("");
                        }, children: "Add" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-filter", children: "Filter to-dos" }), _jsx("input", { id: "todo-filter", value: filter, onChange: (event) => setFilter(event.target.value), placeholder: "Search item text, details, or source sessions" })] }), _jsxs("table", { className: "todo-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Done" }), _jsx("th", { children: "Item" }), _jsx("th", { children: "Date added" }), _jsx("th", { children: "Source sessions" }), _jsx("th", { children: "Remove" })] }) }), _jsx("tbody", { children: filteredTodos.map((todo) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("input", { type: "checkbox", checked: todo.isDone, onChange: () => onToggle({ ...todo, isDone: !todo.isDone }) }) }), _jsx("td", { children: todo.description }), _jsx("td", { children: todo.createdAt.slice(0, 10) }), _jsx("td", { children: todo.sessionIds.length }), _jsx("td", { children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDelete(todo.id), children: "Delete" }) })] }, todo.id))) })] })] }));
};
