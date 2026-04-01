import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
import { DEFAULT_GENERATION_RULES, DEFAULT_GENERATION_SYSTEM_PROMPT, DEFAULT_REVISION_RULES, DEFAULT_TRANSLATION_RULES, } from "@notesmith/prompts";
import { TemplatesCard } from "../../templates/components/TemplatesCard";
const SETTINGS_SECTIONS = [
    { id: "ai", label: "AI Settings", description: "Models, API key, transcription" },
    { id: "themes", label: "Themes", description: "Look and feel" },
    { id: "output", label: "Output formatting", description: "Language and output defaults" },
    { id: "people", label: "People", description: "Saved people and abbreviations" },
    { id: "prompts", label: "Prompts", description: "Generation and revision instructions" },
    { id: "templates", label: "Templates for meetings/notes", description: "Built-in and custom note structures" },
    { id: "other", label: "Other upcoming settings", description: "Migration, updates, future options" },
];
export const SettingsCard = ({ settings, templates, onChange, onSaveTemplate, onImportLegacy, onCheckForUpdates, updateStatusNote, }) => {
    const [activeSection, setActiveSection] = useState("ai");
    const [personDraft, setPersonDraft] = useState("");
    const [abbrShort, setAbbrShort] = useState("");
    const [abbrFull, setAbbrFull] = useState("");
    const [extraBlockLabel, setExtraBlockLabel] = useState("");
    const [extraBlockBody, setExtraBlockBody] = useState("");
    const updatePromptProfile = (nextPromptProfile) => onChange({
        ...settings,
        promptProfile: nextPromptProfile,
    });
    const updateExtraBlock = (id, updates) => updatePromptProfile({
        ...settings.promptProfile,
        extraBlocks: settings.promptProfile.extraBlocks.map((block) => block.id === id ? { ...block, ...updates } : block),
    });
    return (_jsxs("div", { className: "settings-shell", id: "desktop-settings-card", children: [_jsxs("aside", { className: "settings-nav", children: [_jsxs("div", { children: [_jsx("h3", { children: "Settings" }), _jsx("p", { className: "muted", children: "One entry point, clearly separated sections." })] }), _jsx("div", { className: "settings-nav-list", children: SETTINGS_SECTIONS.map((section) => (_jsxs("button", { type: "button", className: "settings-nav-button", "data-active": activeSection === section.id, onClick: () => setActiveSection(section.id), children: [_jsx("span", { children: section.label }), _jsx("small", { children: section.description })] }, section.id))) })] }), _jsxs("section", { className: "settings-panel", children: [activeSection === "ai" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "AI Settings" }), _jsx("p", { children: "These settings stay local to this machine and are never written into shared data files." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "api-key", children: "API key" }), _jsx("input", { id: "api-key", type: "password", value: settings.apiKey, onChange: (event) => onChange({ ...settings, apiKey: event.target.value }), placeholder: "Stored locally on this machine only" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "text-model", children: "Text model" }), _jsxs("select", { id: "text-model", value: settings.textModel, onChange: (event) => onChange({ ...settings, textModel: event.target.value }), children: [_jsx("option", { value: "gpt-5-mini", children: "GPT-5 mini" }), _jsx("option", { value: "gpt-5", children: "GPT-5" }), _jsx("option", { value: "gpt-4.1", children: "GPT-4.1" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "transcription-model", children: "Transcription model" }), _jsxs("select", { id: "transcription-model", value: settings.transcriptionModel, onChange: (event) => onChange({ ...settings, transcriptionModel: event.target.value }), children: [_jsx("option", { value: "gpt-4o-mini-transcribe", children: "GPT-4o mini transcribe" }), _jsx("option", { value: "gpt-4o-transcribe", children: "GPT-4o transcribe" }), _jsx("option", { value: "gpt-4o-transcribe-diarize", children: "GPT-4o transcribe diarize" })] })] })] })) : null, activeSection === "themes" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Themes" }), _jsx("p", { children: "Theme stays separate from shared settings because it is a local UI preference." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "theme-select", children: "Theme" }), _jsxs("select", { id: "theme-select", value: settings.theme, onChange: (event) => onChange({ ...settings, theme: event.target.value }), children: [_jsx("option", { value: "modern-olive", children: "Modern Olive" }), _jsx("option", { value: "classic-blue", children: "Classic Blue" }), _jsx("option", { value: "graphite-forest", children: "Graphite Forest" })] })] })] })) : null, activeSection === "output" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Output formatting" }), _jsx("p", { children: "These defaults shape how generated notes should read and which template should open by default." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "desktop-default-template", children: "Default desktop template" }), _jsx("select", { id: "desktop-default-template", value: settings.preferredDesktopTemplateId, onChange: (event) => onChange({ ...settings, preferredDesktopTemplateId: event.target.value }), children: BUILTIN_TEMPLATES.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-language", children: "Output language" }), _jsxs("select", { id: "output-language", value: settings.outputLanguage, onChange: (event) => onChange({
                                            ...settings,
                                            outputLanguage: event.target.value,
                                        }), children: [_jsx("option", { value: "same", children: "Same as source" }), _jsx("option", { value: "sv", children: "Swedish" }), _jsx("option", { value: "en", children: "English" })] })] })] })) : null, activeSection === "people" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "People" }), _jsx("p", { children: "Keep frequent people and shorthand in one place so note capture stays fast and consistent." })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "person-draft", children: "Saved people" }), _jsx("input", { id: "person-draft", value: personDraft, onChange: (event) => setPersonDraft(event.target.value), placeholder: "Add person" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                                    const nextValue = personDraft.trim();
                                                    if (!nextValue)
                                                        return;
                                                    onChange({
                                                        ...settings,
                                                        savedParticipants: Array.from(new Set([...settings.savedParticipants, nextValue])).sort(),
                                                    });
                                                    setPersonDraft("");
                                                }, children: "Add" })] }), _jsx("div", { className: "section-list", children: settings.savedParticipants.map((participant) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: participant }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                            ...settings,
                                                            savedParticipants: settings.savedParticipants.filter((entry) => entry !== participant),
                                                        }), children: "Remove" }) })] }, participant))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "abbr-short", children: "Abbreviation" }), _jsx("input", { id: "abbr-short", value: abbrShort, onChange: (event) => setAbbrShort(event.target.value), placeholder: "e.g. FYI" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "abbr-full", children: "Full wording" }), _jsx("input", { id: "abbr-full", value: abbrFull, onChange: (event) => setAbbrFull(event.target.value), placeholder: "For your information" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                                    if (!abbrShort.trim() || !abbrFull.trim())
                                                        return;
                                                    onChange({
                                                        ...settings,
                                                        abbreviations: [
                                                            ...settings.abbreviations,
                                                            { id: crypto.randomUUID(), shortForm: abbrShort.trim(), fullForm: abbrFull.trim() },
                                                        ],
                                                    });
                                                    setAbbrShort("");
                                                    setAbbrFull("");
                                                }, children: "Add" })] }), _jsx("div", { className: "section-list", children: settings.abbreviations.map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.shortForm }), _jsx("span", { className: "muted", children: entry.fullForm }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                            ...settings,
                                                            abbreviations: settings.abbreviations.filter((item) => item.id !== entry.id),
                                                        }), children: "Remove" }) })] }, entry.id))) })] })] })) : null, activeSection === "prompts" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Prompts" }), _jsx("p", { children: "Prompt behavior is separated here so the AI layer can keep evolving without cluttering the rest of settings." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "generation-system", children: "Generation system prompt" }), _jsx("textarea", { id: "generation-system", value: settings.promptProfile.generationSystem, onChange: (event) => updatePromptProfile({
                                            ...settings.promptProfile,
                                            generationSystem: event.target.value,
                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "generation-rules", children: "Generation rules" }), _jsx("textarea", { id: "generation-rules", value: settings.promptProfile.generationRules, onChange: (event) => updatePromptProfile({
                                            ...settings.promptProfile,
                                            generationRules: event.target.value,
                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "revision-rules", children: "Revision rules" }), _jsx("textarea", { id: "revision-rules", value: settings.promptProfile.revisionRules, onChange: (event) => updatePromptProfile({
                                            ...settings.promptProfile,
                                            revisionRules: event.target.value,
                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "translation-rules", children: "Translation rules" }), _jsx("textarea", { id: "translation-rules", value: settings.promptProfile.translationRules, onChange: (event) => updatePromptProfile({
                                            ...settings.promptProfile,
                                            translationRules: event.target.value,
                                        }) })] }), _jsx("div", { className: "inline-row", children: _jsx("button", { className: "small-button", type: "button", onClick: () => updatePromptProfile({
                                        generationSystem: DEFAULT_GENERATION_SYSTEM_PROMPT,
                                        generationRules: DEFAULT_GENERATION_RULES,
                                        revisionRules: DEFAULT_REVISION_RULES,
                                        translationRules: DEFAULT_TRANSLATION_RULES,
                                        extraBlocks: settings.promptProfile.extraBlocks,
                                    }), children: "Reset prompt defaults" }) }), _jsx("p", { className: "tiny-text", children: "Resetting defaults leaves your extra prompt blocks in place." }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { children: [_jsx("h3", { children: "Extra Prompt Blocks" }), _jsx("p", { className: "muted", children: "Reusable add-on instructions that can stay enabled or disabled per user preference." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "extra-block-label", children: "Block label" }), _jsx("input", { id: "extra-block-label", value: extraBlockLabel, onChange: (event) => setExtraBlockLabel(event.target.value), placeholder: "Example: Customer-friendly tone" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "extra-block-body", children: "Block instructions" }), _jsx("textarea", { id: "extra-block-body", value: extraBlockBody, onChange: (event) => setExtraBlockBody(event.target.value), placeholder: "Describe the additional generation guidance to apply when this block is enabled." })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                            if (!extraBlockBody.trim())
                                                return;
                                            updatePromptProfile({
                                                ...settings.promptProfile,
                                                extraBlocks: [
                                                    ...settings.promptProfile.extraBlocks,
                                                    {
                                                        id: crypto.randomUUID(),
                                                        label: extraBlockLabel.trim() || "Extra prompt block",
                                                        body: extraBlockBody.trim(),
                                                        enabled: true,
                                                    },
                                                ],
                                            });
                                            setExtraBlockLabel("");
                                            setExtraBlockBody("");
                                        }, children: "Add prompt block" }), _jsx("div", { className: "section-list", children: settings.promptProfile.extraBlocks.map((block) => (_jsxs("div", { className: "list-item", children: [_jsxs("div", { className: "inline-row checkbox-row", children: [_jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: block.enabled, onChange: (event) => updateExtraBlock(block.id, { enabled: event.target.checked }) }), "Enabled during generation"] }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => updatePromptProfile({
                                                                ...settings.promptProfile,
                                                                extraBlocks: settings.promptProfile.extraBlocks.filter((entry) => entry.id !== block.id),
                                                            }), children: "Remove" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-label-${block.id}`, children: "Label" }), _jsx("input", { id: `prompt-block-label-${block.id}`, value: block.label, onChange: (event) => updateExtraBlock(block.id, { label: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-body-${block.id}`, children: "Instructions" }), _jsx("textarea", { id: `prompt-block-body-${block.id}`, value: block.body, onChange: (event) => updateExtraBlock(block.id, { body: event.target.value }) })] })] }, block.id))) })] })] })) : null, activeSection === "templates" ? (_jsx(TemplatesCard, { templates: templates, onSave: onSaveTemplate })) : null, activeSection === "other" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Other upcoming settings" }), _jsx("p", { children: "This section gathers the miscellaneous desktop settings that do not belong to the main note-taking flow." })] }), _jsxs("div", { className: "inline-row", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void onCheckForUpdates(), children: "Check for updates" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onImportLegacy(), children: "Import current browser app data" })] }), updateStatusNote ? _jsx("p", { className: "tiny-text", children: updateStatusNote }) : null, _jsx("p", { className: "tiny-text", children: "This is also the right place for upcoming settings that should exist, but not compete with the primary workspace." })] })) : null] })] }));
};
