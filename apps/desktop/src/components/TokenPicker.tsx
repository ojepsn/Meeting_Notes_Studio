import { useEffect, useId, useMemo, useState } from "react";
import { filterComboboxOptions } from "./comboboxUtils";
import { buildVisibleQuickSuggestions, parseTokenList } from "./peoplePickerUtils";

interface TokenPickerProps {
  id?: string;
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

const SingleValueCombobox = ({
  id,
  value,
  savedOptions,
  suggestedOptions,
  placeholder,
  suggestionBadgeText,
  onChange,
}: TokenPickerProps) => {
  const generatedId = useId();
  const inputId = id ?? `single-value-${generatedId}`;
  const listboxId = `${inputId}-choices`;
  const [isOpen, setIsOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = useMemo(
    () => filterComboboxOptions([...savedOptions, ...suggestedOptions], isFiltering ? value : ""),
    [isFiltering, savedOptions, suggestedOptions, value],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [value]);

  const selectOption = (option: string) => {
    onChange(option);
    setIsFiltering(false);
    setIsOpen(false);
  };

  return (
    <div
      className="single-value-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && filteredOptions.length ? `${listboxId}-${activeIndex}` : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={(event) => {
          event.currentTarget.select();
          setIsFiltering(false);
          setIsOpen(true);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsFiltering(true);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const wasOpen = isOpen;
            setIsOpen(true);
            if (filteredOptions.length) setActiveIndex((current) => (wasOpen ? (current + 1) % filteredOptions.length : 0));
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
        }}
      />
      <button
        className="single-value-combobox-toggle"
        type="button"
        tabIndex={-1}
        aria-label={isOpen ? "Close choices" : "Show choices"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setIsFiltering(false);
          setIsOpen((current) => !current);
        }}
      >
        v
      </button>

      {isOpen ? (
        <div id={listboxId} className="single-value-combobox-results" role="listbox" aria-label="Available values">
          {filteredOptions.length ? (
            filteredOptions.map((option, index) => (
              <button
                id={`${listboxId}-${index}`}
                key={option}
                type="button"
                role="option"
                aria-selected={option.toLocaleLowerCase() === value.trim().toLocaleLowerCase()}
                className="single-value-combobox-option"
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                <span>{option}</span>
                <small>{suggestionBadgeText}</small>
              </button>
            ))
          ) : (
            <p className="single-value-combobox-empty">No saved match. Your typed value will be kept.</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

const MultiValueTokenPicker = ({
  value,
  savedOptions,
  suggestedOptions,
  placeholder,
  helperText,
  suggestionSummary = "Suggestions",
  suggestionBadgeText = "Saved",
  mode = "multi",
  onChange,
}: TokenPickerProps) => {
  const [draft, setDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedTokens = useMemo(() => parseTokenList(value), [value]);
  const selectedKeys = useMemo(() => new Set(selectedTokens.map((entry) => entry.toLocaleLowerCase())), [selectedTokens]);

  useEffect(() => {
    setActiveIndex(0);
  }, [draft]);

  const availableOptions = useMemo(
    () =>
      savedOptions.filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
      }),
    [savedOptions, selectedKeys],
  );

  const quickSuggestions = useMemo(
    () => buildVisibleQuickSuggestions({ suggestedPeople: suggestedOptions, selectedPeople: selectedTokens }),
    [selectedTokens, suggestedOptions],
  );

  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLocaleLowerCase();
    if (!query) return [];

    const prefixMatches: string[] = [];
    const containsMatches: string[] = [];

    availableOptions.forEach((entry) => {
      const normalized = entry.toLocaleLowerCase();
      if (normalized.startsWith(query)) {
        prefixMatches.push(entry);
      } else if (normalized.includes(query)) {
        containsMatches.push(entry);
      }
    });

    return [...prefixMatches, ...containsMatches].slice(0, 8);
  }, [availableOptions, draft]);

  const commitTokens = (tokens: string[]) => {
    onChange(mode === "single" ? (tokens[0] ?? "") : tokens.join(", "));
  };

  const addTokens = (rawValue: string) => {
    const nextEntries = parseTokenList(rawValue).filter((entry) => !selectedKeys.has(entry.toLocaleLowerCase()));
    if (!nextEntries.length) {
      setDraft("");
      return;
    }
    commitTokens(mode === "single" ? [nextEntries[0]] : [...selectedTokens, ...nextEntries]);
    setDraft("");
  };

  const removeToken = (token: string) => {
    commitTokens(selectedTokens.filter((entry) => entry !== token));
  };

  const replaceDraftWithSuggestion = (token: string) => {
    addTokens(token);
  };

  const handleDraftChange = (nextDraft: string) => {
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

  return (
    <div className="people-picker">
      <div className="people-field-shell">
        {selectedTokens.map((token) => (
          <span key={token} className="people-token">
            <span>{token}</span>
            <button type="button" className="people-token-remove" onClick={() => removeToken(token)} aria-label={`Remove ${token}`}>
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={(event) => {
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
              } else if (draft.trim()) {
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
          }}
          onBlur={() => {
            if (draft.trim()) {
              addTokens(draft);
            }
          }}
          placeholder={selectedTokens.length ? "" : placeholder}
        />
      </div>

      {draft.trim() && filteredSuggestions.length ? (
        <div className="people-results-panel" role="listbox" aria-label="Matching values">
          {filteredSuggestions.map((token, index) => (
            <button
              key={token}
              type="button"
              className="people-result-item"
              data-active={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => replaceDraftWithSuggestion(token)}
            >
              <strong>{token}</strong>
              <span>{suggestionBadgeText}</span>
            </button>
          ))}
        </div>
      ) : null}

      {quickSuggestions.length ? (
        <details className="workspace-disclosure people-suggestion-disclosure">
          <summary>{suggestionSummary}</summary>
          <div className="workspace-disclosure-body">
            <div className="people-suggestion-row">
              {quickSuggestions.map((token) => (
                <button key={token} type="button" className="people-suggestion-chip" onClick={() => addTokens(token)}>
                  {token}
                </button>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      {helperText ? <p className="people-helper-text">{helperText}</p> : null}
    </div>
  );
};

export const TokenPicker = (props: TokenPickerProps) =>
  props.mode === "single" ? <SingleValueCombobox {...props} /> : <MultiValueTokenPicker {...props} />;
