import type { TodoRecord } from "@notesmith/domain";
interface TodosWorkspaceProps {
    todos: TodoRecord[];
    requestedTodoId?: string | null;
    onToggle: (todo: TodoRecord) => void;
    onAdd: (description: string) => void;
    onSave: (todo: TodoRecord) => void;
    onDelete: (id: string) => void;
    onConvertToActivity: (todo: TodoRecord) => void;
}
export declare const TodosWorkspace: ({ todos, requestedTodoId, onToggle, onAdd, onSave, onDelete, onConvertToActivity }: TodosWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
