import { useEffect, useMemo, useRef, useState } from "react";
import type { TodoRecord } from "@notesmith/domain";

type TodoSortKey = "createdAt" | "description" | "domain" | "project" | "activity" | "doOn" | "dueDate";

interface TodosWorkspaceProps {
  todos: TodoRecord[];
  requestedTodoId?: string | null;
  onEditorClose?: () => void;
  onToggle: (todo: TodoRecord) => void;
  onAdd: (description: string) => void;
  onSave: (todo: TodoRecord) => void;
  onDelete: (id: string) => void;
  onConvertToActivity: (todo: TodoRecord) => void;
}

const createBlankTodoDraft = (description = ""): TodoRecord => ({
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

const normalizeValue = (value: string) => value.trim().toLowerCase();

export const TodosWorkspace = ({ todos, requestedTodoId, onEditorClose, onToggle, onAdd, onSave, onDelete, onConvertToActivity }: TodosWorkspaceProps) => {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<TodoSortKey>("dueDate");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<TodoRecord>(createBlankTodoDraft());
  const detailsEditorRef = useRef<HTMLDivElement | null>(null);

  const openTodos = useMemo(() => todos.filter((todo) => !todo.isDone), [todos]);
  const filteredAndSortedTodos = useMemo(() => {
    const normalized = normalizeValue(query);
    const filtered = !normalized
      ? openTodos
      : openTodos.filter((todo) =>
          [
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
            .includes(normalized),
        );

    const valueForSort = (todo: TodoRecord) => {
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
    if (!editingTodoId) return;
    const todo = todos.find((entry) => entry.id === editingTodoId);
    if (!todo) {
      setEditingTodoId(null);
      setEditingDraft(createBlankTodoDraft());
      return;
    }
    setEditingDraft(todo);
  }, [editingTodoId, todos]);

  useEffect(() => {
    if (!detailsEditorRef.current) return;
    const nextHtml = editingDraft.detailsHtml || "<p></p>";
    if (detailsEditorRef.current.innerHTML !== nextHtml) {
      detailsEditorRef.current.innerHTML = nextHtml;
    }
  }, [editingTodoId, editingDraft.detailsHtml]);

  const submitDraft = () => {
    const nextValue = draft.trim();
    if (!nextValue) return;
    onAdd(nextValue);
    setDraft("");
  };

  const closeEditor = () => {
    setEditingTodoId(null);
    onEditorClose?.();
  };

  const sortOptions: Array<{ value: TodoSortKey; label: string }> = [
    { value: "dueDate", label: "Due date" },
    { value: "doOn", label: "Do on" },
    { value: "createdAt", label: "Created" },
    { value: "description", label: "Title" },
    { value: "domain", label: "Domain" },
    { value: "project", label: "Project" },
    { value: "activity", label: "Activity" },
  ];

  return (
    <div className="card todos-workspace todos-workspace-minimal">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Todos</h2>
        </div>
      </div>

      <div className="todos-workspace-input-row">
        <div className="field field-wide">
          <label htmlFor="todos-workspace-draft">New todo</label>
          <input
            id="todos-workspace-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitDraft();
              }
            }}
            placeholder="Add a focused next action"
          />
        </div>
        <button className="primary-button" type="button" onClick={submitDraft}>
          Add
        </button>
      </div>

      <div className="todos-workspace-toolbar">
        <div className="field field-wide">
          <label htmlFor="todos-workspace-filter">Search</label>
          <input
            id="todos-workspace-filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter todos"
          />
        </div>
        <div className="field">
          <label htmlFor="todos-workspace-sort">Sort by</label>
          <select id="todos-workspace-sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as TodoSortKey)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="status-chip">{openTodos.length} open</span>
        <span className="status-chip">{todos.length - openTodos.length} done</span>
      </div>

      <div className="todos-workspace-table">
        <div className="todos-workspace-row todos-workspace-row-header">
          <span>Done</span>
          <span>Todo</span>
          <span>Private</span>
          <span>Domain</span>
          <span>Project</span>
          <span>Activity</span>
          <span>Do on</span>
          <span>Due</span>
          <span>Created</span>
          <span />
        </div>
        {filteredAndSortedTodos.length ? (
          filteredAndSortedTodos.map((todo) => (
            <div
              key={todo.id}
              className="todos-workspace-row"
              onDoubleClick={() => setEditingTodoId(todo.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setEditingTodoId(todo.id);
                }
              }}
            >
              <span>
                <input
                  type="checkbox"
                  checked={todo.isDone}
                  onChange={() => onToggle({ ...todo, isDone: !todo.isDone })}
                />
              </span>
              <span className="todos-cell-strong">{todo.description}</span>
              <span>{todo.isPrivate ? "Yes" : "No"}</span>
              <span>{todo.domain || "—"}</span>
              <span>{todo.project || "—"}</span>
              <span>{todo.activity || "—"}</span>
              <span>{todo.doOn || "—"}</span>
              <span>{todo.dueDate || "—"}</span>
              <span>{todo.createdAt.slice(0, 10)}</span>
              <span>
                <button
                  className="small-button danger-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(todo.id);
                  }}
                >
                  Delete
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state-card compact-empty-state">
            <h3>No open todos</h3>
            <p>Capture the next action here, or type `td` followed by text in any input across the app.</p>
          </div>
        )}
      </div>

      {completedTodos.length ? (
        <details className="workspace-disclosure">
          <summary>Recently completed</summary>
          <div className="workspace-disclosure-body todos-workspace-completed">
            {completedTodos.map((todo) => (
              <label key={todo.id} className="todos-workspace-main todos-workspace-main-completed">
                <input
                  type="checkbox"
                  checked={todo.isDone}
                  onChange={() => onToggle({ ...todo, isDone: !todo.isDone })}
                />
                <span className="todos-workspace-copy">
                  <strong>{todo.description}</strong>
                  <span className="muted">{todo.createdAt.slice(0, 10)}</span>
                </span>
              </label>
            ))}
          </div>
        </details>
      ) : null}

      {editingTodoId ? (
        <div className="overlay-backdrop todos-editor-backdrop" role="presentation" onClick={closeEditor}>
          <div className="overlay-surface todos-editor-surface" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-header">
              <div>
                <strong>Edit todo</strong>
              </div>
              <button className="small-button" type="button" onClick={closeEditor}>
                Close
              </button>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="todo-edit-description">Todo</label>
                <input
                  id="todo-edit-description"
                  value={editingDraft.description}
                  onChange={(event) => setEditingDraft({ ...editingDraft, description: event.target.value })}
                />
              </div>
              <div className="metadata-triplet-grid">
                <div className="field metadata-subfield">
                  <label htmlFor="todo-edit-domain">Domain</label>
                  <input
                    id="todo-edit-domain"
                    value={editingDraft.domain}
                    onChange={(event) => setEditingDraft({ ...editingDraft, domain: event.target.value })}
                  />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="todo-edit-project">Project</label>
                  <input
                    id="todo-edit-project"
                    value={editingDraft.project}
                    onChange={(event) => setEditingDraft({ ...editingDraft, project: event.target.value })}
                  />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="todo-edit-activity">Activity</label>
                  <input
                    id="todo-edit-activity"
                    value={editingDraft.activity}
                    onChange={(event) => setEditingDraft({ ...editingDraft, activity: event.target.value })}
                  />
                </div>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="todo-edit-do-on">Do on</label>
                  <input
                    id="todo-edit-do-on"
                    type="date"
                    value={editingDraft.doOn}
                    onChange={(event) => setEditingDraft({ ...editingDraft, doOn: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="todo-edit-due-date">Due date</label>
                  <input
                    id="todo-edit-due-date"
                    type="date"
                    value={editingDraft.dueDate}
                    onChange={(event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value })}
                  />
                </div>
                <div className="field todo-private-field">
                  <span>Private</span>
                  <div className="compact-private-toggle">
                    <input
                      id="todo-edit-private"
                      type="checkbox"
                      checked={editingDraft.isPrivate}
                      onChange={(event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked })}
                    />
                    <label htmlFor="todo-edit-private" className="checkbox-label">
                      Private
                    </label>
                  </div>
                </div>
              </div>
              <div className="field">
                <label htmlFor="todo-edit-details">Details</label>
                <div
                  id="todo-edit-details"
                  ref={detailsEditorRef}
                  className="rich-text-surface todo-rich-text-surface"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) =>
                    setEditingDraft({
                      ...editingDraft,
                      detailsHtml: (event.currentTarget as HTMLDivElement).innerHTML,
                    })
                  }
                />
              </div>
              <div className="page-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    onSave({ ...editingDraft });
                    closeEditor();
                  }}
                >
                  Save
                </button>
                <button
                  className="shell-button"
                  type="button"
                  onClick={() => {
                    onConvertToActivity(editingDraft);
                    closeEditor();
                  }}
                >
                  Convert to activity
                </button>
                <button className="small-button" type="button" onClick={closeEditor}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
