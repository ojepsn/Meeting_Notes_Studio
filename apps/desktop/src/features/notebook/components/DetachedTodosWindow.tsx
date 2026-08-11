import { useEffect, useState } from "react";
import type { TodoRecord } from "@notesmith/domain";
import { NotebookTodosPanel } from "./NotebookTodosPanel";
import {
  TODOS_SNAPSHOT_EVENT,
  sendTodosCommand,
  type TodosWindowSnapshot,
} from "../todosWindowBridge";

export const DetachedTodosWindow = () => {
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [theme, setTheme] = useState("fluent-slate-light");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<TodosWindowSnapshot>(TODOS_SNAPSHOT_EVENT, (event) => {
        if (disposed) return;
        setTodos(event.payload.todos);
        setTheme(event.payload.theme);
        setIsConnected(true);
      }),
    ).then((disposeListener) => {
      if (disposed) disposeListener();
      else unlisten = disposeListener;
      return sendTodosCommand({ type: "request-snapshot" });
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return (
    <main className="app-shell detached-todos-window" data-theme={theme}>
      <div className="detached-todos-window-content">
        <NotebookTodosPanel
        todos={todos}
        onAddTodo={(description) => void sendTodosCommand({ type: "add", description })}
        onSaveTodo={(todo) => void sendTodosCommand({ type: "save", todo })}
        onDeleteTodo={(todoId) => void sendTodosCommand({ type: "delete", todoId })}
        onAddNote={(todoId) => void sendTodosCommand({ type: "add-note", todoId })}
        headerActions={(
          <div className="notebook-todos-window-actions">
            <span className="tiny-text">{isConnected ? "Synced with NoteSmith" : "Connecting..."}</span>
          </div>
        )}
        />
      </div>
    </main>
  );
};
