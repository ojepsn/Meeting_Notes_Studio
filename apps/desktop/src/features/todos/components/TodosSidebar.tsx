import { useMemo, useState } from "react";
import type { TodoRecord } from "@notesmith/domain";

interface TodosSidebarProps {
  todos: TodoRecord[];
  onToggle: (todo: TodoRecord) => void;
  onAdd: (description: string) => void;
  onDelete: (id: string) => void;
  onOpenAll: () => void;
  compact?: boolean;
}

export const TodosSidebar = ({ todos, onToggle, onAdd, onDelete, onOpenAll, compact = false }: TodosSidebarProps) => {
  const [draft, setDraft] = useState("");

  const pendingTodos = useMemo(
    () => todos.filter((todo) => !todo.isDone).slice(0, compact ? 4 : 5),
    [compact, todos],
  );

  const completedCount = todos.filter((todo) => todo.isDone).length;

  const submitDraft = () => {
    if (!draft.trim()) {
      return;
    }
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className={compact ? "workspace-rail-todo-card" : "sidebar-card"}>
      <div className="card-header">
        <div>
          <h3>To-dos</h3>
        </div>
        <button className="small-button" type="button" onClick={onOpenAll}>
          {compact ? "Open" : "Open all"}
        </button>
      </div>
      <div className="field">
        <label htmlFor={compact ? "rail-todo-draft" : "sidebar-todo-draft"}>Quick add</label>
        <input
          id={compact ? "rail-todo-draft" : "sidebar-todo-draft"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
          placeholder="Add a to-do or type td ... anywhere"
        />
      </div>
      <div className={`todo-sidebar-meta${compact ? " todo-sidebar-meta-compact" : ""}`}>
        <span className="status-chip">{pendingTodos.length} visible</span>
        <span className="tiny-text">{completedCount} done</span>
      </div>
      <div className={`todo-sidebar-list${compact ? " todo-sidebar-list-compact" : ""}`}>
        {pendingTodos.length ? (
          pendingTodos.map((todo) => (
            <label key={todo.id} className="todo-sidebar-item">
              <input
                type="checkbox"
                checked={todo.isDone}
                onChange={() => onToggle({ ...todo, isDone: !todo.isDone })}
              />
              <span className="todo-sidebar-item-copy">
                <strong>{todo.description}</strong>
                <span className="muted">{compact ? todo.createdAt.slice(5, 10) : todo.createdAt.slice(0, 10)}</span>
              </span>
              <button
                className="small-button danger-button"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onDelete(todo.id);
                }}
              >
                Delete
              </button>
            </label>
          ))
        ) : (
          <div className="list-item">
            <strong>No open to-dos</strong>
            <span className="muted">Use quick add here or type `td ...` in any text field.</span>
          </div>
        )}
      </div>
    </div>
  );
};
