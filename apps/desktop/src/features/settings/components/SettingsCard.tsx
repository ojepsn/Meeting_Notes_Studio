import { useMemo, useState } from "react";
import type { LocalAppSettings } from "@notesmith/domain";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";

interface SettingsCardProps {
  settings: LocalAppSettings;
  onChange: (settings: LocalAppSettings) => void;
  onImportLegacy: () => Promise<void>;
}

export const SettingsCard = ({ settings, onChange, onImportLegacy }: SettingsCardProps) => {
  const [participantDraft, setParticipantDraft] = useState("");
  const [abbrShort, setAbbrShort] = useState("");
  const [abbrFull, setAbbrFull] = useState("");
  const templateOptions = useMemo(() => BUILTIN_TEMPLATES, []);

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
          {templateOptions.map((template) => (
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
              onChange({
                ...settings,
                promptProfile: {
                  ...settings.promptProfile,
                  generationSystem: event.target.value,
                },
              })
            }
          />
        </div>
        <button className="small-button" type="button" onClick={() => void onImportLegacy()}>
          Import current browser app data
        </button>
        <p className="tiny-text">This brings over sessions, custom templates, todos, participants, abbreviations, and prompt settings from the current PWA when present.</p>
      </div>
    </div>
  );
};
