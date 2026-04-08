import { jsx as _jsx } from "react/jsx-runtime";
import { TokenPicker } from "./TokenPicker";
export const PeoplePicker = ({ value, savedPeople, suggestedPeople, placeholder = "Search or add people", mode = "multi", onChange, }) => (_jsx(TokenPicker, { value: value, savedOptions: savedPeople, suggestedOptions: suggestedPeople, placeholder: placeholder, suggestionSummary: "Recent people", suggestionBadgeText: "From saved People", mode: mode, onChange: onChange }));
