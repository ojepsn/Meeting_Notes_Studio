import { useEffect, useMemo, useState } from "react";
import { buildVisibleQuickSuggestions, parseTokenList } from "./peoplePickerUtils";

interface TokenPickerProps {
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

export const TokenPicker = ({
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
