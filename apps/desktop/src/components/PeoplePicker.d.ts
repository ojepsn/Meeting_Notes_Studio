interface PeoplePickerProps {
    value: string;
    savedPeople: string[];
    suggestedPeople: string[];
    placeholder?: string;
    mode?: "single" | "multi";
    onChange: (value: string) => void;
}
export declare const PeoplePicker: ({ value, savedPeople, suggestedPeople, placeholder, mode, onChange, }: PeoplePickerProps) => import("react/jsx-runtime").JSX.Element;
export {};
