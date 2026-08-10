import { useEffect, useState } from "react";
import type { LocalAppSettings, PromptBlock, TemplateDefinition } from "@notesmith/domain";
import { getTemplatesForCaptureMode } from "@notesmith/domain";
import type { DesktopStorageInfo, LocalBackupInfo } from "../../../lib/storage/desktopStorage";
import {
  DEFAULT_MEETING_MINUTES_RULES,
  DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
  DEFAULT_PERSONAL_NOTES_RULES,
  DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
  DEFAULT_REVISION_RULES,
  DEFAULT_TRANSLATION_RULES,
} from "@notesmith/prompts";
import type { AIRequestHistoryEntry } from "../../../lib/ai/history";
import type { AIDiagnosticsItem } from "../../../lib/ai/metrics";
import type { SelectModelOption } from "../../../lib/ai/modelPricing";
import { OUTPUT_LAYOUT_PRESETS } from "../../../lib/export/outputLayouts";
import { TemplatesCard } from "../../templates/components/TemplatesCard";
import { buildRichTextCommands } from "../../richTextCommands/RichTextCommandMenu";

export type SettingsSection =
  | "ai"
  | "diagnostics"
  | "themes"
  | "output"
  | "commands"
  | "people"
  | "prompts"
  | "templates"
  | "other";

interface SettingsCardProps {
  settings: LocalAppSettings;
  templates: TemplateDefinition[];
  initialSection?: SettingsSection;
  onChange: (settings: LocalAppSettings) => void;
  onSaveTemplate: (template: TemplateDefinition) => void;
  onResetTemplates: () => Promise<void>;
  onImportLegacy: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  onCheckForUpdates: () => Promise<void>;
  onInstallUpdate?: () => Promise<void>;
  onOpenManualUpdate?: () => Promise<void>;
  onOpenDataFolder: () => Promise<void>;
  onOpenDatabaseFolder: () => Promise<void>;
  onExportBackup: () => Promise<void>;
  onSaveBackupAs: () => Promise<void>;
  onRefreshModelPricing: () => Promise<void> | void;
  updateStatusNote?: string | null;
  desktopVersion?: string | null;
  desktopBundleType?: string | null;
  availableUpdateVersion?: string | null;
  manualUpdateUrl?: string | null;
  isCheckingForUpdates?: boolean;
  isInstallingUpdate?: boolean;
  storageInfo: DesktopStorageInfo | null;
  latestLocalBackupInfo: LocalBackupInfo | null;
  aiDiagnostics: AIDiagnosticsItem[];
  aiRequestHistory: AIRequestHistoryEntry[];
  textModelOptions: SelectModelOption[];
  transcriptionModelOptions: SelectModelOption[];
  modelPricingStatus: string;
  isRefreshingModelPricing: boolean;
}

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string; description: string }> = [
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

type QuickModelChoice = {
  id: string;
  label: string;
  description: string;
  modelId: string;
};

const TEXT_MODEL_QUICK_CHOICES: QuickModelChoice[] = [
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

const TRANSCRIPTION_MODEL_QUICK_CHOICES: QuickModelChoice[] = [
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

const findQuickChoiceForModel = (choices: QuickModelChoice[], modelId: string) =>
  choices.find((choice) => choice.modelId === modelId) ?? null;

type ThemeMode = "light" | "dark";
type ThemeDefinition = {
  id: string;
  label: string;
  description: string;
  bestFor: string;
  swatches: {
    light: [string, string, string];
    dark: [string, string, string];
  };
};

const DESKTOP_THEMES: ThemeDefinition[] = [
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

const THEME_MODE_OPTIONS: Array<{ id: ThemeMode; label: string; description: string }> = [
  { id: "light", label: "Light", description: "Bright neutral workspace for daytime and high-clarity work." },
  { id: "dark", label: "Dark", description: "Lower-glare workspace for late sessions and visual calm." },
];

const parseThemeValue = (value: string) => {
  const match = value.match(/^(.*?)-(light|dark)$/);
  if (!match) {
    return { familyId: "fluent-slate", mode: "light" as ThemeMode };
  }
  return {
    familyId: match[1],
    mode: match[2] as ThemeMode,
  };
};

const buildThemeValue = (familyId: string, mode: ThemeMode) => `${familyId}-${mode}`;

export const SettingsCard = ({
  settings,
  templates,
  initialSection = "ai",
  onChange,
  onSaveTemplate,
  onResetTemplates,
  onImportLegacy,
  onImportBackup,
  onCheckForUpdates,
  onInstallUpdate,
  onOpenManualUpdate,
  onOpenDataFolder,
  onOpenDatabaseFolder,
  onExportBackup,
  onSaveBackupAs,
  onRefreshModelPricing,
  updateStatusNote,
  desktopVersion,
  desktopBundleType,
  availableUpdateVersion,
  manualUpdateUrl,
  isCheckingForUpdates,
  isInstallingUpdate,
  storageInfo,
  latestLocalBackupInfo,
  aiDiagnostics,
  aiRequestHistory,
  textModelOptions,
  transcriptionModelOptions,
  modelPricingStatus,
  isRefreshingModelPricing,
}: SettingsCardProps) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
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

  const updatePromptProfile = (nextPromptProfile: LocalAppSettings["promptProfile"]) =>
    onChange({
      ...settings,
      promptProfile: nextPromptProfile,
    });

  const normalizedCommandTrigger = commandTrigger.replace(/^@+/, "").trim().toLowerCase();
  const builtInTextCommands = buildRichTextCommands();
  const reservedCommandTriggers = new Set(builtInTextCommands.map((command) => command.trigger));
  const savedCommandTriggers = new Set((settings.richTextCommands || []).map((command) => command.trigger));
  const canAddTextCommand =
    /^[a-z0-9_-]{1,24}$/.test(normalizedCommandTrigger) &&
    commandTemplate.trim().length > 0 &&
    !reservedCommandTriggers.has(normalizedCommandTrigger) &&
    !savedCommandTriggers.has(normalizedCommandTrigger);

  const updateExtraBlock = (id: string, updates: Partial<PromptBlock>) =>
    updatePromptProfile({
      ...settings.promptProfile,
      extraBlocks: settings.promptProfile.extraBlocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block,
      ),
    });

  const selectedTextModel =
    textModelOptions.find((option) => option.id === settings.textModel) ?? textModelOptions[0] ?? null;
  const selectedTranscriptionModel =
    transcriptionModelOptions.find((option) => option.id === settings.transcriptionModel) ?? transcriptionModelOptions[0] ?? null;
  const selectedTextQuickChoice = findQuickChoiceForModel(TEXT_MODEL_QUICK_CHOICES, selectedTextModel?.id || settings.textModel);
  const selectedTranscriptionQuickChoice = findQuickChoiceForModel(
    TRANSCRIPTION_MODEL_QUICK_CHOICES,
    selectedTranscriptionModel?.id || settings.transcriptionModel,
  );
  const selectedTheme = parseThemeValue(settings.theme);
  const selectedThemeDefinition = DESKTOP_THEMES.find((theme) => theme.id === selectedTheme.familyId) ?? DESKTOP_THEMES[0];
  const meetingTemplateOptions = getTemplatesForCaptureMode(templates, "meeting-note");
  const pendingRuleSuggestions = settings.ruleSuggestions.filter((entry) => entry.status === "pending" && !entry.ignoreForever);
  const ignoredRuleSuggestions = settings.ruleSuggestions.filter((entry) => entry.status === "ignored");
  const pendingAbbreviationSuggestions = pendingRuleSuggestions.filter((entry) => entry.type === "abbreviation");
  const pendingPreferredNameSuggestions = pendingRuleSuggestions.filter((entry) => entry.type === "preferred_name");
  const ignoredAbbreviationSuggestions = ignoredRuleSuggestions.filter((entry) => entry.type === "abbreviation");
  const ignoredPreferredNameSuggestions = ignoredRuleSuggestions.filter((entry) => entry.type === "preferred_name");

  const updateThemeFamily = (familyId: string) => onChange({ ...settings, theme: buildThemeValue(familyId, selectedTheme.mode) });
  const updateThemeMode = (mode: ThemeMode) => onChange({ ...settings, theme: buildThemeValue(selectedTheme.familyId, mode) });
  const restorePromptDefaults = () =>
    updatePromptProfile({
      meetingMinutesSystem: DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
      meetingMinutesRules: DEFAULT_MEETING_MINUTES_RULES,
      personalNotesSystem: DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
      personalNotesRules: DEFAULT_PERSONAL_NOTES_RULES,
      revisionRules: DEFAULT_REVISION_RULES,
      translationRules: DEFAULT_TRANSLATION_RULES,
      extraBlocks: settings.promptProfile.extraBlocks,
    });

  const renderQuickChoicePicker = ({
    title,
    description,
    choices,
    selectedModelId,
    onSelect,
  }: {
    title: string;
    description: string;
    choices: QuickModelChoice[];
    selectedModelId: string;
    onSelect: (modelId: string) => void;
  }) => (
    <div className="ai-quick-choice-section">
      <div className="model-picker-header">
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
      </div>
      <div className="ai-quick-choice-grid">
        {choices.map((choice) => {
          const isSelected = choice.modelId === selectedModelId;
          return (
            <button
              key={choice.id}
              type="button"
              className="ai-quick-choice-card"
              data-active={isSelected}
              onClick={() => onSelect(choice.modelId)}
            >
              <strong>{choice.label}</strong>
              <p>{choice.description}</p>
              {isSelected ? <span className="model-option-selected">Selected</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderModelCards = ({
    title,
    description,
    options,
    selectedId,
    onSelect,
  }: {
    title: string;
    description: string;
    options: SelectModelOption[];
    selectedId: string;
    onSelect: (modelId: string) => void;
  }) => (
    <div className="model-picker-section">
      <div className="model-picker-header">
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
      </div>
      <div className="model-picker-grid">
        {options.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              className="model-option-card"
              data-active={isSelected}
              aria-pressed={isSelected}
              onClick={() => onSelect(option.id)}
            >
              <div className="model-option-header">
                <div>
                  <div className="model-option-title-row">
                    <strong>{option.label}</strong>
                    {isSelected ? <span className="model-option-selected">Selected</span> : null}
                  </div>
                  <p>{option.summary}</p>
                </div>
                <div className="model-option-tags">
                  {option.tags.map((tag) => (
                    <span key={tag} className="model-option-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="model-option-copy-block">
                <span className="model-option-label">Best for</span>
                <p>{option.recommendedFor}</p>
              </div>

              <div className="model-option-copy-block">
                <span className="model-option-label">Recommendation</span>
                <p>{option.recommendation}</p>
              </div>

              <div className="model-option-copy-block">
                <span className="model-option-label">Pricing</span>
                <ul className="model-option-list">
                  {option.pricingLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <div className="model-option-copy-block model-option-copy-block-compact">
                <span className="model-option-label">Model details</span>
                <ul className="model-option-list">
                  {option.metadataLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="settings-shell" id="desktop-settings-card">
      <aside className="settings-nav">
        <div>
          <h3>Settings</h3>
          <p className="muted">One entry point, clearly separated sections.</p>
        </div>
        <div className="settings-nav-list">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className="settings-nav-button"
              data-active={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
            >
              <span>{section.label}</span>
              <small>{section.description}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="settings-panel">
        {activeSection === "ai" ? (
          <div className="sidebar-card">
            <div>
              <h3>AI Settings</h3>
              <p>These settings stay local to this machine and are never written into shared data files.</p>
            </div>
            <div className="ai-settings-summary">
              <div className="ai-settings-summary-grid">
                <div className="diagnostics-card">
                  <span className="model-option-label">Text model</span>
                  <strong>{selectedTextModel?.label || settings.textModel}</strong>
                  <span className="tiny-text">
                    {selectedTextQuickChoice ? `${selectedTextQuickChoice.label} mode` : "Custom selection"}
                  </span>
                </div>
                <div className="diagnostics-card">
                  <span className="model-option-label">Transcription</span>
                  <strong>{selectedTranscriptionModel?.label || settings.transcriptionModel}</strong>
                  <span className="tiny-text">
                    {selectedTranscriptionQuickChoice ? `${selectedTranscriptionQuickChoice.label} mode` : "Custom selection"}
                  </span>
                </div>
                <div className="diagnostics-card">
                  <span className="model-option-label">Model data</span>
                  <strong>OpenAI guidance</strong>
                  <span className="tiny-text">{modelPricingStatus}</span>
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="api-key">API key</label>
              <input
                id="api-key"
                type="password"
                value={settings.apiKey}
                onChange={(event) => onChange({ ...settings, apiKey: event.target.value })}
                placeholder="Stored locally on this machine only"
              />
            </div>
            {renderQuickChoicePicker({
              title: "Text model quick choices",
              description: "Start with a simple decision first. You can open the detailed model cards below when you want deeper control.",
              choices: TEXT_MODEL_QUICK_CHOICES,
              selectedModelId: selectedTextModel?.id || settings.textModel,
              onSelect: (textModel) => onChange({ ...settings, textModel }),
            })}
            <div className="inline-row">
              <button
                className="small-button inline-action"
                type="button"
                onClick={() => setShowAdvancedTextModels((current) => !current)}
              >
                {showAdvancedTextModels ? "Hide detailed text models" : "Show detailed text models"}
              </button>
            </div>
            {showAdvancedTextModels
              ? renderModelCards({
                  title: "Detailed text models",
                  description:
                    "Choose between the current OpenAI text models for note generation, revision, and translation. The catalog refreshes from OpenAI every day.",
                  options: textModelOptions,
                  selectedId: selectedTextModel?.id || settings.textModel,
                  onSelect: (textModel) => onChange({ ...settings, textModel }),
                })
              : null}
            {renderQuickChoicePicker({
              title: "Transcription quick choices",
              description:
                "Pick the recording mode that matches your real task first, then open the detailed cards if you want the exact model and pricing details.",
              choices: TRANSCRIPTION_MODEL_QUICK_CHOICES,
              selectedModelId: selectedTranscriptionModel?.id || settings.transcriptionModel,
              onSelect: (transcriptionModel) => onChange({ ...settings, transcriptionModel }),
            })}
            <div className="inline-row">
              <button
                className="small-button inline-action"
                type="button"
                onClick={() => setShowAdvancedTranscriptionModels((current) => !current)}
              >
                {showAdvancedTranscriptionModels ? "Hide detailed transcription models" : "Show detailed transcription models"}
              </button>
            </div>
            {showAdvancedTranscriptionModels
              ? renderModelCards({
                  title: "Detailed transcription models",
                  description:
                    "Choose the OpenAI transcription model that best fits your recording quality, speaker-label, and cost needs.",
                  options: transcriptionModelOptions,
                  selectedId: selectedTranscriptionModel?.id || settings.transcriptionModel,
                  onSelect: (transcriptionModel) => onChange({ ...settings, transcriptionModel }),
                })
              : null}
            <div className="inline-row">
              <button
                className="small-button inline-action"
                type="button"
                onClick={() => void onRefreshModelPricing()}
                disabled={isRefreshingModelPricing}
              >
                {isRefreshingModelPricing ? "Refreshing model data..." : "Refresh pricing and recommendations"}
              </button>
            </div>
            <p className="tiny-text model-pricing-status-copy">{modelPricingStatus}</p>
          </div>
        ) : null}

        {activeSection === "themes" ? (
          <div className="sidebar-card">
            <div>
              <h3>Themes</h3>
              <p>Choose a curated desktop theme family, then switch between light and dark without losing the overall visual identity.</p>
            </div>
            <div className="ai-settings-summary-grid">
              <div className="diagnostics-card">
                <span className="model-option-label">Current family</span>
                <strong>{selectedThemeDefinition.label}</strong>
                <span className="tiny-text">{selectedThemeDefinition.bestFor}</span>
              </div>
              <div className="diagnostics-card">
                <span className="model-option-label">Current mode</span>
                <strong>{selectedTheme.mode === "light" ? "Light" : "Dark"}</strong>
                <span className="tiny-text">Theme stays local to this machine as a UI preference.</span>
              </div>
            </div>
            <div className="theme-mode-grid">
              {THEME_MODE_OPTIONS.map((option) => {
                const isSelected = selectedTheme.mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="theme-mode-card"
                    data-active={isSelected}
                    onClick={() => updateThemeMode(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                    {isSelected ? <span className="model-option-selected">Selected</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="theme-preview-grid">
              {DESKTOP_THEMES.map((theme) => {
                const isSelected = theme.id === selectedTheme.familyId;
                const swatches = selectedTheme.mode === "dark" ? theme.swatches.dark : theme.swatches.light;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className="theme-preview-card"
                    data-active={isSelected}
                    onClick={() => updateThemeFamily(theme.id)}
                  >
                    <div className="theme-preview-surface">
                      <div className="theme-preview-swatch-row">
                        {swatches.map((swatch) => (
                          <span key={swatch} className="theme-preview-swatch" style={{ background: swatch }} />
                        ))}
                      </div>
                    </div>
                    <div className="theme-preview-copy">
                      <div className="theme-preview-title-row">
                        <strong>{theme.label}</strong>
                        {isSelected ? <span className="model-option-selected">Selected</span> : null}
                      </div>
                      <p>{theme.description}</p>
                      <span className="tiny-text">{theme.bestFor}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeSection === "output" ? (
          <div className="sidebar-card">
            <div>
              <h3>Output formatting</h3>
              <p>These defaults shape how generated notes read on screen and how Word and PDF exports are styled.</p>
            </div>
            <div className="field">
              <label htmlFor="desktop-default-template">Default desktop template</label>
              <select
                id="desktop-default-template"
                value={settings.preferredDesktopTemplateId}
                onChange={(event) => onChange({ ...settings, preferredDesktopTemplateId: event.target.value })}
              >
                {meetingTemplateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="output-language">Output language</label>
              <select
                id="output-language"
                value={settings.outputLanguage}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    outputLanguage: event.target.value as LocalAppSettings["outputLanguage"],
                  })
                }
              >
                <option value="same">Same as source</option>
                <option value="sv">Swedish</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="output-layout-preset">Document layout preset</label>
              <select
                id="output-layout-preset"
                value={settings.outputLayoutPresetId}
                onChange={(event) => onChange({ ...settings, outputLayoutPresetId: event.target.value })}
              >
                {OUTPUT_LAYOUT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-option-grid">
              {OUTPUT_LAYOUT_PRESETS.map((preset) => {
                const isSelected = settings.outputLayoutPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    className={`settings-option-card${isSelected ? " settings-option-card-selected" : ""}`}
                    type="button"
                    onClick={() => onChange({ ...settings, outputLayoutPresetId: preset.id })}
                  >
                    <div className="model-option-title-row">
                      <strong>{preset.label}</strong>
                      {isSelected ? <span className="model-option-selected">Selected</span> : null}
                    </div>
                    <p>{preset.description}</p>
                    <div className="model-option-copy-block model-option-copy-block-compact">
                      <span className="model-option-label">Typography</span>
                      <span className="tiny-text">
                        Headers: {preset.style.headingFont.split(",")[0].replaceAll("\"", "")}
                      </span>
                      <span className="tiny-text">
                        Body: {preset.style.bodyFont.split(",")[0].replaceAll("\"", "")} · {preset.style.bodySize} pt · {preset.style.lineHeight} line height
                      </span>
                    </div>
                    <div className="model-option-copy-block model-option-copy-block-compact">
                      <span className="model-option-label">Best for</span>
                      <span className="tiny-text">{preset.bestFor}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeSection === "commands" ? (
          <div className="sidebar-card settings-text-commands-card">
            <div>
              <h3>Text commands</h3>
              <p>Type @ in any rich-text field to search commands. Press Space after an exact command, or use Enter, Tab, or the command menu to insert it.</p>
            </div>

            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Built-in commands</strong>
                <span className="tiny-text">Dates and times use this computer's current timezone.</span>
              </div>
              <div className="text-command-reference-grid">
                {builtInTextCommands.map((command) => (
                  <div className="text-command-reference" key={command.trigger}>
                    <strong>@{command.trigger}</strong>
                    <span>{command.label}</span>
                    <small>{command.description}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Custom commands</strong>
                <span className="tiny-text">Available placeholders: {"{date}"}, {"{time}"}, {"{datetime}"}, {"{tomorrow}"}, {"{yesterday}"}, {"{week}"}, and {"{day}"}.</span>
              </div>
              <div className="text-command-form">
                <div className="field">
                  <label htmlFor="text-command-trigger">Command</label>
                  <div className="text-command-trigger-input">
                    <span>@</span>
                    <input
                      id="text-command-trigger"
                      value={commandTrigger}
                      onChange={(event) => setCommandTrigger(event.target.value)}
                      placeholder="followup"
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="text-command-label">Menu label</label>
                  <input
                    id="text-command-label"
                    value={commandLabel}
                    onChange={(event) => setCommandLabel(event.target.value)}
                    placeholder="Follow-up reminder"
                  />
                </div>
                <div className="field field-wide">
                  <label htmlFor="text-command-template">Inserted text</label>
                  <textarea
                    id="text-command-template"
                    value={commandTemplate}
                    onChange={(event) => setCommandTemplate(event.target.value)}
                    placeholder="Follow up by {tomorrow}: "
                    rows={4}
                  />
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!canAddTextCommand}
                  onClick={() => {
                    if (!canAddTextCommand) return;
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
                  }}
                >
                  Add command
                </button>
                {normalizedCommandTrigger && reservedCommandTriggers.has(normalizedCommandTrigger) ? (
                  <span className="tiny-text settings-command-warning">@{normalizedCommandTrigger} is a built-in command.</span>
                ) : null}
                {normalizedCommandTrigger && savedCommandTriggers.has(normalizedCommandTrigger) ? (
                  <span className="tiny-text settings-command-warning">@{normalizedCommandTrigger} is already saved.</span>
                ) : null}
              </div>

              <div className="section-list">
                {(settings.richTextCommands || []).map((command) => (
                  <div className="list-item text-command-saved-item" key={command.id}>
                    <strong>@{command.trigger}</strong>
                    <span>{command.label}</span>
                    <small>{command.template}</small>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() => onChange({
                          ...settings,
                          richTextCommands: (settings.richTextCommands || []).filter((entry) => entry.id !== command.id),
                        })}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!(settings.richTextCommands || []).length ? <p className="tiny-text">No custom commands yet.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "people" ? (
          <div className="sidebar-card">
            <div>
              <h3>People, Domains & Projects</h3>
              <p>Manage the slower shared structure here, so the execution workspaces can stay focused on fast capture, scheduling, and time.</p>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>People</strong>
                <span className="tiny-text">Reusable contacts and meeting participants.</span>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="person-draft">Saved people</label>
                  <input
                    id="person-draft"
                    value={personDraft}
                    onChange={(event) => setPersonDraft(event.target.value)}
                    placeholder="Add person"
                  />
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => {
                    const nextValue = personDraft.trim();
                    if (!nextValue) return;
                    onChange({
                      ...settings,
                      savedParticipants: Array.from(new Set([...settings.savedParticipants, nextValue])).sort(),
                    });
                    setPersonDraft("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="section-list">
                {settings.savedParticipants.map((participant) => (
                  <div key={participant} className="list-item">
                    <strong>{participant}</strong>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            savedParticipants: settings.savedParticipants.filter((entry) => entry !== participant),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Projects</strong>
                <span className="tiny-text">Reusable delivery tracks and workstreams.</span>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="project-draft">Saved projects</label>
                  <input
                    id="project-draft"
                    value={projectDraft}
                    onChange={(event) => setProjectDraft(event.target.value)}
                    placeholder="Add project"
                  />
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => {
                    const nextValue = projectDraft.trim();
                    if (!nextValue) return;
                    onChange({
                      ...settings,
                      savedProjects: Array.from(new Set([...settings.savedProjects, nextValue])).sort(),
                    });
                    setProjectDraft("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="section-list">
                {settings.savedProjects.map((project) => (
                  <div key={project} className="list-item">
                    <strong>{project}</strong>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            savedProjects: settings.savedProjects.filter((entry) => entry !== project),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Domains</strong>
                <span className="tiny-text">Top-level business areas above projects.</span>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="domain-draft">Saved domains</label>
                  <input
                    id="domain-draft"
                    value={domainDraft}
                    onChange={(event) => setDomainDraft(event.target.value)}
                    placeholder="Add domain"
                  />
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => {
                    const nextValue = domainDraft.trim();
                    if (!nextValue) return;
                    onChange({
                      ...settings,
                      savedDomains: Array.from(new Set([...settings.savedDomains, nextValue])).sort(),
                    });
                    setDomainDraft("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="section-list">
                {settings.savedDomains.map((domain) => (
                  <div key={domain} className="list-item">
                    <strong>{domain}</strong>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            savedDomains: settings.savedDomains.filter((entry) => entry !== domain),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Activity labels</strong>
                <span className="tiny-text">Reusable labels that help with faster linking and filtering.</span>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="activity-draft">Saved activities</label>
                  <input
                    id="activity-draft"
                    value={activityDraft}
                    onChange={(event) => setActivityDraft(event.target.value)}
                    placeholder="Add activity"
                  />
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => {
                    const nextValue = activityDraft.trim();
                    if (!nextValue) return;
                    onChange({
                      ...settings,
                      savedActivities: Array.from(new Set([...settings.savedActivities, nextValue])).sort(),
                    });
                    setActivityDraft("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="section-list">
                {settings.savedActivities.map((activity) => (
                  <div key={activity} className="list-item">
                    <strong>{activity}</strong>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            savedActivities: settings.savedActivities.filter((entry) => entry !== activity),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Tags</strong>
                <span className="tiny-text">Flexible labels for cross-cutting filters and future reporting.</span>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="tag-draft">Saved tags</label>
                  <input
                    id="tag-draft"
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    placeholder="Add tag"
                  />
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => {
                    const nextValue = tagDraft.trim();
                    if (!nextValue) return;
                    onChange({
                      ...settings,
                      savedTags: Array.from(new Set([...settings.savedTags, nextValue])).sort(),
                    });
                    setTagDraft("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="section-list">
                {settings.savedTags.map((tag) => (
                  <div key={tag} className="list-item">
                    <strong>{tag}</strong>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            savedTags: settings.savedTags.filter((entry) => entry !== tag),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Abbreviations</strong>
                <span className="tiny-text">Expand shorthand consistently during cleanup and output generation.</span>
              </div>
              <div className="inline-row">
                <div className="field">
                  <label htmlFor="abbr-short">Abbreviation</label>
                  <input id="abbr-short" value={abbrShort} onChange={(event) => setAbbrShort(event.target.value)} placeholder="e.g. FYI" />
                </div>
                <div className="field">
                  <label htmlFor="abbr-full">Full wording</label>
                  <input id="abbr-full" value={abbrFull} onChange={(event) => setAbbrFull(event.target.value)} placeholder="For your information" />
                </div>
                <button
                  className="small-button inline-action"
                  type="button"
                  onClick={() => {
                    if (!abbrShort.trim() || !abbrFull.trim()) return;
                    onChange({
                      ...settings,
                      abbreviations: [
                        ...settings.abbreviations,
                        { id: crypto.randomUUID(), shortForm: abbrShort.trim(), fullForm: abbrFull.trim() },
                      ],
                    });
                    setAbbrShort("");
                    setAbbrFull("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="section-list">
                {settings.abbreviations.map((entry) => (
                  <div key={entry.id} className="list-item">
                    <strong>{entry.shortForm}</strong>
                    <span className="muted">{entry.fullForm}</span>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            abbreviations: settings.abbreviations.filter((item) => item.id !== entry.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Preferred participant names</strong>
                <span className="tiny-text">Expand short participant-name forms into the preferred full name when the mapping is clear.</span>
              </div>
              <div className="section-list">
                {settings.preferredParticipantNames.length ? settings.preferredParticipantNames.map((entry) => (
                  <div key={entry.id} className="list-item">
                    <strong>{entry.shortForm}</strong>
                    <span className="muted">{entry.fullName}</span>
                    <div className="list-item-actions">
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            preferredParticipantNames: settings.preferredParticipantNames.filter((item) => item.id !== entry.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )) : <p className="tiny-text">No preferred participant-name rules saved yet.</p>}
              </div>
            </div>
            <div className="section-divider">
              <div className="settings-subsection-heading">
                <strong>Suggested rules</strong>
                <span className="tiny-text">Repeated shorthand and participant-name patterns can be reviewed here before they become reusable rules.</span>
              </div>
              <div className="section-list">
                {pendingAbbreviationSuggestions.length || pendingPreferredNameSuggestions.length ? (
                  [...pendingAbbreviationSuggestions, ...pendingPreferredNameSuggestions].map((entry) => (
                    <div key={entry.id} className="list-item">
                      <strong>{entry.type === "abbreviation" ? "Suggested abbreviation" : "Preferred participant name"}</strong>
                      <span className="muted">{entry.sourceValue} -&gt; {entry.suggestedValue} · Seen {entry.evidenceCount} times</span>
                      <div className="list-item-actions">
                        <button
                          className="small-button inline-action"
                          type="button"
                          onClick={() => {
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
                                ruleSuggestions: settings.ruleSuggestions.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, status: "accepted", ignoreForever: false, updatedAt: new Date().toISOString() }
                                    : item),
                              });
                              return;
                            }

                            const exists = settings.preferredParticipantNames.some(
                              (item) =>
                                item.shortForm.toLocaleLowerCase() === entry.sourceValue.toLocaleLowerCase()
                                && item.fullName.toLocaleLowerCase() === entry.suggestedValue.toLocaleLowerCase(),
                            );
                            onChange({
                              ...settings,
                              preferredParticipantNames: exists
                                ? settings.preferredParticipantNames
                                : [
                                    ...settings.preferredParticipantNames,
                                    { id: crypto.randomUUID(), shortForm: entry.sourceValue, fullName: entry.suggestedValue },
                                  ],
                              ruleSuggestions: settings.ruleSuggestions.map((item) =>
                                item.id === entry.id
                                  ? { ...item, status: "accepted", ignoreForever: false, updatedAt: new Date().toISOString() }
                                  : item),
                            });
                          }}
                        >
                          Add
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          onClick={() =>
                            onChange({
                              ...settings,
                              ruleSuggestions: settings.ruleSuggestions.map((item) =>
                                item.id === entry.id
                                  ? { ...item, status: "ignored", ignoreForever: true, updatedAt: new Date().toISOString() }
                                  : item),
                            })
                          }
                        >
                          Never suggest
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="tiny-text">No pending suggestions yet. New suggestions appear here after the same pattern is seen across sessions.</p>
                )}
              </div>
              {ignoredAbbreviationSuggestions.length || ignoredPreferredNameSuggestions.length ? (
                <div className="section-list">
                  <p className="tiny-text">Ignored suggestions</p>
                  {[...ignoredAbbreviationSuggestions, ...ignoredPreferredNameSuggestions].map((entry) => (
                    <div key={entry.id} className="list-item">
                      <strong>{entry.sourceValue} -&gt; {entry.suggestedValue}</strong>
                      <span className="muted">{entry.type === "abbreviation" ? "Abbreviation suggestion" : "Participant-name suggestion"}</span>
                      <div className="list-item-actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() =>
                            onChange({
                              ...settings,
                              ruleSuggestions: settings.ruleSuggestions.map((item) =>
                                item.id === entry.id
                                  ? { ...item, status: "pending", ignoreForever: false, updatedAt: new Date().toISOString() }
                                  : item),
                            })
                          }
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeSection === "prompts" ? (
          <div className="sidebar-card">
            <div>
              <h3>Prompts</h3>
              <p>Prompt management is organized by feature type so meeting minutes, personal notes, and future AI tools can evolve without turning settings into one long prompt page.</p>
            </div>
            <div className="diagnostics-grid">
              <div className="diagnostics-card">
                <strong>Generation workflows</strong>
                <span className="tiny-text">Keep meeting minutes and personal-note polishing separate so each workflow can optimize for the right tone, structure, and level of synthesis.</span>
              </div>
              <div className="diagnostics-card">
                <strong>Shared post-processing</strong>
                <span className="tiny-text">Revision and translation stay reusable across workflows so the prompt system scales cleanly as more AI features are added.</span>
              </div>
              <div className="diagnostics-card">
                <strong>Reusable prompt blocks</strong>
                <span className="tiny-text">Store optional add-on instructions once and reuse them across future AI tools instead of duplicating prompt logic everywhere.</span>
              </div>
            </div>
            <details className="workspace-disclosure" open>
              <summary>Meeting minutes</summary>
              <div className="workspace-disclosure-body stack">
                <p className="tiny-text">Used for meeting-focused sessions where the expected outcome is a professional minutes document that emphasizes decisions, action items, and business-ready clarity.</p>
                <div className="field">
                  <label htmlFor="meeting-minutes-system">System prompt</label>
                  <textarea
                    id="meeting-minutes-system"
                    value={settings.promptProfile.meetingMinutesSystem}
                    onChange={(event) =>
                      updatePromptProfile({
                        ...settings.promptProfile,
                        meetingMinutesSystem: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="meeting-minutes-rules">Generation rules</label>
                  <textarea
                    id="meeting-minutes-rules"
                    value={settings.promptProfile.meetingMinutesRules}
                    onChange={(event) =>
                      updatePromptProfile({
                        ...settings.promptProfile,
                        meetingMinutesRules: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </details>
            <details className="workspace-disclosure" open>
              <summary>Personal notes & dictation</summary>
              <div className="workspace-disclosure-body stack">
                <p className="tiny-text">Used for quick notes and voice notes where readability matters, but the output should stay proportionate to the original note instead of becoming formal meeting documentation.</p>
                <div className="field">
                  <label htmlFor="personal-notes-system">System prompt</label>
                  <textarea
                    id="personal-notes-system"
                    value={settings.promptProfile.personalNotesSystem}
                    onChange={(event) =>
                      updatePromptProfile({
                        ...settings.promptProfile,
                        personalNotesSystem: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="personal-notes-rules">Generation rules</label>
                  <textarea
                    id="personal-notes-rules"
                    value={settings.promptProfile.personalNotesRules}
                    onChange={(event) =>
                      updatePromptProfile({
                        ...settings.promptProfile,
                        personalNotesRules: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </details>
            <details className="workspace-disclosure">
              <summary>Shared revision & translation</summary>
              <div className="workspace-disclosure-body stack">
                <p className="tiny-text">These prompt families are shared across note types so polishing and translation stay consistent even as new AI-powered workflows are added later.</p>
                <div className="field">
                  <label htmlFor="revision-rules">Revision rules</label>
                  <textarea
                    id="revision-rules"
                    value={settings.promptProfile.revisionRules}
                    onChange={(event) =>
                      updatePromptProfile({
                        ...settings.promptProfile,
                        revisionRules: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="translation-rules">Translation rules</label>
                  <textarea
                    id="translation-rules"
                    value={settings.promptProfile.translationRules}
                    onChange={(event) =>
                      updatePromptProfile({
                        ...settings.promptProfile,
                        translationRules: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </details>
            <div className="prompt-actions-row">
              <div className="prompt-actions-copy">
                <strong>Restore prompt defaults</strong>
                <p className="tiny-text">Reload the latest built-in prompt families from the app for meeting minutes, personal notes, revision, and translation. Your reusable extra prompt blocks stay in place.</p>
              </div>
              <div className="inline-row">
                <button className="small-button" type="button" onClick={restorePromptDefaults}>
                  Restore prompt defaults
                </button>
              </div>
            </div>
            <p className="tiny-text">
              Use this when you want to replace edited built-in prompt families with the latest versions from the app without losing your reusable prompt blocks.
            </p>
            <div className="section-divider">
              <div>
                <h3>Reusable extra prompt blocks</h3>
                <p className="muted">Keep add-on instructions here so future AI features can reuse them without duplicating prompt logic everywhere.</p>
              </div>
              <div className="field">
                <label htmlFor="extra-block-label">Block label</label>
                <input
                  id="extra-block-label"
                  value={extraBlockLabel}
                  onChange={(event) => setExtraBlockLabel(event.target.value)}
                  placeholder="Example: Customer-friendly tone"
                />
              </div>
              <div className="field">
                <label htmlFor="extra-block-body">Block instructions</label>
                <textarea
                  id="extra-block-body"
                  value={extraBlockBody}
                  onChange={(event) => setExtraBlockBody(event.target.value)}
                  placeholder="Describe the additional generation guidance to apply when this block is enabled."
                />
              </div>
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  if (!extraBlockBody.trim()) return;
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
                }}
              >
                Add prompt block
              </button>
              <div className="section-list">
                {settings.promptProfile.extraBlocks.map((block) => (
                  <div key={block.id} className="list-item">
                    <div className="inline-row checkbox-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={block.enabled}
                          onChange={(event) => updateExtraBlock(block.id, { enabled: event.target.checked })}
                        />
                        Enabled during generation
                      </label>
                      <button
                        className="small-button danger-button"
                        type="button"
                        onClick={() =>
                          updatePromptProfile({
                            ...settings.promptProfile,
                            extraBlocks: settings.promptProfile.extraBlocks.filter((entry) => entry.id !== block.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <div className="field">
                      <label htmlFor={`prompt-block-label-${block.id}`}>Label</label>
                      <input
                        id={`prompt-block-label-${block.id}`}
                        value={block.label}
                        onChange={(event) => updateExtraBlock(block.id, { label: event.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`prompt-block-body-${block.id}`}>Instructions</label>
                      <textarea
                        id={`prompt-block-body-${block.id}`}
                        value={block.body}
                        onChange={(event) => updateExtraBlock(block.id, { body: event.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "templates" ? (
          <TemplatesCard templates={templates} onSave={onSaveTemplate} onResetTemplates={onResetTemplates} />
        ) : null}

        {activeSection === "diagnostics" ? (
          <div className="sidebar-card">
            <div>
              <h3>AI Diagnostics</h3>
              <p>Local visibility into request volume, cache hits, retries, failures, and recent AI activity.</p>
            </div>
            <div className="section-divider diagnostics-panel">
              <div>
                <h3>Snapshot</h3>
                <p className="muted">Per-operation totals and a rolled-up summary for the current app state.</p>
              </div>
              <div className="diagnostics-grid">
                {aiDiagnostics.map((entry) => (
                  <div key={entry.operation} className="diagnostics-card">
                    <strong>{entry.operation === "totals" ? "All AI requests" : entry.operation}</strong>
                    <span className="tiny-text">{entry.requestCount} requests</span>
                    <span className="tiny-text">{entry.successRate}% success</span>
                    <span className="tiny-text">{entry.cacheHitCount} cache hits</span>
                    <span className="tiny-text">{entry.retryCount} retries</span>
                    <span className="tiny-text">{entry.averageDurationMs} ms avg success</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-divider diagnostics-panel">
              <div>
                <h3>Recent AI Request History</h3>
                <p className="muted">Bounded local history for support and debugging. Newest entries appear first.</p>
              </div>
              {aiRequestHistory.length ? (
                <div className="section-list">
                  {aiRequestHistory.map((entry) => (
                    <div key={entry.requestId} className="list-item diagnostics-history-item">
                      <div className="inline-row diagnostics-history-head">
                        <strong>{entry.operation}</strong>
                        <span className="tiny-text">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="diagnostics-history-meta">
                        <span className="tiny-text">{entry.status}</span>
                        <span className="tiny-text">{entry.durationMs} ms</span>
                        <span className="tiny-text">{entry.retryCount} retries</span>
                        <span className="tiny-text">{entry.cached ? "cache hit" : "live request"}</span>
                        {entry.promptVersion ? <span className="tiny-text">prompt {entry.promptVersion}</span> : null}
                        {entry.errorCode ? <span className="tiny-text">{entry.errorCode}</span> : null}
                      </div>
                      {entry.errorMessage ? <p className="tiny-text diagnostics-history-error">{entry.errorMessage}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tiny-text">No AI request history has been recorded yet.</p>
              )}
            </div>
          </div>
        ) : null}

        {activeSection === "other" ? (
          <div className="sidebar-card">
            <div>
              <h3>Other upcoming settings</h3>
              <p>This section gathers the miscellaneous desktop settings that do not belong to the main note-taking flow.</p>
            </div>
            <div className="field">
              <label htmlFor="capture-workspace-density">Default Capture UI</label>
              <select
                id="capture-workspace-density"
                value={settings.captureWorkspaceDensity}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    captureWorkspaceDensity: event.target.value === "minimal" ? "minimal" : "full",
                  })
                }
              >
                <option value="full">Full</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="output-workspace-density">Default Output UI</label>
              <select
                id="output-workspace-density"
                value={settings.outputWorkspaceDensity}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    outputWorkspaceDensity: event.target.value === "minimal" ? "minimal" : "full",
                  })
                }
              >
                <option value="full">Full</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="inline-row">
              <button className="small-button" type="button" onClick={() => void onImportLegacy()}>
                Import current browser app data
              </button>
              <button className="small-button" type="button" onClick={() => void onImportBackup()}>
                Import backup / PWA file
              </button>
              <button className="small-button" type="button" onClick={() => void onExportBackup()}>
                Export backup to Downloads
              </button>
              <button className="small-button" type="button" onClick={() => void onSaveBackupAs()}>
                Save backup as...
              </button>
              <button className="small-button" type="button" onClick={() => void onOpenDataFolder()}>
                Open data folder
              </button>
              <button className="small-button" type="button" onClick={() => void onOpenDatabaseFolder()}>
                Open database folder
              </button>
              <button className="small-button" type="button" onClick={() => void onCheckForUpdates()} disabled={Boolean(isCheckingForUpdates)}>
                {isCheckingForUpdates ? "Checking updates..." : "Check for updates"}
              </button>
              {availableUpdateVersion && onInstallUpdate ? (
                <button className="primary-button" type="button" onClick={() => void onInstallUpdate()} disabled={Boolean(isInstallingUpdate)}>
                  {isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}`}
                </button>
              ) : null}
              {manualUpdateUrl && onOpenManualUpdate ? (
                <button className="small-button" type="button" onClick={() => void onOpenManualUpdate()}>
                  {availableUpdateVersion ? "Download installer manually" : "Download latest installer"}
                </button>
              ) : null}
            </div>
            {storageInfo ? (
              <div className="section-list">
                <div className="list-item">
                  <strong>Desktop version</strong>
                  <span className="muted">{desktopVersion || "Unknown"}</span>
                </div>
                <div className="list-item">
                  <strong>Bundle type</strong>
                  <span className="muted">{desktopBundleType || "Unknown"}</span>
                </div>
                <div className="list-item">
                  <strong>Data folder</strong>
                  <span className="muted">{storageInfo.appDataDir}</span>
                </div>
                <div className="list-item">
                  <strong>Database path</strong>
                  <span className="muted">{storageInfo.databasePath}</span>
                </div>
                <div className="list-item">
                  <strong>Attachments folder</strong>
                  <span className="muted">{storageInfo.attachmentsDir}</span>
                </div>
                <div className="list-item">
                  <strong>Local backups folder</strong>
                  <span className="muted">{storageInfo.backupsDir}</span>
                </div>
                <div className="list-item">
                  <strong>Latest local safety backup</strong>
                  <span className="muted">
                    {latestLocalBackupInfo
                      ? `${new Date(latestLocalBackupInfo.modifiedMs).toLocaleString()}`
                      : "No local safety backup yet"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="tiny-text">Storage paths are shown here when running inside the installed Tauri desktop app.</p>
            )}
            {updateStatusNote ? <p className="tiny-text">{updateStatusNote}</p> : null}
            <p className="tiny-text">
              For uninstall/reinstall safety, export a backup file to a folder outside AppData before removing the app.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};
