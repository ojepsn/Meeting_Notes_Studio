interface PeoplePickerProps {
    value: string;
    savedPeople: string[];
    suggestedPeople: string[];
    placeholder?: string;
    onChange: (value: string) => void;
}
export declare const PeoplePicker: ({ value, savedPeople, suggestedPeople, placeholder, onChange, }: PeoplePickerProps) => import("react/jsx-runtime").JSX.Element;
export {};
