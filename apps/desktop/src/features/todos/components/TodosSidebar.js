import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export const TodosSidebar = ({ todos, onToggle, onAdd, onDelete, onOpenAll }) => {
    const [draft, setDraft] = useState("");
    const pendingTodos = useMemo(() => todos.filter((todo) => !todo.isDone).slice(0, 5), [todos]);
    const completedCount = todos.filter((todo) => todo.isDone).length;
    const submitDraft = () => {
        if (!draft.trim()) {
            return;
        }
        onAdd(draft);
        setDraft("");
    };
    return (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { className: "card-header", children: [_jsx("div", { children: _jsx("h3", { children: "To-dos" }) }), _jsx("button", { className: "small-button", type: "button", onClick: onOpenAll, children: "Open all" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "sidebar-todo-draft", children: "Quick add" }), _jsx("input", { id: "sidebar-todo-draft", value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                submitDraft();
                            }
                        }, placeholder: "Add a to-do or type td ... anywhere" })] }), _jsxs("div", { className: "todo-sidebar-meta", children: [_jsxs("span", { className: "status-chip", children: [pendingTodos.length, " visible"] }), _jsxs("span", { className: "tiny-text", children: [completedCount, " done"] })] }), _jsx("div", { className: "todo-sidebar-list", children: pendingTodos.length ? (pendingTodos.map((todo) => (_jsxs("label", { className: "todo-sidebar-item", children: [_jsx("input", { type: "checkbox", checked: todo.isDone, onChange: () => onToggle({ ...todo, isDone: !todo.isDone }) }), _jsxs("span", { className: "todo-sidebar-item-copy", children: [_jsx("strong", { children: todo.description }), _jsx("span", { className: "muted", children: todo.createdAt.slice(0, 10) })] }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: (event) => {
                                event.preventDefault();
                                onDelete(todo.id);
                            }, children: "Delete" })] }, todo.id)))) : (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "No open to-dos" }), _jsx("span", { className: "muted", children: "Use quick add here or type `td ...` in any text field." })] })) })] }));
};
