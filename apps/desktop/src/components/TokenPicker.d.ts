interface TokenPickerProps {
    id?: string;
    value: string;
    savedOptions: string[];
    suggestedOptions: string[];
    placeholder: string;
    helperText?: string;
    suggestionSummary?: string;
    suggestionBadgeText?: string;
    mode?: "single" | "multi";
    onChange: (value: string) => void;
}
export declare const TokenPicker: (props: TokenPickerProps) => import("react/jsx-runtime").JSX.Element;
export {};
