import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import { PeoplePicker } from "../../../components/PeoplePicker";
import { TokenPicker } from "../../../components/TokenPicker";
import type { RecordingMode } from "../../../lib/files/recording";
import {
  type CaptureWorkspaceDensity,
  DEFAULT_TEMPLATE_BY_CAPTURE_MODE,
  getTemplatesForCaptureMode,
  type AttachmentRecord,
  type CaptureMode,
  type SessionRecord,
  type TemplateDefinition,
} from "@notesmith/domain";

interface SessionEditorProps {
  session: SessionRecord;
  templates: TemplateDefinition[];
  attachments: AttachmentRecord[];
  presentation?: CaptureWorkspaceDensity;
  showPresentationActions?: boolean;
  savedPeople: string[];
  suggestedPeople: string[];
  savedProjects: string[];
  suggestedProjects: string[];
  savedDomains: string[];
  suggestedDomains: string[];
  savedActivities: string[];
  suggestedActivities: string[];
  savedTags: string[];
  suggestedTags: string[];
  isTranscribingAudio: boolean;
  recordingMode: RecordingMode;
  isRecordingAudio: boolean;
  recordingStatusNote?: string | null;
  onChange: (session: SessionRecord) => void;
  onImportTranscript: () => void;
  onImportAudio: () => void;
  onImportImage: () => void;
  onTranscribeAudio: () => void;
  onChangeRecordingMode: (mode: RecordingMode) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onUpdateAttachment: (attachment: AttachmentRecord) => void;
  onOpenDetails?: () => void;
}

const RECORDING_MODE_META: Record<
  RecordingMode,
  {
    label: string;
    description: string;
  }
> = {
  microphone: {
    label: "Microphone",
    description: "Best for dictation and people speaking in the room.",
  },
  "system-audio": {
    label: "Computer audio",
    description: "Best for Zoom, Teams, webinars, and speaker playback shared from this computer.",
  },
  hybrid: {
    label: "Microphone + computer audio",
    description: "Best for hybrid meetings with room voices and remote participants together.",
  },
};

const DETAIL_LEVEL_LABELS: Record<number, string> = {
  1: "Minimal",
  2: "Concise",
  3: "Balanced",
  4: "Detailed",
  5: "Comprehensive",
};

const CAPTURE_MODE_META: Record<
  CaptureMode,
  {
    label: string;
    subtitle: string;
    primaryFieldLabel: string;
    primaryFieldPlaceholder: string;
  }
> = {
  "meeting-note": {
    label: "Meeting note",
    subtitle: "Best for meetings, calls, interviews, and structured minutes.",
    primaryFieldLabel: "Manual notes",
    primaryFieldPlaceholder: "Capture the rough meeting notes here. The AI will combine this with transcript and context.",
  },
  "quick-note": {
    label: "Quick note",
    subtitle: "Best for fast typed notes with minimal setup and low metadata.",
    primaryFieldLabel: "Note",
    primaryFieldPlaceholder: "Write the note here. Keep it rough and fast; polishing comes later.",
  },
  "voice-note": {
    label: "Voice note",
    subtitle: "Best for dictation, spoken reflections, and quick audio-first capture.",
    primaryFieldLabel: "Dictation / transcript",
    primaryFieldPlaceholder: "Dictated or transcribed speech should live here as the main capture source.",
  },
};

export const SessionEditor = ({
  session,
  templates,
  attachments,
  presentation = "full",
  showPresentationActions = true,
  savedPeople,
  suggestedPeople,
  savedProjects,
  suggestedProjects,
  savedDomains,
  suggestedDomains,
  savedActivities,
  suggestedActivities,
  savedTags,
  suggestedTags,
  isTranscribingAudio,
  recordingMode,
  isRecordingAudio,
  recordingStatusNote,
  onChange,
  onImportTranscript,
  onImportAudio,
  onImportImage,
  onTranscribeAudio,
  onChangeRecordingMode,
  onStartRecording,
  onStopRecording,
  onRemoveAttachment,
  onUpdateAttachment,
  onOpenDetails,
}: SessionEditorProps) => {
  const update = <K extends keyof SessionRecord>(key: K, value: SessionRecord[K]) =>
    onChange({ ...session, [key]: value });

  const availableTemplates = getTemplatesForCaptureMode(templates, session.captureMode);
  const activeTemplate =
    availableTemplates.find((template) => template.id === session.templateId) ??
    availableTemplates[0] ??
    templates[0];
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
  const modeMeta = CAPTURE_MODE_META[session.captureMode];
  const showMeetingMeta = session.captureMode === "meeting-note";
  const showQuickHighlights = session.captureMode === "meeting-note";
  const showTranscriptField = session.captureMode !== "quick-note";
  const primaryTemplateOptions = availableTemplates.length ? availableTemplates : templates;
  const isMinimal = presentation === "minimal";
  const showMinimalMeetingCore = isMinimal && session.captureMode === "meeting-note";
  const showMinimalVoiceCore = isMinimal && session.captureMode === "voice-note";
  const showFullAudioCard = !isMinimal && session.captureMode !== "quick-note";
  const showMinimalAudioStrip = isMinimal && session.captureMode !== "quick-note";
  const showDetailsDisclosure = !isMinimal;

  const switchMode = (captureMode: CaptureMode) => {
    const nextTemplates = getTemplatesForCaptureMode(templates, captureMode);
    const nextTemplate =
      nextTemplates.find((template) => template.id === DEFAULT_TEMPLATE_BY_CAPTURE_MODE[captureMode]) ?? nextTemplates[0];
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
      captureMode,
      templateId: nextTemplate?.id ?? session.templateId,
      customFieldValues: nextFieldValues,
      excludedSectionIds: [],
    });
  };

  const handleTemplateChange = (templateId: string) => {
    const nextTemplate = templates.find((template) => template.id === templateId);
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
      templateId,
      customFieldValues: nextFieldValues,
      excludedSectionIds: [],
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Capture</h2>
        </div>
        {isMinimal && showPresentationActions ? (
          <div className="capture-minimal-actions">
            <span className="tiny-text">Minimal mode</span>
            <button className="small-button" type="button" onClick={onOpenDetails}>
              Open details
            </button>
          </div>
        ) : null}
      </div>

      <div className={`capture-mode-switch${isMinimal ? " capture-mode-switch-minimal" : ""}`}>
        {(Object.keys(CAPTURE_MODE_META) as CaptureMode[]).map((captureMode) => (
          <button
            key={captureMode}
            className="capture-mode-card"
            data-active={session.captureMode === captureMode}
            type="button"
            onClick={() => switchMode(captureMode)}
          >
            <strong>{CAPTURE_MODE_META[captureMode].label}</strong>
            <span>{CAPTURE_MODE_META[captureMode].subtitle}</span>
          </button>
        ))}
      </div>

      <div className="form-grid">
        <div className="capture-top-row field field-wide">
          <div className="field capture-template-field">
            <label htmlFor="template-select">Template</label>
            <select id="template-select" value={activeTemplate?.id ?? ""} onChange={(event) => handleTemplateChange(event.target.value)}>
              {primaryTemplateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field capture-title-field">
            <label htmlFor="session-title">Title</label>
            <input
              id="session-title"
              value={session.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder={
                session.captureMode === "meeting-note"
                  ? "Weekly project meeting"
                  : session.captureMode === "voice-note"
                    ? "Voice memo"
                    : "Quick note title"
              }
            />
          </div>

          <div className="field capture-private-field">
            <span>Private</span>
            <div className="compact-private-toggle">
              <input
                id="session-private"
                type="checkbox"
                checked={session.isPrivate}
                onChange={(event) => update("isPrivate", event.target.checked)}
              />
              <label htmlFor="session-private" className="checkbox-label">
                Private
              </label>
            </div>
          </div>
        </div>

        {showFullAudioCard ? (
          <div className="field field-wide audio-capture-card" data-recording={isRecordingAudio}>
            <div className="audio-capture-header">
              <div>
                <div className="audio-capture-heading-row">
                  <label>Audio capture</label>
                  {isRecordingAudio ? (
                    <span className="recording-live-pill" aria-live="polite">
                      <span className="recording-live-dot" />
                      Recording now
                    </span>
                  ) : null}
                </div>
                <p className="muted">
                  {session.captureMode === "meeting-note"
                    ? "Record the meeting directly here or upload audio later."
                    : "Start with recording if this note begins as a spoken memo."}
                </p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={isRecordingAudio ? onStopRecording : onStartRecording}
              >
                {isRecordingAudio ? "Stop recording" : "Start recording"}
              </button>
            </div>
            {isRecordingAudio ? (
              <div className="recording-active-banner" aria-live="polite">
                <strong>Recording in progress</strong>
                <span>
                  {recordingMode === "microphone"
                    ? "The microphone is currently being captured into this session."
                    : recordingMode === "system-audio"
                      ? "Shared computer audio is currently being captured into this session."
                      : "Microphone and shared computer audio are both being captured into this session."}
                </span>
              </div>
            ) : null}
            <div className="recording-mode-grid">
              {(Object.keys(RECORDING_MODE_META) as RecordingMode[]).map((mode) => {
                const meta = RECORDING_MODE_META[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    className="recording-mode-card"
                    data-active={recordingMode === mode}
                    onClick={() => onChangeRecordingMode(mode)}
                  >
                    <strong>{meta.label}</strong>
                    <p>{meta.description}</p>
                  </button>
                );
              })}
            </div>
            <span className="tiny-text">
              {recordingStatusNote ||
                (recordingMode === "microphone"
                  ? "Microphone mode records spoken audio directly into this session."
                  : recordingMode === "system-audio"
                    ? "Choose a shared window, screen, or app and enable audio sharing when prompted."
                    : "Capture room speech from the microphone and remote voices from shared computer audio together.")}
            </span>
          </div>
        ) : null}

        {showMinimalAudioStrip ? (
          <div className="field field-wide minimal-audio-strip" data-recording={isRecordingAudio}>
            <div className="minimal-audio-strip-main">
              <strong>Audio capture</strong>
              <span className="muted">
                {isRecordingAudio
                  ? recordingMode === "microphone"
                    ? "Recording microphone"
                    : recordingMode === "system-audio"
                      ? "Recording computer audio"
                      : "Recording microphone and computer audio"
                  : "Ready to record or transcribe"}
              </span>
            </div>
            <div className="minimal-audio-strip-actions">
              <select value={recordingMode} onChange={(event) => onChangeRecordingMode(event.target.value as RecordingMode)}>
                {(Object.keys(RECORDING_MODE_META) as RecordingMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {RECORDING_MODE_META[mode].label}
                  </option>
                ))}
              </select>
              <button className="primary-button" type="button" onClick={isRecordingAudio ? onStopRecording : onStartRecording}>
                {isRecordingAudio ? "Stop recording" : "Record"}
              </button>
            </div>
          </div>
        ) : null}

        {showMinimalMeetingCore ? (
          <div className="field field-wide minimal-context-grid">
            <div className="field">
              <label htmlFor="session-participants">People</label>
              <PeoplePicker
                value={session.participantText}
                savedPeople={savedPeople}
                suggestedPeople={suggestedPeople}
                onChange={(value) => update("participantText", value)}
                placeholder="Search or add people"
              />
            </div>
            <div className="field">
              <label htmlFor="session-date">Date</label>
              <input id="session-date" type="date" value={session.date} onChange={(event) => update("date", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="session-start">Start time</label>
              <input id="session-start" type="time" value={session.startTime} onChange={(event) => update("startTime", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="session-end">End time</label>
              <input id="session-end" type="time" value={session.endTime} onChange={(event) => update("endTime", event.target.value)} />
            </div>
          </div>
        ) : null}

        {showDetailsDisclosure && showMeetingMeta ? (
          <details className="field field-wide workspace-disclosure">
            <summary>Meeting details</summary>
            <div className="workspace-disclosure-body form-grid">
              <div className="field">
                <label htmlFor="session-date">Date</label>
                <input id="session-date" type="date" value={session.date} onChange={(event) => update("date", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="session-participants">People</label>
                <PeoplePicker
                  value={session.participantText}
                  savedPeople={savedPeople}
                  suggestedPeople={suggestedPeople}
                  onChange={(value) => update("participantText", value)}
                  placeholder="Search or add people"
                />
              </div>
              <div className="field field-wide metadata-triplet">
                <div className="metadata-triplet-grid">
                  <div className="field metadata-subfield">
                    <label htmlFor="session-domain">Domain</label>
                    <TokenPicker
                      value={session.domain}
                      savedOptions={savedDomains}
                      suggestedOptions={suggestedDomains}
                      placeholder="Search or add domain"
                      suggestionSummary="Recent domains"
                      suggestionBadgeText="From saved Domains"
                      mode="single"
                      onChange={(value) => update("domain", value)}
                    />
                  </div>
                  <div className="field metadata-subfield">
                    <label htmlFor="session-project">Project</label>
                    <TokenPicker
                      value={session.project}
                      savedOptions={savedProjects}
                      suggestedOptions={suggestedProjects}
                      placeholder="Search or add project"
                      suggestionSummary="Recent projects"
                      suggestionBadgeText="From saved Projects"
                      mode="single"
                      onChange={(value) => update("project", value)}
                    />
                  </div>
                  <div className="field metadata-subfield">
                    <label htmlFor="session-activity">Activity</label>
                    <TokenPicker
                      value={session.activity}
                      savedOptions={savedActivities}
                      suggestedOptions={suggestedActivities}
                      placeholder="Search or add activity"
                      suggestionSummary="Recent activities"
                      suggestionBadgeText="From saved Activities"
                      mode="single"
                      onChange={(value) => update("activity", value)}
                    />
                  </div>
                </div>
              </div>
              <div className="field">
                <label htmlFor="session-start">Start time</label>
                <input id="session-start" type="time" value={session.startTime} onChange={(event) => update("startTime", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="session-end">End time</label>
                <input id="session-end" type="time" value={session.endTime} onChange={(event) => update("endTime", event.target.value)} />
              </div>
              <div className="field field-wide">
                <label htmlFor="session-tags">Tags</label>
                <TokenPicker
                  value={session.tagsText}
                  savedOptions={savedTags}
                  suggestedOptions={suggestedTags}
                  placeholder="Add tags like q2-planning, budget, hiring"
                  suggestionSummary="Recent tags"
                  suggestionBadgeText="From saved Tags"
                  onChange={(value) => update("tagsText", value)}
                />
              </div>
            </div>
          </details>
        ) : showDetailsDisclosure ? (
          <details className="field field-wide workspace-disclosure">
            <summary>Optional note details</summary>
            <div className="workspace-disclosure-body form-grid">
              <div className="field">
                <label htmlFor="session-date">Date</label>
                <input id="session-date" type="date" value={session.date} onChange={(event) => update("date", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="session-time">Time</label>
                <input id="session-time" type="time" value={session.startTime} onChange={(event) => update("startTime", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="session-participants">People</label>
                <PeoplePicker
                  value={session.participantText}
                  savedPeople={savedPeople}
                  suggestedPeople={suggestedPeople}
                  onChange={(value) => update("participantText", value)}
                  placeholder="Search or add optional context"
                />
              </div>
              <div className="field field-wide metadata-triplet">
                <div className="metadata-triplet-grid">
                  <div className="field metadata-subfield">
                    <label htmlFor="session-domain">Domain</label>
                    <TokenPicker
                      value={session.domain}
                      savedOptions={savedDomains}
                      suggestedOptions={suggestedDomains}
                      placeholder="Search or add domain"
                      suggestionSummary="Recent domains"
                      suggestionBadgeText="From saved Domains"
                      mode="single"
                      onChange={(value) => update("domain", value)}
                    />
                  </div>
                  <div className="field metadata-subfield">
                    <label htmlFor="session-project">Project</label>
                    <TokenPicker
                      value={session.project}
                      savedOptions={savedProjects}
                      suggestedOptions={suggestedProjects}
                      placeholder="Search or add project"
                      suggestionSummary="Recent projects"
                      suggestionBadgeText="From saved Projects"
                      mode="single"
                      onChange={(value) => update("project", value)}
                    />
                  </div>
                  <div className="field metadata-subfield">
                    <label htmlFor="session-activity">Activity</label>
                    <TokenPicker
                      value={session.activity}
                      savedOptions={savedActivities}
                      suggestedOptions={suggestedActivities}
                      placeholder="Search or add activity"
                      suggestionSummary="Recent activities"
                      suggestionBadgeText="From saved Activities"
                      mode="single"
                      onChange={(value) => update("activity", value)}
                    />
                  </div>
                </div>
              </div>
              <div className="field field-wide">
                <label htmlFor="session-tags">Tags</label>
                <TokenPicker
                  value={session.tagsText}
                  savedOptions={savedTags}
                  suggestedOptions={suggestedTags}
                  placeholder="Add tags like q2-planning, budget, hiring"
                  suggestionSummary="Recent tags"
                  suggestionBadgeText="From saved Tags"
                  onChange={(value) => update("tagsText", value)}
                />
              </div>
            </div>
          </details>
        ) : null}

        {session.captureMode === "voice-note" ? (
          <>
            <div className="field field-wide">
              <label htmlFor="live-transcript">{modeMeta.primaryFieldLabel}</label>
              <textarea
                id="live-transcript"
                value={session.liveTranscript}
                onChange={(event) => update("liveTranscript", event.target.value)}
                placeholder={modeMeta.primaryFieldPlaceholder}
              />
            </div>
            {isMinimal ? (
              <div className="field field-wide">
                <label htmlFor="manual-notes">Notes</label>
                <textarea
                  id="manual-notes"
                  value={session.manualNotes}
                  onChange={(event) => update("manualNotes", event.target.value)}
                  placeholder="Add a short written note if it helps later."
                />
              </div>
            ) : (
              <details className="field field-wide workspace-disclosure">
                <summary>Optional written note</summary>
                <div className="workspace-disclosure-body">
                  <div className="field field-wide">
                    <label htmlFor="manual-notes">Manual note</label>
                    <textarea
                      id="manual-notes"
                      value={session.manualNotes}
                      onChange={(event) => update("manualNotes", event.target.value)}
                      placeholder="Add a short written note if it helps later."
                    />
                  </div>
                </div>
              </details>
            )}
          </>
        ) : (
          <div className="field field-wide">
            <label htmlFor="manual-notes">{modeMeta.primaryFieldLabel}</label>
            <textarea
              id="manual-notes"
              value={session.manualNotes}
              onChange={(event) => update("manualNotes", event.target.value)}
              placeholder={modeMeta.primaryFieldPlaceholder}
            />
          </div>
        )}

        {!isMinimal && showQuickHighlights ? (
          <div className="field field-wide">
            <label htmlFor="quick-highlights">Quick highlights</label>
            <textarea
              id="quick-highlights"
              value={session.quickHighlights}
              onChange={(event) => update("quickHighlights", event.target.value)}
              placeholder="Short key points, names, or topics to emphasize in the final output."
            />
          </div>
        ) : null}

        {!isMinimal ? customFields.map((field) => (
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
        )) : null}

        {!showMinimalVoiceCore && showTranscriptField ? (
          <div className="field field-wide">
            <label htmlFor="session-transcript">
              {session.captureMode === "meeting-note" ? "Transcript" : "Live transcript"}
            </label>
            <textarea
              id="session-transcript"
              value={session.liveTranscript}
              onChange={(event) => update("liveTranscript", event.target.value)}
              placeholder={
                session.captureMode === "meeting-note"
                  ? "Meeting transcript text will land here."
                  : "Spoken capture and transcript text live here."
              }
            />
          </div>
        ) : null}

        {!isMinimal ? (
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
        ) : null}

        {!isMinimal ? (
          <div className="page-actions field-wide">
          <button className="small-button" type="button" onClick={onImportImage}>
            Upload image
          </button>
          {session.captureMode !== "quick-note" ? (
            <>
              <button className="small-button" type="button" onClick={onImportAudio}>
                Upload audio
              </button>
              <button className="small-button" type="button" onClick={onTranscribeAudio}>
                {isTranscribingAudio ? "Transcribing audio..." : "Transcribe audio"}
              </button>
              <button className="small-button" type="button" onClick={onImportTranscript}>
                Upload transcript file
              </button>
            </>
          ) : (
            <button className="small-button" type="button" onClick={onImportTranscript}>
              Upload note text
            </button>
          )}
          </div>
        ) : null}

        {!isMinimal && imageAttachments.length ? (
          <div className="field field-wide">
            <label>Session images</label>
            <div className="section-list">
              {imageAttachments.map((attachment, index) => (
                <div key={attachment.id} className="list-item image-attachment-item">
                  <AttachmentImagePreview attachment={attachment} />
                  <div className="image-attachment-details">
                    <strong>{attachment.filename}</strong>
                    <span className="muted">{Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB</span>
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

        {!isMinimal && otherAttachments.length ? (
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
