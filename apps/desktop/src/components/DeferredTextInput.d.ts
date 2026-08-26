import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
interface DeferredTextProps {
    value: string;
    onCommit: (value: string) => void;
    onDraftChange?: (value: string) => void;
    commitDelayMs?: number;
}
type DeferredTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "value"> & DeferredTextProps;
type DeferredTextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "defaultValue" | "onChange" | "value"> & DeferredTextProps;
export declare const DeferredTextInput: ({ value, onCommit, onDraftChange, commitDelayMs, onBlur, onFocus, onKeyDown, onCompositionStart, onCompositionEnd, ...props }: DeferredTextInputProps) => import("react/jsx-runtime").JSX.Element;
export declare const DeferredTextArea: ({ value, onCommit, onDraftChange, commitDelayMs, onBlur, onFocus, onKeyDown, onCompositionStart, onCompositionEnd, ...props }: DeferredTextAreaProps) => import("react/jsx-runtime").JSX.Element;
export {};
