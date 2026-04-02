import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
const parsePeople = (value) => Array.from(new Map(value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => [entry.toLocaleLowerCase(), entry])).values());
export const PeoplePicker = ({ value, savedPeople, suggestedPeople, placeholder = "Search or add people", onChange, }) => {
    const [draft, setDraft] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const selectedPeople = useMemo(() => parsePeople(value), [value]);
    const selectedKeys = useMemo(() => new Set(selectedPeople.map((entry) => entry.toLocaleLowerCase())), [selectedPeople]);
    useEffect(() => {
        setActiveIndex(0);
    }, [draft]);
    const availablePeople = useMemo(() => savedPeople.filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
    }), [savedPeople, selectedKeys]);
    const quickSuggestions = useMemo(() => suggestedPeople
        .filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
    })
        .slice(0, 6), [selectedKeys, suggestedPeople]);
    const filteredSuggestions = useMemo(() => {
        const query = draft.trim().toLocaleLowerCase();
        if (!query)
            return [];
        const prefixMatches = [];
        const containsMatches = [];
        availablePeople.forEach((entry) => {
            const normalized = entry.toLocaleLowerCase();
            if (normalized.startsWith(query)) {
                prefixMatches.push(entry);
            }
            else if (normalized.includes(query)) {
                containsMatches.push(entry);
            }
        });
        return [...prefixMatches, ...containsMatches].slice(0, 8);
    }, [availablePeople, draft]);
    const commitPeople = (people) => {
        onChange(people.join(", "));
    };
    const addPeople = (rawValue) => {
        const nextEntries = parsePeople(rawValue).filter((entry) => !selectedKeys.has(entry.toLocaleLowerCase()));
        if (!nextEntries.length) {
            setDraft("");
            return;
        }
        commitPeople([...selectedPeople, ...nextEntries]);
        setDraft("");
    };
    const removePerson = (person) => {
        commitPeople(selectedPeople.filter((entry) => entry !== person));
    };
    const replaceDraftWithSuggestion = (person) => {
        addPeople(person);
    };
    const handleDraftChange = (nextDraft) => {
        const hasDelimiter = /[\n,;]/.test(nextDraft);
        if (!hasDelimiter) {
            setDraft(nextDraft);
            return;
        }
        const endsWithDelimiter = /[\n,;]\s*$/.test(nextDraft);
        const segments = nextDraft.split(/[\n,;]+/);
        const trailingDraft = endsWithDelimiter ? "" : (segments.pop() ?? "");
        const committedSegments = segments.join(", ");
        if (committedSegments.trim()) {
            addPeople(committedSegments);
        }
        setDraft(trailingDraft.trimStart());
    };
    return (_jsxs("div", { className: "people-picker", children: [_jsxs("div", { className: "people-field-shell", children: [selectedPeople.map((person) => (_jsxs("span", { className: "people-token", children: [_jsx("span", { children: person }), _jsx("button", { type: "button", className: "people-token-remove", onClick: () => removePerson(person), "aria-label": `Remove ${person}`, children: "\u00D7" })] }, person))), _jsx("input", { value: draft, onChange: (event) => handleDraftChange(event.target.value), onKeyDown: (event) => {
                            if (event.key === "ArrowDown" && filteredSuggestions.length) {
                                event.preventDefault();
                                setActiveIndex((current) => (current + 1) % filteredSuggestions.length);
                                return;
                            }
                            if (event.key === "ArrowUp" && filteredSuggestions.length) {
                                event.preventDefault();
                                setActiveIndex((current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length);
                                return;
                            }
                            if (event.key === "Enter") {
                                event.preventDefault();
                                if (filteredSuggestions.length && draft.trim()) {
                                    replaceDraftWithSuggestion(filteredSuggestions[Math.min(activeIndex, filteredSuggestions.length - 1)] ?? draft);
                                }
                                else if (draft.trim()) {
                                    addPeople(draft);
                                }
                                return;
                            }
                            if ((event.key === "," || event.key === ";") && draft.trim()) {
                                return;
                            }
                            if (event.key === "Backspace" && !draft && selectedPeople.length) {
                                removePerson(selectedPeople[selectedPeople.length - 1]);
                            }
                            if (event.key === "Escape") {
                                setActiveIndex(0);
                            }
                        }, onBlur: () => {
                            if (draft.trim()) {
                                addPeople(draft);
                            }
                        }, placeholder: selectedPeople.length ? "" : placeholder })] }), draft.trim() && filteredSuggestions.length ? (_jsx("div", { className: "people-results-panel", role: "listbox", "aria-label": "Matching people", children: filteredSuggestions.map((person, index) => (_jsxs("button", { type: "button", className: "people-result-item", "data-active": index === activeIndex, onMouseEnter: () => setActiveIndex(index), onMouseDown: (event) => event.preventDefault(), onClick: () => replaceDraftWithSuggestion(person), children: [_jsx("strong", { children: person }), _jsx("span", { children: "From saved People" })] }, person))) })) : null, quickSuggestions.length ? (_jsx("div", { className: "people-suggestion-row", children: quickSuggestions.map((person) => (_jsx("button", { type: "button", className: "people-suggestion-chip", onClick: () => addPeople(person), children: person }, person))) })) : null, _jsxs("p", { className: "people-helper-text", children: ["Type to search saved People. Press ", _jsx("kbd", { children: "Enter" }), ", comma, or semicolon to add a name. New names stay in this note and can be saved to People after output is generated."] })] }));
};
