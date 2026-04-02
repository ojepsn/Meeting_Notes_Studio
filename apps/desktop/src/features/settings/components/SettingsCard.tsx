import { useState } from "react";
import type { LocalAppSettings, PromptBlock, TemplateDefinition } from "@notesmith/domain";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
import {
  DEFAULT_GENERATION_RULES,
  DEFAULT_GENERATION_SYSTEM_PROMPT,
  DEFAULT_REVISION_RULES,
  DEFAULT_TRANSLATION_RULES,
} from "@notesmith/prompts";
import type { AIRequestHistoryEntry } from "../../../lib/ai/history";
import type { AIDiagnosticsItem } from "../../../lib/ai/metrics";
import type { SelectModelOption } from "../../../lib/ai/modelPricing";
import { TemplatesCard } from "../../templates/components/TemplatesCard";

type SettingsSection =
  | "ai"
  | "diagnostics"
  | "themes"
  | "output"
  | "people"
  | "prompts"
  | "templates"
  | "other";

interface SettingsCardProps {
  settings: LocalAppSettings;
  templates: TemplateDefinition[];
  onChange: (settings: LocalAppSettings) => void;
  onSaveTemplate: (template: TemplateDefinition) => void;
  onImportLegacy: () => Promise<void>;
  onCheckForUpdates: () => Promise<void>;
  onRefreshModelPricing: () => Promise<void> | void;
  updateStatusNote?: string | null;
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
  { id: "people", label: "People", description: "Saved people and abbreviations" },
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

const TRANSCRIPTION_MODEL_QUICK_CHOICES: QuickModelChoice[] = [
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

const findQuickChoiceForModel = (choices: QuickModelChoice[], modelId: string) =>
  choices.find((choice) => choice.modelId === modelId) ?? null;

export const SettingsCard = ({
  settings,
  templates,
  onChange,
  onSaveTemplate,
  onImportLegacy,
  onCheckForUpdates,
  onRefreshModelPricing,
  updateStatusNote,
  aiDiagnostics,
  aiRequestHistory,
  textModelOptions,
  transcriptionModelOptions,
  modelPricingStatus,
  isRefreshingModelPricing,
}: SettingsCardProps) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>("ai");
  const [showAdvancedTextModels, setShowAdvancedTextModels] = useState(false);
  const [showAdvancedTranscriptionModels, setShowAdvancedTranscriptionModels] = useState(false);
  const [personDraft, setPersonDraft] = useState("");
  const [abbrShort, setAbbrShort] = useState("");
  const [abbrFull, setAbbrFull] = useState("");
  const [extraBlockLabel, setExtraBlockLabel] = useState("");
  const [extraBlockBody, setExtraBlockBody] = useState("");

  const updatePromptProfile = (nextPromptProfile: LocalAppSettings["promptProfile"]) =>
    onChange({
      ...settings,
      promptProfile: nextPromptProfile,
    });

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
                    "Choose between the current OpenAI GPT-5.4 text models for note generation, revision, and translation.",
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
              <p>Theme stays separate from shared settings because it is a local UI preference.</p>
            </div>
            <div className="field">
              <label htmlFor="theme-select">Theme</label>
              <select
                id="theme-select"
                value={settings.theme}
                onChange={(event) => onChange({ ...settings, theme: event.target.value })}
              >
                <option value="modern-olive">Modern Olive</option>
                <option value="classic-blue">Classic Blue</option>
                <option value="graphite-forest">Graphite Forest</option>
              </select>
            </div>
          </div>
        ) : null}

        {activeSection === "output" ? (
          <div className="sidebar-card">
            <div>
              <h3>Output formatting</h3>
              <p>These defaults shape how generated notes should read and which template should open by default.</p>
            </div>
            <div className="field">
              <label htmlFor="desktop-default-template">Default desktop template</label>
              <select
                id="desktop-default-template"
                value={settings.preferredDesktopTemplateId}
                onChange={(event) => onChange({ ...settings, preferredDesktopTemplateId: event.target.value })}
              >
                {BUILTIN_TEMPLATES.map((template) => (
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
          </div>
        ) : null}

        {activeSection === "people" ? (
          <div className="sidebar-card">
            <div>
              <h3>People</h3>
              <p>Keep frequent people and shorthand in one place so note capture stays fast and consistent.</p>
            </div>
            <div className="section-divider">
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
          </div>
        ) : null}

        {activeSection === "prompts" ? (
          <div className="sidebar-card">
            <div>
              <h3>Prompts</h3>
              <p>Prompt behavior is separated here so the AI layer can keep evolving without cluttering the rest of settings.</p>
            </div>
            <div className="field">
              <label htmlFor="generation-system">Generation system prompt</label>
              <textarea
                id="generation-system"
                value={settings.promptProfile.generationSystem}
                onChange={(event) =>
                  updatePromptProfile({
                    ...settings.promptProfile,
                    generationSystem: event.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="generation-rules">Generation rules</label>
              <textarea
                id="generation-rules"
                value={settings.promptProfile.generationRules}
                onChange={(event) =>
                  updatePromptProfile({
                    ...settings.promptProfile,
                    generationRules: event.target.value,
                  })
                }
              />
            </div>
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
            <div className="inline-row">
              <button
                className="small-button"
                type="button"
                onClick={() =>
                  updatePromptProfile({
                    generationSystem: DEFAULT_GENERATION_SYSTEM_PROMPT,
                    generationRules: DEFAULT_GENERATION_RULES,
                    revisionRules: DEFAULT_REVISION_RULES,
                    translationRules: DEFAULT_TRANSLATION_RULES,
                    extraBlocks: settings.promptProfile.extraBlocks,
                  })
                }
              >
                Reset prompt defaults
              </button>
            </div>
            <p className="tiny-text">
              Resetting defaults leaves your extra prompt blocks in place.
            </p>
            <div className="section-divider">
              <div>
                <h3>Extra Prompt Blocks</h3>
                <p className="muted">Reusable add-on instructions that can stay enabled or disabled per user preference.</p>
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
          <TemplatesCard templates={templates} onSave={onSaveTemplate} />
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
            <div className="inline-row">
              <button className="small-button" type="button" onClick={() => void onCheckForUpdates()}>
                Check for updates
              </button>
              <button className="small-button" type="button" onClick={() => void onImportLegacy()}>
                Import current browser app data
              </button>
            </div>
            {updateStatusNote ? <p className="tiny-text">{updateStatusNote}</p> : null}
            <p className="tiny-text">
              This is also the right place for upcoming settings that should exist, but not compete with the primary workspace.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};
