import { type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { TodoPriority, TodoRecord } from "@notesmith/domain";
export type NotebookTodoSort = "priority-desc" | "priority-asc" | "title-asc" | "title-desc" | "created-desc" | "created-asc" | "updated-desc" | "updated-asc" | "due-asc" | "due-desc";
interface NotebookTodosPanelProps {
    todos: TodoRecord[];
    runningTodoIds: string[];
    onAddTodo: (description: string) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onDeleteTodo: (todoId: string) => void;
    onAddNote: (todoId: string) => void;
    onToggleTime: (todoId: string, isRunning: boolean) => void;
    headerActions?: ReactNode;
    onHeaderPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
    onHeaderPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
    onHeaderPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
}
export interface NotebookTodoFilters {
    query: string;
    domain: string;
    project: string;
    activity: string;
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
    domainFilter: string;
    projectFilter: string;
    activityFilter: string;
}
export declare const DEFAULT_NOTEBOOK_TODO_VIEW_SETTINGS: NotebookTodoViewSettings;
export declare const normalizeNotebookTodoViewSettings: (value: unknown) => NotebookTodoViewSettings;
export declare const sortNotebookTodos: (todos: TodoRecord[], sort: NotebookTodoSort) => TodoRecord[];
export declare const filterNotebookTodos: (todos: TodoRecord[], filters: NotebookTodoFilters) => TodoRecord[];
export declare const applyNotebookTodoCompletionAnchors: (todos: TodoRecord[], anchors: Record<string, number>) => TodoRecord[];
export declare const NotebookTodosPanel: ({ todos, runningTodoIds, onAddTodo, onSaveTodo, onDeleteTodo, onAddNote, onToggleTime, headerActions, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp, }: NotebookTodosPanelProps) => import("react/jsx-runtime").JSX.Element;
export {};
