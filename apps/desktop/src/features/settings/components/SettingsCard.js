import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
export const SettingsCard = ({ settings, onChange, onImportLegacy }) => {
    const [participantDraft, setParticipantDraft] = useState("");
    const [abbrShort, setAbbrShort] = useState("");
    const [abbrFull, setAbbrFull] = useState("");
    const templateOptions = useMemo(() => BUILTIN_TEMPLATES, []);
    return (_jsxs("div", { className: "sidebar-card", id: "desktop-settings-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Settings Foundation" }), _jsx("p", { children: "These settings stay local-only and already respect the future sync boundaries." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "api-key", children: "API key" }), _jsx("input", { id: "api-key", type: "password", value: settings.apiKey, onChange: (event) => onChange({ ...settings, apiKey: event.target.value }), placeholder: "Stored locally on this machine only" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "text-model", children: "Text model" }), _jsxs("select", { id: "text-model", value: settings.textModel, onChange: (event) => onChange({ ...settings, textModel: event.target.value }), children: [_jsx("option", { value: "gpt-5-mini", children: "GPT-5 mini" }), _jsx("option", { value: "gpt-5", children: "GPT-5" }), _jsx("option", { value: "gpt-4.1", children: "GPT-4.1" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "transcription-model", children: "Transcription model" }), _jsxs("select", { id: "transcription-model", value: settings.transcriptionModel, onChange: (event) => onChange({ ...settings, transcriptionModel: event.target.value }), children: [_jsx("option", { value: "gpt-4o-mini-transcribe", children: "GPT-4o mini transcribe" }), _jsx("option", { value: "gpt-4o-transcribe", children: "GPT-4o transcribe" }), _jsx("option", { value: "gpt-4o-transcribe-diarize", children: "GPT-4o transcribe diarize" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "theme-select", children: "Theme" }), _jsxs("select", { id: "theme-select", value: settings.theme, onChange: (event) => onChange({ ...settings, theme: event.target.value }), children: [_jsx("option", { value: "modern-olive", children: "Modern Olive" }), _jsx("option", { value: "classic-blue", children: "Classic Blue" }), _jsx("option", { value: "graphite-forest", children: "Graphite Forest" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "desktop-default-template", children: "Default desktop template" }), _jsx("select", { id: "desktop-default-template", value: settings.preferredDesktopTemplateId, onChange: (event) => onChange({ ...settings, preferredDesktopTemplateId: event.target.value }), children: templateOptions.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-language", children: "Output language" }), _jsxs("select", { id: "output-language", value: settings.outputLanguage, onChange: (event) => onChange({
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
                                        }), children: "Remove" }) })] }, entry.id))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "generation-system", children: "Generation system prompt" }), _jsx("textarea", { id: "generation-system", value: settings.promptProfile.generationSystem, onChange: (event) => onChange({
                                    ...settings,
                                    promptProfile: {
                                        ...settings.promptProfile,
                                        generationSystem: event.target.value,
                                    },
                                }) })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onImportLegacy(), children: "Import current browser app data" }), _jsx("p", { className: "tiny-text", children: "This brings over sessions, custom templates, todos, participants, abbreviations, and prompt settings from the current PWA when present." })] })] }));
};
