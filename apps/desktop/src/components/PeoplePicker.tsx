import { TokenPicker } from "./TokenPicker";

interface PeoplePickerProps {
  value: string;
  savedPeople: string[];
  suggestedPeople: string[];
  placeholder?: string;
  mode?: "single" | "multi";
  onChange: (value: string) => void;
}

export const PeoplePicker = ({
  value,
  savedPeople,
  suggestedPeople,
  placeholder = "Search or add people",
  mode = "multi",
  onChange,
}: PeoplePickerProps) => (
  <TokenPicker
    value={value}
    savedOptions={savedPeople}
    suggestedOptions={suggestedPeople}
    placeholder={placeholder}
    suggestionSummary="Recent people"
    suggestionBadgeText="From saved People"
    mode={mode}
    onChange={onChange}
  />
);
