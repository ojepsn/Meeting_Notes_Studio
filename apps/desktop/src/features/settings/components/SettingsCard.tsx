import { useState } from "react";
import type { LocalAppSettings, PromptBlock } from "@notesmith/domain";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
import {
  DEFAULT_GENERATION_RULES,
  DEFAULT_GENERATION_SYSTEM_PROMPT,
  DEFAULT_REVISION_RULES,
  DEFAULT_TRANSLATION_RULES,
} from "@notesmith/prompts";

interface SettingsCardProps {
  settings: LocalAppSettings;
  onChange: (settings: LocalAppSettings) => void;
  onImportLegacy: () => Promise<void>;
}

export const SettingsCard = ({ settings, onChange, onImportLegacy }: SettingsCardProps) => {
  const [participantDraft, setParticipantDraft] = useState("");
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

  return (
    <div className="sidebar-card" id="desktop-settings-card">
      <div>
        <h3>Settings Foundation</h3>
        <p>These settings stay local-only and already respect the future sync boundaries.</p>
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
      <div className="field">
        <label htmlFor="text-model">Text model</label>
        <select
          id="text-model"
          value={settings.textModel}
          onChange={(event) => onChange({ ...settings, textModel: event.target.value })}
        >
          <option value="gpt-5-mini">GPT-5 mini</option>
          <option value="gpt-5">GPT-5</option>
          <option value="gpt-4.1">GPT-4.1</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="transcription-model">Transcription model</label>
        <select
          id="transcription-model"
          value={settings.transcriptionModel}
          onChange={(event) => onChange({ ...settings, transcriptionModel: event.target.value })}
        >
          <option value="gpt-4o-mini-transcribe">GPT-4o mini transcribe</option>
          <option value="gpt-4o-transcribe">GPT-4o transcribe</option>
          <option value="gpt-4o-transcribe-diarize">GPT-4o transcribe diarize</option>
        </select>
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
      <div className="section-divider">
        <div className="inline-row">
          <div className="field">
            <label htmlFor="participant-draft">Saved participants</label>
            <input
              id="participant-draft"
              value={participantDraft}
              onChange={(event) => setParticipantDraft(event.target.value)}
              placeholder="Add participant"
            />
          </div>
          <button
            className="small-button inline-action"
            type="button"
            onClick={() => {
              const nextValue = participantDraft.trim();
              if (!nextValue) return;
              onChange({
                ...settings,
                savedParticipants: Array.from(new Set([...settings.savedParticipants, nextValue])).sort(),
              });
              setParticipantDraft("");
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
      <div className="section-divider">
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
          <button className="small-button" type="button" onClick={() => void onImportLegacy()}>
            Import current browser app data
          </button>
        </div>
        <p className="tiny-text">
          These prompt settings stay local to this machine. Resetting defaults leaves your extra prompt blocks in place.
        </p>
      </div>
      <div className="section-divider">
        <div>
          <h3>Extra Prompt Blocks</h3>
          <p className="muted">Add reusable instructions that should be appended during generation when enabled.</p>
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
        <p className="tiny-text">
          This brings over sessions, custom templates, todos, participants, abbreviations, and prompt settings from the
          current PWA when present.
        </p>
      </div>
    </div>
  );
};
