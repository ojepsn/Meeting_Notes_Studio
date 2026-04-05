import type { TodoRecord } from "@notesmith/domain";
interface TodosSidebarProps {
    todos: TodoRecord[];
    onToggle: (todo: TodoRecord) => void;
    onAdd: (description: string) => void;
    onDelete: (id: string) => void;
    onOpenAll: () => void;
}
export declare const TodosSidebar: ({ todos, onToggle, onAdd, onDelete, onOpenAll }: TodosSidebarProps) => import("react/jsx-runtime").JSX.Element;
export {};
