import { useEffect, useMemo, useRef, useState } from "react";
import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import { DateInput } from "../../../components/DateInput";
import { PeoplePicker } from "../../../components/PeoplePicker";
import { TokenPicker } from "../../../components/TokenPicker";
import { parseTokenList } from "../../../components/peoplePickerUtils";
import { getActivitiesForSelection, getProjectsForDomain, type StructureOptions } from "../../../lib/structure/options";
import type { RecordingMode } from "../../../lib/files/recording";
import { getPrimaryCaptureMode, getTemplatesForCaptureMode, type AttachmentRecord, type CaptureWorkspaceDensity, type SessionRecord, type TemplateDefinition } from "@notesmith/domain";

const richTextToPlainText = (value: string) => {
  if (!value) return "";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const normalizeRichTextHtml = (value: string) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value || "";
  const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6"]);
  wrapper.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }
      element.replaceWith(fragment);
      return;
    }
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
  });
  const normalized = wrapper.innerHTML.replace(/<div>/gi, "<p>").replace(/<\/div>/gi, "</p>").trim();
  if (!normalized) return "";
  if (!/<(p|ul|ol|li|br|h[1-6])\b/i.test(normalized)) {
    return `<p>${normalized}</p>`;
  }
  return normalized;
};

const RICH_TEXT_COMMANDS = [
  { id: "bold", label: "Bold", type: "command", command: "bold" },
  { id: "italic", label: "Italic", type: "command", command: "italic" },
  { id: "unordered", label: "Bullets", type: "command", command: "insertUnorderedList" },
  { id: "ordered", label: "Numbered", type: "command", command: "insertOrderedList" },
  { id: "h1", label: "H1", type: "block", value: "H1" },
  { id: "h2", label: "H2", type: "block", value: "H2" },
  { id: "h3", label: "H3", type: "block", value: "H3" },
  { id: "h4", label: "H4", type: "block", value: "H4" },
  { id: "h5", label: "H5", type: "block", value: "H5" },
  { id: "h6", label: "H6", type: "block", value: "H6" },
] as const;

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
  structureOptions: StructureOptions;
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
  onCreateSessionFromTemplate?: (templateId: string) => void;
  onOpenInstructions?: () => void;
}

const RECORDING_MODE_META: Record<RecordingMode, { label: string; description: string; helper: string }> = {
  microphone: {
    label: "Room / hybrid meeting",
    description: "Best when people in the room and speaker audio are both being heard physically in the space.",
    helper: "Use this for in-room meetings, hybrid meetings played through speakers, and everyday spoken capture.",
  },
  "system-audio": {
    label: "Direct computer audio",
    description: "Best for Teams, Zoom, webinars, playback, or anything you want captured directly from this computer.",
    helper: "Choose the app, screen, or system audio source when prompted.",
  },
  hybrid: {
    label: "Room + direct computer audio",
    description: "Best when you need both the room microphone and direct in-computer audio together.",
    helper: "This combines microphone capture with direct computer audio for the richest desktop meeting capture.",
  },
};

const DETAIL_LEVEL_LABELS: Record<number, string> = { 1: "Minimal", 2: "Concise", 3: "Balanced", 4: "Detailed", 5: "Comprehensive" };
const STANDARD_TEMPLATE_FIELD_KEYS = ["title", "participants", "date", "startTime", "endTime", "agenda"] as const;
const CAPTURE_MODE_META = {
  "meeting-note": { label: "Meeting", subtitle: "Best for meetings, calls, interviews, and structured minutes.", primaryFieldLabel: "Manual notes", primaryFieldPlaceholder: "Write your own notes here. The AI will combine them with transcript and context." },
  "quick-note": { label: "Quick note", subtitle: "Best for fast typed notes with minimal setup.", primaryFieldLabel: "Manual notes", primaryFieldPlaceholder: "Write your own notes here. They will be included in the Output." },
  "voice-note": { label: "Voice note", subtitle: "Best for audio-first capture and spoken reflections.", primaryFieldLabel: "Manual notes", primaryFieldPlaceholder: "Add any written notes you want included alongside the recording and transcript." },
} as const;

export const SessionEditor = ({
  session, templates, attachments, presentation = "full", showPresentationActions = true,
  savedPeople, suggestedPeople, savedProjects, suggestedProjects, savedDomains, suggestedDomains, savedActivities,
  suggestedActivities, structureOptions, savedTags, suggestedTags, isTranscribingAudio, recordingMode,
  isRecordingAudio, recordingStatusNote, onChange, onImportTranscript, onImportAudio, onImportImage,
  onTranscribeAudio, onChangeRecordingMode, onStartRecording, onStopRecording, onRemoveAttachment,
  onUpdateAttachment, onOpenDetails, onCreateSessionFromTemplate,
  onOpenInstructions,
}: SessionEditorProps) => {
  const update = <K extends keyof SessionRecord>(key: K, value: SessionRecord[K]) => onChange({ ...session, [key]: value });
  const agendaEditorRef = useRef<HTMLDivElement | null>(null);
  const manualNotesEditorRef = useRef<HTMLDivElement | null>(null);
  const [highlightDraft, setHighlightDraft] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(session.captureMode === "meeting-note");
  const [peopleOpen, setPeopleOpen] = useState(Boolean(session.participantText.trim()));
  const [contextOpen, setContextOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(session.captureMode === "voice-note" || Boolean(session.liveTranscript.trim()));
  const [uploadedTranscriptOpen, setUploadedTranscriptOpen] = useState(Boolean(session.uploadedTranscript.trim()));

  useEffect(() => {
    setDetailsOpen(session.captureMode === "meeting-note");
    setPeopleOpen(Boolean(session.participantText.trim()));
    setContextOpen(false);
    setTranscriptOpen(session.captureMode === "voice-note" || Boolean(session.liveTranscript.trim()));
    setUploadedTranscriptOpen(Boolean(session.uploadedTranscript.trim()));
  }, [session.id, session.captureMode, session.participantText, session.liveTranscript, session.uploadedTranscript]);

  const availableTemplates = getTemplatesForCaptureMode(templates, session.captureMode);
  const activeTemplate = availableTemplates.find((template) => template.id === session.templateId) ?? availableTemplates[0] ?? templates[0];
  const quickStartTemplates = useMemo(() => {
    const preferredOrder = ["meeting", "personal-note", "one-on-one"];
    const builtIns = preferredOrder.map((id) => templates.find((template) => template.id === id)).filter((template): template is TemplateDefinition => Boolean(template));
    const customs = templates.filter((template) => template.kind === "custom" && !preferredOrder.includes(template.id));
    return [...builtIns, ...customs];
  }, [templates]);
  const agendaField = activeTemplate?.fields.find((field) => field.key === "agenda" && field.enabled);
  const customFields =
    activeTemplate?.fields.filter(
      (field) => field.enabled && !STANDARD_TEMPLATE_FIELD_KEYS.includes(field.key as (typeof STANDARD_TEMPLATE_FIELD_KEYS)[number]),
    ) ?? [];
  const enabledSections = activeTemplate?.sections.map((section) => ({ ...section, checked: !session.excludedSectionIds.includes(section.id) })) ?? [];
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");
  const otherAttachments = attachments.filter((attachment) => attachment.kind !== "image");
  const filteredProjects = getProjectsForDomain(structureOptions, session.domain);
  const filteredActivities = getActivitiesForSelection(structureOptions, session.domain, session.project);
  const projectPickerOptions = filteredProjects.length ? filteredProjects : savedProjects;
  const activityPickerOptions = filteredActivities.length ? filteredActivities : savedActivities;
  const filteredProjectSet = new Set(projectPickerOptions);
  const filteredActivitySet = new Set(activityPickerOptions);
  const suggestedProjectsForSelection = suggestedProjects.filter((project) => filteredProjectSet.has(project));
  const suggestedActivitiesForSelection = suggestedActivities.filter((activity) => filteredActivitySet.has(activity));
  const modeMeta = CAPTURE_MODE_META[session.captureMode];
  const isMinimal = presentation === "minimal";
  const showFullAudioCard = !isMinimal && session.captureMode !== "quick-note";
  const showMinimalAudioStrip = isMinimal && session.captureMode !== "quick-note";
  const showQuickHighlights = session.captureMode === "meeting-note";
  const titleField = activeTemplate?.fields.find((field) => field.key === "title" && field.enabled);
  const participantsField = activeTemplate?.fields.find((field) => field.key === "participants" && field.enabled);
  const hasDateField = Boolean(activeTemplate?.fields.find((field) => field.key === "date" && field.enabled));
  const hasStartTimeField = Boolean(activeTemplate?.fields.find((field) => field.key === "startTime" && field.enabled));
  const hasEndTimeField = Boolean(activeTemplate?.fields.find((field) => field.key === "endTime" && field.enabled));
  const shouldShowLiveTranscript = session.captureMode === "voice-note" || Boolean(session.liveTranscript.trim());
  const titleLabel = titleField?.label || "Title";
  const highlightTokens = useMemo(() => parseTokenList(session.quickHighlights), [session.quickHighlights]);

  useEffect(() => {
    if (!agendaEditorRef.current || !agendaField) return;
    const nextHtml = normalizeRichTextHtml(session.customFieldValues[agendaField.id] ?? "");
    if (agendaEditorRef.current.innerHTML !== nextHtml) {
      agendaEditorRef.current.innerHTML = nextHtml;
    }
    agendaEditorRef.current.dataset.empty = richTextToPlainText(nextHtml) ? "false" : "true";
  }, [agendaField, session.customFieldValues, session.id]);

  useEffect(() => {
    if (!manualNotesEditorRef.current) return;
    const nextHtml = normalizeRichTextHtml(session.manualNotes);
    if (manualNotesEditorRef.current.innerHTML !== nextHtml) {
      manualNotesEditorRef.current.innerHTML = nextHtml;
    }
    manualNotesEditorRef.current.dataset.empty = richTextToPlainText(nextHtml) ? "false" : "true";
  }, [session.manualNotes, session.id]);

  const updateAgenda = (html: string) => {
    if (!agendaField) return;
    const normalized = normalizeRichTextHtml(html);
    update("customFieldValues", { ...session.customFieldValues, [agendaField.id]: normalized });
    if (agendaEditorRef.current) {
      agendaEditorRef.current.dataset.empty = richTextToPlainText(normalized) ? "false" : "true";
    }
  };

  const updateManualNotes = (html: string) => {
    const normalized = normalizeRichTextHtml(html);
    update("manualNotes", normalized);
    if (manualNotesEditorRef.current) {
      manualNotesEditorRef.current.dataset.empty = richTextToPlainText(normalized) ? "false" : "true";
    }
  };

  const applyRichTextCommand = (
    editorRef: { current: HTMLDivElement | null },
    updater: (html: string) => void,
    action: (typeof RICH_TEXT_COMMANDS)[number],
  ) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (action.type === "block") {
      document.execCommand("formatBlock", false, action.value);
    } else {
      document.execCommand(action.command);
    }
    updater(editorRef.current.innerHTML);
  };

  const applyAgendaCommand = (action: (typeof RICH_TEXT_COMMANDS)[number]) => {
    applyRichTextCommand(agendaEditorRef, updateAgenda, action);
  };

  const applyManualNotesCommand = (action: (typeof RICH_TEXT_COMMANDS)[number]) => {
    applyRichTextCommand(manualNotesEditorRef, updateManualNotes, action);
  };

  const handleDomainChange = (domain: string) => {
    const nextProjects = getProjectsForDomain(structureOptions, domain);
    const nextProject = nextProjects.includes(session.project) ? session.project : "";
    const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
    const nextActivity = nextActivities.includes(session.activity) ? session.activity : "";
    onChange({ ...session, domain, project: nextProject, activity: nextActivity });
  };

  const handleProjectChange = (project: string) => {
    const nextActivities = getActivitiesForSelection(structureOptions, session.domain, project);
    const nextActivity = nextActivities.includes(session.activity) ? session.activity : "";
    onChange({ ...session, project, activity: nextActivity });
  };

  const handleTemplateChange = (templateId: string) => {
    const nextTemplate = templates.find((template) => template.id === templateId);
    const nextCaptureMode = nextTemplate ? getPrimaryCaptureMode(nextTemplate) : session.captureMode;
    const nextFieldValues = Object.fromEntries((nextTemplate?.fields ?? [])
      .filter(
        (field) => field.enabled && !STANDARD_TEMPLATE_FIELD_KEYS.includes(field.key as (typeof STANDARD_TEMPLATE_FIELD_KEYS)[number]),
      )
      .map((field) => [field.id, session.customFieldValues[field.id] ?? ""]));
    onChange({ ...session, captureMode: nextCaptureMode, templateId, customFieldValues: nextFieldValues, excludedSectionIds: [] });
  };

  const addHighlight = (rawValue: string) => {
    const nextEntry = rawValue.trim();
    if (!nextEntry) {
      return;
    }
    const nextHighlights = Array.from(new Map([...highlightTokens, nextEntry].map((entry) => [entry.toLocaleLowerCase(), entry] as const)).values());
    update("quickHighlights", nextHighlights.join(", "));
    setHighlightDraft("");
  };

  const removeHighlight = (target: string) => {
    update(
      "quickHighlights",
      highlightTokens.filter((entry) => entry.toLocaleLowerCase() !== target.toLocaleLowerCase()).join(", "),
    );
  };

  if (isMinimal) {
    return (
      <div className="card session-editor session-editor-minimal session-editor-pwa">
        <div className="panel-heading session-editor-pwa-heading">
          <div className="panel-heading-copy">
            <p className="section-label">Capture</p>
            <h2>{session.title || "Untitled session"}</h2>
          </div>
          <div className="panel-actions panel-actions-capture-top">
            <div className="panel-actions-shared">
              {onOpenInstructions ? (
                <button className="shell-button" type="button" onClick={onOpenInstructions}>
                  Instructions
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="editor-header-row session-editor-pwa-template-row">
          <div className="template-quick-selectors template-quick-selectors-desktop">
            {quickStartTemplates.map((template) => (
              <button
                key={template.id}
                className="ghost-button session-template-pill-pwa"
                type="button"
                onClick={() => onCreateSessionFromTemplate?.(template.id)}
                disabled={!onCreateSessionFromTemplate}
              >
                {`New ${template.name}`}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-layout session-editor-pwa-layout">
          <div className="editor-main">
            <section className="form-section" aria-label="Session details">
              <details className="workspace-disclosure pwa-disclosure-card" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
                <summary>
                  <div className="form-section-header">
                    <p className="section-label">Details</p>
                  </div>
                </summary>
                <div className="workspace-disclosure-body form-grid">
                  <div className="field field-wide">
                    <label htmlFor="session-title">{titleLabel}</label>
                    <input
                      className="minimal-title-input"
                      id="session-title"
                      value={session.title}
                      onChange={(event) => update("title", event.target.value)}
                      placeholder={session.captureMode === "meeting-note" ? "Weekly project meeting" : session.captureMode === "voice-note" ? "Voice memo" : "Quick note title"}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="template-select">Template</label>
                    <select id="template-select" value={activeTemplate?.id ?? ""} onChange={(event) => handleTemplateChange(event.target.value)}>
                      {availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasDateField ? (
                    <div className="field">
                      <label htmlFor="session-date">Date</label>
                      <DateInput id="session-date" value={session.date} onChange={(event) => update("date", event.target.value)} />
                    </div>
                  ) : null}
                  {hasStartTimeField ? (
                    <div className="field">
                      <label htmlFor="session-start">Start time</label>
                      <input id="session-start" type="time" value={session.startTime} onChange={(event) => update("startTime", event.target.value)} />
                    </div>
                  ) : null}
                  {hasEndTimeField ? (
                    <div className="field">
                      <label htmlFor="session-end">End time</label>
                      <input id="session-end" type="time" value={session.endTime} onChange={(event) => update("endTime", event.target.value)} />
                    </div>
                  ) : null}
                  {agendaField ? (
                    <details className="field field-wide workspace-disclosure">
                      <summary>{agendaField.label}</summary>
                      <div className="workspace-disclosure-body">
                        <div className="rich-text-toolbar">
                          {RICH_TEXT_COMMANDS.map((action) => (
                            <button key={action.id} className="shell-button rich-text-command" type="button" onClick={() => applyAgendaCommand(action)}>
                              {action.label}
                            </button>
                          ))}
                        </div>
                        <div
                          id="session-agenda"
                          ref={agendaEditorRef}
                          className="rich-text-surface agenda-rich-text-surface"
                          contentEditable
                          suppressContentEditableWarning
                          data-placeholder="List the planned agenda, topics, or framing points for this meeting."
                          data-empty="true"
                          onInput={(event) => updateAgenda((event.currentTarget as HTMLDivElement).innerHTML)}
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              </details>
            </section>

            {participantsField ? (
              <section className="form-section" aria-label="People">
                <details className="workspace-disclosure pwa-disclosure-card" open={peopleOpen} onToggle={(event) => setPeopleOpen(event.currentTarget.open)}>
                  <summary>
                    <div className="form-section-header">
                      <p className="section-label">People</p>
                    </div>
                  </summary>
                  <div className="workspace-disclosure-body form-grid">
                    <div className="field field-wide">
                      <label htmlFor="session-participants">{participantsField.label}</label>
                      <PeoplePicker value={session.participantText} savedPeople={savedPeople} suggestedPeople={suggestedPeople} onChange={(value) => update("participantText", value)} placeholder="Search or add people" />
                    </div>
                    {customFields.map((field) => (
                      <div key={field.id} className={field.type === "textarea" ? "field field-wide" : "field"}>
                        <label htmlFor={`custom-field-${field.id}`}>{field.label}</label>
                        {field.type === "textarea" ? (
                          <textarea id={`custom-field-${field.id}`} value={session.customFieldValues[field.id] ?? ""} onChange={(event) => update("customFieldValues", { ...session.customFieldValues, [field.id]: event.target.value })} />
                        ) : (
                          <input id={`custom-field-${field.id}`} type={field.type === "number" ? "number" : field.type} value={session.customFieldValues[field.id] ?? ""} onChange={(event) => update("customFieldValues", { ...session.customFieldValues, [field.id]: event.target.value })} />
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </section>
            ) : customFields.length ? (
              <section className="form-section" aria-label="Details">
                <details className="workspace-disclosure pwa-disclosure-card">
                  <summary>
                    <div className="form-section-header">
                      <p className="section-label">Details</p>
                    </div>
                  </summary>
                  <div className="workspace-disclosure-body form-grid">
                    {customFields.map((field) => (
                      <div key={field.id} className={field.type === "textarea" ? "field field-wide" : "field"}>
                        <label htmlFor={`custom-field-${field.id}`}>{field.label}</label>
                        {field.type === "textarea" ? (
                          <textarea id={`custom-field-${field.id}`} value={session.customFieldValues[field.id] ?? ""} onChange={(event) => update("customFieldValues", { ...session.customFieldValues, [field.id]: event.target.value })} />
                        ) : (
                          <input id={`custom-field-${field.id}`} type={field.type === "number" ? "number" : field.type} value={session.customFieldValues[field.id] ?? ""} onChange={(event) => update("customFieldValues", { ...session.customFieldValues, [field.id]: event.target.value })} />
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </section>
            ) : null}

            {showQuickHighlights ? (
              <section className="form-section" aria-label="Highlights">
                <details className="workspace-disclosure pwa-disclosure-card" open>
                  <summary>
                    <div className="form-section-header">
                      <p className="section-label">Highlights</p>
                    </div>
                  </summary>
                  <div className="workspace-disclosure-body form-grid">
                    <div className="field field-wide">
                      <label htmlFor="quick-highlights">Quick highlights</label>
                      <input
                        id="quick-highlights"
                        value={highlightDraft}
                        onChange={(event) => setHighlightDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === "," || event.key === ";") {
                            event.preventDefault();
                            addHighlight(highlightDraft);
                          }
                        }}
                        placeholder="Type a highlight and press Enter"
                      />
                      {highlightTokens.length ? (
                        <div className="session-highlight-chip-row">
                          {highlightTokens.map((highlight) => (
                            <button
                              key={highlight}
                              className="people-suggestion-chip session-highlight-chip"
                              type="button"
                              onClick={() => removeHighlight(highlight)}
                              aria-label={`Remove highlight ${highlight}`}
                            >
                              <span>{highlight}</span>
                              <span aria-hidden="true">×</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </details>
              </section>
            ) : null}

          </div>

          <aside className="editor-sidebar">
            <section className="config-card workflow-card" aria-label="Capture methods">
              <div className="config-card-copy">
                <p className="section-label">Capture</p>
                <h3>Choose how to bring notes in</h3>
              </div>

              <section className="audio-capture-card session-editor-audio-pwa" data-recording={isRecordingAudio}>
                <div className="audio-capture-copy">
                  <p className="section-label">Recording & transcription</p>
                  <h3>Choose your capture mode</h3>
                </div>
                <div className="capture-toolbar audio-capture-actions session-editor-audio-actions-pwa">
                  <button className="secondary-button capture-mode-button" type="button" onClick={() => onChangeRecordingMode("microphone")}>
                    <span className="capture-mode-title">Start room / hybrid meeting</span>
                    <span className="capture-mode-hint">Use mic for room voices and nearby speakers</span>
                  </button>
                  <button className="secondary-button capture-mode-button" type="button" onClick={() => onChangeRecordingMode("system-audio")}>
                    <span className="capture-mode-title">Start direct computer audio</span>
                    <span className="capture-mode-hint">Use direct in-computer sound from this device</span>
                  </button>
                  <button className="secondary-button capture-mode-button" type="button" onClick={() => onChangeRecordingMode("hybrid")}>
                    <span className="capture-mode-title">Start room + computer audio</span>
                    <span className="capture-mode-hint">Combine mic and direct computer audio together</span>
                  </button>
                  <button className="primary-button" type="button" onClick={isRecordingAudio ? onStopRecording : onStartRecording}>
                    {isRecordingAudio ? "Stop recording" : "Record"}
                  </button>
                  <button className="shell-button" type="button" onClick={onImportAudio}>
                    Upload audio
                  </button>
                  <button className="shell-button" type="button" onClick={onImportTranscript}>
                    Upload transcript
                  </button>
                  <button className="shell-button" type="button" onClick={onTranscribeAudio}>
                    {isTranscribingAudio ? "Transcribing audio..." : "Transcribe audio"}
                  </button>
                  <button className="shell-button" type="button" onClick={onImportImage}>
                    Upload image
                  </button>
                </div>
                <p className="support-text">{recordingStatusNote || RECORDING_MODE_META[recordingMode].helper}</p>
              </section>
            </section>

            <details className="workspace-disclosure pwa-disclosure-card">
              <summary>Advanced capture tools</summary>
              <div className="workspace-disclosure-body form-grid">
                <div className="field field-wide metadata-triplet">
                  <div className="metadata-triplet-grid">
                    <div className="field metadata-subfield">
                      <label htmlFor="session-domain">Domain</label>
                      <TokenPicker value={session.domain} savedOptions={structureOptions.domains.length ? structureOptions.domains : savedDomains} suggestedOptions={suggestedDomains} placeholder="Search or add domain" suggestionSummary="Recent domains" suggestionBadgeText="From saved Domains" mode="single" onChange={handleDomainChange} />
                    </div>
                    <div className="field metadata-subfield">
                      <label htmlFor="session-project">Project</label>
                      <TokenPicker value={session.project} savedOptions={projectPickerOptions} suggestedOptions={suggestedProjectsForSelection} placeholder="Search or add project" suggestionSummary="Recent projects" suggestionBadgeText="From saved Projects" mode="single" onChange={handleProjectChange} />
                    </div>
                    <div className="field metadata-subfield">
                      <label htmlFor="session-activity">Activity</label>
                      <TokenPicker value={session.activity} savedOptions={activityPickerOptions} suggestedOptions={suggestedActivitiesForSelection} placeholder="Search or add activity" suggestionSummary="Recent activities" suggestionBadgeText="From saved Activities" mode="single" onChange={(value) => update("activity", value)} />
                    </div>
                  </div>
                </div>
                <div className="field field-wide">
                  <label htmlFor="session-tags">Tags</label>
                  <TokenPicker value={session.tagsText} savedOptions={savedTags} suggestedOptions={suggestedTags} placeholder="Add tags like q2-planning, budget, hiring" suggestionSummary="Recent tags" suggestionBadgeText="From saved Tags" onChange={(value) => update("tagsText", value)} />
                </div>
              </div>
            </details>
          </aside>
        </div>

        <section className="form-section notes-transcript-section" aria-label="Notes and transcripts">
          <details className="workspace-disclosure pwa-disclosure-card" open>
            <summary>Manual notes</summary>
            <div className="workspace-disclosure-body">
              <div className="field field-wide">
                <div className="rich-text-toolbar">
                  {RICH_TEXT_COMMANDS.map((action) => (
                    <button key={action.id} className="shell-button rich-text-command" type="button" onClick={() => applyManualNotesCommand(action)}>
                      {action.label}
                    </button>
                  ))}
                </div>
                <div
                  className="rich-text-surface manual-notes-rich-text-surface editor-textarea-primary"
                  id="manual-notes"
                  ref={manualNotesEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Write your own notes here, which will be included in the Output"
                  data-empty="true"
                  onInput={(event) => updateManualNotes((event.currentTarget as HTMLDivElement).innerHTML)}
                />
              </div>
            </div>
          </details>

          {shouldShowLiveTranscript ? (
            <details className="workspace-disclosure pwa-disclosure-card" open={transcriptOpen} onToggle={(event) => setTranscriptOpen(event.currentTarget.open)}>
              <summary>{session.captureMode === "voice-note" ? "Live transcript" : "Transcript"}</summary>
              <div className="workspace-disclosure-body">
                <div className="field field-wide">
                  <textarea
                    className="editor-textarea editor-textarea-secondary"
                    id="session-transcript"
                    value={session.liveTranscript}
                    onChange={(event) => update("liveTranscript", event.target.value)}
                    placeholder={session.captureMode === "voice-note" ? "Dictation appears here while recording..." : "Transcript text will appear here."}
                  />
                </div>
              </div>
            </details>
          ) : null}

          <details className="workspace-disclosure pwa-disclosure-card" open={uploadedTranscriptOpen} onToggle={(event) => setUploadedTranscriptOpen(event.currentTarget.open)}>
            <summary>Transcript</summary>
            <div className="workspace-disclosure-body">
              <div className="field field-wide">
                <textarea
                  className="editor-textarea editor-textarea-secondary"
                  id="session-uploaded-transcript"
                  value={session.uploadedTranscript}
                  onChange={(event) => update("uploadedTranscript", event.target.value)}
                  placeholder="Paste a transcript here, or upload one from a file."
                />
              </div>
            </div>
          </details>
        </section>
      </div>
    );
  }

  return (
    <div className={`card session-editor${isMinimal ? " session-editor-minimal" : ""}`}>
      <div className={`card-header${isMinimal ? " session-editor-header-minimal" : ""}`}>
        <div><h2>Capture</h2></div>
        <div className="capture-header-actions">
          {onOpenInstructions ? <button className="small-button" type="button" onClick={onOpenInstructions}>Instructions</button> : null}
          {isMinimal && showPresentationActions ? <div className="capture-minimal-actions"><span className="tiny-text">Minimal mode</span><button className="small-button" type="button" onClick={onOpenDetails}>Open details</button></div> : null}
        </div>
      </div>

      <div className={`session-quick-start-row${isMinimal ? " session-quick-start-row-minimal" : ""}`}>
        <div className="session-template-pill-row">
          {quickStartTemplates.map((template) => (
            <button key={template.id} className="segment-button session-template-pill" type="button" onClick={() => onCreateSessionFromTemplate?.(template.id)} disabled={!onCreateSessionFromTemplate}>
              {`New ${template.name}`}
            </button>
          ))}
        </div>
      </div>

      <div className="session-capture-copy"><strong>{modeMeta.label}</strong><span className="muted">{modeMeta.subtitle}</span></div>

      <div className={`form-grid${isMinimal ? " form-grid-minimal" : ""}`}>
        <details className="field field-wide workspace-disclosure" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
          <summary>Details</summary>
          <div className="workspace-disclosure-body form-grid">
            <div className="field field-wide">
              <label htmlFor="session-title">{titleField?.label || "Title"}</label>
              <input className={isMinimal ? "minimal-title-input" : undefined} id="session-title" value={session.title} onChange={(event) => update("title", event.target.value)} placeholder={session.captureMode === "meeting-note" ? "Weekly project meeting" : session.captureMode === "voice-note" ? "Voice memo" : "Quick note title"} />
            </div>
            <div className={`field${isMinimal ? " capture-meta-field" : ""}`}>
              <label htmlFor="template-select">Template</label>
              <select id="template-select" value={activeTemplate?.id ?? ""} onChange={(event) => handleTemplateChange(event.target.value)}>
                {availableTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </div>
            {hasDateField ? <div className={`field${isMinimal ? " capture-meta-field" : ""}`}><label htmlFor="session-date">Date</label><DateInput id="session-date" value={session.date} onChange={(event) => update("date", event.target.value)} /></div> : null}
            {hasStartTimeField ? <div className={`field${isMinimal ? " capture-meta-field" : ""}`}><label htmlFor="session-start">Start time</label><input id="session-start" type="time" value={session.startTime} onChange={(event) => update("startTime", event.target.value)} /></div> : null}
            {hasEndTimeField ? <div className={`field${isMinimal ? " capture-meta-field" : ""}`}><label htmlFor="session-end">End time</label><input id="session-end" type="time" value={session.endTime} onChange={(event) => update("endTime", event.target.value)} /></div> : null}
            {agendaField ? (
              <details className="field field-wide workspace-disclosure">
                <summary>{agendaField.label}</summary>
                <div className="workspace-disclosure-body">
                  <div className="rich-text-toolbar">
                    {RICH_TEXT_COMMANDS.map((action) => (
                      <button key={action.id} className="small-button rich-text-command" type="button" onClick={() => applyAgendaCommand(action)}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <div
                    id="session-agenda"
                    ref={agendaEditorRef}
                    className="rich-text-surface agenda-rich-text-surface"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="List the planned agenda, topics, or framing points for this meeting."
                    data-empty="true"
                    onInput={(event) => updateAgenda((event.currentTarget as HTMLDivElement).innerHTML)}
                  />
                </div>
              </details>
            ) : null}
          </div>
        </details>

        {showFullAudioCard ? (
          <div className="field field-wide audio-capture-card" data-recording={isRecordingAudio}>
            <div className="audio-capture-header">
              <div>
                <div className="audio-capture-heading-row">
                  <label>Audio capture</label>
                  {isRecordingAudio ? <span className="recording-live-pill" aria-live="polite"><span className="recording-live-dot" />Recording now</span> : null}
                </div>
                <p className="muted">{session.captureMode === "meeting-note" ? "Use the native desktop recorder here, or upload audio later." : "Record first if this note starts as spoken audio."}</p>
              </div>
              <button className="primary-button" type="button" onClick={isRecordingAudio ? onStopRecording : onStartRecording}>
                {isRecordingAudio ? "Stop recording" : "Start recording"}
              </button>
            </div>
            {isRecordingAudio ? <div className="recording-active-banner" aria-live="polite"><strong>Recording in progress</strong><span>{RECORDING_MODE_META[recordingMode].helper}</span></div> : null}
            <div className="recording-mode-grid">
              {(Object.keys(RECORDING_MODE_META) as RecordingMode[]).map((mode) => (
                <button key={mode} type="button" className="recording-mode-card" data-active={recordingMode === mode} onClick={() => onChangeRecordingMode(mode)}>
                  <strong>{RECORDING_MODE_META[mode].label}</strong>
                  <p>{RECORDING_MODE_META[mode].description}</p>
                </button>
              ))}
            </div>
            <span className="tiny-text">{recordingStatusNote || RECORDING_MODE_META[recordingMode].helper}</span>
          </div>
        ) : null}

        {showMinimalAudioStrip ? (
          <div className="field field-wide minimal-audio-strip" data-recording={isRecordingAudio}>
            <div className="minimal-audio-strip-main">
              <strong>Audio capture</strong>
              <span className="muted">{isRecordingAudio ? RECORDING_MODE_META[recordingMode].label : "Ready to record or transcribe"}</span>
            </div>
            <div className="minimal-audio-strip-actions">
              <select value={recordingMode} onChange={(event) => onChangeRecordingMode(event.target.value as RecordingMode)}>
                {(Object.keys(RECORDING_MODE_META) as RecordingMode[]).map((mode) => <option key={mode} value={mode}>{RECORDING_MODE_META[mode].label}</option>)}
              </select>
              <button className="primary-button" type="button" onClick={isRecordingAudio ? onStopRecording : onStartRecording}>
                {isRecordingAudio ? "Stop recording" : "Record"}
              </button>
            </div>
          </div>
        ) : null}

        {participantsField ? (
          <details className="field field-wide workspace-disclosure" open={peopleOpen} onToggle={(event) => setPeopleOpen(event.currentTarget.open)}>
            <summary>People</summary>
            <div className="workspace-disclosure-body">
              <div className="field field-wide">
                <label htmlFor="session-participants">{participantsField.label}</label>
                <PeoplePicker value={session.participantText} savedPeople={savedPeople} suggestedPeople={suggestedPeople} onChange={(value) => update("participantText", value)} placeholder="Search or add people" />
              </div>
            </div>
          </details>
        ) : null}

        <div className="field field-wide">
          <label htmlFor="manual-notes">{modeMeta.primaryFieldLabel}</label>
          <div className="rich-text-toolbar">
            {RICH_TEXT_COMMANDS.map((action) => (
              <button key={action.id} className="small-button rich-text-command" type="button" onClick={() => applyManualNotesCommand(action)}>
                {action.label}
              </button>
            ))}
          </div>
          <div
            className={`rich-text-surface manual-notes-rich-text-surface${isMinimal ? " editor-textarea-primary" : ""}`}
            id="manual-notes"
            ref={manualNotesEditorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={modeMeta.primaryFieldPlaceholder}
            data-empty="true"
            onInput={(event) => updateManualNotes((event.currentTarget as HTMLDivElement).innerHTML)}
          />
        </div>

        {showQuickHighlights || customFields.length ? (
          <details className="field field-wide workspace-disclosure">
            <summary>Highlights and custom fields</summary>
            <div className="workspace-disclosure-body form-grid">
              {showQuickHighlights ? <div className="field field-wide"><label htmlFor="quick-highlights">Highlights</label><textarea id="quick-highlights" value={session.quickHighlights} onChange={(event) => update("quickHighlights", event.target.value)} placeholder="Short key points, names, or topics to emphasize in the final output." /></div> : null}
              {customFields.map((field) => (
                <div key={field.id} className={field.type === "textarea" ? "field field-wide" : "field"}>
                  <label htmlFor={`custom-field-${field.id}`}>{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea id={`custom-field-${field.id}`} value={session.customFieldValues[field.id] ?? ""} onChange={(event) => update("customFieldValues", { ...session.customFieldValues, [field.id]: event.target.value })} />
                  ) : (
                    <input id={`custom-field-${field.id}`} type={field.type === "number" ? "number" : field.type} value={session.customFieldValues[field.id] ?? ""} onChange={(event) => update("customFieldValues", { ...session.customFieldValues, [field.id]: event.target.value })} />
                  )}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {session.captureMode !== "quick-note" ? (
          <details className="field field-wide workspace-disclosure" open={transcriptOpen} onToggle={(event) => setTranscriptOpen(event.currentTarget.open)}>
            <summary>{session.captureMode === "voice-note" ? "Live transcript" : "Transcript"}</summary>
            <div className="workspace-disclosure-body">
              <div className="field field-wide">
                <textarea className={`editor-textarea${isMinimal ? " editor-textarea-secondary" : ""}`} id="session-transcript" value={session.liveTranscript} onChange={(event) => update("liveTranscript", event.target.value)} placeholder={session.captureMode === "meeting-note" ? "Meeting transcript text will land here." : "Dictation and transcript text will land here."} />
              </div>
            </div>
          </details>
        ) : null}

        {session.captureMode !== "quick-note" ? (
          <details className="field field-wide workspace-disclosure" open={uploadedTranscriptOpen} onToggle={(event) => setUploadedTranscriptOpen(event.currentTarget.open)}>
            <summary>Uploaded transcript</summary>
            <div className="workspace-disclosure-body">
              <div className="field field-wide">
                <textarea className={`editor-textarea${isMinimal ? " editor-textarea-secondary" : ""}`} id="session-uploaded-transcript" value={session.uploadedTranscript} onChange={(event) => update("uploadedTranscript", event.target.value)} placeholder="Imported transcript text will appear here." />
              </div>
            </div>
          </details>
        ) : null}

        <details className="field field-wide workspace-disclosure" open={contextOpen} onToggle={(event) => setContextOpen(event.currentTarget.open)}>
          <summary>Context and tags</summary>
          <div className="workspace-disclosure-body form-grid">
            <div className="field field-wide metadata-triplet">
              <div className="metadata-triplet-grid">
                <div className="field metadata-subfield">
                  <label htmlFor="session-domain">Domain</label>
                  <TokenPicker value={session.domain} savedOptions={structureOptions.domains.length ? structureOptions.domains : savedDomains} suggestedOptions={suggestedDomains} placeholder="Search or add domain" suggestionSummary="Recent domains" suggestionBadgeText="From saved Domains" mode="single" onChange={handleDomainChange} />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="session-project">Project</label>
                  <TokenPicker value={session.project} savedOptions={projectPickerOptions} suggestedOptions={suggestedProjectsForSelection} placeholder="Search or add project" suggestionSummary="Recent projects" suggestionBadgeText="From saved Projects" mode="single" onChange={handleProjectChange} />
                </div>
                <div className="field metadata-subfield">
                  <label htmlFor="session-activity">Activity</label>
                  <TokenPicker value={session.activity} savedOptions={activityPickerOptions} suggestedOptions={suggestedActivitiesForSelection} placeholder="Search or add activity" suggestionSummary="Recent activities" suggestionBadgeText="From saved Activities" mode="single" onChange={(value) => update("activity", value)} />
                </div>
              </div>
            </div>
            <div className="field field-wide">
              <label htmlFor="session-tags">Tags</label>
              <TokenPicker value={session.tagsText} savedOptions={savedTags} suggestedOptions={suggestedTags} placeholder="Add tags like q2-planning, budget, hiring" suggestionSummary="Recent tags" suggestionBadgeText="From saved Tags" onChange={(value) => update("tagsText", value)} />
            </div>
            <div className="field">
              <label htmlFor="detail-level">Detail level</label>
              <select id="detail-level" value={String(session.detailLevel)} onChange={(event) => update("detailLevel", Number(event.target.value))}>
                {Object.entries(DETAIL_LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{value} - {label}</option>)}
              </select>
            </div>
            <div className="field capture-private-field">
              <span>Privacy</span>
              <div className="compact-private-toggle">
                <input id="session-private" type="checkbox" checked={session.isPrivate} onChange={(event) => update("isPrivate", event.target.checked)} />
                <label htmlFor="session-private" className="checkbox-label">Private</label>
              </div>
            </div>
          </div>
        </details>

        <details className="field field-wide workspace-disclosure">
          <summary>Advanced capture tools</summary>
          <div className="workspace-disclosure-body form-grid">
            {enabledSections.length ? (
              <div className="field field-wide">
                <label>Output sections for this session</label>
                <div className="section-list">
                  {enabledSections.map((section) => (
                    <label key={section.id} className="list-item checkbox-label">
                      <input type="checkbox" checked={section.checked} onChange={(event) => update("excludedSectionIds", event.target.checked ? session.excludedSectionIds.filter((id) => id !== section.id) : Array.from(new Set([...session.excludedSectionIds, section.id])))} />
                      <span><strong>{section.title}</strong><span className="muted">{section.instructions}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="page-actions field-wide">
              <button className="small-button" type="button" onClick={onImportImage}>Upload image</button>
              {session.captureMode !== "quick-note" ? (
                <>
                  <button className="small-button" type="button" onClick={onImportAudio}>Upload audio</button>
                  <button className="small-button" type="button" onClick={onTranscribeAudio}>{isTranscribingAudio ? "Transcribing audio..." : "Transcribe audio"}</button>
                  <button className="small-button" type="button" onClick={onImportTranscript}>Upload transcript file</button>
                </>
              ) : (
                <button className="small-button" type="button" onClick={onImportTranscript}>Upload note text</button>
              )}
            </div>
          </div>
        </details>

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
                      <input id={`image-caption-${attachment.id}`} value={attachment.caption} onChange={(event) => onUpdateAttachment({ ...attachment, caption: event.target.value })} placeholder="Optional caption for the polished output" />
                    </div>
                    <div className="inline-row">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={attachment.includeInOutput} onChange={(event) => onUpdateAttachment({ ...attachment, includeInOutput: event.target.checked, outputPosition: event.target.checked ? attachment.outputPosition || index + 1 : 0 })} />
                        Include in output
                      </label>
                      <button className="small-button danger-button inline-action" type="button" onClick={() => onRemoveAttachment(attachment.id)}>Remove</button>
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
                  <span className="muted">{attachment.kind} · {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB</span>
                  <div className="list-item-actions">
                    <button className="small-button danger-button" type="button" onClick={() => onRemoveAttachment(attachment.id)}>Remove</button>
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
