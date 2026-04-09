import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import { DateInput } from "../../../components/DateInput";
import { PeoplePicker } from "../../../components/PeoplePicker";
import { TokenPicker } from "../../../components/TokenPicker";
import { getActivitiesForSelection, getProjectsForDomain } from "../../../lib/structure/options";
import { DEFAULT_TEMPLATE_BY_CAPTURE_MODE, getTemplatesForCaptureMode, } from "@notesmith/domain";
const RECORDING_MODE_META = {
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
const DETAIL_LEVEL_LABELS = {
    1: "Minimal",
    2: "Concise",
    3: "Balanced",
    4: "Detailed",
    5: "Comprehensive",
};
const CAPTURE_MODE_META = {
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
export const SessionEditor = ({ session, templates, attachments, presentation = "full", showPresentationActions = true, savedPeople, suggestedPeople, savedProjects, suggestedProjects, savedDomains, suggestedDomains, savedActivities, suggestedActivities, structureOptions, savedTags, suggestedTags, isTranscribingAudio, recordingMode, isRecordingAudio, recordingStatusNote, onChange, onImportTranscript, onImportAudio, onImportImage, onTranscribeAudio, onChangeRecordingMode, onStartRecording, onStopRecording, onRemoveAttachment, onUpdateAttachment, onOpenDetails, }) => {
    const update = (key, value) => onChange({ ...session, [key]: value });
    const availableTemplates = getTemplatesForCaptureMode(templates, session.captureMode);
    const activeTemplate = availableTemplates.find((template) => template.id === session.templateId) ??
        availableTemplates[0] ??
        templates[0];
    const customFields = activeTemplate?.fields.filter((field) => field.enabled &&
        !["title", "participants", "date", "startTime", "endTime"].includes(field.key)) ?? [];
    const enabledSections = activeTemplate?.sections.map((section) => ({
        ...section,
        checked: !session.excludedSectionIds.includes(section.id),
    })) ?? [];
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
    const showMeetingMeta = session.captureMode === "meeting-note";
    const showQuickHighlights = session.captureMode === "meeting-note";
    const showTranscriptField = session.captureMode !== "quick-note";
    const primaryTemplateOptions = availableTemplates.length ? availableTemplates : templates;
    const isMinimal = presentation === "minimal";
    const showMinimalMeetingCore = isMinimal && session.captureMode === "meeting-note";
    const showMinimalVoiceCore = isMinimal && session.captureMode === "voice-note";
    const showFullAudioCard = !isMinimal && session.captureMode !== "quick-note";
    const showMinimalAudioStrip = isMinimal && session.captureMode !== "quick-note";
    const showDetailsDisclosure = true;
    const switchMode = (captureMode) => {
        const nextTemplates = getTemplatesForCaptureMode(templates, captureMode);
        const nextTemplate = nextTemplates.find((template) => template.id === DEFAULT_TEMPLATE_BY_CAPTURE_MODE[captureMode]) ?? nextTemplates[0];
        const nextFieldValues = Object.fromEntries((nextTemplate?.fields ?? [])
            .filter((field) => field.enabled &&
            !["title", "participants", "date", "startTime", "endTime"].includes(field.key))
            .map((field) => [field.id, session.customFieldValues[field.id] ?? ""]));
        onChange({
            ...session,
            captureMode,
            templateId: nextTemplate?.id ?? session.templateId,
            customFieldValues: nextFieldValues,
            excludedSectionIds: [],
        });
    };
    const handleDomainChange = (domain) => {
        const nextProjects = getProjectsForDomain(structureOptions, domain);
        const nextProject = nextProjects.includes(session.project) ? session.project : "";
        const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
        const nextActivity = nextActivities.includes(session.activity) ? session.activity : "";
        onChange({
            ...session,
            domain,
            project: nextProject,
            activity: nextActivity,
        });
    };
    const handleProjectChange = (project) => {
        const nextActivities = getActivitiesForSelection(structureOptions, session.domain, project);
        const nextActivity = nextActivities.includes(session.activity) ? session.activity : "";
        onChange({
            ...session,
            project,
            activity: nextActivity,
        });
    };
    const handleTemplateChange = (templateId) => {
        const nextTemplate = templates.find((template) => template.id === templateId);
        const nextFieldValues = Object.fromEntries((nextTemplate?.fields ?? [])
            .filter((field) => field.enabled &&
            !["title", "participants", "date", "startTime", "endTime"].includes(field.key))
            .map((field) => [field.id, session.customFieldValues[field.id] ?? ""]));
        onChange({
            ...session,
            templateId,
            customFieldValues: nextFieldValues,
            excludedSectionIds: [],
        });
    };
    return (_jsxs("div", { className: `card session-editor${isMinimal ? " session-editor-minimal" : ""}`, children: [_jsxs("div", { className: `card-header${isMinimal ? " session-editor-header-minimal" : ""}`, children: [_jsx("div", { children: _jsx("h2", { children: "Capture" }) }), isMinimal && showPresentationActions ? (_jsxs("div", { className: "capture-minimal-actions", children: [_jsx("span", { className: "tiny-text", children: "Minimal mode" }), _jsx("button", { className: "small-button", type: "button", onClick: onOpenDetails, children: "Open details" })] })) : null] }), _jsx("div", { className: `capture-mode-switch${isMinimal ? " capture-mode-switch-minimal" : ""}`, children: Object.keys(CAPTURE_MODE_META).map((captureMode) => (_jsxs("button", { className: `capture-mode-card${isMinimal ? " capture-mode-card-minimal" : ""}`, "data-active": session.captureMode === captureMode, type: "button", onClick: () => switchMode(captureMode), children: [_jsx("strong", { children: CAPTURE_MODE_META[captureMode].label }), _jsx("span", { children: CAPTURE_MODE_META[captureMode].subtitle })] }, captureMode))) }), _jsxs("div", { className: `form-grid${isMinimal ? " form-grid-minimal" : ""}`, children: [_jsxs("div", { className: `capture-top-row field field-wide${isMinimal ? " capture-top-row-minimal" : ""}`, children: [_jsxs("div", { className: `field capture-template-field${isMinimal ? " capture-meta-field" : ""}`, children: [_jsx("label", { htmlFor: "template-select", children: "Template" }), _jsx("select", { id: "template-select", value: activeTemplate?.id ?? "", onChange: (event) => handleTemplateChange(event.target.value), children: primaryTemplateOptions.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id))) })] }), _jsxs("div", { className: `field capture-title-field${isMinimal ? " capture-title-field-minimal" : ""}`, children: [_jsx("label", { htmlFor: "session-title", children: "Title" }), _jsx("input", { className: isMinimal ? "minimal-title-input" : undefined, id: "session-title", value: session.title, onChange: (event) => update("title", event.target.value), placeholder: session.captureMode === "meeting-note"
                                            ? "Weekly project meeting"
                                            : session.captureMode === "voice-note"
                                                ? "Voice memo"
                                                : "Quick note title" })] }), _jsxs("div", { className: `field capture-private-field${isMinimal ? " capture-meta-field" : ""}`, children: [_jsx("span", { children: "Private" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "session-private", type: "checkbox", checked: session.isPrivate, onChange: (event) => update("isPrivate", event.target.checked) }), _jsx("label", { htmlFor: "session-private", className: "checkbox-label", children: "Private" })] })] })] }), showFullAudioCard ? (_jsxs("div", { className: "field field-wide audio-capture-card", "data-recording": isRecordingAudio, children: [_jsxs("div", { className: "audio-capture-header", children: [_jsxs("div", { children: [_jsxs("div", { className: "audio-capture-heading-row", children: [_jsx("label", { children: "Audio capture" }), isRecordingAudio ? (_jsxs("span", { className: "recording-live-pill", "aria-live": "polite", children: [_jsx("span", { className: "recording-live-dot" }), "Recording now"] })) : null] }), _jsx("p", { className: "muted", children: session.captureMode === "meeting-note"
                                                    ? "Record the meeting directly here or upload audio later."
                                                    : "Start with recording if this note begins as a spoken memo." })] }), _jsx("button", { className: "primary-button", type: "button", onClick: isRecordingAudio ? onStopRecording : onStartRecording, children: isRecordingAudio ? "Stop recording" : "Start recording" })] }), isRecordingAudio ? (_jsxs("div", { className: "recording-active-banner", "aria-live": "polite", children: [_jsx("strong", { children: "Recording in progress" }), _jsx("span", { children: recordingMode === "microphone"
                                            ? "The microphone is currently being captured into this session."
                                            : recordingMode === "system-audio"
                                                ? "Shared computer audio is currently being captured into this session."
                                                : "Microphone and shared computer audio are both being captured into this session." })] })) : null, _jsx("div", { className: "recording-mode-grid", children: Object.keys(RECORDING_MODE_META).map((mode) => {
                                    const meta = RECORDING_MODE_META[mode];
                                    return (_jsxs("button", { type: "button", className: "recording-mode-card", "data-active": recordingMode === mode, onClick: () => onChangeRecordingMode(mode), children: [_jsx("strong", { children: meta.label }), _jsx("p", { children: meta.description })] }, mode));
                                }) }), _jsx("span", { className: "tiny-text", children: recordingStatusNote ||
                                    (recordingMode === "microphone"
                                        ? "Microphone mode records spoken audio directly into this session."
                                        : recordingMode === "system-audio"
                                            ? "Choose a shared window, screen, or app and enable audio sharing when prompted."
                                            : "Capture room speech from the microphone and remote voices from shared computer audio together.") })] })) : null, showMinimalAudioStrip ? (_jsxs("div", { className: "field field-wide minimal-audio-strip", "data-recording": isRecordingAudio, children: [_jsxs("div", { className: "minimal-audio-strip-main", children: [_jsx("strong", { children: "Audio capture" }), _jsx("span", { className: "muted", children: isRecordingAudio
                                            ? recordingMode === "microphone"
                                                ? "Recording microphone"
                                                : recordingMode === "system-audio"
                                                    ? "Recording computer audio"
                                                    : "Recording microphone and computer audio"
                                            : "Ready to record or transcribe" })] }), _jsxs("div", { className: "minimal-audio-strip-actions", children: [_jsx("select", { value: recordingMode, onChange: (event) => onChangeRecordingMode(event.target.value), children: Object.keys(RECORDING_MODE_META).map((mode) => (_jsx("option", { value: mode, children: RECORDING_MODE_META[mode].label }, mode))) }), _jsx("button", { className: "primary-button", type: "button", onClick: isRecordingAudio ? onStopRecording : onStartRecording, children: isRecordingAudio ? "Stop recording" : "Record" })] })] })) : null, showMinimalMeetingCore ? (_jsxs("div", { className: "field field-wide minimal-context-grid", children: [_jsxs("div", { className: "field minimal-context-primary", children: [_jsx("label", { htmlFor: "session-participants", children: "People" }), _jsx(PeoplePicker, { value: session.participantText, savedPeople: savedPeople, suggestedPeople: suggestedPeople, onChange: (value) => update("participantText", value), placeholder: "Search or add people" })] }), _jsxs("div", { className: "field capture-meta-field", children: [_jsx("label", { htmlFor: "session-date", children: "Date" }), _jsx(DateInput, { id: "session-date", value: session.date, onChange: (event) => update("date", event.target.value) })] }), _jsxs("div", { className: "field capture-meta-field", children: [_jsx("label", { htmlFor: "session-start", children: "Start time" }), _jsx("input", { id: "session-start", type: "time", value: session.startTime, onChange: (event) => update("startTime", event.target.value) })] }), _jsxs("div", { className: "field capture-meta-field", children: [_jsx("label", { htmlFor: "session-end", children: "End time" }), _jsx("input", { id: "session-end", type: "time", value: session.endTime, onChange: (event) => update("endTime", event.target.value) })] })] })) : null, showDetailsDisclosure && showMeetingMeta ? (_jsxs("details", { className: "field field-wide workspace-disclosure", children: [_jsx("summary", { children: "Meeting details" }), _jsxs("div", { className: "workspace-disclosure-body form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-date", children: "Date" }), _jsx(DateInput, { id: "session-date", value: session.date, onChange: (event) => update("date", event.target.value) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-participants", children: "People" }), _jsx(PeoplePicker, { value: session.participantText, savedPeople: savedPeople, suggestedPeople: suggestedPeople, onChange: (value) => update("participantText", value), placeholder: "Search or add people" })] }), _jsx("div", { className: "field field-wide metadata-triplet", children: _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "session-domain", children: "Domain" }), _jsx(TokenPicker, { value: session.domain, savedOptions: structureOptions.domains.length ? structureOptions.domains : savedDomains, suggestedOptions: suggestedDomains, placeholder: "Search or add domain", suggestionSummary: "Recent domains", suggestionBadgeText: "From saved Domains", mode: "single", onChange: handleDomainChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "session-project", children: "Project" }), _jsx(TokenPicker, { value: session.project, savedOptions: projectPickerOptions, suggestedOptions: suggestedProjectsForSelection, placeholder: "Search or add project", suggestionSummary: "Recent projects", suggestionBadgeText: "From saved Projects", mode: "single", onChange: handleProjectChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "session-activity", children: "Activity" }), _jsx(TokenPicker, { value: session.activity, savedOptions: activityPickerOptions, suggestedOptions: suggestedActivitiesForSelection, placeholder: "Search or add activity", suggestionSummary: "Recent activities", suggestionBadgeText: "From saved Activities", mode: "single", onChange: (value) => update("activity", value) })] })] }) }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-start", children: "Start time" }), _jsx("input", { id: "session-start", type: "time", value: session.startTime, onChange: (event) => update("startTime", event.target.value) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-end", children: "End time" }), _jsx("input", { id: "session-end", type: "time", value: session.endTime, onChange: (event) => update("endTime", event.target.value) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "session-tags", children: "Tags" }), _jsx(TokenPicker, { value: session.tagsText, savedOptions: savedTags, suggestedOptions: suggestedTags, placeholder: "Add tags like q2-planning, budget, hiring", suggestionSummary: "Recent tags", suggestionBadgeText: "From saved Tags", onChange: (value) => update("tagsText", value) })] })] })] })) : showDetailsDisclosure ? (_jsxs("details", { className: "field field-wide workspace-disclosure", children: [_jsx("summary", { children: "Optional note details" }), _jsxs("div", { className: "workspace-disclosure-body form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-date", children: "Date" }), _jsx(DateInput, { id: "session-date", value: session.date, onChange: (event) => update("date", event.target.value) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-time", children: "Time" }), _jsx("input", { id: "session-time", type: "time", value: session.startTime, onChange: (event) => update("startTime", event.target.value) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-participants", children: "People" }), _jsx(PeoplePicker, { value: session.participantText, savedPeople: savedPeople, suggestedPeople: suggestedPeople, onChange: (value) => update("participantText", value), placeholder: "Search or add optional context" })] }), _jsx("div", { className: "field field-wide metadata-triplet", children: _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "session-domain", children: "Domain" }), _jsx(TokenPicker, { value: session.domain, savedOptions: structureOptions.domains.length ? structureOptions.domains : savedDomains, suggestedOptions: suggestedDomains, placeholder: "Search or add domain", suggestionSummary: "Recent domains", suggestionBadgeText: "From saved Domains", mode: "single", onChange: handleDomainChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "session-project", children: "Project" }), _jsx(TokenPicker, { value: session.project, savedOptions: projectPickerOptions, suggestedOptions: suggestedProjectsForSelection, placeholder: "Search or add project", suggestionSummary: "Recent projects", suggestionBadgeText: "From saved Projects", mode: "single", onChange: handleProjectChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "session-activity", children: "Activity" }), _jsx(TokenPicker, { value: session.activity, savedOptions: activityPickerOptions, suggestedOptions: suggestedActivitiesForSelection, placeholder: "Search or add activity", suggestionSummary: "Recent activities", suggestionBadgeText: "From saved Activities", mode: "single", onChange: (value) => update("activity", value) })] })] }) }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "session-tags", children: "Tags" }), _jsx(TokenPicker, { value: session.tagsText, savedOptions: savedTags, suggestedOptions: suggestedTags, placeholder: "Add tags like q2-planning, budget, hiring", suggestionSummary: "Recent tags", suggestionBadgeText: "From saved Tags", onChange: (value) => update("tagsText", value) })] })] })] })) : null, session.captureMode === "voice-note" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "live-transcript", children: modeMeta.primaryFieldLabel }), _jsx("textarea", { className: "editor-textarea editor-textarea-primary", id: "live-transcript", value: session.liveTranscript, onChange: (event) => update("liveTranscript", event.target.value), placeholder: modeMeta.primaryFieldPlaceholder })] }), isMinimal ? (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "manual-notes", children: "Notes" }), _jsx("textarea", { className: "editor-textarea editor-textarea-secondary", id: "manual-notes", value: session.manualNotes, onChange: (event) => update("manualNotes", event.target.value), placeholder: "Add a short written note if it helps later." })] })) : (_jsxs("details", { className: "field field-wide workspace-disclosure", children: [_jsx("summary", { children: "Optional written note" }), _jsx("div", { className: "workspace-disclosure-body", children: _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "manual-notes", children: "Manual note" }), _jsx("textarea", { id: "manual-notes", value: session.manualNotes, onChange: (event) => update("manualNotes", event.target.value), placeholder: "Add a short written note if it helps later." })] }) })] }))] })) : (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "manual-notes", children: modeMeta.primaryFieldLabel }), _jsx("textarea", { className: `editor-textarea${isMinimal ? " editor-textarea-primary" : ""}`, id: "manual-notes", value: session.manualNotes, onChange: (event) => update("manualNotes", event.target.value), placeholder: modeMeta.primaryFieldPlaceholder })] })), showQuickHighlights || customFields.length ? (_jsxs("details", { className: "field field-wide workspace-disclosure", children: [_jsx("summary", { children: "Capture extras" }), _jsxs("div", { className: "workspace-disclosure-body form-grid", children: [showQuickHighlights ? (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "quick-highlights", children: "Quick highlights" }), _jsx("textarea", { id: "quick-highlights", value: session.quickHighlights, onChange: (event) => update("quickHighlights", event.target.value), placeholder: "Short key points, names, or topics to emphasize in the final output." })] })) : null, customFields.map((field) => (_jsxs("div", { className: field.type === "textarea" ? "field field-wide" : "field", children: [_jsx("label", { htmlFor: `custom-field-${field.id}`, children: field.label }), field.type === "textarea" ? (_jsx("textarea", { id: `custom-field-${field.id}`, value: session.customFieldValues[field.id] ?? "", onChange: (event) => update("customFieldValues", {
                                                    ...session.customFieldValues,
                                                    [field.id]: event.target.value,
                                                }) })) : (_jsx("input", { id: `custom-field-${field.id}`, type: field.type === "number" ? "number" : field.type, value: session.customFieldValues[field.id] ?? "", onChange: (event) => update("customFieldValues", {
                                                    ...session.customFieldValues,
                                                    [field.id]: event.target.value,
                                                }) }))] }, field.id)))] })] })) : null, !showMinimalVoiceCore && showTranscriptField ? (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "session-transcript", children: session.captureMode === "meeting-note" ? "Transcript" : "Live transcript" }), _jsx("textarea", { className: `editor-textarea${isMinimal ? " editor-textarea-secondary" : ""}`, id: "session-transcript", value: session.liveTranscript, onChange: (event) => update("liveTranscript", event.target.value), placeholder: session.captureMode === "meeting-note"
                                    ? "Meeting transcript text will land here."
                                    : "Spoken capture and transcript text live here." })] })) : null, _jsxs("details", { className: "field field-wide workspace-disclosure", children: [_jsx("summary", { children: "Advanced capture tools" }), _jsxs("div", { className: "workspace-disclosure-body form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "detail-level", children: "Detail level" }), _jsx("select", { id: "detail-level", value: String(session.detailLevel), onChange: (event) => update("detailLevel", Number(event.target.value)), children: Object.entries(DETAIL_LEVEL_LABELS).map(([value, label]) => (_jsxs("option", { value: value, children: [value, " - ", label] }, value))) })] }), enabledSections.length ? (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "Output sections for this session" }), _jsx("div", { className: "section-list", children: enabledSections.map((section) => (_jsxs("label", { className: "list-item checkbox-label", children: [_jsx("input", { type: "checkbox", checked: section.checked, onChange: (event) => update("excludedSectionIds", event.target.checked
                                                                ? session.excludedSectionIds.filter((id) => id !== section.id)
                                                                : Array.from(new Set([...session.excludedSectionIds, section.id]))) }), _jsxs("span", { children: [_jsx("strong", { children: section.title }), _jsx("span", { className: "muted", children: section.instructions })] })] }, section.id))) })] })) : null, _jsxs("div", { className: "page-actions field-wide", children: [_jsx("button", { className: "small-button", type: "button", onClick: onImportImage, children: "Upload image" }), session.captureMode !== "quick-note" ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "small-button", type: "button", onClick: onImportAudio, children: "Upload audio" }), _jsx("button", { className: "small-button", type: "button", onClick: onTranscribeAudio, children: isTranscribingAudio ? "Transcribing audio..." : "Transcribe audio" }), _jsx("button", { className: "small-button", type: "button", onClick: onImportTranscript, children: "Upload transcript file" })] })) : (_jsx("button", { className: "small-button", type: "button", onClick: onImportTranscript, children: "Upload note text" }))] })] })] }), !isMinimal && imageAttachments.length ? (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "Session images" }), _jsx("div", { className: "section-list", children: imageAttachments.map((attachment, index) => (_jsxs("div", { className: "list-item image-attachment-item", children: [_jsx(AttachmentImagePreview, { attachment: attachment }), _jsxs("div", { className: "image-attachment-details", children: [_jsx("strong", { children: attachment.filename }), _jsxs("span", { className: "muted", children: [Math.max(1, Math.round(attachment.sizeBytes / 1024)), " KB"] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `image-caption-${attachment.id}`, children: "Caption" }), _jsx("input", { id: `image-caption-${attachment.id}`, value: attachment.caption, onChange: (event) => onUpdateAttachment({
                                                                ...attachment,
                                                                caption: event.target.value,
                                                            }), placeholder: "Optional caption for the polished output" })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: attachment.includeInOutput, onChange: (event) => onUpdateAttachment({
                                                                        ...attachment,
                                                                        includeInOutput: event.target.checked,
                                                                        outputPosition: event.target.checked ? attachment.outputPosition || index + 1 : 0,
                                                                    }) }), "Include in output"] }), _jsx("button", { className: "small-button danger-button inline-action", type: "button", onClick: () => onRemoveAttachment(attachment.id), children: "Remove" })] })] })] }, attachment.id))) })] })) : null, !isMinimal && otherAttachments.length ? (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "Session attachments" }), _jsx("div", { className: "section-list", children: otherAttachments.map((attachment) => (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: attachment.filename }), _jsxs("span", { className: "muted", children: [attachment.kind, " \u00B7 ", Math.max(1, Math.round(attachment.sizeBytes / 1024)), " KB"] }), _jsx("div", { className: "list-item-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onRemoveAttachment(attachment.id), children: "Remove" }) })] }, attachment.id))) })] })) : null] })] }));
};
