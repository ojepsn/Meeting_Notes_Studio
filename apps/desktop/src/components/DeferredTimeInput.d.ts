import { type InputHTMLAttributes } from "react";
type DeferredTimeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "type" | "value"> & {
    value: string;
    onCommit: (value: string) => void;
    onDraftChange?: (value: string) => void;
};
export declare const DeferredTimeInput: ({ value, onCommit, onDraftChange, onBlur, onFocus, onKeyDown, ...props }: DeferredTimeInputProps) => import("react/jsx-runtime").JSX.Element;
export {};
