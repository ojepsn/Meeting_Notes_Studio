import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
import { DEFAULT_GENERATION_RULES, DEFAULT_GENERATION_SYSTEM_PROMPT, DEFAULT_REVISION_RULES, DEFAULT_TRANSLATION_RULES, } from "@notesmith/prompts";
import { TemplatesCard } from "../../templates/components/TemplatesCard";
const SETTINGS_SECTIONS = [
    { id: "ai", label: "AI Settings", description: "Models, API key, transcription" },
    { id: "diagnostics", label: "AI Diagnostics", description: "Metrics, cache, and recent AI history" },
    { id: "themes", label: "Themes", description: "Look and feel" },
    { id: "output", label: "Output formatting", description: "Language and output defaults" },
    { id: "people", label: "People", description: "Saved people and abbreviations" },
    { id: "prompts", label: "Prompts", description: "Generation and revision instructions" },
    { id: "templates", label: "Templates for meetings/notes", description: "Built-in and custom note structures" },
    { id: "other", label: "Other upcoming settings", description: "Migration, updates, future options" },
];
const TEXT_MODEL_QUICK_CHOICES = [
    {
        id: "recommended",
        label: "Recommended",
        description: "Best starting point for most high-quality note generation and revision work.",
        modelId: "gpt-5.4",
    },
    {
        id: "faster",
        label: "Faster",
        description: "Good day-to-day balance when speed and cost matter more than flagship quality.",
        modelId: "gpt-5.4-mini",
    },
    {
        id: "cheaper",
        label: "Cheaper",
        description: "Lowest-cost option for simpler formatting and lightweight transformations.",
        modelId: "gpt-5.4-nano",
    },
    {
        id: "best-quality",
        label: "Best quality",
        description: "Use for the hardest and most important drafting tasks when extra compute is worth it.",
        modelId: "gpt-5.4-pro",
    },
];
const TRANSCRIPTION_MODEL_QUICK_CHOICES = [
    {
        id: "recommended",
        label: "Recommended",
        description: "Best everyday choice for routine recordings and normal desktop capture.",
        modelId: "gpt-4o-mini-transcribe",
    },
    {
        id: "higher-accuracy",
        label: "Higher accuracy",
        description: "Better for important recordings where transcript quality matters more than cost.",
        modelId: "gpt-4o-transcribe",
    },
    {
        id: "speaker-labels",
        label: "Speaker labels",
        description: "Best when identifying who said what matters in meetings and interviews.",
        modelId: "gpt-4o-transcribe-diarize",
    },
];
const findQuickChoiceForModel = (choices, modelId) => choices.find((choice) => choice.modelId === modelId) ?? null;
const DESKTOP_THEMES = [
    {
        id: "fluent-slate",
        label: "Fluent Slate",
        description: "A calm professional default with restrained blue accents and quiet neutral surfaces.",
        bestFor: "Best all-round business default",
        swatches: {
            light: ["#f7f8fb", "#e8edf5", "#4f77cc"],
            dark: ["#151a22", "#202633", "#7fa4ff"],
        },
    },
    {
        id: "atlas-blue",
        label: "Atlas Blue",
        description: "A familiar enterprise look with crisp structure, clarity, and dependable blue emphasis.",
        bestFor: "Best for classic enterprise feel",
        swatches: {
            light: ["#f7f9fc", "#e3ebf7", "#2d62c9"],
            dark: ["#121826", "#1c2740", "#6e9eff"],
        },
    },
    {
        id: "graphite-forest",
        label: "Graphite Forest",
        description: "A low-fatigue theme for long sessions, with deep neutrals and muted green focus accents.",
        bestFor: "Best for long focused work",
        swatches: {
            light: ["#f5f5f1", "#e6e7df", "#4f755a"],
            dark: ["#171a18", "#232824", "#87b092"],
        },
    },
    {
        id: "stone-olive",
        label: "Stone Olive",
        description: "A warmer premium theme with stone neutrals and olive accents that still feels serious and productive.",
        bestFor: "Best for a distinctive premium desktop feel",
        swatches: {
            light: ["#f7f5ef", "#ebe6d7", "#6a7440"],
            dark: ["#1c1b17", "#2a2923", "#a8b57a"],
        },
    },
    {
        id: "nordic-teal",
        label: "Nordic Teal",
        description: "A crisp contemporary theme with cool neutrals and teal accents for a modern technical feel.",
        bestFor: "Best for modern, technical, efficient work",
        swatches: {
            light: ["#f4f8f9", "#e1ebee", "#2d8c92"],
            dark: ["#0f171c", "#17242c", "#4ab8bf"],
        },
    },
    {
        id: "copper-ink",
        label: "Copper Ink",
        description: "A warmer executive-style theme with editorial contrast and muted copper emphasis.",
        bestFor: "Best for premium, focused, editorial-style work",
        swatches: {
            light: ["#f8f3ea", "#e7ddd0", "#9a6546"],
            dark: ["#13100d", "#211a15", "#d09a6b"],
        },
    },
];
const THEME_MODE_OPTIONS = [
    { id: "light", label: "Light", description: "Bright neutral workspace for daytime and high-clarity work." },
    { id: "dark", label: "Dark", description: "Lower-glare workspace for late sessions and visual calm." },
];
const parseThemeValue = (value) => {
    const match = value.match(/^(.*?)-(light|dark)$/);
    if (!match) {
        return { familyId: "fluent-slate", mode: "light" };
    }
    return {
        familyId: match[1],
        mode: match[2],
    };
};
const buildThemeValue = (familyId, mode) => `${familyId}-${mode}`;
export const SettingsCard = ({ settings, templates, initialSection = "ai", onChange, onSaveTemplate, onImportLegacy, onCheckForUpdates, onRefreshModelPricing, updateStatusNote, aiDiagnostics, aiRequestHistory, textModelOptions, transcriptionModelOptions, modelPricingStatus, isRefreshingModelPricing, }) => {
    const [activeSection, setActiveSection] = useState(initialSection);
    const [showAdvancedTextModels, setShowAdvancedTextModels] = useState(false);
    const [showAdvancedTranscriptionModels, setShowAdvancedTranscriptionModels] = useState(false);
    const [personDraft, setPersonDraft] = useState("");
    const [abbrShort, setAbbrShort] = useState("");
    const [abbrFull, setAbbrFull] = useState("");
    const [extraBlockLabel, setExtraBlockLabel] = useState("");
    const [extraBlockBody, setExtraBlockBody] = useState("");
    useEffect(() => {
        if (initialSection && SETTINGS_SECTIONS.some((section) => section.id === initialSection)) {
            setActiveSection(initialSection);
        }
    }, [initialSection]);
    const updatePromptProfile = (nextPromptProfile) => onChange({
        ...settings,
        promptProfile: nextPromptProfile,
    });
    const updateExtraBlock = (id, updates) => updatePromptProfile({
        ...settings.promptProfile,
        extraBlocks: settings.promptProfile.extraBlocks.map((block) => block.id === id ? { ...block, ...updates } : block),
    });
    const selectedTextModel = textModelOptions.find((option) => option.id === settings.textModel) ?? textModelOptions[0] ?? null;
    const selectedTranscriptionModel = transcriptionModelOptions.find((option) => option.id === settings.transcriptionModel) ?? transcriptionModelOptions[0] ?? null;
    const selectedTextQuickChoice = findQuickChoiceForModel(TEXT_MODEL_QUICK_CHOICES, selectedTextModel?.id || settings.textModel);
    const selectedTranscriptionQuickChoice = findQuickChoiceForModel(TRANSCRIPTION_MODEL_QUICK_CHOICES, selectedTranscriptionModel?.id || settings.transcriptionModel);
    const selectedTheme = parseThemeValue(settings.theme);
    const selectedThemeDefinition = DESKTOP_THEMES.find((theme) => theme.id === selectedTheme.familyId) ?? DESKTOP_THEMES[0];
    const updateThemeFamily = (familyId) => onChange({ ...settings, theme: buildThemeValue(familyId, selectedTheme.mode) });
    const updateThemeMode = (mode) => onChange({ ...settings, theme: buildThemeValue(selectedTheme.familyId, mode) });
    const renderQuickChoicePicker = ({ title, description, choices, selectedModelId, onSelect, }) => (_jsxs("div", { className: "ai-quick-choice-section", children: [_jsx("div", { className: "model-picker-header", children: _jsxs("div", { children: [_jsx("h4", { children: title }), _jsx("p", { children: description })] }) }), _jsx("div", { className: "ai-quick-choice-grid", children: choices.map((choice) => {
                    const isSelected = choice.modelId === selectedModelId;
                    return (_jsxs("button", { type: "button", className: "ai-quick-choice-card", "data-active": isSelected, onClick: () => onSelect(choice.modelId), children: [_jsx("strong", { children: choice.label }), _jsx("p", { children: choice.description }), isSelected ? _jsx("span", { className: "model-option-selected", children: "Selected" }) : null] }, choice.id));
                }) })] }));
    const renderModelCards = ({ title, description, options, selectedId, onSelect, }) => (_jsxs("div", { className: "model-picker-section", children: [_jsx("div", { className: "model-picker-header", children: _jsxs("div", { children: [_jsx("h4", { children: title }), _jsx("p", { children: description })] }) }), _jsx("div", { className: "model-picker-grid", children: options.map((option) => {
                    const isSelected = option.id === selectedId;
                    return (_jsxs("button", { type: "button", className: "model-option-card", "data-active": isSelected, "aria-pressed": isSelected, onClick: () => onSelect(option.id), children: [_jsxs("div", { className: "model-option-header", children: [_jsxs("div", { children: [_jsxs("div", { className: "model-option-title-row", children: [_jsx("strong", { children: option.label }), isSelected ? _jsx("span", { className: "model-option-selected", children: "Selected" }) : null] }), _jsx("p", { children: option.summary })] }), _jsx("div", { className: "model-option-tags", children: option.tags.map((tag) => (_jsx("span", { className: "model-option-tag", children: tag }, tag))) })] }), _jsxs("div", { className: "model-option-copy-block", children: [_jsx("span", { className: "model-option-label", children: "Best for" }), _jsx("p", { children: option.recommendedFor })] }), _jsxs("div", { className: "model-option-copy-block", children: [_jsx("span", { className: "model-option-label", children: "Recommendation" }), _jsx("p", { children: option.recommendation })] }), _jsxs("div", { className: "model-option-copy-block", children: [_jsx("span", { className: "model-option-label", children: "Pricing" }), _jsx("ul", { className: "model-option-list", children: option.pricingLines.map((line) => (_jsx("li", { children: line }, line))) })] }), _jsxs("div", { className: "model-option-copy-block model-option-copy-block-compact", children: [_jsx("span", { className: "model-option-label", children: "Model details" }), _jsx("ul", { className: "model-option-list", children: option.metadataLines.map((line) => (_jsx("li", { children: line }, line))) })] })] }, option.id));
                }) })] }));
    return (_jsxs("div", { className: "settings-shell", id: "desktop-settings-card", children: [_jsxs("aside", { className: "settings-nav", children: [_jsxs("div", { children: [_jsx("h3", { children: "Settings" }), _jsx("p", { className: "muted", children: "One entry point, clearly separated sections." })] }), _jsx("div", { className: "settings-nav-list", children: SETTINGS_SECTIONS.map((section) => (_jsxs("button", { type: "button", className: "settings-nav-button", "data-active": activeSection === section.id, onClick: () => setActiveSection(section.id), children: [_jsx("span", { children: section.label }), _jsx("small", { children: section.description })] }, section.id))) })] }), _jsxs("section", { className: "settings-panel", children: [activeSection === "ai" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "AI Settings" }), _jsx("p", { children: "These settings stay local to this machine and are never written into shared data files." })] }), _jsx("div", { className: "ai-settings-summary", children: _jsxs("div", { className: "ai-settings-summary-grid", children: [_jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Text model" }), _jsx("strong", { children: selectedTextModel?.label || settings.textModel }), _jsx("span", { className: "tiny-text", children: selectedTextQuickChoice ? `${selectedTextQuickChoice.label} mode` : "Custom selection" })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Transcription" }), _jsx("strong", { children: selectedTranscriptionModel?.label || settings.transcriptionModel }), _jsx("span", { className: "tiny-text", children: selectedTranscriptionQuickChoice ? `${selectedTranscriptionQuickChoice.label} mode` : "Custom selection" })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Model data" }), _jsx("strong", { children: "OpenAI guidance" }), _jsx("span", { className: "tiny-text", children: modelPricingStatus })] })] }) }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "api-key", children: "API key" }), _jsx("input", { id: "api-key", type: "password", value: settings.apiKey, onChange: (event) => onChange({ ...settings, apiKey: event.target.value }), placeholder: "Stored locally on this machine only" })] }), renderQuickChoicePicker({
                                title: "Text model quick choices",
                                description: "Start with a simple decision first. You can open the detailed model cards below when you want deeper control.",
                                choices: TEXT_MODEL_QUICK_CHOICES,
                                selectedModelId: selectedTextModel?.id || settings.textModel,
                                onSelect: (textModel) => onChange({ ...settings, textModel }),
                            }), _jsx("div", { className: "inline-row", children: _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => setShowAdvancedTextModels((current) => !current), children: showAdvancedTextModels ? "Hide detailed text models" : "Show detailed text models" }) }), showAdvancedTextModels
                                ? renderModelCards({
                                    title: "Detailed text models",
                                    description: "Choose between the current OpenAI GPT-5.4 text models for note generation, revision, and translation.",
                                    options: textModelOptions,
                                    selectedId: selectedTextModel?.id || settings.textModel,
                                    onSelect: (textModel) => onChange({ ...settings, textModel }),
                                })
                                : null, renderQuickChoicePicker({
                                title: "Transcription quick choices",
                                description: "Pick the recording mode that matches your real task first, then open the detailed cards if you want the exact model and pricing details.",
                                choices: TRANSCRIPTION_MODEL_QUICK_CHOICES,
                                selectedModelId: selectedTranscriptionModel?.id || settings.transcriptionModel,
                                onSelect: (transcriptionModel) => onChange({ ...settings, transcriptionModel }),
                            }), _jsx("div", { className: "inline-row", children: _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => setShowAdvancedTranscriptionModels((current) => !current), children: showAdvancedTranscriptionModels ? "Hide detailed transcription models" : "Show detailed transcription models" }) }), showAdvancedTranscriptionModels
                                ? renderModelCards({
                                    title: "Detailed transcription models",
                                    description: "Choose the OpenAI transcription model that best fits your recording quality, speaker-label, and cost needs.",
                                    options: transcriptionModelOptions,
                                    selectedId: selectedTranscriptionModel?.id || settings.transcriptionModel,
                                    onSelect: (transcriptionModel) => onChange({ ...settings, transcriptionModel }),
                                })
                                : null, _jsx("div", { className: "inline-row", children: _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => void onRefreshModelPricing(), disabled: isRefreshingModelPricing, children: isRefreshingModelPricing ? "Refreshing model data..." : "Refresh pricing and recommendations" }) }), _jsx("p", { className: "tiny-text model-pricing-status-copy", children: modelPricingStatus })] })) : null, activeSection === "themes" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Themes" }), _jsx("p", { children: "Choose a curated desktop theme family, then switch between light and dark without losing the overall visual identity." })] }), _jsxs("div", { className: "ai-settings-summary-grid", children: [_jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Current family" }), _jsx("strong", { children: selectedThemeDefinition.label }), _jsx("span", { className: "tiny-text", children: selectedThemeDefinition.bestFor })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("span", { className: "model-option-label", children: "Current mode" }), _jsx("strong", { children: selectedTheme.mode === "light" ? "Light" : "Dark" }), _jsx("span", { className: "tiny-text", children: "Theme stays local to this machine as a UI preference." })] })] }), _jsx("div", { className: "theme-mode-grid", children: THEME_MODE_OPTIONS.map((option) => {
                                    const isSelected = selectedTheme.mode === option.id;
                                    return (_jsxs("button", { type: "button", className: "theme-mode-card", "data-active": isSelected, onClick: () => updateThemeMode(option.id), children: [_jsx("strong", { children: option.label }), _jsx("p", { children: option.description }), isSelected ? _jsx("span", { className: "model-option-selected", children: "Selected" }) : null] }, option.id));
                                }) }), _jsx("div", { className: "theme-preview-grid", children: DESKTOP_THEMES.map((theme) => {
                                    const isSelected = theme.id === selectedTheme.familyId;
                                    const swatches = selectedTheme.mode === "dark" ? theme.swatches.dark : theme.swatches.light;
                                    return (_jsxs("button", { type: "button", className: "theme-preview-card", "data-active": isSelected, onClick: () => updateThemeFamily(theme.id), children: [_jsx("div", { className: "theme-preview-surface", children: _jsx("div", { className: "theme-preview-swatch-row", children: swatches.map((swatch) => (_jsx("span", { className: "theme-preview-swatch", style: { background: swatch } }, swatch))) }) }), _jsxs("div", { className: "theme-preview-copy", children: [_jsxs("div", { className: "theme-preview-title-row", children: [_jsx("strong", { children: theme.label }), isSelected ? _jsx("span", { className: "model-option-selected", children: "Selected" }) : null] }), _jsx("p", { children: theme.description }), _jsx("span", { className: "tiny-text", children: theme.bestFor })] })] }, theme.id));
                                }) })] })) : null, activeSection === "output" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Output formatting" }), _jsx("p", { children: "These defaults shape how generated notes should read and which template should open by default." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "desktop-default-template", children: "Default desktop template" }), _jsx("select", { id: "desktop-default-template", value: settings.preferredDesktopTemplateId, onChange: (event) => onChange({ ...settings, preferredDesktopTemplateId: event.target.value }), children: BUILTIN_TEMPLATES.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-language", children: "Output language" }), _jsxs("select", { id: "output-language", value: settings.outputLanguage, onChange: (event) => onChange({
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
                                                            }), children: "Remove" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-label-${block.id}`, children: "Label" }), _jsx("input", { id: `prompt-block-label-${block.id}`, value: block.label, onChange: (event) => updateExtraBlock(block.id, { label: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-body-${block.id}`, children: "Instructions" }), _jsx("textarea", { id: `prompt-block-body-${block.id}`, value: block.body, onChange: (event) => updateExtraBlock(block.id, { body: event.target.value }) })] })] }, block.id))) })] })] })) : null, activeSection === "templates" ? (_jsx(TemplatesCard, { templates: templates, onSave: onSaveTemplate })) : null, activeSection === "diagnostics" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "AI Diagnostics" }), _jsx("p", { children: "Local visibility into request volume, cache hits, retries, failures, and recent AI activity." })] }), _jsxs("div", { className: "section-divider diagnostics-panel", children: [_jsxs("div", { children: [_jsx("h3", { children: "Snapshot" }), _jsx("p", { className: "muted", children: "Per-operation totals and a rolled-up summary for the current app state." })] }), _jsx("div", { className: "diagnostics-grid", children: aiDiagnostics.map((entry) => (_jsxs("div", { className: "diagnostics-card", children: [_jsx("strong", { children: entry.operation === "totals" ? "All AI requests" : entry.operation }), _jsxs("span", { className: "tiny-text", children: [entry.requestCount, " requests"] }), _jsxs("span", { className: "tiny-text", children: [entry.successRate, "% success"] }), _jsxs("span", { className: "tiny-text", children: [entry.cacheHitCount, " cache hits"] }), _jsxs("span", { className: "tiny-text", children: [entry.retryCount, " retries"] }), _jsxs("span", { className: "tiny-text", children: [entry.averageDurationMs, " ms avg success"] })] }, entry.operation))) })] }), _jsxs("div", { className: "section-divider diagnostics-panel", children: [_jsxs("div", { children: [_jsx("h3", { children: "Recent AI Request History" }), _jsx("p", { className: "muted", children: "Bounded local history for support and debugging. Newest entries appear first." })] }), aiRequestHistory.length ? (_jsx("div", { className: "section-list", children: aiRequestHistory.map((entry) => (_jsxs("div", { className: "list-item diagnostics-history-item", children: [_jsxs("div", { className: "inline-row diagnostics-history-head", children: [_jsx("strong", { children: entry.operation }), _jsx("span", { className: "tiny-text", children: new Date(entry.timestamp).toLocaleString() })] }), _jsxs("div", { className: "diagnostics-history-meta", children: [_jsx("span", { className: "tiny-text", children: entry.status }), _jsxs("span", { className: "tiny-text", children: [entry.durationMs, " ms"] }), _jsxs("span", { className: "tiny-text", children: [entry.retryCount, " retries"] }), _jsx("span", { className: "tiny-text", children: entry.cached ? "cache hit" : "live request" }), entry.promptVersion ? _jsxs("span", { className: "tiny-text", children: ["prompt ", entry.promptVersion] }) : null, entry.errorCode ? _jsx("span", { className: "tiny-text", children: entry.errorCode }) : null] }), entry.errorMessage ? _jsx("p", { className: "tiny-text diagnostics-history-error", children: entry.errorMessage }) : null] }, entry.requestId))) })) : (_jsx("p", { className: "tiny-text", children: "No AI request history has been recorded yet." }))] })] })) : null, activeSection === "other" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Other upcoming settings" }), _jsx("p", { children: "This section gathers the miscellaneous desktop settings that do not belong to the main note-taking flow." })] }), _jsxs("div", { className: "inline-row", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void onCheckForUpdates(), children: "Check for updates" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onImportLegacy(), children: "Import current browser app data" })] }), updateStatusNote ? _jsx("p", { className: "tiny-text", children: updateStatusNote }) : null, _jsx("p", { className: "tiny-text", children: "This is also the right place for upcoming settings that should exist, but not compete with the primary workspace." })] })) : null] })] }));
};
