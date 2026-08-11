import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  onDeleteTodo: (todoId: string) => void;
  onAddNote: (todoId: string) => void;
  headerActions?: ReactNode;
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onHeaderPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onHeaderPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface NotebookTodoFilters {
  query: string;
  showBusiness: boolean;
  showPrivate: boolean;
  urgentOnly: boolean;
  priority: "all" | TodoPriority;
}

type NotebookTodoSortField = "priority" | "title" | "created" | "updated" | "due";
type NotebookTodoSortDirection = "asc" | "desc";

export interface NotebookTodoViewSettings {
  sortField: NotebookTodoSortField;
  sortDirection: NotebookTodoSortDirection;
  showBusiness: boolean;
  showPrivate: boolean;
  showCompleted: boolean;
  urgentOnly: boolean;
  priorityFilter: "all" | TodoPriority;
}

export const DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS: NotebookTodoViewSettings = {
  sortField: "priority",
  sortDirection: "desc",
  showBusiness: true,
  showPrivate: true,
  showCompleted: true,
  urgentOnly: false,
  priorityFilter: "all",
};

const NOTEBOOK_TODO_VIEW_SETTINGS_KEY = "notesmith:notebook-todo-view-settings";
const TODO_SORT_FIELDS: NotebookTodoSortField[] = ["priority", "title", "created", "updated", "due"];
const TODO_PRIORITIES: NotebookTodoViewSettings["priorityFilter"][] = ["all", "low", "normal", "high"];

export const normalizeNotebookTodoViewSettings = (value: unknown): NotebookTodoViewSettings => {
  const saved = value && typeof value === "object" ? value as Partial<NotebookTodoViewSettings> : {};
  return {
    sortField: TODO_SORT_FIELDS.includes(saved.sortField as NotebookTodoSortField)
      ? saved.sortField as NotebookTodoSortField
      : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.sortField,
    sortDirection: saved.sortDirection === "asc" || saved.sortDirection === "desc"
      ? saved.sortDirection
      : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.sortDirection,
    showBusiness: typeof saved.showBusiness === "boolean" ? saved.showBusiness : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.showBusiness,
    showPrivate: typeof saved.showPrivate === "boolean" ? saved.showPrivate : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.showPrivate,
    showCompleted: typeof saved.showCompleted === "boolean" ? saved.showCompleted : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.showCompleted,
    urgentOnly: typeof saved.urgentOnly === "boolean" ? saved.urgentOnly : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.urgentOnly,
    priorityFilter: TODO_PRIORITIES.includes(saved.priorityFilter as NotebookTodoViewSettings["priorityFilter"])
      ? saved.priorityFilter as NotebookTodoViewSettings["priorityFilter"]
      : DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS.priorityFilter,
  };
};

const readNotebookTodoViewSettings = () => {
  try {
    return normalizeNotebookTodoViewSettings(JSON.parse(window.localStorage.getItem(NOTEBOOK_TODO_VIEW_SETTINGS_KEY) || "null"));
  } catch {
    return DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS;
  }
};

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

export const NotebookTodosPanel = ({
  todos,
  onAddTodo,
  onSaveTodo,
  onDeleteTodo,
  onAddNote,
  headerActions,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
}: NotebookTodosPanelProps) => {
  const [initialViewSettings] = useState(readNotebookTodoViewSettings);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<NotebookTodoSortField>(initialViewSettings.sortField);
  const [sortDirection, setSortDirection] = useState<NotebookTodoSortDirection>(initialViewSettings.sortDirection);
  const [showBusiness, setShowBusiness] = useState(initialViewSettings.showBusiness);
  const [showPrivate, setShowPrivate] = useState(initialViewSettings.showPrivate);
  const [showCompleted, setShowCompleted] = useState(initialViewSettings.showCompleted);
  const [urgentOnly, setUrgentOnly] = useState(initialViewSettings.urgentOnly);
  const [priorityFilter, setPriorityFilter] = useState<"all" | TodoPriority>(initialViewSettings.priorityFilter);
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

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTEBOOK_TODO_VIEW_SETTINGS_KEY, JSON.stringify({
        sortField,
        sortDirection,
        showBusiness,
        showPrivate,
        showCompleted,
        urgentOnly,
        priorityFilter,
      } satisfies NotebookTodoViewSettings));
    } catch {
      // The panel remains usable when local settings storage is unavailable.
    }
  }, [priorityFilter, showBusiness, showCompleted, showPrivate, sortDirection, sortField, urgentOnly]);

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
      <header
        className="notebook-todos-header"
        data-drag-handle
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div>
          <span className="notebook-todos-drag-grip" aria-hidden="true">::</span>
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
            <button
              className="primary-button notebook-todo-add-note-button"
              type="button"
              disabled={!selectedTodo}
              onClick={() => selectedTodo && onAddNote(selectedTodo.id)}
            >
              Add note
            </button>
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
                  <button
                    className="notebook-todo-date"
                    type="button"
                    title={todo.doOn ? `Do on ${todo.doOn}` : todo.dueDate ? `Due ${todo.dueDate}` : "No date set"}
                    onClick={() => setSelectedTodoId(todo.id)}
                  >
                    {todo.doOn || todo.dueDate || "No date"}
                  </button>
                  <input
                    type="checkbox"
                    aria-label={`Mark ${todo.description} done`}
                    checked={todo.isDone}
                    onChange={(event) => setTodoDone(todo, event.target.checked)}
                  />
                  <button className="notebook-todo-select" type="button" onClick={() => setSelectedTodoId(todo.id)}>
                    <strong>{todo.description}</strong>
                    <span className="notebook-todo-priority">{getTodoPriority(todo)}</span>
                    {todo.isUrgent ? <span className="notebook-todo-urgent">Urgent</span> : null}
                  </button>
                  <button
                    className="notebook-todo-delete"
                    type="button"
                    aria-label={`Delete ${todo.description}`}
                    title="Delete todo"
                    onClick={() => onDeleteTodo(todo.id)}
                  >
                    x
                  </button>
                </div>
              ))}
              {!sortedTodos.length ? <p className="tiny-text">No todos match these filters.</p> : null}
            </div>
          </div>

          {selectedTodo ? (
            <div className="notebook-todo-editor" data-expanded="true">
            <div className="field notebook-todo-title-field">
              <label htmlFor="notebook-todo-title">Todo</label>
              <input id="notebook-todo-title" value={selectedTodo.description} onChange={(event) => saveSelected({ description: event.target.value })} />
            </div>

            <div className="notebook-todo-checks">
              <div className="notebook-todo-choice-group" role="radiogroup" aria-label="Todo type">
                <span>Type</span>
                <label><input type="radio" name={`notebook-todo-type-${selectedTodo.id}`} checked={!selectedTodo.isPrivate} onChange={() => saveSelected({ isPrivate: false })} /> Business</label>
                <label><input type="radio" name={`notebook-todo-type-${selectedTodo.id}`} checked={selectedTodo.isPrivate} onChange={() => saveSelected({ isPrivate: true })} /> Private</label>
              </div>
              <div className="notebook-todo-choice-group" role="radiogroup" aria-label="Todo priority">
                <span>Priority</span>
                {(["low", "normal", "high"] as const).map((priority) => (
                  <label key={priority}>
                    <input
                      type="radio"
                      name={`notebook-todo-priority-${selectedTodo.id}`}
                      checked={getTodoPriority(selectedTodo) === priority}
                      onChange={() => saveSelected({ priority, isPriority: priority === "high" })}
                    />
                    {priority[0].toUpperCase() + priority.slice(1)}
                  </label>
                ))}
              </div>
              <label><input type="checkbox" checked={Boolean(selectedTodo.isUrgent)} onChange={(event) => saveSelected({ isUrgent: event.target.checked })} /> Urgent</label>
              <label><input type="checkbox" checked={selectedTodo.isDone} onChange={(event) => setTodoDone(selectedTodo, event.target.checked)} /> Done</label>
            </div>

            <div className="notebook-todo-meta-grid">
              <label>
                <span>Do on</span>
                <DateInput id="notebook-todo-do-on" value={selectedTodo.doOn} onChange={(event) => saveSelected({ doOn: event.target.value })} />
              </label>
              <label>
                <span>Due date</span>
                <DateInput id="notebook-todo-due" value={selectedTodo.dueDate} onChange={(event) => saveSelected({ dueDate: event.target.value })} />
              </label>
            </div>

            <div className="notebook-todo-context-grid">
              <label className="notebook-todo-context-wide">
                <span>Participants</span>
                <input
                  value={selectedTodo.participantText || ""}
                  placeholder="People involved"
                  onChange={(event) => saveSelected({ participantText: event.target.value })}
                />
              </label>
              <label>
                <span>Domain</span>
                <input value={selectedTodo.domain} onChange={(event) => saveSelected({ domain: event.target.value })} />
              </label>
              <label>
                <span>Project</span>
                <input value={selectedTodo.project} onChange={(event) => saveSelected({ project: event.target.value })} />
              </label>
              <label>
                <span>Activity</span>
                <input value={selectedTodo.activity} onChange={(event) => saveSelected({ activity: event.target.value })} />
              </label>
            </div>

            <div className="field notebook-todo-details-field">
              <label htmlFor="notebook-todo-details">Todo details</label>
              <TodoDetailsEditor
                id="notebook-todo-details"
                compact
                value={selectedTodo.detailsHtml}
                onChange={(detailsHtml) => saveSelected({ detailsHtml })}
              />
            </div>

            <div className="notebook-todo-record-meta" aria-label="Todo record information">
              <span>Created {new Date(selectedTodo.createdAt).toLocaleString()}</span>
              <span>Updated {new Date(selectedTodo.updatedAt || selectedTodo.createdAt).toLocaleString()}</span>
              <span>{selectedTodo.sessionIds.length} linked {selectedTodo.sessionIds.length === 1 ? "note" : "notes"}</span>
            </div>

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
