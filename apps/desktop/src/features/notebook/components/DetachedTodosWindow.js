import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { NotebookTodosPanel } from "./NotebookTodosPanel";
import { TODOS_SNAPSHOT_EVENT, sendTodosCommand, } from "../todosWindowBridge";
export const DetachedTodosWindow = () => {
    const [todos, setTodos] = useState([]);
    const [theme, setTheme] = useState("fluent-slate-light");
    const [runningTodoIds, setRunningTodoIds] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    useEffect(() => {
        let disposed = false;
        let unlisten;
        void import("@tauri-apps/api/event").then(({ listen }) => listen(TODOS_SNAPSHOT_EVENT, (event) => {
            if (disposed)
                return;
            setTodos(event.payload.todos);
            setTheme(event.payload.theme);
            setRunningTodoIds(event.payload.runningTodoIds);
            setIsConnected(true);
        })).then((disposeListener) => {
            if (disposed)
                disposeListener();
            else
                unlisten = disposeListener;
            return sendTodosCommand({ type: "request-snapshot" });
        });
        return () => {
            disposed = true;
            unlisten?.();
        };
    }, []);
    return (_jsx("main", { className: "app-shell detached-todos-window", "data-theme": theme, children: _jsx("div", { className: "detached-todos-window-content", children: _jsx(NotebookTodosPanel, { todos: todos, runningTodoIds: runningTodoIds, onAddTodo: (description) => void sendTodosCommand({ type: "add", description }), onSaveTodo: (todo) => void sendTodosCommand({ type: "save", todo }), onDeleteTodo: (todoId) => void sendTodosCommand({ type: "delete", todoId }), onAddNote: (todoId) => void sendTodosCommand({ type: "add-note", todoId }), onToggleTime: (todoId, isRunning) => void sendTodosCommand({ type: "toggle-time", todoId, isRunning }), headerActions: (_jsx("div", { className: "notebook-todos-window-actions", children: _jsx("span", { className: "tiny-text", children: isConnected ? "Synced with NoteSmith" : "Connecting..." }) })) }) }) }));
};
