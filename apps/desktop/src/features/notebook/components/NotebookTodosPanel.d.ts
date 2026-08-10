import { type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { TodoPriority, TodoRecord } from "@notesmith/domain";
export type NotebookTodoSort = "priority-desc" | "priority-asc" | "title-asc" | "title-desc" | "created-desc" | "created-asc" | "updated-desc" | "updated-asc" | "due-asc" | "due-desc";
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
export declare const sortNotebookTodos: (todos: TodoRecord[], sort: NotebookTodoSort) => TodoRecord[];
export declare const filterNotebookTodos: (todos: TodoRecord[], filters: NotebookTodoFilters) => TodoRecord[];
export declare const applyNotebookTodoCompletionAnchors: (todos: TodoRecord[], anchors: Record<string, number>) => TodoRecord[];
export declare const NotebookTodosPanel: ({ todos, onAddTodo, onSaveTodo, onDeleteTodo, onAddNote, headerActions, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp, }: NotebookTodosPanelProps) => import("react/jsx-runtime").JSX.Element;
export {};
