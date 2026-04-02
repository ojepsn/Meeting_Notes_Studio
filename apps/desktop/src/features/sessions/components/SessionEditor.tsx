import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import type { AttachmentRecord, SessionRecord, TemplateDefinition } from "@notesmith/domain";

interface SessionEditorProps {
  session: SessionRecord;
  templates: TemplateDefinition[];
  attachments: AttachmentRecord[];
  isTranscribingAudio: boolean;
  onChange: (session: SessionRecord) => void;
  onImportTranscript: () => void;
  onImportAudio: () => void;
  onImportImage: () => void;
  onTranscribeAudio: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onUpdateAttachment: (attachment: AttachmentRecord) => void;
}

const DETAIL_LEVEL_LABELS: Record<number, string> = {
  1: "Minimal",
  2: "Concise",
  3: "Balanced",
  4: "Detailed",
  5: "Comprehensive",
};

export const SessionEditor = ({
  session,
  templates,
  attachments,
  isTranscribingAudio,
  onChange,
  onImportTranscript,
  onImportAudio,
  onImportImage,
  onTranscribeAudio,
  onRemoveAttachment,
  onUpdateAttachment,
}: SessionEditorProps) => {
  const update = <K extends keyof SessionRecord>(key: K, value: SessionRecord[K]) =>
    onChange({ ...session, [key]: value });
  const activeTemplate = templates.find((template) => template.id === session.templateId) ?? templates[0];
  const customFields =
    activeTemplate?.fields.filter(
      (field) =>
        field.enabled &&
        !["title", "participants", "date", "startTime", "endTime"].includes(field.key),
    ) ?? [];
  const enabledSections =
    activeTemplate?.sections.map((section) => ({
      ...section,
      checked: !session.excludedSectionIds.includes(section.id),
    })) ?? [];
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");
  const otherAttachments = attachments.filter((attachment) => attachment.kind !== "image");
  const hasCaptureContent = Boolean(
    session.manualNotes.trim() ||
      session.quickHighlights.trim() ||
      session.liveTranscript.trim() ||
      session.uploadedTranscript.trim() ||
      attachments.length,
  );

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Capture</h2>
          <p>Capture stays simple: rough notes first, supporting tools second, advanced controls only when you need them.</p>
        </div>
      </div>
      {!hasCaptureContent ? (
        <div className="empty-state-card compact-empty-state">
          <h3>Quick start</h3>
          <ol className="empty-state-steps">
            <li>Choose the right template for the note you want to create.</li>
            <li>Write rough notes in Manual notes, or import transcript/audio/image material from the right-side tools.</li>
            <li>Switch to Output when you are ready to generate polished notes.</li>
          </ol>
        </div>
      ) : null}
      <div className="form-grid">
        <div className="field field-wide">
          <label htmlFor="template-select">Template</label>
          <select
            id="template-select"
            value={session.templateId}
            onChange={(event) => {
              const nextTemplate = templates.find((template) => template.id === event.target.value);
              const nextFieldValues = Object.fromEntries(
                (nextTemplate?.fields ?? [])
                  .filter(
                    (field) =>
                      field.enabled &&
                      !["title", "participants", "date", "startTime", "endTime"].includes(field.key),
                  )
                  .map((field) => [field.id, session.customFieldValues[field.id] ?? ""]),
              );
              onChange({
                ...session,
                templateId: event.target.value,
                customFieldValues: nextFieldValues,
                excludedSectionIds: [],
              });
            }}
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
          <label htmlFor="quick-highlights">Quick highlights</label>
          <textarea
            id="quick-highlights"
            value={session.quickHighlights}
            onChange={(event) => update("quickHighlights", event.target.value)}
            placeholder="Short key points, names, or topics to emphasize in the final output."
          />
        </div>
        {customFields.map((field) => (
          <div key={field.id} className={field.type === "textarea" ? "field field-wide" : "field"}>
            <label htmlFor={`custom-field-${field.id}`}>{field.label}</label>
            {field.type === "textarea" ? (
              <textarea
                id={`custom-field-${field.id}`}
                value={session.customFieldValues[field.id] ?? ""}
                onChange={(event) =>
                  update("customFieldValues", {
                    ...session.customFieldValues,
                    [field.id]: event.target.value,
                  })
                }
              />
            ) : (
              <input
                id={`custom-field-${field.id}`}
                type={field.type === "number" ? "number" : field.type}
                value={session.customFieldValues[field.id] ?? ""}
                onChange={(event) =>
                  update("customFieldValues", {
                    ...session.customFieldValues,
                    [field.id]: event.target.value,
                  })
                }
              />
            )}
          </div>
        ))}
        <div className="field field-wide">
          <label htmlFor="live-transcript">Live transcript</label>
          <textarea
            id="live-transcript"
            value={session.liveTranscript}
            onChange={(event) => update("liveTranscript", event.target.value)}
            placeholder="Recorded transcript text will land here."
          />
        </div>
        <details className="field field-wide workspace-disclosure">
          <summary>Advanced output controls</summary>
          <div className="workspace-disclosure-body form-grid">
            <div className="field">
              <label htmlFor="detail-level">Detail level</label>
              <select
                id="detail-level"
                value={String(session.detailLevel)}
                onChange={(event) => update("detailLevel", Number(event.target.value))}
              >
                {Object.entries(DETAIL_LEVEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {value} - {label}
                  </option>
                ))}
              </select>
            </div>
            {enabledSections.length ? (
              <div className="field field-wide">
                <label>Output sections for this session</label>
                <div className="section-list">
                  {enabledSections.map((section) => (
                    <label key={section.id} className="list-item checkbox-label">
                      <input
                        type="checkbox"
                        checked={section.checked}
                        onChange={(event) =>
                          update(
                            "excludedSectionIds",
                            event.target.checked
                              ? session.excludedSectionIds.filter((id) => id !== section.id)
                              : Array.from(new Set([...session.excludedSectionIds, section.id])),
                          )
                        }
                      />
                      <span>
                        <strong>{section.title}</strong>
                        <span className="muted">{section.instructions}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
        <div className="page-actions field-wide">
          <button className="small-button" type="button" onClick={onImportImage}>
            Upload image
          </button>
          <button className="small-button" type="button" onClick={onImportAudio}>
            Upload audio
          </button>
          <button className="small-button" type="button" onClick={onTranscribeAudio}>
            {isTranscribingAudio ? "Transcribing audio..." : "Transcribe audio"}
          </button>
          <button className="small-button" type="button" onClick={onImportTranscript}>
            Upload transcript file
          </button>
        </div>
        {imageAttachments.length ? (
          <div className="field field-wide">
            <label>Session images</label>
            <div className="section-list">
              {imageAttachments.map((attachment, index) => (
                <div key={attachment.id} className="list-item image-attachment-item">
                  <AttachmentImagePreview attachment={attachment} />
                  <div className="image-attachment-details">
                    <strong>{attachment.filename}</strong>
                    <span className="muted">
                      {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
                    </span>
                    <div className="field">
                      <label htmlFor={`image-caption-${attachment.id}`}>Caption</label>
                      <input
                        id={`image-caption-${attachment.id}`}
                        value={attachment.caption}
                        onChange={(event) =>
                          onUpdateAttachment({
                            ...attachment,
                            caption: event.target.value,
                          })
                        }
                        placeholder="Optional caption for the polished output"
                      />
                    </div>
                    <div className="inline-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={attachment.includeInOutput}
                          onChange={(event) =>
                            onUpdateAttachment({
                              ...attachment,
                              includeInOutput: event.target.checked,
                              outputPosition: event.target.checked ? attachment.outputPosition || index + 1 : 0,
                            })
                          }
                        />
                        Include in output
                      </label>
                      <button
                        className="small-button danger-button inline-action"
                        type="button"
                        onClick={() => onRemoveAttachment(attachment.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {otherAttachments.length ? (
          <div className="field field-wide">
            <label>Session attachments</label>
            <div className="section-list">
              {otherAttachments.map((attachment) => (
                <div key={attachment.id} className="list-item">
                  <strong>{attachment.filename}</strong>
                  <span className="muted">
                    {attachment.kind} · {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
                  </span>
                  <div className="list-item-actions">
                    <button
                      className="small-button danger-button"
                      type="button"
                      onClick={() => onRemoveAttachment(attachment.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
