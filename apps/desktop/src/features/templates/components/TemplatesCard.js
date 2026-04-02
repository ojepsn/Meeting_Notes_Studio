import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { getPrimaryCaptureMode, } from "@notesmith/domain";
const FIELD_TYPES = ["text", "number", "date", "time", "textarea"];
const CAPTURE_MODE_OPTIONS = [
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
const createBlankField = (position) => ({
    id: crypto.randomUUID(),
    key: `customField${position}`,
    label: `Custom field ${position}`,
    type: "text",
    enabled: true,
    required: false,
    position,
});
const createBlankSection = (position) => ({
    id: crypto.randomUUID(),
    title: `Custom section ${position}`,
    instructions: "Describe what this section should cover.",
    enabledByDefault: true,
    position,
});
const createDraftTemplate = (captureMode) => ({
    id: `custom-${crypto.randomUUID()}`,
    name: captureMode === "meeting-note"
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
const normalizeFields = (fields) => fields.map((field, index) => ({
    ...field,
    key: field.key.trim() || `customField${index + 1}`,
    label: field.label.trim() || `Custom field ${index + 1}`,
    position: index + 1,
}));
const normalizeSections = (sections) => sections.map((section, index) => ({
    ...section,
    title: section.title.trim() || `Custom section ${index + 1}`,
    instructions: section.instructions.trim() || "Describe what this section should cover.",
    position: index + 1,
}));
export const TemplatesCard = ({ templates, onSave, onResetTemplates }) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? null);
    const [draft, setDraft] = useState(templates[0] ?? null);
    useEffect(() => {
        if (!templates.length && (!draft || draft.id !== selectedTemplateId)) {
            setSelectedTemplateId(null);
            setDraft(null);
            return;
        }
        if (draft && draft.id === selectedTemplateId && !templates.some((template) => template.id === draft.id)) {
            return;
        }
        const selected = templates.find((template) => template.id === selectedTemplateId) ??
            templates.find((template) => template.id === draft?.id) ??
            templates[0];
        if (selected) {
            setSelectedTemplateId(selected.id);
            setDraft(selected);
        }
    }, [draft, selectedTemplateId, templates]);
    const draftCategory = draft ? getPrimaryCaptureMode(draft) : "meeting-note";
    const groupedTemplates = useMemo(() => CAPTURE_MODE_OPTIONS.map((mode) => ({
        ...mode,
        templates: templates.filter((template) => getPrimaryCaptureMode(template) === mode.id),
    })), [templates]);
    const editableTemplatesForDraftCategory = templates.filter((template) => getPrimaryCaptureMode(template) === draftCategory);
    const updateDraft = (nextDraft) => {
        setDraft(nextDraft);
        if (nextDraft) {
            setSelectedTemplateId(nextDraft.id);
        }
    };
    const startDraftForCategory = (captureMode) => {
        updateDraft(createDraftTemplate(captureMode));
    };
    return (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Templates" }), _jsx("p", { children: "Create templates under the top-level note type where they belong. Each template then appears only in that session category." })] }), _jsx("div", { className: "stack", children: groupedTemplates.map((category) => (_jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { children: [_jsx("strong", { children: category.label }), _jsx("p", { className: "muted", children: category.description })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => startDraftForCategory(category.id), children: category.createLabel })] }), _jsx("div", { className: "section-list", children: category.templates.map((template) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: template.name }), _jsxs("span", { className: "muted", children: [template.kind === "builtin" ? "Built-in" : "Custom", " \u00B7 ", template.fields.length, " fields \u00B7 ", template.sections.length, " output sections"] }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button", type: "button", onClick: () => updateDraft(template), children: "Edit" }) })] }, template.id))) })] }, category.id))) }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "template-editor-select", children: "Template editor" }), _jsxs("select", { id: "template-editor-select", value: selectedTemplateId ?? "", onChange: (event) => {
                                            const nextTemplate = templates.find((template) => template.id === event.target.value) ?? null;
                                            updateDraft(nextTemplate);
                                        }, children: [!editableTemplatesForDraftCategory.length ? _jsx("option", { value: "", children: "No templates in this category yet" }) : null, editableTemplatesForDraftCategory.map((template) => (_jsxs("option", { value: template.id, children: [template.name, " ", template.kind === "builtin" ? "(Built-in)" : "(Custom)"] }, template.id)))] })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => startDraftForCategory(draftCategory), children: "New in this category" }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => void onResetTemplates(), children: "Restore default templates" })] }), !draft ? (_jsx("p", { className: "tiny-text", children: "Choose a category above to create a template, or edit any built-in or custom template from its category list." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "template-name", children: "Template name" }), _jsx("input", { id: "template-name", value: draft.name, onChange: (event) => setDraft({ ...draft, name: event.target.value }), placeholder: "Client update" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "template-prompt-instructions", children: "Template-specific AI instructions" }), _jsx("textarea", { id: "template-prompt-instructions", value: draft.promptInstructions ?? "", onChange: (event) => setDraft({ ...draft, promptInstructions: event.target.value }), placeholder: "Describe the tone, structure, or priorities this template should enforce during generation." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Top-level category" }), _jsx("div", { className: "capture-mode-switch", children: CAPTURE_MODE_OPTIONS.map((mode) => (_jsxs("button", { type: "button", className: "capture-mode-card", "data-active": getPrimaryCaptureMode(draft) === mode.id, onClick: () => setDraft({
                                                ...draft,
                                                captureModes: [mode.id],
                                            }), children: [_jsx("strong", { children: mode.label }), _jsxs("span", { children: ["This template will only appear inside ", mode.label.toLowerCase(), "."] })] }, mode.id))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { children: [_jsx("strong", { children: "Input fields" }), _jsx("p", { className: "muted", children: "Choose the extra fields this template expects during note capture." })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => setDraft({ ...draft, fields: [...draft.fields, createBlankField(draft.fields.length + 1)] }), children: "Add field" })] }), _jsx("div", { className: "section-list", children: draft.fields.map((field) => (_jsxs("div", { className: "list-item", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `field-label-${field.id}`, children: "Field label" }), _jsx("input", { id: `field-label-${field.id}`, value: field.label, onChange: (event) => setDraft({
                                                                ...draft,
                                                                fields: draft.fields.map((entry) => entry.id === field.id ? { ...entry, label: event.target.value } : entry),
                                                            }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `field-key-${field.id}`, children: "Field key" }), _jsx("input", { id: `field-key-${field.id}`, value: field.key, onChange: (event) => setDraft({
                                                                ...draft,
                                                                fields: draft.fields.map((entry) => entry.id === field.id ? { ...entry, key: event.target.value.replace(/\s+/g, "") } : entry),
                                                            }) })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `field-type-${field.id}`, children: "Field type" }), _jsx("select", { id: `field-type-${field.id}`, value: field.type, onChange: (event) => setDraft({
                                                                        ...draft,
                                                                        fields: draft.fields.map((entry) => entry.id === field.id ? { ...entry, type: event.target.value } : entry),
                                                                    }), children: FIELD_TYPES.map((type) => (_jsx("option", { value: type, children: type }, type))) })] }), _jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: field.enabled, onChange: (event) => setDraft({
                                                                        ...draft,
                                                                        fields: draft.fields.map((entry) => entry.id === field.id ? { ...entry, enabled: event.target.checked } : entry),
                                                                    }) }), "Enabled"] }), _jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: field.required, onChange: (event) => setDraft({
                                                                        ...draft,
                                                                        fields: draft.fields.map((entry) => entry.id === field.id ? { ...entry, required: event.target.checked } : entry),
                                                                    }) }), "Required"] }), _jsx("button", { className: "small-button danger-button inline-action", type: "button", onClick: () => setDraft({
                                                                ...draft,
                                                                fields: draft.fields.filter((entry) => entry.id !== field.id),
                                                            }), disabled: draft.fields.length === 1, children: "Remove" })] })] }, field.id))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { children: [_jsx("strong", { children: "Output sections" }), _jsx("p", { className: "muted", children: "Define which sections generation should produce and what each section should cover." })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => setDraft({ ...draft, sections: [...draft.sections, createBlankSection(draft.sections.length + 1)] }), children: "Add section" })] }), _jsx("div", { className: "section-list", children: draft.sections.map((section) => (_jsxs("div", { className: "list-item", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `section-title-${section.id}`, children: "Section title" }), _jsx("input", { id: `section-title-${section.id}`, value: section.title, onChange: (event) => setDraft({
                                                                ...draft,
                                                                sections: draft.sections.map((entry) => entry.id === section.id ? { ...entry, title: event.target.value } : entry),
                                                            }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `section-instructions-${section.id}`, children: "Section instructions" }), _jsx("textarea", { id: `section-instructions-${section.id}`, value: section.instructions, onChange: (event) => setDraft({
                                                                ...draft,
                                                                sections: draft.sections.map((entry) => entry.id === section.id ? { ...entry, instructions: event.target.value } : entry),
                                                            }) })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: section.enabledByDefault, onChange: (event) => setDraft({
                                                                        ...draft,
                                                                        sections: draft.sections.map((entry) => entry.id === section.id ? { ...entry, enabledByDefault: event.target.checked } : entry),
                                                                    }) }), "Enabled by default"] }), _jsx("button", { className: "small-button danger-button inline-action", type: "button", onClick: () => setDraft({
                                                                ...draft,
                                                                sections: draft.sections.filter((entry) => entry.id !== section.id),
                                                            }), disabled: draft.sections.length === 1, children: "Remove" })] })] }, section.id))) })] }), _jsx("div", { className: "inline-row", children: _jsx("button", { className: "primary-button inline-action", type: "button", onClick: () => onSave({
                                        ...draft,
                                        name: draft.name.trim() || "New custom template",
                                        captureModes: [getPrimaryCaptureMode(draft)],
                                        promptInstructions: draft.promptInstructions?.trim() || "",
                                        fields: normalizeFields(draft.fields),
                                        sections: normalizeSections(draft.sections),
                                    }), children: "Save template" }) })] }))] })] }));
};
