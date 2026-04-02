import { useEffect, useMemo, useState } from "react";

const parsePeople = (value: string) =>
  Array.from(
    new Map(
      value
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => [entry.toLocaleLowerCase(), entry] as const),
    ).values(),
  );

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
}: PeoplePickerProps) => {
  const [draft, setDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedPeople = useMemo(() => parsePeople(value), [value]);
  const selectedKeys = useMemo(() => new Set(selectedPeople.map((entry) => entry.toLocaleLowerCase())), [selectedPeople]);

  useEffect(() => {
    setActiveIndex(0);
  }, [draft]);

  const availablePeople = useMemo(
    () =>
      savedPeople.filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
      }),
    [savedPeople, selectedKeys],
  );

  const quickSuggestions = useMemo(
    () =>
      suggestedPeople
        .filter((entry) => {
          const normalized = entry.trim().toLocaleLowerCase();
          return normalized && !selectedKeys.has(normalized);
        })
        .slice(0, 6),
    [selectedKeys, suggestedPeople],
  );

  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLocaleLowerCase();
    if (!query) return [];

    const prefixMatches: string[] = [];
    const containsMatches: string[] = [];

    availablePeople.forEach((entry) => {
      const normalized = entry.toLocaleLowerCase();
      if (normalized.startsWith(query)) {
        prefixMatches.push(entry);
      } else if (normalized.includes(query)) {
        containsMatches.push(entry);
      }
    });

    return [...prefixMatches, ...containsMatches].slice(0, 8);
  }, [availablePeople, draft]);

  const commitPeople = (people: string[]) => {
    onChange(people.join(", "));
  };

  const addPeople = (rawValue: string) => {
    const nextEntries = parsePeople(rawValue).filter((entry) => !selectedKeys.has(entry.toLocaleLowerCase()));
    if (!nextEntries.length) {
      setDraft("");
      return;
    }
    commitPeople([...selectedPeople, ...nextEntries]);
    setDraft("");
  };

  const removePerson = (person: string) => {
    commitPeople(selectedPeople.filter((entry) => entry !== person));
  };

  const replaceDraftWithSuggestion = (person: string) => {
    addPeople(person);
  };

  const handleDraftChange = (nextDraft: string) => {
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

  return (
    <div className="people-picker">
      <div className="people-field-shell">
        {selectedPeople.map((person) => (
          <span key={person} className="people-token">
            <span>{person}</span>
            <button type="button" className="people-token-remove" onClick={() => removePerson(person)} aria-label={`Remove ${person}`}>
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
          }}
          onBlur={() => {
            if (draft.trim()) {
              addPeople(draft);
            }
          }}
          placeholder={selectedPeople.length ? "" : placeholder}
        />
      </div>

      {draft.trim() && filteredSuggestions.length ? (
        <div className="people-results-panel" role="listbox" aria-label="Matching people">
          {filteredSuggestions.map((person, index) => (
            <button
              key={person}
              type="button"
              className="people-result-item"
              data-active={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => replaceDraftWithSuggestion(person)}
            >
              <strong>{person}</strong>
              <span>From saved People</span>
            </button>
          ))}
        </div>
      ) : null}

      {quickSuggestions.length ? (
        <div className="people-suggestion-row">
          {quickSuggestions.map((person) => (
            <button key={person} type="button" className="people-suggestion-chip" onClick={() => addPeople(person)}>
              {person}
            </button>
          ))}
        </div>
      ) : null}

      <p className="people-helper-text">
        Type to search saved People. Press <kbd>Enter</kbd>, comma, or semicolon to add a name. New names stay in this note and can be saved to People after output is generated.
      </p>
    </div>
  );
};
