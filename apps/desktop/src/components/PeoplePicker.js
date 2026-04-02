import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
const parsePeople = (value) => Array.from(new Map(value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => [entry.toLocaleLowerCase(), entry])).values());
export const PeoplePicker = ({ value, savedPeople, placeholder = "Add people", onChange }) => {
    const [draft, setDraft] = useState("");
    const selectedPeople = useMemo(() => parsePeople(value), [value]);
    const selectedKeys = useMemo(() => new Set(selectedPeople.map((entry) => entry.toLocaleLowerCase())), [selectedPeople]);
    const suggestedPeople = useMemo(() => savedPeople.filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
    }), [savedPeople, selectedKeys]);
    const filteredSuggestions = useMemo(() => {
        const query = draft.trim().toLocaleLowerCase();
        if (!query)
            return suggestedPeople.slice(0, 8);
        return suggestedPeople.filter((entry) => entry.toLocaleLowerCase().includes(query)).slice(0, 8);
    }, [draft, suggestedPeople]);
    const commitPeople = (people) => {
        onChange(people.join(", "));
    };
    const addPerson = (rawValue) => {
        const nextValue = rawValue.trim();
        if (!nextValue)
            return;
        if (selectedKeys.has(nextValue.toLocaleLowerCase())) {
            setDraft("");
            return;
        }
        commitPeople([...selectedPeople, nextValue]);
        setDraft("");
    };
    const removePerson = (person) => {
        commitPeople(selectedPeople.filter((entry) => entry !== person));
    };
    return (_jsxs("div", { className: "people-picker", children: [selectedPeople.length ? (_jsx("div", { className: "people-chip-list", children: selectedPeople.map((person) => (_jsxs("span", { className: "people-chip", children: [_jsx("span", { children: person }), _jsx("button", { type: "button", className: "people-chip-remove", onClick: () => removePerson(person), "aria-label": `Remove ${person}`, children: "\u00D7" })] }, person))) })) : null, _jsxs("div", { className: "people-input-row", children: [_jsx("input", { value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                            if (event.key === "Enter" || event.key === "," || event.key === ";") {
                                event.preventDefault();
                                addPerson(draft);
                            }
                            if (event.key === "Backspace" && !draft && selectedPeople.length) {
                                removePerson(selectedPeople[selectedPeople.length - 1]);
                            }
                        }, placeholder: placeholder }), _jsx("button", { className: "small-button", type: "button", onClick: () => addPerson(draft), children: "Add" })] }), filteredSuggestions.length ? (_jsx("div", { className: "people-suggestion-row", children: filteredSuggestions.map((person) => (_jsx("button", { type: "button", className: "people-suggestion-chip", onClick: () => addPerson(person), children: person }, person))) })) : null] }));
};
