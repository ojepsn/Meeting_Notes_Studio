import type { SessionRecord, TemplateDefinition } from "@notesmith/domain";

interface SessionEditorProps {
  session: SessionRecord;
  templates: TemplateDefinition[];
  onChange: (session: SessionRecord) => void;
  onImportTranscript: () => void;
}

export const SessionEditor = ({ session, templates, onChange, onImportTranscript }: SessionEditorProps) => {
  const update = <K extends keyof SessionRecord>(key: K, value: SessionRecord[K]) =>
    onChange({ ...session, [key]: value });

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Capture</h2>
          <p>Sessions stay local-first, but this UI is already shaped for the future Tauri + SQLite architecture.</p>
        </div>
      </div>
      <div className="form-grid">
        <div className="field field-wide">
          <label htmlFor="template-select">Template</label>
          <select
            id="template-select"
            value={session.templateId}
            onChange={(event) => update("templateId", event.target.value)}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-wide">
          <label htmlFor="session-title">Title</label>
          <input
            id="session-title"
            value={session.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Weekly project meeting"
          />
        </div>
        <div className="field">
          <label htmlFor="session-date">Date</label>
          <input
            id="session-date"
            type="date"
            value={session.date}
            onChange={(event) => update("date", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="session-participants">Participants</label>
          <input
            id="session-participants"
            value={session.participantText}
            onChange={(event) => update("participantText", event.target.value)}
            placeholder="Add participants"
          />
        </div>
        <div className="field">
          <label htmlFor="session-start">Start time</label>
          <input
            id="session-start"
            type="time"
            value={session.startTime}
            onChange={(event) => update("startTime", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="session-end">End time</label>
          <input
            id="session-end"
            type="time"
            value={session.endTime}
            onChange={(event) => update("endTime", event.target.value)}
          />
        </div>
        <div className="field field-wide">
          <label htmlFor="manual-notes">Manual notes</label>
          <textarea
            id="manual-notes"
            value={session.manualNotes}
            onChange={(event) => update("manualNotes", event.target.value)}
            placeholder="Capture the rough notes here. This is where later AI services will read from."
          />
        </div>
        <div className="field field-wide">
          <label htmlFor="live-transcript">Live transcript</label>
          <textarea
            id="live-transcript"
            value={session.liveTranscript}
            onChange={(event) => update("liveTranscript", event.target.value)}
            placeholder="Recorded transcript text will land here."
          />
        </div>
        <div className="page-actions field-wide">
          <button className="small-button" type="button" onClick={onImportTranscript}>
            Upload transcript file
          </button>
        </div>
      </div>
    </div>
  );
};
