import type { TodoRecord } from "@notesmith/domain";
interface TodosCardProps {
    todos: TodoRecord[];
    onToggle: (todo: TodoRecord) => void;
    onAdd: (description: string) => void;
    onDelete: (id: string) => void;
}
export declare const TodosCard: ({ todos, onToggle, onAdd, onDelete }: TodosCardProps) => import("react/jsx-runtime").JSX.Element;
export {};
