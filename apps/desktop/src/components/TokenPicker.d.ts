interface TokenPickerProps {
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
export declare const TokenPicker: ({ value, savedOptions, suggestedOptions, placeholder, helperText, suggestionSummary, suggestionBadgeText, mode, onChange, }: TokenPickerProps) => import("react/jsx-runtime").JSX.Element;
export {};
