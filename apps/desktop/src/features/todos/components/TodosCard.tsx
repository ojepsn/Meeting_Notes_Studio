import { useMemo, useState } from "react";
import type { TodoRecord } from "@notesmith/domain";

interface TodosCardProps {
  todos: TodoRecord[];
  onToggle: (todo: TodoRecord) => void;
  onAdd: (description: string) => void;
  onDelete: (id: string) => void;
}

export const TodosCard = ({ todos, onToggle, onAdd, onDelete }: TodosCardProps) => {
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");

  const filteredTodos = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return todos;
    return todos.filter((todo) =>
      [todo.description, todo.comments, todo.createdAt, todo.sessionIds.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [filter, todos]);

  return (
    <div className="card" id="desktop-todos-card">
      <div className="card-header">
        <div>
          <h2>Personal To-do List</h2>
          <p>This module is already separated so it can later grow into its own assistant workflow.</p>
        </div>
        <span className="status-chip">{todos.length} items</span>
      </div>
      <div className="inline-row">
        <div className="field">
          <label htmlFor="todo-draft">New to-do</label>
          <input
            id="todo-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a personal action or reminder"
          />
        </div>
        <button
          className="primary-button inline-action"
          type="button"
          onClick={() => {
            onAdd(draft);
            setDraft("");
          }}
        >
          Add
        </button>
      </div>
      <div className="field">
        <label htmlFor="todo-filter">Filter to-dos</label>
        <input
          id="todo-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search item text, comments, or source sessions"
        />
      </div>
      <table className="todo-table">
        <thead>
          <tr>
            <th>Done</th>
            <th>Item</th>
            <th>Date added</th>
            <th>Source sessions</th>
            <th>Remove</th>
          </tr>
        </thead>
        <tbody>
          {filteredTodos.map((todo) => (
            <tr key={todo.id}>
              <td>
                <input
                  type="checkbox"
                  checked={todo.isDone}
                  onChange={() => onToggle({ ...todo, isDone: !todo.isDone })}
                />
              </td>
              <td>{todo.description}</td>
              <td>{todo.createdAt.slice(0, 10)}</td>
              <td>{todo.sessionIds.length}</td>
              <td>
                <button className="small-button danger-button" type="button" onClick={() => onDelete(todo.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
