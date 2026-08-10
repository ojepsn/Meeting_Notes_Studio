interface TodoDetailsEditorProps {
    value: string;
    onChange: (value: string) => void;
    id?: string;
    compact?: boolean;
    placeholder?: string;
}
export declare const TodoDetailsEditor: ({ value, onChange, id, compact, placeholder, }: TodoDetailsEditorProps) => import("react/jsx-runtime").JSX.Element;
export {};
