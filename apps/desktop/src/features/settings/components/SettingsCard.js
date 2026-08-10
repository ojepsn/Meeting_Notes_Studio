import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getTemplatesForCaptureMode } from "@notesmith/domain";
import { DEFAULT_MEETING_MINUTES_RULES, DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT, DEFAULT_PERSONAL_NOTES_RULES, DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT, DEFAULT_REVISION_RULES, DEFAULT_TRANSLATION_RULES, } from "@notesmith/prompts";
import { OUTPUT_LAYOUT_PRESETS } from "../../../lib/export/outputLayouts";
import { TemplatesCard } from "../../templates/components/TemplatesCard";
import { buildRichTextCommands } from "../../richTextCommands/RichTextCommandMenu";
const SETTINGS_SECTIONS = [
    { id: "ai", label: "AI Settings", description: "Models, API key, transcription" },
    { id: "diagnostics", label: "AI Diagnostics", description: "Metrics, cache, and recent AI history" },
    { id: "themes", label: "Themes", description: "Look and feel" },
    { id: "output", label: "Output formatting", description: "Language and output defaults" },
    { id: "commands", label: "Text commands", description: "Fast snippets in rich-text fields" },
    { id: "people", label: "People, Domains & Projects", description: "Reusable people, structure, and shorthand" },
    { id: "prompts", label: "Prompts", description: "Generation and revision instructions" },
    { id: "templates", label: "Templates for meetings/notes", description: "Built-in and custom note structures" },
    { id: "other", label: "Other upcoming settings", description: "Migration, updates, future options" },
];
const TEXT_MODEL_QUICK_CHOICES = [
    {
        id: "recommended",
        label: "Recommended",
        description: "Best starting point for most high-quality note generation and revision work.",
        modelId: "gpt-5.6-terra",
    },
    {
        id: "faster",
        label: "Faster",
        description: "Good day-to-day balance when speed and cost matter more than flagship quality.",
        modelId: "gpt-5.6-luna",
    },
    {
        id: "flagship",
        label: "Flagship",
        description: "Strongest current OpenAI model for the most important drafting and restructuring work.",
        modelId: "gpt-5.6-sol",
    },
    {
        id: "best-value",
        label: "Best value",
        description: "Best current balance of cost and quality for most day-to-day work.",
        modelId: "gpt-5.6-terra",
    },
];
const TRANSCRIPTION_MODEL_QUICK_CHOICES = [
    {
        id: "recommended",
        label: "Recommended",
        description: "Current OpenAI default for accurate everyday recordings and uploaded audio.",
        modelId: "gpt-transcribe",
    },
    {
        id: "higher-accuracy",
        label: "GPT-4o",
        description: "Good when you intentionally want the GPT-4o transcription profile for important recordings.",
        modelId: "gpt-4o-transcribe",
    },
    {
        id: "lower-cost",
        label: "Lower cost",
        description: "Best for routine recordings when you want the least expensive GPT-4o-family option.",
        modelId: "gpt-4o-mini-transcribe",
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
export const SettingsCard = ({ settings, templates, initialSection = "ai", onChange, onSaveTemplate, onResetTemplates, onImportLegacy, onImportBackup, onCheckForUpdates, onInstallUpdate, onOpenManualUpdate, onOpenDataFolder, onOpenDatabaseFolder, onExportBackup, onSaveBackupAs, onRefreshModelPricing, updateStatusNote, desktopVersion, desktopBundleType, availableUpdateVersion, manualUpdateUrl, isCheckingForUpdates, isInstallingUpdate, storageInfo, latestLocalBackupInfo, aiDiagnostics, aiRequestHistory, textModelOptions, transcriptionModelOptions, modelPricingStatus, isRefreshingModelPricing, }) => {
    const [activeSection, setActiveSection] = useState(initialSection);
    const [showAdvancedTextModels, setShowAdvancedTextModels] = useState(false);
    const [showAdvancedTranscriptionModels, setShowAdvancedTranscriptionModels] = useState(false);
    const [personDraft, setPersonDraft] = useState("");
    const [projectDraft, setProjectDraft] = useState("");
    const [domainDraft, setDomainDraft] = useState("");
    const [activityDraft, setActivityDraft] = useState("");
    const [tagDraft, setTagDraft] = useState("");
    const [abbrShort, setAbbrShort] = useState("");
    const [abbrFull, setAbbrFull] = useState("");
    const [commandTrigger, setCommandTrigger] = useState("");
    const [commandLabel, setCommandLabel] = useState("");
    const [commandTemplate, setCommandTemplate] = useState("");
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
    const normalizedCommandTrigger = commandTrigger.replace(/^@+/, "").trim().toLowerCase();
    const builtInTextCommands = buildRichTextCommands();
    const reservedCommandTriggers = new Set(builtInTextCommands.map((command) => command.trigger));
    const savedCommandTriggers = new Set((settings.richTextCommands || []).map((command) => command.trigger));
    const canAddTextCommand = /^[a-z0-9_-]{1,24}$/.test(normalizedCommandTrigger) &&
        commandTemplate.trim().length > 0 &&
        !reservedCommandTriggers.has(normalizedCommandTrigger) &&
        !savedCommandTriggers.has(normalizedCommandTrigger);
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
    const meetingTemplateOptions = getTemplatesForCaptureMode(templates, "meeting-note");
    const pendingRuleSuggestions = settings.ruleSuggestions.filter((entry) => entry.status === "pending" && !entry.ignoreForever);
    const ignoredRuleSuggestions = settings.ruleSuggestions.filter((entry) => entry.status === "ignored");
    const pendingAbbreviationSuggestions = pendingRuleSuggestions.filter((entry) => entry.type === "abbreviation");
    const pendingPreferredNameSuggestions = pendingRuleSuggestions.filter((entry) => entry.type === "preferred_name");
    const ignoredAbbreviationSuggestions = ignoredRuleSuggestions.filter((entry) => entry.type === "abbreviation");
    const ignoredPreferredNameSuggestions = ignoredRuleSuggestions.filter((entry) => entry.type === "preferred_name");
    const updateThemeFamily = (familyId) => onChange({ ...settings, theme: buildThemeValue(familyId, selectedTheme.mode) });
    const updateThemeMode = (mode) => onChange({ ...settings, theme: buildThemeValue(selectedTheme.familyId, mode) });
    const restorePromptDefaults = () => updatePromptProfile({
        meetingMinutesSystem: DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
        meetingMinutesRules: DEFAULT_MEETING_MINUTES_RULES,
        personalNotesSystem: DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
        personalNotesRules: DEFAULT_PERSONAL_NOTES_RULES,
        revisionRules: DEFAULT_REVISION_RULES,
        translationRules: DEFAULT_TRANSLATION_RULES,
        extraBlocks: settings.promptProfile.extraBlocks,
    });
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
                                    description: "Choose between the current OpenAI text models for note generation, revision, and translation. The catalog refreshes from OpenAI every day.",
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
                                }) })] })) : null, activeSection === "output" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Output formatting" }), _jsx("p", { children: "These defaults shape how generated notes read on screen and how Word and PDF exports are styled." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "desktop-default-template", children: "Default desktop template" }), _jsx("select", { id: "desktop-default-template", value: settings.preferredDesktopTemplateId, onChange: (event) => onChange({ ...settings, preferredDesktopTemplateId: event.target.value }), children: meetingTemplateOptions.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-language", children: "Output language" }), _jsxs("select", { id: "output-language", value: settings.outputLanguage, onChange: (event) => onChange({
                                            ...settings,
                                            outputLanguage: event.target.value,
                                        }), children: [_jsx("option", { value: "same", children: "Same as source" }), _jsx("option", { value: "sv", children: "Swedish" }), _jsx("option", { value: "en", children: "English" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-layout-preset", children: "Document layout preset" }), _jsx("select", { id: "output-layout-preset", value: settings.outputLayoutPresetId, onChange: (event) => onChange({ ...settings, outputLayoutPresetId: event.target.value }), children: OUTPUT_LAYOUT_PRESETS.map((preset) => (_jsx("option", { value: preset.id, children: preset.label }, preset.id))) })] }), _jsx("div", { className: "settings-option-grid", children: OUTPUT_LAYOUT_PRESETS.map((preset) => {
                                    const isSelected = settings.outputLayoutPresetId === preset.id;
                                    return (_jsxs("button", { className: `settings-option-card${isSelected ? " settings-option-card-selected" : ""}`, type: "button", onClick: () => onChange({ ...settings, outputLayoutPresetId: preset.id }), children: [_jsxs("div", { className: "model-option-title-row", children: [_jsx("strong", { children: preset.label }), isSelected ? _jsx("span", { className: "model-option-selected", children: "Selected" }) : null] }), _jsx("p", { children: preset.description }), _jsxs("div", { className: "model-option-copy-block model-option-copy-block-compact", children: [_jsx("span", { className: "model-option-label", children: "Typography" }), _jsxs("span", { className: "tiny-text", children: ["Headers: ", preset.style.headingFont.split(",")[0].replaceAll("\"", "")] }), _jsxs("span", { className: "tiny-text", children: ["Body: ", preset.style.bodyFont.split(",")[0].replaceAll("\"", ""), " \u00B7 ", preset.style.bodySize, " pt \u00B7 ", preset.style.lineHeight, " line height"] })] }), _jsxs("div", { className: "model-option-copy-block model-option-copy-block-compact", children: [_jsx("span", { className: "model-option-label", children: "Best for" }), _jsx("span", { className: "tiny-text", children: preset.bestFor })] })] }, preset.id));
                                }) })] })) : null, activeSection === "commands" ? (_jsxs("div", { className: "sidebar-card settings-text-commands-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Text commands" }), _jsx("p", { children: "Type @ in any rich-text field to search commands. Press Space after an exact command, or use Enter, Tab, or the command menu to insert it." })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Built-in commands" }), _jsx("span", { className: "tiny-text", children: "Dates and times use this computer's current timezone." })] }), _jsx("div", { className: "text-command-reference-grid", children: builtInTextCommands.map((command) => (_jsxs("div", { className: "text-command-reference", children: [_jsxs("strong", { children: ["@", command.trigger] }), _jsx("span", { children: command.label }), _jsx("small", { children: command.description })] }, command.trigger))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Custom commands" }), _jsxs("span", { className: "tiny-text", children: ["Available placeholders: ", "{date}", ", ", "{time}", ", ", "{datetime}", ", ", "{tomorrow}", ", ", "{yesterday}", ", ", "{week}", ", and ", "{day}", "."] })] }), _jsxs("div", { className: "text-command-form", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "text-command-trigger", children: "Command" }), _jsxs("div", { className: "text-command-trigger-input", children: [_jsx("span", { children: "@" }), _jsx("input", { id: "text-command-trigger", value: commandTrigger, onChange: (event) => setCommandTrigger(event.target.value), placeholder: "followup" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "text-command-label", children: "Menu label" }), _jsx("input", { id: "text-command-label", value: commandLabel, onChange: (event) => setCommandLabel(event.target.value), placeholder: "Follow-up reminder" })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "text-command-template", children: "Inserted text" }), _jsx("textarea", { id: "text-command-template", value: commandTemplate, onChange: (event) => setCommandTemplate(event.target.value), placeholder: "Follow up by {tomorrow}: ", rows: 4 })] }), _jsx("button", { className: "primary-button", type: "button", disabled: !canAddTextCommand, onClick: () => {
                                                    if (!canAddTextCommand)
                                                        return;
                                                    onChange({
                                                        ...settings,
                                                        richTextCommands: [
                                                            ...(settings.richTextCommands || []),
                                                            {
                                                                id: crypto.randomUUID(),
                                                                trigger: normalizedCommandTrigger,
                                                                label: commandLabel.trim() || normalizedCommandTrigger,
                                                                template: commandTemplate,
                                                            },
                                                        ],
                                                    });
                                                    setCommandTrigger("");
                                                    setCommandLabel("");
                                                    setCommandTemplate("");
                                                }, children: "Add command" }), normalizedCommandTrigger && reservedCommandTriggers.has(normalizedCommandTrigger) ? (_jsxs("span", { className: "tiny-text settings-command-warning", children: ["@", normalizedCommandTrigger, " is a built-in command."] })) : null, normalizedCommandTrigger && savedCommandTriggers.has(normalizedCommandTrigger) ? (_jsxs("span", { className: "tiny-text settings-command-warning", children: ["@", normalizedCommandTrigger, " is already saved."] })) : null] }), _jsxs("div", { className: "section-list", children: [(settings.richTextCommands || []).map((command) => (_jsxs("div", { className: "list-item text-command-saved-item", children: [_jsxs("strong", { children: ["@", command.trigger] }), _jsx("span", { children: command.label }), _jsx("small", { children: command.template }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                                ...settings,
                                                                richTextCommands: (settings.richTextCommands || []).filter((entry) => entry.id !== command.id),
                                                            }), children: "Remove" }) })] }, command.id))), !(settings.richTextCommands || []).length ? _jsx("p", { className: "tiny-text", children: "No custom commands yet." }) : null] })] })] })) : null, activeSection === "people" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "People, Domains & Projects" }), _jsx("p", { children: "Manage the slower shared structure here, so the execution workspaces can stay focused on fast capture, scheduling, and time." })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "People" }), _jsx("span", { className: "tiny-text", children: "Reusable contacts and meeting participants." })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "person-draft", children: "Saved people" }), _jsx("input", { id: "person-draft", value: personDraft, onChange: (event) => setPersonDraft(event.target.value), placeholder: "Add person" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
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
                                                        }), children: "Remove" }) })] }, participant))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Projects" }), _jsx("span", { className: "tiny-text", children: "Reusable delivery tracks and workstreams." })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "project-draft", children: "Saved projects" }), _jsx("input", { id: "project-draft", value: projectDraft, onChange: (event) => setProjectDraft(event.target.value), placeholder: "Add project" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                                    const nextValue = projectDraft.trim();
                                                    if (!nextValue)
                                                        return;
                                                    onChange({
                                                        ...settings,
                                                        savedProjects: Array.from(new Set([...settings.savedProjects, nextValue])).sort(),
                                                    });
                                                    setProjectDraft("");
                                                }, children: "Add" })] }), _jsx("div", { className: "section-list", children: settings.savedProjects.map((project) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: project }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                            ...settings,
                                                            savedProjects: settings.savedProjects.filter((entry) => entry !== project),
                                                        }), children: "Remove" }) })] }, project))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Domains" }), _jsx("span", { className: "tiny-text", children: "Top-level business areas above projects." })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "domain-draft", children: "Saved domains" }), _jsx("input", { id: "domain-draft", value: domainDraft, onChange: (event) => setDomainDraft(event.target.value), placeholder: "Add domain" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                                    const nextValue = domainDraft.trim();
                                                    if (!nextValue)
                                                        return;
                                                    onChange({
                                                        ...settings,
                                                        savedDomains: Array.from(new Set([...settings.savedDomains, nextValue])).sort(),
                                                    });
                                                    setDomainDraft("");
                                                }, children: "Add" })] }), _jsx("div", { className: "section-list", children: settings.savedDomains.map((domain) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: domain }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                            ...settings,
                                                            savedDomains: settings.savedDomains.filter((entry) => entry !== domain),
                                                        }), children: "Remove" }) })] }, domain))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Activity labels" }), _jsx("span", { className: "tiny-text", children: "Reusable labels that help with faster linking and filtering." })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "activity-draft", children: "Saved activities" }), _jsx("input", { id: "activity-draft", value: activityDraft, onChange: (event) => setActivityDraft(event.target.value), placeholder: "Add activity" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                                    const nextValue = activityDraft.trim();
                                                    if (!nextValue)
                                                        return;
                                                    onChange({
                                                        ...settings,
                                                        savedActivities: Array.from(new Set([...settings.savedActivities, nextValue])).sort(),
                                                    });
                                                    setActivityDraft("");
                                                }, children: "Add" })] }), _jsx("div", { className: "section-list", children: settings.savedActivities.map((activity) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activity }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                            ...settings,
                                                            savedActivities: settings.savedActivities.filter((entry) => entry !== activity),
                                                        }), children: "Remove" }) })] }, activity))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Tags" }), _jsx("span", { className: "tiny-text", children: "Flexible labels for cross-cutting filters and future reporting." })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "tag-draft", children: "Saved tags" }), _jsx("input", { id: "tag-draft", value: tagDraft, onChange: (event) => setTagDraft(event.target.value), placeholder: "Add tag" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                                    const nextValue = tagDraft.trim();
                                                    if (!nextValue)
                                                        return;
                                                    onChange({
                                                        ...settings,
                                                        savedTags: Array.from(new Set([...settings.savedTags, nextValue])).sort(),
                                                    });
                                                    setTagDraft("");
                                                }, children: "Add" })] }), _jsx("div", { className: "section-list", children: settings.savedTags.map((tag) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: tag }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                            ...settings,
                                                            savedTags: settings.savedTags.filter((entry) => entry !== tag),
                                                        }), children: "Remove" }) })] }, tag))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Abbreviations" }), _jsx("span", { className: "tiny-text", children: "Expand shorthand consistently during cleanup and output generation." })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "abbr-short", children: "Abbreviation" }), _jsx("input", { id: "abbr-short", value: abbrShort, onChange: (event) => setAbbrShort(event.target.value), placeholder: "e.g. FYI" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "abbr-full", children: "Full wording" }), _jsx("input", { id: "abbr-full", value: abbrFull, onChange: (event) => setAbbrFull(event.target.value), placeholder: "For your information" })] }), _jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
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
                                                        }), children: "Remove" }) })] }, entry.id))) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Preferred participant names" }), _jsx("span", { className: "tiny-text", children: "Expand short participant-name forms into the preferred full name when the mapping is clear." })] }), _jsx("div", { className: "section-list", children: settings.preferredParticipantNames.length ? settings.preferredParticipantNames.map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.shortForm }), _jsx("span", { className: "muted", children: entry.fullName }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onChange({
                                                            ...settings,
                                                            preferredParticipantNames: settings.preferredParticipantNames.filter((item) => item.id !== entry.id),
                                                        }), children: "Remove" }) })] }, entry.id))) : _jsx("p", { className: "tiny-text", children: "No preferred participant-name rules saved yet." }) })] }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { className: "settings-subsection-heading", children: [_jsx("strong", { children: "Suggested rules" }), _jsx("span", { className: "tiny-text", children: "Repeated shorthand and participant-name patterns can be reviewed here before they become reusable rules." })] }), _jsx("div", { className: "section-list", children: pendingAbbreviationSuggestions.length || pendingPreferredNameSuggestions.length ? ([...pendingAbbreviationSuggestions, ...pendingPreferredNameSuggestions].map((entry) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: entry.type === "abbreviation" ? "Suggested abbreviation" : "Preferred participant name" }), _jsxs("span", { className: "muted", children: [entry.sourceValue, " -> ", entry.suggestedValue, " \u00B7 Seen ", entry.evidenceCount, " times"] }), _jsxs("div", { className: "list-item-actions", children: [_jsx("button", { className: "small-button inline-action", type: "button", onClick: () => {
                                                                if (entry.type === "abbreviation") {
                                                                    const exists = settings.abbreviations.some((item) => item.shortForm.toLocaleLowerCase() === entry.sourceValue.toLocaleLowerCase());
                                                                    onChange({
                                                                        ...settings,
                                                                        abbreviations: exists
                                                                            ? settings.abbreviations
                                                                            : [
                                                                                ...settings.abbreviations,
                                                                                { id: crypto.randomUUID(), shortForm: entry.sourceValue, fullForm: entry.suggestedValue },
                                                                            ],
                                                                        ruleSuggestions: settings.ruleSuggestions.map((item) => item.id === entry.id
                                                                            ? { ...item, status: "accepted", ignoreForever: false, updatedAt: new Date().toISOString() }
                                                                            : item),
                                                                    });
                                                                    return;
                                                                }
                                                                const exists = settings.preferredParticipantNames.some((item) => item.shortForm.toLocaleLowerCase() === entry.sourceValue.toLocaleLowerCase()
                                                                    && item.fullName.toLocaleLowerCase() === entry.suggestedValue.toLocaleLowerCase());
                                                                onChange({
                                                                    ...settings,
                                                                    preferredParticipantNames: exists
                                                                        ? settings.preferredParticipantNames
                                                                        : [
                                                                            ...settings.preferredParticipantNames,
                                                                            { id: crypto.randomUUID(), shortForm: entry.sourceValue, fullName: entry.suggestedValue },
                                                                        ],
                                                                    ruleSuggestions: settings.ruleSuggestions.map((item) => item.id === entry.id
                                                                        ? { ...item, status: "accepted", ignoreForever: false, updatedAt: new Date().toISOString() }
                                                                        : item),
                                                                });
                                                            }, children: "Add" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onChange({
                                                                ...settings,
                                                                ruleSuggestions: settings.ruleSuggestions.map((item) => item.id === entry.id
                                                                    ? { ...item, status: "ignored", ignoreForever: true, updatedAt: new Date().toISOString() }
                                                                    : item),
                                                            }), children: "Never suggest" })] })] }, entry.id)))) : (_jsx("p", { className: "tiny-text", children: "No pending suggestions yet. New suggestions appear here after the same pattern is seen across sessions." })) }), ignoredAbbreviationSuggestions.length || ignoredPreferredNameSuggestions.length ? (_jsxs("div", { className: "section-list", children: [_jsx("p", { className: "tiny-text", children: "Ignored suggestions" }), [...ignoredAbbreviationSuggestions, ...ignoredPreferredNameSuggestions].map((entry) => (_jsxs("div", { className: "list-item", children: [_jsxs("strong", { children: [entry.sourceValue, " -> ", entry.suggestedValue] }), _jsx("span", { className: "muted", children: entry.type === "abbreviation" ? "Abbreviation suggestion" : "Participant-name suggestion" }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button", type: "button", onClick: () => onChange({
                                                                ...settings,
                                                                ruleSuggestions: settings.ruleSuggestions.map((item) => item.id === entry.id
                                                                    ? { ...item, status: "pending", ignoreForever: false, updatedAt: new Date().toISOString() }
                                                                    : item),
                                                            }), children: "Restore" }) })] }, entry.id)))] })) : null] })] })) : null, activeSection === "prompts" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Prompts" }), _jsx("p", { children: "Prompt management is organized by feature type so meeting minutes, personal notes, and future AI tools can evolve without turning settings into one long prompt page." })] }), _jsxs("div", { className: "diagnostics-grid", children: [_jsxs("div", { className: "diagnostics-card", children: [_jsx("strong", { children: "Generation workflows" }), _jsx("span", { className: "tiny-text", children: "Keep meeting minutes and personal-note polishing separate so each workflow can optimize for the right tone, structure, and level of synthesis." })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("strong", { children: "Shared post-processing" }), _jsx("span", { className: "tiny-text", children: "Revision and translation stay reusable across workflows so the prompt system scales cleanly as more AI features are added." })] }), _jsxs("div", { className: "diagnostics-card", children: [_jsx("strong", { children: "Reusable prompt blocks" }), _jsx("span", { className: "tiny-text", children: "Store optional add-on instructions once and reuse them across future AI tools instead of duplicating prompt logic everywhere." })] })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Meeting minutes" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsx("p", { className: "tiny-text", children: "Used for meeting-focused sessions where the expected outcome is a professional minutes document that emphasizes decisions, action items, and business-ready clarity." }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "meeting-minutes-system", children: "System prompt" }), _jsx("textarea", { id: "meeting-minutes-system", value: settings.promptProfile.meetingMinutesSystem, onChange: (event) => updatePromptProfile({
                                                            ...settings.promptProfile,
                                                            meetingMinutesSystem: event.target.value,
                                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "meeting-minutes-rules", children: "Generation rules" }), _jsx("textarea", { id: "meeting-minutes-rules", value: settings.promptProfile.meetingMinutesRules, onChange: (event) => updatePromptProfile({
                                                            ...settings.promptProfile,
                                                            meetingMinutesRules: event.target.value,
                                                        }) })] })] })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Personal notes & dictation" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsx("p", { className: "tiny-text", children: "Used for quick notes and voice notes where readability matters, but the output should stay proportionate to the original note instead of becoming formal meeting documentation." }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "personal-notes-system", children: "System prompt" }), _jsx("textarea", { id: "personal-notes-system", value: settings.promptProfile.personalNotesSystem, onChange: (event) => updatePromptProfile({
                                                            ...settings.promptProfile,
                                                            personalNotesSystem: event.target.value,
                                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "personal-notes-rules", children: "Generation rules" }), _jsx("textarea", { id: "personal-notes-rules", value: settings.promptProfile.personalNotesRules, onChange: (event) => updatePromptProfile({
                                                            ...settings.promptProfile,
                                                            personalNotesRules: event.target.value,
                                                        }) })] })] })] }), _jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Shared revision & translation" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsx("p", { className: "tiny-text", children: "These prompt families are shared across note types so polishing and translation stay consistent even as new AI-powered workflows are added later." }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "revision-rules", children: "Revision rules" }), _jsx("textarea", { id: "revision-rules", value: settings.promptProfile.revisionRules, onChange: (event) => updatePromptProfile({
                                                            ...settings.promptProfile,
                                                            revisionRules: event.target.value,
                                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "translation-rules", children: "Translation rules" }), _jsx("textarea", { id: "translation-rules", value: settings.promptProfile.translationRules, onChange: (event) => updatePromptProfile({
                                                            ...settings.promptProfile,
                                                            translationRules: event.target.value,
                                                        }) })] })] })] }), _jsxs("div", { className: "prompt-actions-row", children: [_jsxs("div", { className: "prompt-actions-copy", children: [_jsx("strong", { children: "Restore prompt defaults" }), _jsx("p", { className: "tiny-text", children: "Reload the latest built-in prompt families from the app for meeting minutes, personal notes, revision, and translation. Your reusable extra prompt blocks stay in place." })] }), _jsx("div", { className: "inline-row", children: _jsx("button", { className: "small-button", type: "button", onClick: restorePromptDefaults, children: "Restore prompt defaults" }) })] }), _jsx("p", { className: "tiny-text", children: "Use this when you want to replace edited built-in prompt families with the latest versions from the app without losing your reusable prompt blocks." }), _jsxs("div", { className: "section-divider", children: [_jsxs("div", { children: [_jsx("h3", { children: "Reusable extra prompt blocks" }), _jsx("p", { className: "muted", children: "Keep add-on instructions here so future AI features can reuse them without duplicating prompt logic everywhere." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "extra-block-label", children: "Block label" }), _jsx("input", { id: "extra-block-label", value: extraBlockLabel, onChange: (event) => setExtraBlockLabel(event.target.value), placeholder: "Example: Customer-friendly tone" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "extra-block-body", children: "Block instructions" }), _jsx("textarea", { id: "extra-block-body", value: extraBlockBody, onChange: (event) => setExtraBlockBody(event.target.value), placeholder: "Describe the additional generation guidance to apply when this block is enabled." })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
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
                                                            }), children: "Remove" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-label-${block.id}`, children: "Label" }), _jsx("input", { id: `prompt-block-label-${block.id}`, value: block.label, onChange: (event) => updateExtraBlock(block.id, { label: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `prompt-block-body-${block.id}`, children: "Instructions" }), _jsx("textarea", { id: `prompt-block-body-${block.id}`, value: block.body, onChange: (event) => updateExtraBlock(block.id, { body: event.target.value }) })] })] }, block.id))) })] })] })) : null, activeSection === "templates" ? (_jsx(TemplatesCard, { templates: templates, onSave: onSaveTemplate, onResetTemplates: onResetTemplates })) : null, activeSection === "diagnostics" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "AI Diagnostics" }), _jsx("p", { children: "Local visibility into request volume, cache hits, retries, failures, and recent AI activity." })] }), _jsxs("div", { className: "section-divider diagnostics-panel", children: [_jsxs("div", { children: [_jsx("h3", { children: "Snapshot" }), _jsx("p", { className: "muted", children: "Per-operation totals and a rolled-up summary for the current app state." })] }), _jsx("div", { className: "diagnostics-grid", children: aiDiagnostics.map((entry) => (_jsxs("div", { className: "diagnostics-card", children: [_jsx("strong", { children: entry.operation === "totals" ? "All AI requests" : entry.operation }), _jsxs("span", { className: "tiny-text", children: [entry.requestCount, " requests"] }), _jsxs("span", { className: "tiny-text", children: [entry.successRate, "% success"] }), _jsxs("span", { className: "tiny-text", children: [entry.cacheHitCount, " cache hits"] }), _jsxs("span", { className: "tiny-text", children: [entry.retryCount, " retries"] }), _jsxs("span", { className: "tiny-text", children: [entry.averageDurationMs, " ms avg success"] })] }, entry.operation))) })] }), _jsxs("div", { className: "section-divider diagnostics-panel", children: [_jsxs("div", { children: [_jsx("h3", { children: "Recent AI Request History" }), _jsx("p", { className: "muted", children: "Bounded local history for support and debugging. Newest entries appear first." })] }), aiRequestHistory.length ? (_jsx("div", { className: "section-list", children: aiRequestHistory.map((entry) => (_jsxs("div", { className: "list-item diagnostics-history-item", children: [_jsxs("div", { className: "inline-row diagnostics-history-head", children: [_jsx("strong", { children: entry.operation }), _jsx("span", { className: "tiny-text", children: new Date(entry.timestamp).toLocaleString() })] }), _jsxs("div", { className: "diagnostics-history-meta", children: [_jsx("span", { className: "tiny-text", children: entry.status }), _jsxs("span", { className: "tiny-text", children: [entry.durationMs, " ms"] }), _jsxs("span", { className: "tiny-text", children: [entry.retryCount, " retries"] }), _jsx("span", { className: "tiny-text", children: entry.cached ? "cache hit" : "live request" }), entry.promptVersion ? _jsxs("span", { className: "tiny-text", children: ["prompt ", entry.promptVersion] }) : null, entry.errorCode ? _jsx("span", { className: "tiny-text", children: entry.errorCode }) : null] }), entry.errorMessage ? _jsx("p", { className: "tiny-text diagnostics-history-error", children: entry.errorMessage }) : null] }, entry.requestId))) })) : (_jsx("p", { className: "tiny-text", children: "No AI request history has been recorded yet." }))] })] })) : null, activeSection === "other" ? (_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Other upcoming settings" }), _jsx("p", { children: "This section gathers the miscellaneous desktop settings that do not belong to the main note-taking flow." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "capture-workspace-density", children: "Default Capture UI" }), _jsxs("select", { id: "capture-workspace-density", value: settings.captureWorkspaceDensity, onChange: (event) => onChange({
                                            ...settings,
                                            captureWorkspaceDensity: event.target.value === "minimal" ? "minimal" : "full",
                                        }), children: [_jsx("option", { value: "full", children: "Full" }), _jsx("option", { value: "minimal", children: "Minimal" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-workspace-density", children: "Default Output UI" }), _jsxs("select", { id: "output-workspace-density", value: settings.outputWorkspaceDensity, onChange: (event) => onChange({
                                            ...settings,
                                            outputWorkspaceDensity: event.target.value === "minimal" ? "minimal" : "full",
                                        }), children: [_jsx("option", { value: "full", children: "Full" }), _jsx("option", { value: "minimal", children: "Minimal" })] })] }), _jsxs("div", { className: "inline-row", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void onImportLegacy(), children: "Import current browser app data" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onImportBackup(), children: "Import backup / PWA file" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onExportBackup(), children: "Export backup to Downloads" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onSaveBackupAs(), children: "Save backup as..." }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onOpenDataFolder(), children: "Open data folder" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onOpenDatabaseFolder(), children: "Open database folder" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void onCheckForUpdates(), disabled: Boolean(isCheckingForUpdates), children: isCheckingForUpdates ? "Checking updates..." : "Check for updates" }), availableUpdateVersion && onInstallUpdate ? (_jsx("button", { className: "primary-button", type: "button", onClick: () => void onInstallUpdate(), disabled: Boolean(isInstallingUpdate), children: isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}` })) : null, manualUpdateUrl && onOpenManualUpdate ? (_jsx("button", { className: "small-button", type: "button", onClick: () => void onOpenManualUpdate(), children: availableUpdateVersion ? "Download installer manually" : "Download latest installer" })) : null] }), storageInfo ? (_jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Desktop version" }), _jsx("span", { className: "muted", children: desktopVersion || "Unknown" })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Bundle type" }), _jsx("span", { className: "muted", children: desktopBundleType || "Unknown" })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Data folder" }), _jsx("span", { className: "muted", children: storageInfo.appDataDir })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Database path" }), _jsx("span", { className: "muted", children: storageInfo.databasePath })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Attachments folder" }), _jsx("span", { className: "muted", children: storageInfo.attachmentsDir })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Local backups folder" }), _jsx("span", { className: "muted", children: storageInfo.backupsDir })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Latest local safety backup" }), _jsx("span", { className: "muted", children: latestLocalBackupInfo
                                                    ? `${new Date(latestLocalBackupInfo.modifiedMs).toLocaleString()}`
                                                    : "No local safety backup yet" })] })] })) : (_jsx("p", { className: "tiny-text", children: "Storage paths are shown here when running inside the installed Tauri desktop app." })), updateStatusNote ? _jsx("p", { className: "tiny-text", children: updateStatusNote }) : null, _jsx("p", { className: "tiny-text", children: "For uninstall/reinstall safety, export a backup file to a folder outside AppData before removing the app." })] })) : null] })] }));
};
