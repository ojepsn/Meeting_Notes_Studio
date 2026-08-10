import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  headerActions?: ReactNode;
}

export interface NotebookTodoFilters {
  query: string;
  showBusiness: boolean;
  showPrivate: boolean;
  urgentOnly: boolean;
  priority: "all" | TodoPriority;
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

const searchableTodoText = (todo: TodoRecord) => [
  todo.description,
  todo.domain,
  todo.project,
  todo.activity,
  todo.comments,
  todo.detailsHtml?.replace(/<[^>]*>/g, " "),
].filter(Boolean).join(" ").toLocaleLowerCase();

export const filterNotebookTodos = (todos: TodoRecord[], filters: NotebookTodoFilters) => {
  const query = filters.query.trim().toLocaleLowerCase();
  return todos.filter((todo) => {
    if (todo.isPrivate ? !filters.showPrivate : !filters.showBusiness) return false;
    if (filters.urgentOnly && !todo.isUrgent) return false;
    if (filters.priority !== "all" && getTodoPriority(todo) !== filters.priority) return false;
    return !query || searchableTodoText(todo).includes(query);
  });
};

export const applyNotebookTodoCompletionAnchors = (todos: TodoRecord[], anchors: Record<string, number>) => {
  const ordered = [...todos];
  Object.entries(anchors)
    .sort((left, right) => left[1] - right[1])
    .forEach(([todoId, targetIndex]) => {
      const currentIndex = ordered.findIndex((todo) => todo.id === todoId);
      if (currentIndex < 0) return;
      const [anchoredTodo] = ordered.splice(currentIndex, 1);
      ordered.splice(Math.min(targetIndex, ordered.length), 0, anchoredTodo);
    });
  return ordered;
};

export const NotebookTodosPanel = ({ todos, onAddTodo, onSaveTodo, onAddNote, headerActions }: NotebookTodosPanelProps) => {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<"priority" | "title" | "created" | "updated" | "due">("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showBusiness, setShowBusiness] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | TodoPriority>("all");
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [completionAnchors, setCompletionAnchors] = useState<Record<string, number>>({});
  const openTodoCount = useMemo(() => todos.filter((todo) => !todo.isDone).length, [todos]);
  const visibleByCompletion = useMemo(
    () => showCompleted ? todos : todos.filter((todo) => !todo.isDone),
    [showCompleted, todos],
  );
  const filteredTodos = useMemo(
    () => filterNotebookTodos(visibleByCompletion, { query, showBusiness, showPrivate, urgentOnly, priority: priorityFilter }),
    [priorityFilter, query, showBusiness, showPrivate, urgentOnly, visibleByCompletion],
  );
  const sort = `${sortField}-${sortDirection}` as NotebookTodoSort;
  const sortedTodos = useMemo(
    () => applyNotebookTodoCompletionAnchors(sortNotebookTodos(filteredTodos, sort), completionAnchors),
    [completionAnchors, filteredTodos, sort],
  );
  const selectedTodo = visibleByCompletion.find((todo) => todo.id === selectedTodoId) || null;

  useEffect(() => {
    if (selectedTodoId && !visibleByCompletion.some((todo) => todo.id === selectedTodoId)) {
      setSelectedTodoId(null);
    }
  }, [selectedTodoId, visibleByCompletion]);

  useEffect(() => {
    setCompletionAnchors({});
  }, [priorityFilter, query, showBusiness, showCompleted, showPrivate, sortDirection, sortField, urgentOnly]);

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

  const setTodoDone = (todo: TodoRecord, isDone: boolean) => {
    if (isDone && !todo.isDone) {
      const currentIndex = sortedTodos.findIndex((entry) => entry.id === todo.id);
      if (currentIndex >= 0) {
        setCompletionAnchors((current) => ({ ...current, [todo.id]: currentIndex }));
      }
    } else if (!isDone) {
      setCompletionAnchors((current) => {
        const next = { ...current };
        delete next[todo.id];
        return next;
      });
    }
    onSaveTodo({ ...todo, isDone });
  };

  return (
    <section className="notebook-todos-section">
      <header className="notebook-todos-header">
        <div>
          <strong>Todos</strong>
          <span className="status-chip">{openTodoCount} open</span>
        </div>
        {headerActions}
      </header>
      <div className="notebook-todos-body">
        <div className="notebook-todos-controls">
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

          <label className="notebook-todo-search">
            <span>Filter</span>
            <input
              type="search"
              value={query}
              placeholder="Search title, details, project..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="notebook-todo-control-row">
            <fieldset className="notebook-todo-choice-group">
              <legend>Show</legend>
              <label><input type="checkbox" checked={showBusiness} onChange={(event) => setShowBusiness(event.target.checked)} /> Business</label>
              <label><input type="checkbox" checked={showPrivate} onChange={(event) => setShowPrivate(event.target.checked)} /> Private</label>
              <label><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Show completed</label>
              <label><input type="checkbox" checked={urgentOnly} onChange={(event) => setUrgentOnly(event.target.checked)} /> Urgent only</label>
            </fieldset>

            <fieldset className="notebook-todo-choice-group">
              <legend>Priority</legend>
              {(["all", "high", "normal", "low"] as const).map((priority) => (
                <label key={priority}>
                  <input
                    type="radio"
                    name="notebook-todo-priority-filter"
                    checked={priorityFilter === priority}
                    onChange={() => setPriorityFilter(priority)}
                  />
                  {priority === "all" ? "All" : priority[0].toUpperCase() + priority.slice(1)}
                </label>
              ))}
            </fieldset>
          </div>

          <div className="notebook-todo-sort-controls">
            <fieldset className="notebook-todo-choice-group">
              <legend>Sort by</legend>
              {([
                ["priority", "Priority"],
                ["title", "Title"],
                ["created", "Added"],
                ["updated", "Updated"],
                ["due", "Due date"],
              ] as const).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="notebook-todo-sort-field"
                    checked={sortField === value}
                    onChange={() => setSortField(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="notebook-todo-choice-group">
              <legend>Direction</legend>
              <label><input type="radio" name="notebook-todo-sort-direction" checked={sortDirection === "asc"} onChange={() => setSortDirection("asc")} /> Ascending</label>
              <label><input type="radio" name="notebook-todo-sort-direction" checked={sortDirection === "desc"} onChange={() => setSortDirection("desc")} /> Descending</label>
            </fieldset>
          </div>
        </div>

        <div className="notebook-todos-work-area">
          <div className="notebook-todo-list-pane">
            <div className="notebook-todo-results-row">
              <strong>{sortedTodos.length} shown</strong>
              {(query || urgentOnly || priorityFilter !== "all" || !showBusiness || !showPrivate || !showCompleted) ? (
                <button
                  className="small-button"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setShowBusiness(true);
                    setShowPrivate(true);
                    setShowCompleted(true);
                    setUrgentOnly(false);
                    setPriorityFilter("all");
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            <div className="notebook-todo-list" aria-label="Open todos">
              {sortedTodos.map((todo) => (
                <div
                  className="notebook-todo-row"
                  data-completed={todo.isDone}
                  data-selected={todo.id === selectedTodoId}
                  key={todo.id}
                >
                  <input
                    type="checkbox"
                    aria-label={`Mark ${todo.description} done`}
                    checked={todo.isDone}
                    onChange={(event) => setTodoDone(todo, event.target.checked)}
                  />
                  <button type="button" onClick={() => setSelectedTodoId(todo.id)}>
                    <strong>{todo.description}</strong>
                    <span>{getTodoPriority(todo)}{todo.isUrgent ? " | Urgent" : ""}{todo.doOn ? ` | ${todo.doOn}` : ""}</span>
                  </button>
                </div>
              ))}
              {!sortedTodos.length ? <p className="tiny-text">No todos match these filters.</p> : null}
            </div>
          </div>

          {selectedTodo ? (
            <div className="notebook-todo-editor" data-expanded="true">
            <div className="field">
              <label htmlFor="notebook-todo-title">Todo</label>
              <input id="notebook-todo-title" value={selectedTodo.description} onChange={(event) => saveSelected({ description: event.target.value })} />
            </div>

            <div className="notebook-todo-checks">
              <label><input type="checkbox" checked={!selectedTodo.isPrivate} onChange={() => saveSelected({ isPrivate: false })} /> Business</label>
              <label><input type="checkbox" checked={selectedTodo.isPrivate} onChange={() => saveSelected({ isPrivate: true })} /> Private</label>
              <label><input type="checkbox" checked={Boolean(selectedTodo.isUrgent)} onChange={(event) => saveSelected({ isUrgent: event.target.checked })} /> Urgent</label>
              <label><input type="checkbox" checked={selectedTodo.isDone} onChange={(event) => setTodoDone(selectedTodo, event.target.checked)} /> Done</label>
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
          ) : (
            <div className="notebook-todo-empty-editor">
              <strong>Select a todo</strong>
              <p>Its editable fields and rich-text details will open here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
