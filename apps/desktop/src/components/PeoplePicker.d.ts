interface PeoplePickerProps {
    value: string;
    savedPeople: string[];
    placeholder?: string;
    onChange: (value: string) => void;
}
export declare const PeoplePicker: ({ value, savedPeople, placeholder, onChange }: PeoplePickerProps) => import("react/jsx-runtime").JSX.Element;
export {};
