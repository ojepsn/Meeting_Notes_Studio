import { TokenPicker } from "./TokenPicker";

interface PeoplePickerProps {
  value: string;
  savedPeople: string[];
  suggestedPeople: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}

export const PeoplePicker = ({
  value,
  savedPeople,
  suggestedPeople,
  placeholder = "Search or add people",
  onChange,
}: PeoplePickerProps) => (
  <TokenPicker
    value={value}
    savedOptions={savedPeople}
    suggestedOptions={suggestedPeople}
    placeholder={placeholder}
    helperText="Type to search saved People. Press Enter, comma, or semicolon to add a name. New names stay in this note and can be saved to People after output is generated."
    suggestionSummary="Recent people"
    suggestionBadgeText="From saved People"
    onChange={onChange}
  />
);
