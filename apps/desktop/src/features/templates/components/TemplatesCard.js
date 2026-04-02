import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
const FIELD_TYPES = ["text", "number", "date", "time", "textarea"];
const CAPTURE_MODE_OPTIONS = [
    { id: "meeting-note", label: "Meeting note" },
    { id: "quick-note", label: "Quick note" },
    { id: "voice-note", label: "Voice note" },
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
const createDraftTemplate = () => ({
    id: `custom-${crypto.randomUUID()}`,
    name: "New custom template",
    kind: "custom",
    captureModes: ["meeting-note", "quick-note", "voice-note"],
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
export const TemplatesCard = ({ templates, onSave }) => {
    const editableTemplates = useMemo(() => templates.filter((template) => template.kind === "custom"), [templates]);
    const [selectedTemplateId, setSelectedTemplateId] = useState(editableTemplates[0]?.id ?? null);
    const [draft, setDraft] = useState(editableTemplates[0] ?? null);
    useEffect(() => {
        if (!editableTemplates.length && (!draft || draft.id !== selectedTemplateId)) {
            setSelectedTemplateId(null);
            setDraft(null);
            return;
        }
        if (draft && draft.id === selectedTemplateId && !editableTemplates.some((template) => template.id === draft.id)) {
            return;
        }
        const selected = editableTemplates.find((template) => template.id === selectedTemplateId) ??
            editableTemplates.find((template) => template.id === draft?.id) ??
            editableTemplates[0];
        setSelectedTemplateId(selected.id);
        setDraft(selected);
    }, [draft, editableTemplates, selectedTemplateId]);
    const updateDraft = (nextDraft) => {
        setDraft(nextDraft);
        if (nextDraft) {
            setSelectedTemplateId(nextDraft.id);
        }
    };
    return (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Templates" }), _jsx("p", { children: "The desktop rebuild keeps templates as first-class domain objects, ready for sync later." })] }), _jsx("div", { className: "section-list", children: templates.map((template) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: template.name }), _jsxs("span", { className: "muted", children: [template.kind === "builtin" ? "Built-in" : "Custom", " \u00B7 ", template.fields.length, " fields \u00B7", " ", template.sections.length, " output sections"] })] }, template.id))) }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "template-editor-select", children: "Custom template editor" }), _jsxs("select", { id: "template-editor-select", value: selectedTemplateId ?? "", onChange: (event) => {
                                            const nextTemplate = editableTemplates.find((template) => template.id === event.target.value) ?? null;
                                            updateDraft(nextTemplate);
                                        }, children: [!editableTemplates.length ? _jsx("option", { value: "", children: "No custom templates yet" }) : null, editableTemplates.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id)))] })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => updateDraft(createDraftTemplate()), children: "New custom template" })] }), !draft ? (_jsx("p", { className: "tiny-text", children: "Create a custom template to define your own fields, output sections, and AI guidance." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "template-name", children: "Template name" }), _jsx("input", { id: "template-name", value: draft.name, onChange: (event) => setDraft({ ...draft, name: event.target.value }), placeholder: "Client update" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "template-prompt-instructions", children: "Template-specific AI instructions" }), _jsx("textarea", { id: "template-prompt-instructions", value: draft.promptInstructions ?? "", onChange: (event) => setDraft({ ...draft, promptInstructions: event.target.value }), placeholder: "Describe the tone, structure, or priorities this template should enforce during generation." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Capture modes" }), _jsx("div", { className: "inline-row wrap-row", children: CAPTURE_MODE_OPTIONS.map((mode) => (_jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: draft.captureModes.includes(mode.id), onChange: (event) => {
                                                        const nextCaptureModes = event.target.checked
                                                            ? Array.from(new Set([...draft.captureModes, mode.id]))
                                                            : draft.captureModes.filter((entry) => entry !== mode.id);
                                                        setDraft({
                                                            ...draft,
                                                            captureModes: nextCaptureModes.length ? nextCaptureModes : [mode.id],
                                                        });
                                                    } }), mode.label] }, mode.id))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { children: [_jsx("strong", { children: "Input fields" }), _jsx("p", { className: "muted", children: "Choose the extra fields this template expects during note capture." })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => setDraft({ ...draft, fields: [...draft.fields, createBlankField(draft.fields.length + 1)] }), children: "Add field" })] }), _jsx("div", { className: "section-list", children: draft.fields.map((field) => (_jsxs("div", { className: "list-item", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `field-label-${field.id}`, children: "Field label" }), _jsx("input", { id: `field-label-${field.id}`, value: field.label, onChange: (event) => setDraft({
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
                                        kind: "custom",
                                        name: draft.name.trim() || "New custom template",
                                        promptInstructions: draft.promptInstructions?.trim() || "",
                                        fields: normalizeFields(draft.fields),
                                        sections: normalizeSections(draft.sections),
                                    }), children: "Save template" }) })] }))] })] }));
};
