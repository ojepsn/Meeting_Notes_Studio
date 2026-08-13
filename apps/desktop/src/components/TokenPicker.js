import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useState } from "react";
import { filterComboboxOptions } from "./comboboxUtils";
import { buildVisibleQuickSuggestions, parseTokenList } from "./peoplePickerUtils";
const SingleValueCombobox = ({ id, value, savedOptions, suggestedOptions, placeholder, suggestionBadgeText, onChange, }) => {
    const generatedId = useId();
    const inputId = id ?? `single-value-${generatedId}`;
    const listboxId = `${inputId}-choices`;
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const filteredOptions = useMemo(() => filterComboboxOptions([...savedOptions, ...suggestedOptions], isFiltering ? value : ""), [isFiltering, savedOptions, suggestedOptions, value]);
    useEffect(() => {
        setActiveIndex(0);
    }, [value]);
    const selectOption = (option) => {
        onChange(option);
        setIsFiltering(false);
        setIsOpen(false);
    };
    return (_jsxs("div", { className: "single-value-combobox", onBlur: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
                setIsOpen(false);
        }, children: [_jsx("input", { id: inputId, role: "combobox", "aria-autocomplete": "list", "aria-expanded": isOpen, "aria-controls": listboxId, "aria-activedescendant": isOpen && filteredOptions.length ? `${listboxId}-${activeIndex}` : undefined, value: value, placeholder: placeholder, autoComplete: "off", onFocus: (event) => {
                    event.currentTarget.select();
                    setIsFiltering(false);
                    setIsOpen(true);
                }, onChange: (event) => {
                    onChange(event.target.value);
                    setIsFiltering(true);
                    setIsOpen(true);
                }, onKeyDown: (event) => {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        const wasOpen = isOpen;
                        setIsOpen(true);
                        if (filteredOptions.length)
                            setActiveIndex((current) => (wasOpen ? (current + 1) % filteredOptions.length : 0));
                        return;
                    }
                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        const wasOpen = isOpen;
                        setIsOpen(true);
                        if (filteredOptions.length) {
                            setActiveIndex((current) => (wasOpen ? (current - 1 + filteredOptions.length) % filteredOptions.length : filteredOptions.length - 1));
                        }
                        return;
                    }
                    if (event.key === "Enter" && isOpen && filteredOptions[activeIndex]) {
                        event.preventDefault();
                        selectOption(filteredOptions[activeIndex]);
                        return;
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setIsOpen(false);
                    }
                } }), _jsx("button", { className: "single-value-combobox-toggle", type: "button", tabIndex: -1, "aria-label": isOpen ? "Close choices" : "Show choices", onMouseDown: (event) => event.preventDefault(), onClick: () => {
                    setIsFiltering(false);
                    setIsOpen((current) => !current);
                }, children: "v" }), isOpen ? (_jsx("div", { id: listboxId, className: "single-value-combobox-results", role: "listbox", "aria-label": "Available values", children: filteredOptions.length ? (filteredOptions.map((option, index) => (_jsxs("button", { id: `${listboxId}-${index}`, type: "button", role: "option", "aria-selected": option.toLocaleLowerCase() === value.trim().toLocaleLowerCase(), className: "single-value-combobox-option", "data-active": index === activeIndex, onMouseEnter: () => setActiveIndex(index), onMouseDown: (event) => event.preventDefault(), onClick: () => selectOption(option), children: [_jsx("span", { children: option }), _jsx("small", { children: suggestionBadgeText })] }, option)))) : (_jsx("p", { className: "single-value-combobox-empty", children: "No saved match. Your typed value will be kept." })) })) : null] }));
};
const MultiValueTokenPicker = ({ value, savedOptions, suggestedOptions, placeholder, helperText, suggestionSummary = "Suggestions", suggestionBadgeText = "Saved", mode = "multi", onChange, }) => {
    const [draft, setDraft] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const selectedTokens = useMemo(() => parseTokenList(value), [value]);
    const selectedKeys = useMemo(() => new Set(selectedTokens.map((entry) => entry.toLocaleLowerCase())), [selectedTokens]);
    useEffect(() => {
        setActiveIndex(0);
    }, [draft]);
    const availableOptions = useMemo(() => savedOptions.filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
    }), [savedOptions, selectedKeys]);
    const quickSuggestions = useMemo(() => buildVisibleQuickSuggestions({ suggestedPeople: suggestedOptions, selectedPeople: selectedTokens }), [selectedTokens, suggestedOptions]);
    const filteredSuggestions = useMemo(() => {
        const query = draft.trim().toLocaleLowerCase();
        if (!query)
            return [];
        const prefixMatches = [];
        const containsMatches = [];
        availableOptions.forEach((entry) => {
            const normalized = entry.toLocaleLowerCase();
            if (normalized.startsWith(query)) {
                prefixMatches.push(entry);
            }
            else if (normalized.includes(query)) {
                containsMatches.push(entry);
            }
        });
        return [...prefixMatches, ...containsMatches].slice(0, 8);
    }, [availableOptions, draft]);
    const commitTokens = (tokens) => {
        onChange(mode === "single" ? (tokens[0] ?? "") : tokens.join(", "));
    };
    const addTokens = (rawValue) => {
        const nextEntries = parseTokenList(rawValue).filter((entry) => !selectedKeys.has(entry.toLocaleLowerCase()));
        if (!nextEntries.length) {
            setDraft("");
            return;
        }
        commitTokens(mode === "single" ? [nextEntries[0]] : [...selectedTokens, ...nextEntries]);
        setDraft("");
    };
    const removeToken = (token) => {
        commitTokens(selectedTokens.filter((entry) => entry !== token));
    };
    const replaceDraftWithSuggestion = (token) => {
        addTokens(token);
    };
    const handleDraftChange = (nextDraft) => {
        if (mode === "single") {
            setDraft(nextDraft);
            return;
        }
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
            addTokens(committedSegments);
        }
        setDraft(trailingDraft.trimStart());
    };
    return (_jsxs("div", { className: "people-picker", children: [_jsxs("div", { className: "people-field-shell", children: [selectedTokens.map((token) => (_jsxs("span", { className: "people-token", children: [_jsx("span", { children: token }), _jsx("button", { type: "button", className: "people-token-remove", onClick: () => removeToken(token), "aria-label": `Remove ${token}`, children: "\u00D7" })] }, token))), _jsx("input", { value: draft, onChange: (event) => handleDraftChange(event.target.value), onKeyDown: (event) => {
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
                                    addTokens(draft);
                                }
                                return;
                            }
                            if (mode === "multi" && (event.key === "," || event.key === ";") && draft.trim()) {
                                return;
                            }
                            if (event.key === "Backspace" && !draft && selectedTokens.length) {
                                removeToken(selectedTokens[selectedTokens.length - 1]);
                            }
                            if (event.key === "Escape") {
                                setActiveIndex(0);
                            }
                        }, onBlur: () => {
                            if (draft.trim()) {
                                addTokens(draft);
                            }
                        }, placeholder: selectedTokens.length ? "" : placeholder })] }), draft.trim() && filteredSuggestions.length ? (_jsx("div", { className: "people-results-panel", role: "listbox", "aria-label": "Matching values", children: filteredSuggestions.map((token, index) => (_jsxs("button", { type: "button", className: "people-result-item", "data-active": index === activeIndex, onMouseEnter: () => setActiveIndex(index), onMouseDown: (event) => event.preventDefault(), onClick: () => replaceDraftWithSuggestion(token), children: [_jsx("strong", { children: token }), _jsx("span", { children: suggestionBadgeText })] }, token))) })) : null, quickSuggestions.length ? (_jsxs("details", { className: "workspace-disclosure people-suggestion-disclosure", children: [_jsx("summary", { children: suggestionSummary }), _jsx("div", { className: "workspace-disclosure-body", children: _jsx("div", { className: "people-suggestion-row", children: quickSuggestions.map((token) => (_jsx("button", { type: "button", className: "people-suggestion-chip", onClick: () => addTokens(token), children: token }, token))) }) })] })) : null, helperText ? _jsx("p", { className: "people-helper-text", children: helperText }) : null] }));
};
export const TokenPicker = (props) => props.mode === "single" ? _jsx(SingleValueCombobox, { ...props }) : _jsx(MultiValueTokenPicker, { ...props });
