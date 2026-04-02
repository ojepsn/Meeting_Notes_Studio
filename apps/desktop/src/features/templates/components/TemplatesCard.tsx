import { useEffect, useMemo, useState } from "react";
import type { CaptureMode, TemplateDefinition, TemplateField, TemplateFieldType, TemplateSection } from "@notesmith/domain";

interface TemplatesCardProps {
  templates: TemplateDefinition[];
  onSave: (template: TemplateDefinition) => void;
}

const FIELD_TYPES: TemplateFieldType[] = ["text", "number", "date", "time", "textarea"];
const CAPTURE_MODE_OPTIONS: Array<{ id: CaptureMode; label: string }> = [
  { id: "meeting-note", label: "Meeting note" },
  { id: "quick-note", label: "Quick note" },
  { id: "voice-note", label: "Voice note" },
];

const createBlankField = (position: number): TemplateField => ({
  id: crypto.randomUUID(),
  key: `customField${position}`,
  label: `Custom field ${position}`,
  type: "text",
  enabled: true,
  required: false,
  position,
});

const createBlankSection = (position: number): TemplateSection => ({
  id: crypto.randomUUID(),
  title: `Custom section ${position}`,
  instructions: "Describe what this section should cover.",
  enabledByDefault: true,
  position,
});

const createDraftTemplate = (): TemplateDefinition => ({
  id: `custom-${crypto.randomUUID()}`,
  name: "New custom template",
  kind: "custom",
  captureModes: ["meeting-note", "quick-note", "voice-note"],
  fields: [createBlankField(1)],
  sections: [createBlankSection(1)],
  promptInstructions: "",
});

const normalizeFields = (fields: TemplateField[]) =>
  fields.map((field, index) => ({
    ...field,
    key: field.key.trim() || `customField${index + 1}`,
    label: field.label.trim() || `Custom field ${index + 1}`,
    position: index + 1,
  }));

const normalizeSections = (sections: TemplateSection[]) =>
  sections.map((section, index) => ({
    ...section,
    title: section.title.trim() || `Custom section ${index + 1}`,
    instructions: section.instructions.trim() || "Describe what this section should cover.",
    position: index + 1,
  }));

export const TemplatesCard = ({ templates, onSave }: TemplatesCardProps) => {
  const editableTemplates = useMemo(() => templates.filter((template) => template.kind === "custom"), [templates]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(editableTemplates[0]?.id ?? null);
  const [draft, setDraft] = useState<TemplateDefinition | null>(editableTemplates[0] ?? null);

  useEffect(() => {
    if (!editableTemplates.length && (!draft || draft.id !== selectedTemplateId)) {
      setSelectedTemplateId(null);
      setDraft(null);
      return;
    }

    if (draft && draft.id === selectedTemplateId && !editableTemplates.some((template) => template.id === draft.id)) {
      return;
    }

    const selected =
      editableTemplates.find((template) => template.id === selectedTemplateId) ??
      editableTemplates.find((template) => template.id === draft?.id) ??
      editableTemplates[0];
    setSelectedTemplateId(selected.id);
    setDraft(selected);
  }, [draft, editableTemplates, selectedTemplateId]);

  const updateDraft = (nextDraft: TemplateDefinition | null) => {
    setDraft(nextDraft);
    if (nextDraft) {
      setSelectedTemplateId(nextDraft.id);
    }
  };

  return (
    <div className="sidebar-card">
      <div>
        <h3>Templates</h3>
        <p>The desktop rebuild keeps templates as first-class domain objects, ready for sync later.</p>
      </div>
      <div className="section-list">
        {templates.map((template) => (
          <div key={template.id} className="list-item">
            <strong>{template.name}</strong>
            <span className="muted">
              {template.kind === "builtin" ? "Built-in" : "Custom"} · {template.fields.length} fields ·{" "}
              {template.sections.length} output sections
            </span>
          </div>
        ))}
      </div>
      <div className="section-divider">
        <div className="inline-row">
          <div className="field">
            <label htmlFor="template-editor-select">Custom template editor</label>
            <select
              id="template-editor-select"
              value={selectedTemplateId ?? ""}
              onChange={(event) => {
                const nextTemplate = editableTemplates.find((template) => template.id === event.target.value) ?? null;
                updateDraft(nextTemplate);
              }}
            >
              {!editableTemplates.length ? <option value="">No custom templates yet</option> : null}
              {editableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <button className="small-button inline-action" type="button" onClick={() => updateDraft(createDraftTemplate())}>
            New custom template
          </button>
        </div>
        {!draft ? (
          <p className="tiny-text">Create a custom template to define your own fields, output sections, and AI guidance.</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="template-name">Template name</label>
              <input
                id="template-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Client update"
              />
            </div>
            <div className="field">
              <label htmlFor="template-prompt-instructions">Template-specific AI instructions</label>
              <textarea
                id="template-prompt-instructions"
                value={draft.promptInstructions ?? ""}
                onChange={(event) => setDraft({ ...draft, promptInstructions: event.target.value })}
                placeholder="Describe the tone, structure, or priorities this template should enforce during generation."
              />
            </div>
            <div className="field">
              <label>Capture modes</label>
              <div className="inline-row wrap-row">
                {CAPTURE_MODE_OPTIONS.map((mode) => (
                  <label key={mode.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={draft.captureModes.includes(mode.id)}
                      onChange={(event) => {
                        const nextCaptureModes = event.target.checked
                          ? Array.from(new Set([...draft.captureModes, mode.id]))
                          : draft.captureModes.filter((entry) => entry !== mode.id);
                        setDraft({
                          ...draft,
                          captureModes: nextCaptureModes.length ? nextCaptureModes : [mode.id],
                        });
                      }}
                    />
                    {mode.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="inline-row">
                <div>
                  <strong>Input fields</strong>
                  <p className="muted">Choose the extra fields this template expects during note capture.</p>
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => setDraft({ ...draft, fields: [...draft.fields, createBlankField(draft.fields.length + 1)] })}
                >
                  Add field
                </button>
              </div>
              <div className="section-list">
                {draft.fields.map((field) => (
                  <div key={field.id} className="list-item">
                    <div className="field">
                      <label htmlFor={`field-label-${field.id}`}>Field label</label>
                      <input
                        id={`field-label-${field.id}`}
                        value={field.label}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            fields: draft.fields.map((entry) =>
                              entry.id === field.id ? { ...entry, label: event.target.value } : entry,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`field-key-${field.id}`}>Field key</label>
                      <input
                        id={`field-key-${field.id}`}
                        value={field.key}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            fields: draft.fields.map((entry) =>
                              entry.id === field.id ? { ...entry, key: event.target.value.replace(/\s+/g, "") } : entry,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="inline-row">
                      <div className="field">
                        <label htmlFor={`field-type-${field.id}`}>Field type</label>
                        <select
                          id={`field-type-${field.id}`}
                          value={field.type}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              fields: draft.fields.map((entry) =>
                                entry.id === field.id ? { ...entry, type: event.target.value as TemplateFieldType } : entry,
                              ),
                            })
                          }
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={field.enabled}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              fields: draft.fields.map((entry) =>
                                entry.id === field.id ? { ...entry, enabled: event.target.checked } : entry,
                              ),
                            })
                          }
                        />
                        Enabled
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              fields: draft.fields.map((entry) =>
                                entry.id === field.id ? { ...entry, required: event.target.checked } : entry,
                              ),
                            })
                          }
                        />
                        Required
                      </label>
                      <button
                        className="small-button danger-button inline-action"
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            fields: draft.fields.filter((entry) => entry.id !== field.id),
                          })
                        }
                        disabled={draft.fields.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="inline-row">
                <div>
                  <strong>Output sections</strong>
                  <p className="muted">Define which sections generation should produce and what each section should cover.</p>
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => setDraft({ ...draft, sections: [...draft.sections, createBlankSection(draft.sections.length + 1)] })}
                >
                  Add section
                </button>
              </div>
              <div className="section-list">
                {draft.sections.map((section) => (
                  <div key={section.id} className="list-item">
                    <div className="field">
                      <label htmlFor={`section-title-${section.id}`}>Section title</label>
                      <input
                        id={`section-title-${section.id}`}
                        value={section.title}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            sections: draft.sections.map((entry) =>
                              entry.id === section.id ? { ...entry, title: event.target.value } : entry,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`section-instructions-${section.id}`}>Section instructions</label>
                      <textarea
                        id={`section-instructions-${section.id}`}
                        value={section.instructions}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            sections: draft.sections.map((entry) =>
                              entry.id === section.id ? { ...entry, instructions: event.target.value } : entry,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="inline-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={section.enabledByDefault}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              sections: draft.sections.map((entry) =>
                                entry.id === section.id ? { ...entry, enabledByDefault: event.target.checked } : entry,
                              ),
                            })
                          }
                        />
                        Enabled by default
                      </label>
                      <button
                        className="small-button danger-button inline-action"
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            sections: draft.sections.filter((entry) => entry.id !== section.id),
                          })
                        }
                        disabled={draft.sections.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="inline-row">
              <button
                className="primary-button inline-action"
                type="button"
                onClick={() =>
                  onSave({
                    ...draft,
                    kind: "custom",
                    name: draft.name.trim() || "New custom template",
                    promptInstructions: draft.promptInstructions?.trim() || "",
                    fields: normalizeFields(draft.fields),
                    sections: normalizeSections(draft.sections),
                  })
                }
              >
                Save template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
