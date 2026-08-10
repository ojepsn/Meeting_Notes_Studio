import type { TodoRecord } from "@notesmith/domain";
export type NotebookTodoSort = "priority-desc" | "priority-asc" | "title-asc" | "title-desc" | "created-desc" | "created-asc" | "updated-desc" | "updated-asc" | "due-asc" | "due-desc";
interface NotebookTodosPanelProps {
    todos: TodoRecord[];
    onAddTodo: (description: string) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onAddNote: (todoId: string) => void;
}
export declare const sortNotebookTodos: (todos: TodoRecord[], sort: NotebookTodoSort) => TodoRecord[];
export declare const NotebookTodosPanel: ({ todos, onAddTodo, onSaveTodo, onAddNote }: NotebookTodosPanelProps) => import("react/jsx-runtime").JSX.Element;
export {};
