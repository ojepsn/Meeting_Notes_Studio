import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
import { DEFAULT_GENERATION_RULES, DEFAULT_GENERATION_SYSTEM_PROMPT, DEFAULT_REVISION_RULES, DEFAULT_TRANSLATION_RULES, } from "@notesmith/prompts";
export const SettingsCard = ({ settings, onChange, onImportLegacy }) => {
    const [participantDraft, setParticipantDraft] = useState("");
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
    return (_jsxs("div", { className: "sidebar-card", id: "desktop-settings-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Settings Foundation" }), _jsx("p", { children: "These settings stay local-only and already respect the future sync boundaries." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "api-key", children: "API key" }), _jsx("input", { id: "api-key", type: "password", value: settings.apiKey, onChange: (event) => onChange({ ...settings, apiKey: event.target.value }), placeholder: "Stored locally on this machine only" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "text-model", children: "Text model" }), _jsxs("select", { id: "text-model", value: settings.textModel, onChange: (event) => onChange({ ...settings, textModel: event.target.value }), children: [_jsx("option", { value: "gpt-5-mini", children: "GPT-5 mini" }), _jsx("option", { value: "gpt-5", children: "GPT-5" }), _jsx("option", { value: "gpt-4.1", children: "GPT-4.1" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "transcription-model", children: "Transcription model" }), _jsxs("select", { id: "transcription-model", value: settings.transcriptionModel, onChange: (event) => onChange({ ...settings, transcriptionModel: event.target.value }), children: [_jsx("option", { value: "gpt-4o-mini-transcribe", children: "GPT-4o mini transcribe" }), _jsx("option", { value: "gpt-4o-transcribe", children: "GPT-4o transcribe" }), _jsx("option", { value: "gpt-4o-transcribe-diarize", children: "GPT-4o transcribe diarize" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "theme-select", children: "Theme" }), _jsxs("select", { id: "theme-select", value: settings.theme, onChange: (event) => onChange({ ...settings, theme: event.target.value }), children: [_jsx("option", { value: "modern-olive", children: "Modern Olive" }), _jsx("option", { value: "classic-blue", children: "Classic Blue" }), _jsx("option", { value: "graphite-forest", children: "Graphite Forest" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "desktop-default-template", children: "Default desktop template" }), _jsx("select", { id: "desktop-default-template", value: settings.preferredDesktopTemplateId, onChange: (event) => onChange({ ...settings, preferredDesktopTemplateId: event.target.value }), children: BUILTIN_TEMPLATES.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-language", children: "Output language" }), _jsxs("select", { id: "output-language", value: settings.outputLanguage, onChange: (event) => onChange({
                            ...settings,
                            outputLanguage: event.target.value,
                        }), children: [_jsx("option", { value: "same", children: "Same as source" }), _jsx("option", { value: "sv", children: "Swedish" }), _jsx("option", { value: "en", children: "English" })] })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "participant-draft", children: "Saved participants" }), _jsx("input", { id: "participant-draft", value: participantDraft, onChange: (event) => setParticipantDraft(event.target.value), placeholder: "Add participant" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                    const nextValue = participantDraft.trim();
                                    if (!nextValue)
                                        return;
                                    onChange({
                                        ...settings,
                                        savedParticipants: Array.from(new Set([...settings.savedParticipants, nextValue])).sort(),
                                    });
                                    setParticipantDraft("");
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
                                        }), children: "Remove" }) })] }, entry.id))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "generation-system", children: "Generation system prompt" }), _jsx("textarea", { id: "generation-system", value: settings.promptProfile.generationSystem, onChange: (event) => updatePromptProfile({
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
                                }) })] }), _jsxs("div", { className: "inline-row", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => updatePromptProfile({
                                    generationSystem: DEFAULT_GENERATION_SYSTEM_PROMPT,
                                    generationRules: DEFAULT_GENERATION_RULES,
                                    revisionRules: DEFAULT_REVISION_RULES,
                                    translationRules: DEFAULT_TRANSLATION_RULES,
                                    extraBlocks: settings.promptProfile.extraBlocks,
                                }), children: "Reset prompt defaults" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onImportLegacy(), children: "Import current browser app data" })] }), _jsx("p", { className: "tiny-text", children: "These prompt settings stay local to this machine. Resetting defaults leaves your extra prompt blocks in place." })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { children: [_jsx("h3", { children: "Extra Prompt Blocks" }), _jsx("p", { className: "muted", children: "Add reusable instructions that should be appended during generation when enabled." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "extra-block-label", children: "Block label" }), _jsx("input", { id: "extra-block-label", value: extraBlockLabel, onChange: (event) => setExtraBlockLabel(event.target.value), placeholder: "Example: Customer-friendly tone" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "extra-block-body", children: "Block instructions" }), _jsx("textarea", { id: "extra-block-body", value: extraBlockBody, onChange: (event) => setExtraBlockBody(event.target.value), placeholder: "Describe the additional generation guidance to apply when this block is enabled." })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
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
                                            }), children: "Remove" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-label-${block.id}`, children: "Label" }), _jsx("input", { id: `prompt-block-label-${block.id}`, value: block.label, onChange: (event) => updateExtraBlock(block.id, { label: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-body-${block.id}`, children: "Instructions" }), _jsx("textarea", { id: `prompt-block-body-${block.id}`, value: block.body, onChange: (event) => updateExtraBlock(block.id, { body: event.target.value }) })] })] }, block.id))) }), _jsx("p", { className: "tiny-text", children: "This brings over sessions, custom templates, todos, participants, abbreviations, and prompt settings from the current PWA when present." })] })] }));
};
