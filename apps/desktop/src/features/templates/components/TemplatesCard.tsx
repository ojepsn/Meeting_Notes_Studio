import { useEffect, useMemo, useState } from "react";
import {
  getPrimaryCaptureMode,
  type CaptureMode,
  type TemplateDefinition,
  type TemplateField,
  type TemplateFieldType,
  type TemplateSection,
} from "@notesmith/domain";

interface TemplatesCardProps {
  templates: TemplateDefinition[];
  onSave: (template: TemplateDefinition) => void;
  onResetTemplates: () => Promise<void>;
}

const FIELD_TYPES: TemplateFieldType[] = ["text", "number", "date", "time", "textarea"];
const CAPTURE_MODE_OPTIONS: Array<{ id: CaptureMode; label: string; description: string; createLabel: string }> = [
  {
    id: "meeting-note",
    label: "Meeting note",
    description: "Templates for meetings, calls, interviews, and structured minutes.",
    createLabel: "New meeting template",
  },
  {
    id: "quick-note",
    label: "Quick note",
    description: "Templates for typed notes, short writeups, and lightweight capture.",
    createLabel: "New note template",
  },
  {
    id: "voice-note",
    label: "Voice note",
    description: "Templates for dictation, voice memos, and audio-first notes.",
    createLabel: "New voice template",
  },
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

const createDraftTemplate = (captureMode: CaptureMode): TemplateDefinition => ({
  id: `custom-${crypto.randomUUID()}`,
  name:
    captureMode === "meeting-note"
      ? "New meeting template"
      : captureMode === "voice-note"
        ? "New voice template"
        : "New note template",
  kind: "custom",
  captureModes: [captureMode],
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

export const TemplatesCard = ({ templates, onSave, onResetTemplates }: TemplatesCardProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [draft, setDraft] = useState<TemplateDefinition | null>(templates[0] ?? null);

  useEffect(() => {
    if (!templates.length && (!draft || draft.id !== selectedTemplateId)) {
      setSelectedTemplateId(null);
      setDraft(null);
      return;
    }

    if (draft && draft.id === selectedTemplateId && !templates.some((template) => template.id === draft.id)) {
      return;
    }

    const selected =
      templates.find((template) => template.id === selectedTemplateId) ??
      templates.find((template) => template.id === draft?.id) ??
      templates[0];

    if (selected) {
      setSelectedTemplateId(selected.id);
      setDraft(selected);
    }
  }, [draft, selectedTemplateId, templates]);

  const draftCategory = draft ? getPrimaryCaptureMode(draft) : "meeting-note";

  const groupedTemplates = useMemo(
    () =>
      CAPTURE_MODE_OPTIONS.map((mode) => ({
        ...mode,
        templates: templates.filter((template) => getPrimaryCaptureMode(template) === mode.id),
      })),
    [templates],
  );

  const editableTemplatesForDraftCategory = templates.filter(
    (template) => getPrimaryCaptureMode(template) === draftCategory,
  );

  const updateDraft = (nextDraft: TemplateDefinition | null) => {
    setDraft(nextDraft);
    if (nextDraft) {
      setSelectedTemplateId(nextDraft.id);
    }
  };

  const startDraftForCategory = (captureMode: CaptureMode) => {
    updateDraft(createDraftTemplate(captureMode));
  };

  return (
    <div className="sidebar-card">
      <div>
        <h3>Templates</h3>
        <p>Create templates under the top-level note type where they belong. Each template then appears only in that session category.</p>
      </div>

      <div className="stack">
        {groupedTemplates.map((category) => (
          <div key={category.id} className="section-divider">
            <div className="inline-row">
              <div>
                <strong>{category.label}</strong>
                <p className="muted">{category.description}</p>
              </div>
              <button
                className="small-button inline-action"
                type="button"
                onClick={() => startDraftForCategory(category.id)}
              >
                {category.createLabel}
              </button>
            </div>
            <div className="section-list">
              {category.templates.map((template) => (
                <div key={template.id} className="list-item">
                  <strong>{template.name}</strong>
                  <span className="muted">
                    {template.kind === "builtin" ? "Built-in" : "Custom"} · {template.fields.length} fields · {template.sections.length} output sections
                  </span>
                  <div className="list-item-actions">
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => updateDraft(template)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-divider">
        <div className="inline-row">
          <div className="field">
            <label htmlFor="template-editor-select">Template editor</label>
            <select
              id="template-editor-select"
              value={selectedTemplateId ?? ""}
              onChange={(event) => {
                const nextTemplate = templates.find((template) => template.id === event.target.value) ?? null;
                updateDraft(nextTemplate);
              }}
            >
              {!editableTemplatesForDraftCategory.length ? <option value="">No templates in this category yet</option> : null}
              {editableTemplatesForDraftCategory.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.kind === "builtin" ? "(Built-in)" : "(Custom)"}
                </option>
              ))}
            </select>
          </div>
          <button className="small-button inline-action" type="button" onClick={() => startDraftForCategory(draftCategory)}>
            New in this category
          </button>
          <button className="small-button inline-action" type="button" onClick={() => void onResetTemplates()}>
            Restore default templates
          </button>
        </div>

        {!draft ? (
          <p className="tiny-text">Choose a category above to create a template, or edit any built-in or custom template from its category list.</p>
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
              <label>Top-level category</label>
              <div className="capture-mode-switch">
                {CAPTURE_MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className="capture-mode-card"
                    data-active={getPrimaryCaptureMode(draft) === mode.id}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        captureModes: [mode.id],
                      })
                    }
                  >
                    <strong>{mode.label}</strong>
                    <span>This template will only appear inside {mode.label.toLowerCase()}.</span>
                  </button>
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
                    name: draft.name.trim() || "New custom template",
                    captureModes: [getPrimaryCaptureMode(draft)],
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
