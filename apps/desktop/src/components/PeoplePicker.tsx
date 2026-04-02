import { useMemo, useState } from "react";

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
  placeholder?: string;
  onChange: (value: string) => void;
}

export const PeoplePicker = ({ value, savedPeople, placeholder = "Add people", onChange }: PeoplePickerProps) => {
  const [draft, setDraft] = useState("");
  const selectedPeople = useMemo(() => parsePeople(value), [value]);
  const selectedKeys = useMemo(() => new Set(selectedPeople.map((entry) => entry.toLocaleLowerCase())), [selectedPeople]);
  const suggestedPeople = useMemo(
    () =>
      savedPeople.filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
      }),
    [savedPeople, selectedKeys],
  );
  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLocaleLowerCase();
    if (!query) return suggestedPeople.slice(0, 8);
    return suggestedPeople.filter((entry) => entry.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [draft, suggestedPeople]);

  const commitPeople = (people: string[]) => {
    onChange(people.join(", "));
  };

  const addPerson = (rawValue: string) => {
    const nextValue = rawValue.trim();
    if (!nextValue) return;
    if (selectedKeys.has(nextValue.toLocaleLowerCase())) {
      setDraft("");
      return;
    }
    commitPeople([...selectedPeople, nextValue]);
    setDraft("");
  };

  const removePerson = (person: string) => {
    commitPeople(selectedPeople.filter((entry) => entry !== person));
  };

  return (
    <div className="people-picker">
      {selectedPeople.length ? (
        <div className="people-chip-list">
          {selectedPeople.map((person) => (
            <span key={person} className="people-chip">
              <span>{person}</span>
              <button type="button" className="people-chip-remove" onClick={() => removePerson(person)} aria-label={`Remove ${person}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="people-input-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === ";") {
              event.preventDefault();
              addPerson(draft);
            }
            if (event.key === "Backspace" && !draft && selectedPeople.length) {
              removePerson(selectedPeople[selectedPeople.length - 1]);
            }
          }}
          placeholder={placeholder}
        />
        <button className="small-button" type="button" onClick={() => addPerson(draft)}>
          Add
        </button>
      </div>

      {filteredSuggestions.length ? (
        <div className="people-suggestion-row">
          {filteredSuggestions.map((person) => (
            <button key={person} type="button" className="people-suggestion-chip" onClick={() => addPerson(person)}>
              {person}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
