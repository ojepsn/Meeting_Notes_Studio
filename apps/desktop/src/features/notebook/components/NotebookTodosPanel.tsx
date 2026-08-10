import { useEffect, useMemo, useState } from "react";
import type { TodoPriority, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { getTodoPriority } from "../../../lib/tasks/model";
import { TodoDetailsEditor } from "../../todos/components/TodoDetailsEditor";

export type NotebookTodoSort =
  | "priority-desc"
  | "priority-asc"
  | "title-asc"
  | "title-desc"
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc"
  | "due-asc"
  | "due-desc";

interface NotebookTodosPanelProps {
  todos: TodoRecord[];
  onAddTodo: (description: string) => void;
  onSaveTodo: (todo: TodoRecord) => void;
  onAddNote: (todoId: string) => void;
}

const priorityRank: Record<TodoPriority, number> = { low: 0, normal: 1, high: 2 };

export const sortNotebookTodos = (todos: TodoRecord[], sort: NotebookTodoSort) => {
  const direction = sort.endsWith("-asc") ? 1 : -1;
  return [...todos].sort((left, right) => {
    let comparison = 0;
    if (sort.startsWith("title")) {
      comparison = left.description.localeCompare(right.description, undefined, { sensitivity: "base" });
    } else if (sort.startsWith("created")) {
      comparison = (left.createdAt || "").localeCompare(right.createdAt || "");
    } else if (sort.startsWith("updated")) {
      comparison = (left.updatedAt || left.createdAt || "").localeCompare(right.updatedAt || right.createdAt || "");
    } else if (sort.startsWith("due")) {
      comparison = (left.dueDate || left.doOn || "9999-99-99").localeCompare(right.dueDate || right.doOn || "9999-99-99");
    } else {
      comparison = priorityRank[getTodoPriority(left)] - priorityRank[getTodoPriority(right)];
      if (!comparison) comparison = Number(Boolean(left.isUrgent)) - Number(Boolean(right.isUrgent));
    }
    if (!comparison) comparison = left.description.localeCompare(right.description, undefined, { sensitivity: "base" });
    return comparison * direction;
  });
};

export const NotebookTodosPanel = ({ todos, onAddTodo, onSaveTodo, onAddNote }: NotebookTodosPanelProps) => {
  const [draft, setDraft] = useState("");
  const [sort, setSort] = useState<NotebookTodoSort>("priority-desc");
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
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
    if (!description) return;
    onAddTodo(description);
    setDraft("");
  };

  const saveSelected = (updates: Partial<TodoRecord>) => {
    if (!selectedTodo) return;
    onSaveTodo({ ...selectedTodo, ...updates });
  };

  return (
    <section className="notebook-todos-section">
      <header className="notebook-todos-header">
        <span>Todos</span>
        <span className="status-chip">{openTodos.length} open</span>
      </header>
      <div className="notebook-todos-body">
        <div className="notebook-todo-add-row">
          <input
            value={draft}
            aria-label="New todo title"
            placeholder="Add a todo"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitTodo();
              }
            }}
          />
          <button className="primary-button" type="button" onClick={submitTodo}>Add</button>
        </div>

        <label className="notebook-todo-sort">
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as NotebookTodoSort)}>
            <option value="priority-desc">Priority: high to low</option>
            <option value="priority-asc">Priority: low to high</option>
            <option value="title-asc">Alphabetical: A to Z</option>
            <option value="title-desc">Alphabetical: Z to A</option>
            <option value="created-desc">Last added: newest first</option>
            <option value="created-asc">Last added: oldest first</option>
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Least recently updated</option>
            <option value="due-asc">Due date: earliest first</option>
            <option value="due-desc">Due date: latest first</option>
          </select>
        </label>

        <div className="notebook-todo-list" aria-label="Open todos">
          {sortedTodos.map((todo) => (
            <div className="notebook-todo-row" data-selected={todo.id === selectedTodoId} key={todo.id}>
              <input
                type="checkbox"
                aria-label={`Mark ${todo.description} done`}
                checked={todo.isDone}
                onChange={() => onSaveTodo({ ...todo, isDone: true })}
              />
              <button type="button" onClick={() => setSelectedTodoId((current) => current === todo.id ? null : todo.id)}>
                <strong>{todo.description}</strong>
                <span>{getTodoPriority(todo)}{todo.isUrgent ? " | Urgent" : ""}{todo.doOn ? ` | ${todo.doOn}` : ""}</span>
              </button>
            </div>
          ))}
          {!sortedTodos.length ? <p className="tiny-text">No open todos. Add one above or create it in Calendar.</p> : null}
        </div>

        {selectedTodo ? (
          <div className="notebook-todo-editor">
            <div className="field">
              <label htmlFor="notebook-todo-title">Todo</label>
              <input id="notebook-todo-title" value={selectedTodo.description} onChange={(event) => saveSelected({ description: event.target.value })} />
            </div>

            <div className="notebook-todo-checks">
              <label><input type="checkbox" checked={!selectedTodo.isPrivate} onChange={() => saveSelected({ isPrivate: false })} /> Business</label>
              <label><input type="checkbox" checked={selectedTodo.isPrivate} onChange={() => saveSelected({ isPrivate: true })} /> Private</label>
              <label><input type="checkbox" checked={Boolean(selectedTodo.isUrgent)} onChange={(event) => saveSelected({ isUrgent: event.target.checked })} /> Urgent</label>
              <label><input type="checkbox" checked={selectedTodo.isDone} onChange={(event) => saveSelected({ isDone: event.target.checked })} /> Done</label>
            </div>

            <div className="notebook-todo-meta-grid">
              <label>
                <span>Priority</span>
                <select
                  value={getTodoPriority(selectedTodo)}
                  onChange={(event) => {
                    const priority = event.target.value as TodoPriority;
                    saveSelected({ priority, isPriority: priority === "high" });
                  }}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                <span>Do on</span>
                <DateInput id="notebook-todo-do-on" value={selectedTodo.doOn} onChange={(event) => saveSelected({ doOn: event.target.value })} />
              </label>
              <label>
                <span>Due date</span>
                <DateInput id="notebook-todo-due" value={selectedTodo.dueDate} onChange={(event) => saveSelected({ dueDate: event.target.value })} />
              </label>
            </div>

            <div className="field">
              <label htmlFor="notebook-todo-details">Details</label>
              <TodoDetailsEditor
                id="notebook-todo-details"
                compact
                value={selectedTodo.detailsHtml}
                onChange={(detailsHtml) => saveSelected({ detailsHtml })}
              />
            </div>

            <button className="primary-button" type="button" onClick={() => onAddNote(selectedTodo.id)}>Add note</button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
