const STORAGE_KEY = "notesmith-sessions";
const SETTINGS_KEY = "notesmith-settings";
const AI_MODEL_CATALOG_KEY = "notesmith-ai-model-catalog";
const APP_STATE_DB_NAME = "notesmith-app-state";
const APP_STATE_DB_VERSION = 1;
const APP_STATE_STORE_NAME = "appState";
const PENDING_AUDIO_DB_NAME = "notesmith-pending-audio";
const PENDING_AUDIO_STORE_NAME = "audioDrafts";
const STORAGE_HANDLE_DB_NAME = "notesmith-storage-handles";
const STORAGE_HANDLE_STORE_NAME = "handles";
const STORAGE_HANDLE_KEY = "localDataFile";
const APP_VERSION = "v0.10.21";

const BUILT_IN_TEMPLATES = {
  meeting: {
    id: "meeting",
    label: "Meeting",
    summaryLead: "This meeting focused on key updates, decisions, and next steps.",
    sections: ["Overview", "Key Discussion Points", "Decisions", "Action Items"],
    templateInstructions: "Structure the output like professional meeting notes with clear business-focused summaries, decisions, and next actions.",
    fields: {
      title: true,
      participants: true,
      agenda: true,
      highlights: true,
      manualNotes: true,
      liveTranscript: true,
      meetingDate: true,
      meetingStartTime: true,
      meetingEndTime: true,
    },
  },
  oneToOneCall: {
    id: "oneToOneCall",
    label: "1:1 / Phone call",
    summaryLead: "This 1:1 or phone call focused on the most important discussion points, decisions, and follow-ups.",
    sections: ["Overview", "Key Discussion Points", "Decisions", "Action Items"],
    templateInstructions: "Structure the output like concise professional call notes with clear key discussion points, decisions, and follow-up actions.",
    fields: {
      title: true,
      participants: true,
      agenda: false,
      highlights: false,
      manualNotes: true,
      liveTranscript: true,
      meetingDate: true,
      meetingStartTime: true,
      meetingEndTime: false,
    },
  },
  personalNote: {
    id: "personalNote",
    label: "Quick note",
    summaryLead: "This note captures the most important observations, ideas, and follow-ups quickly.",
    sections: ["Overview", "Key Notes", "Decisions", "Action Items"],
    templateInstructions: "Structure the output like a professional quick working note. Keep the focus on useful observations, decisions, and follow-up actions.",
    fields: {
      title: true,
      participants: false,
      agenda: false,
      highlights: false,
      manualNotes: true,
      liveTranscript: true,
      meetingDate: true,
      meetingStartTime: true,
      meetingEndTime: false,
    },
  },
};

const sessionList = document.querySelector("#session-list");
const emptySessions = document.querySelector("#empty-sessions");
const sessionsPanel = document.querySelector("#sessions-panel");
const sessionsPanelBackdrop = document.querySelector("#sessions-panel-backdrop");
const toggleSessionsPanelButton = document.querySelector("#toggle-sessions-panel");
const collapseSessionsPanelButton = document.querySelector("#collapse-sessions-panel");
const desktopViewButtons = [...document.querySelectorAll("[data-desktop-view]")];
const sessionFilterInput = document.querySelector("#session-filter");
const selectAllSessionsInput = document.querySelector("#select-all-sessions");
const deleteSelectedSessionsButton = document.querySelector("#delete-selected-sessions");
const exportSessionsButton = document.querySelector("#export-sessions");
const importSessionsButton = document.querySelector("#import-sessions");
const saveLocalFileButton = document.querySelector("#save-local-file");
const importSessionsInput = document.querySelector("#import-sessions-input");
const sessionStorageStatus = document.querySelector("#session-storage-status");
const openSessionsMainButton = document.querySelector("#open-sessions-main");
const openTodoMainButton = document.querySelector("#open-todo-main");
const openTodoOutputButton = document.querySelector("#open-todo-output");
const openBackupPanelButton = document.querySelector("#open-backup-panel");
const openBackupOutputButton = document.querySelector("#open-backup-output");
const openInstructionsButton = document.querySelector("#open-instructions");
const openSettingsButton = document.querySelector("#open-settings");
const openSettingsOutputButton = document.querySelector("#open-settings-output");
const openAiSettingsInlineButton = document.querySelector("#open-ai-settings-inline");
const promptGenerationSystemInput = document.querySelector("#prompt-generation-system");
const promptGenerationRulesInput = document.querySelector("#prompt-generation-rules");
const promptPersonalNotesSystemInput = document.querySelector("#prompt-personal-notes-system");
const promptPersonalNotesRulesInput = document.querySelector("#prompt-personal-notes-rules");
const promptRevisionRulesInput = document.querySelector("#prompt-revision-rules");
const promptTranslationRulesInput = document.querySelector("#prompt-translation-rules");
const promptAdditionalList = document.querySelector("#prompt-additional-list");
const addPromptBlockButton = document.querySelector("#add-prompt-block");
const resetPromptSettingsButton = document.querySelector("#reset-prompt-settings");
const backupPanelModal = document.querySelector("#backup-panel-modal");
const closeBackupPanelBackdrop = document.querySelector("#close-backup-panel");
const closeBackupPanelButton = document.querySelector("#close-backup-panel-button");
const recordingsModal = document.querySelector("#recordings-modal");
const closeRecordingsBackdrop = document.querySelector("#close-recordings");
const closeRecordingsButton = document.querySelector("#close-recordings-button");
const todoPanelModal = document.querySelector("#todo-panel-modal");
const closeTodoPanelBackdrop = document.querySelector("#close-todo-panel");
const closeTodoPanelButton = document.querySelector("#close-todo-panel-button");
const todoList = document.querySelector("#todo-list");
const emptyTodos = document.querySelector("#empty-todos");
const todoFilterInput = document.querySelector("#todo-filter");
const todoSortCompletedButton = document.querySelector("#todo-sort-completed");
const todoSortDescriptionButton = document.querySelector("#todo-sort-description");
const todoSortAddedButton = document.querySelector("#todo-sort-added");
const todoSortSessionsButton = document.querySelector("#todo-sort-sessions");
const todoDetailModal = document.querySelector("#todo-detail-modal");
const closeTodoDetailBackdrop = document.querySelector("#close-todo-detail");
const closeTodoDetailButton = document.querySelector("#close-todo-detail-button");
const todoDetailTitle = document.querySelector("#todo-detail-title");
const todoDetailComplete = document.querySelector("#todo-detail-complete");
const todoDetailDescription = document.querySelector("#todo-detail-description");
const todoDetailAdded = document.querySelector("#todo-detail-added");
const todoDetailSessions = document.querySelector("#todo-detail-sessions");
const todoDetailComments = document.querySelector("#todo-detail-comments");
const todoDetailRemoveButton = document.querySelector("#todo-detail-remove");
const workspacePanelModal = document.querySelector("#workspace-panel-modal");
const closeWorkspacePanelBackdrop = document.querySelector("#close-workspace-panel");
const closeWorkspacePanelButton = document.querySelector("#close-workspace-panel-button");
const openSessionsShortcutButton = document.querySelector("#open-sessions-shortcut");
const openBackupShortcutButton = document.querySelector("#open-backup-shortcut");
const confirmModal = document.querySelector("#confirm-modal");
const closeConfirmModalBackdrop = document.querySelector("#close-confirm-modal");
const closeConfirmModalButton = document.querySelector("#close-confirm-modal-button");
const confirmModalEyebrow = document.querySelector("#confirm-modal-eyebrow");
const confirmModalTitle = document.querySelector("#confirm-modal-title");
const confirmModalMessage = document.querySelector("#confirm-modal-message");
const confirmModalCancelButton = document.querySelector("#confirm-modal-cancel");
const confirmModalConfirmButton = document.querySelector("#confirm-modal-confirm");
const settingsModal = document.querySelector("#settings-modal");
const instructionsModal = document.querySelector("#instructions-modal");
const closeInstructionsBackdrop = document.querySelector("#close-instructions");
const closeInstructionsButton = document.querySelector("#close-instructions-button");
const closeSettingsBackdrop = document.querySelector("#close-settings");
const closeSettingsButton = document.querySelector("#close-settings-button");
const settingsForm = document.querySelector("#settings-form");
const backupReminderModal = document.querySelector("#backup-reminder-modal");
const closeBackupReminderBackdrop = document.querySelector("#close-backup-reminder");
const closeBackupReminderButton = document.querySelector("#close-backup-reminder-button");
const backupReminderExportButton = document.querySelector("#backup-reminder-export");
const backupReminderSaveLocalButton = document.querySelector("#backup-reminder-save-local");
const backupReminderLaterButton = document.querySelector("#backup-reminder-later");
const settingsNavButtons = [...document.querySelectorAll("[data-settings-tab]")];
const settingsSections = [...document.querySelectorAll("[data-settings-section]")];
const themeFamilySelect = document.querySelector("#theme-family");
const themeModeSelect = document.querySelector("#theme-mode");
const settingsThemeDescription = document.querySelector("#settings-theme-description");
const exportStylePresetSelect = document.querySelector("#export-style-preset");
const exportStyleDescription = document.querySelector("#export-style-description");
const storageModeBrowserInput = document.querySelector("#storage-mode-browser");
const storageModeFileInput = document.querySelector("#storage-mode-file");
const storageModeCopy = document.querySelector("#storage-mode-copy");
const storageStatusCopy = document.querySelector("#storage-status-copy");
const createStorageFileButton = document.querySelector("#create-storage-file");
const useStorageFileButton = document.querySelector("#use-storage-file");
const reconnectStorageFileButton = document.querySelector("#reconnect-storage-file");
const disconnectStorageFileButton = document.querySelector("#disconnect-storage-file");
const exportTitleFontInput = document.querySelector("#export-title-font");
const exportHeadingFontInput = document.querySelector("#export-heading-font");
const exportBodyFontInput = document.querySelector("#export-body-font");
const exportMetaFontInput = document.querySelector("#export-meta-font");
const exportTitleSizeInput = document.querySelector("#export-title-size");
const exportHeadingSizeInput = document.querySelector("#export-heading-size");
const exportBodySizeInput = document.querySelector("#export-body-size");
const exportMetaSizeInput = document.querySelector("#export-meta-size");
const exportLineHeightInput = document.querySelector("#export-line-height");
const aiSettingsModal = document.querySelector("#ai-settings-modal");
const closeAiSettingsBackdrop = document.querySelector("#close-ai-settings");
const closeAiSettingsButton = document.querySelector("#close-ai-settings-button");
const aiSettingsForm = document.querySelector("#ai-settings-form");
const aiSettingsNavButtons = [...document.querySelectorAll("[data-ai-settings-tab]")];
const aiSettingsSections = [...document.querySelectorAll("[data-ai-settings-section]")];
const titleDisplay = document.querySelector("#session-title");
const saveStatus = document.querySelector("#save-status");
const updateAppButton = document.querySelector("#update-app");
const appUpdateNotice = document.querySelector("#app-update-notice");
const meetingTitleInput = document.querySelector("#meeting-title");
const templateSelect = document.querySelector("#meeting-template");
const templateQuickSelectors = document.querySelector("#template-quick-selectors");
const titleField = document.querySelector("#title-field");
const titleFieldLabel = document.querySelector("#title-field-label");
const participantsField = document.querySelector("#participants-field");
const participantsFieldLabel = participantsField?.querySelector(".field-label");
const meetingScheduleField = document.querySelector("#meeting-schedule-field");
const contextDisclosure = document.querySelector(".context-disclosure");
const contextCardDisclosure = document.querySelector("#context-card-disclosure");
const meetingDateField = document.querySelector("#meeting-date-field");
const meetingStartTimeField = document.querySelector("#meeting-start-time-field");
const meetingEndTimeField = document.querySelector("#meeting-end-time-field");
const meetingAgendaField = document.querySelector("#meeting-agenda-field");
const templateCustomFieldsContainer = document.querySelector("#template-custom-fields");
const highlightsField = document.querySelector("#highlights-field");
const highlightsCardDisclosure = document.querySelector("#highlights-card-disclosure");
const manualNotesField = document.querySelector("#manual-notes-field");
const manualNotesDisclosure = document.querySelector("#manual-notes-disclosure");
const liveTranscriptDisclosure = document.querySelector("#live-transcript-disclosure");
const uploadedTranscriptDisclosure = document.querySelector("#uploaded-transcript-disclosure");
const liveTranscriptField = document.querySelector("#live-transcript-field");
const uploadedTranscriptField = document.querySelector("#uploaded-transcript-field");
const liveTranscriptBadge = document.querySelector("#live-transcript-badge");
const uploadedTranscriptBadge = document.querySelector("#uploaded-transcript-badge");
const mobileCaptureStatus = document.querySelector("#mobile-capture-status");
const editorPanel = document.querySelector(".editor-panel");
const workspaceLayout = document.querySelector(".workspace");
const apiKeyInput = document.querySelector("#api-key");
const modelSelect = document.querySelector("#model-select");
const modelOptions = document.querySelector("#model-options");
const modelPricingStatus = document.querySelector("#model-pricing-status");
const transcriptionModelSelect = document.querySelector("#transcription-model-select");
const transcriptionModelOptions = document.querySelector("#transcription-model-options");
const transcriptionModelDescription = document.querySelector("#transcription-model-description");
const transcriptionModelPricing = document.querySelector("#transcription-model-pricing");
const appModelsLabel = document.querySelector("#app-models");
const participantsInput = document.querySelector("#participants");
const participantSuggestions = document.querySelector("#participant-suggestions");
const participantDirectoryPanel = document.querySelector("#participant-directory");
const participantChips = document.querySelector("#participant-chips");
const toggleParticipantDirectoryButton = document.querySelector("#toggle-participant-directory");
const toggleParticipantDirectoryLabel = document.querySelector(".participant-toggle-label");
const openParticipantSettingsButton = document.querySelector("#open-participant-settings");
const participantDirectoryInput = document.querySelector("#participant-directory-input");
const addDirectoryParticipantButton = document.querySelector("#add-directory-participant");
const selectAllParticipantsInput = document.querySelector("#select-all-participants");
const deleteSelectedParticipantsButton = document.querySelector("#delete-selected-participants");
const participantDirectoryList = document.querySelector("#participant-directory-list");
const abbreviationShortInput = document.querySelector("#abbreviation-short-input");
const abbreviationFullInput = document.querySelector("#abbreviation-full-input");
const addAbbreviationButton = document.querySelector("#add-abbreviation");
const abbreviationDirectoryList = document.querySelector("#abbreviation-directory-list");
const meetingDateInput = document.querySelector("#meeting-date");
const meetingStartTimeInput = document.querySelector("#meeting-start-time");
const meetingEndTimeInput = document.querySelector("#meeting-end-time");
const meetingAgendaInput = document.querySelector("#meeting-agenda");
const includeAgendaInput = document.querySelector("#include-agenda");
const includeSummaryInput = document.querySelector("#include-summary");
const includeHighlightsInput = document.querySelector("#include-highlights");
const includeDecisionsInput = document.querySelector("#include-decisions");
const includeActionsInput = document.querySelector("#include-actions");
const transcribeOnlyInput = document.querySelector("#transcribe-only");
const templateSectionList = document.querySelector("#template-section-list");
const outputLanguageSelect = document.querySelector("#output-language");
const detailLevelInput = document.querySelector("#detail-level");
const detailLevelLabel = document.querySelector("#detail-level-label");
const additionalInstructionsInput = document.querySelector("#additional-instructions");
const addCustomHeaderButton = document.querySelector("#add-custom-header");
const customHeaderList = document.querySelector("#custom-header-list");
const customHeaderAddForm = document.querySelector("#custom-header-add-form");
const newCustomHeaderTitleInput = document.querySelector("#new-custom-header-title");
const newCustomHeaderInstructionsInput = document.querySelector("#new-custom-header-instructions");
const saveCustomHeaderButton = document.querySelector("#save-custom-header");
const cancelCustomHeaderButton = document.querySelector("#cancel-custom-header");
const highlightsInput = document.querySelector("#highlights-input");
const highlightChips = document.querySelector("#highlight-chips");
const liveTranscriptInput = document.querySelector("#live-transcript");
const uploadedTranscriptInput = document.querySelector("#uploaded-transcript");
const rawNotesInput = document.querySelector("#raw-notes");
const highlightsSection = highlightsField?.closest(".form-section");
const dictationLanguageSelect = document.querySelector("#dictation-language");
const polishButton = document.querySelector("#polish-notes");
const mobileGenerateButton = document.querySelector("#mobile-generate");
const dictationToggle = document.querySelector("#dictation-toggle");
const mobileDictationToggle = document.querySelector("#mobile-dictation-toggle");
const audioRecordToggle = document.querySelector("#audio-record-toggle");
const audioScreenToggle = document.querySelector("#audio-screen-toggle");
const uploadAudioButton = document.querySelector("#upload-audio");
const uploadTranscriptButton = document.querySelector("#upload-transcript");
const transcribeAudioButton = document.querySelector("#transcribe-audio");
const manageRecordingsButton = document.querySelector("#manage-recordings");
const audioFileInput = document.querySelector("#audio-file-input");
const transcriptFileInput = document.querySelector("#transcript-file-input");
const audioCaptureStatus = document.querySelector("#audio-capture-status");
const pendingRecordingsPanel = document.querySelector("#pending-recordings-panel");
const pendingRecordingsList = document.querySelector("#pending-recordings-list");
const dictationStatus = document.querySelector("#dictation-status");
const copyOutputButton = document.querySelector("#copy-output");
const exportWordButton = document.querySelector("#export-word");
const exportPdfButton = document.querySelector("#export-pdf");
const translateOutputButton = document.querySelector("#translate-output");
const polishedOutput = document.querySelector("#polished-output");
const outputFeedbackInput = document.querySelector("#output-feedback");
const improveOutputButton = document.querySelector("#improve-output");
  const revertOutputButton = document.querySelector("#revert-output");
  const outputFeedbackStatus = document.querySelector("#output-feedback-status");
  const outputResizeHandle = document.querySelector("#output-resize-handle");
  const appVersionLabel = document.querySelector("#app-version");
const editorSidebar = document.querySelector(".editor-sidebar");
const outputPanel = document.querySelector(".output-panel");
const mobileOpenMoreButton = document.querySelector("#mobile-open-more");
const closeMobileMoreButton = document.querySelector("#close-mobile-more");
const mobileOpenOutputButton = document.querySelector("#mobile-open-output");
const mobileOpenOutputBarButton = document.querySelector("#mobile-view-output-bar");
const closeMobileOutputButton = document.querySelector("#close-mobile-output");
const mobileOpenSessionsButton = document.querySelector("#mobile-open-sessions");
const mobileOpenTodoButton = document.querySelector("#mobile-open-todo");
const mobileOpenSettingsButton = document.querySelector("#mobile-open-settings");
const mobileOpenInstructionsButton = document.querySelector("#mobile-open-instructions");
const mobileOpenBackupButton = document.querySelector("#mobile-open-backup");
const mobileSheetBackdrop = document.querySelector("#mobile-sheet-backdrop");
const sessionItemTemplate = document.querySelector("#session-item-template");
const highlightChipTemplate = document.querySelector("#highlight-chip-template");
const participantDirectoryItemTemplate = document.querySelector("#participant-directory-item-template");
const pendingRecordingItemTemplate = document.querySelector("#pending-recording-item-template");
const abbreviationDirectoryItemTemplate = document.querySelector("#abbreviation-directory-item-template");
const todoItemTemplate = document.querySelector("#todo-item-template");
const promptBlockTemplate = document.querySelector("#prompt-block-template");
const customHeaderTemplate = document.querySelector("#custom-header-template");
const addCustomTemplateButton = document.querySelector("#add-custom-template");
const duplicateTemplateButton = document.querySelector("#duplicate-template");
const duplicateTemplateSourceSelect = document.querySelector("#duplicate-template-source");
const templateLauncherVisibilityList = document.querySelector("#template-launcher-visibility-list");
const customTemplateList = document.querySelector("#custom-template-list");
const customTemplateTemplate = document.querySelector("#custom-template-template");
const templateHeaderTemplate = document.querySelector("#template-header-template");
const templateFieldTemplate = document.querySelector("#template-field-template");
const structuredSectionInputs = [
  includeSummaryInput,
  includeHighlightsInput,
  includeDecisionsInput,
  includeActionsInput,
];

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const DICTATION_LANGUAGES = {
  swedish: "sv-SE",
  english: "en-US",
};
const OUTPUT_LANGUAGES = {
  swedish: "swedish",
  english: "english",
};
const APP_STATUS_STATES = {
  idle: "idle",
  saving: "saving",
  recording: "recording",
  generating: "generating",
  updating: "updating",
  warning: "warning",
};
const MOBILE_LAYOUT_QUERY = window.matchMedia("(max-width: 720px)");
const REMOTE_VERSION_CHECK_INTERVAL_MS = 2 * 60 * 1000;
const SUPPORTS_FILE_SAVE = typeof window.showSaveFilePicker === "function";
const SUPPORTS_AUDIO_RECORDING = typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
const SUPPORTS_MEETING_CAPTURE = typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
const MAX_MODEL_INPUT_PRICE_PER_MILLION = 2.5;
const APPROX_TOKENS_PER_PAGE = 750;
  const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
  const AUDIO_CHUNK_TARGET_BYTES = 23 * 1024 * 1024;
  const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
  const DEFAULT_OUTPUT_PANEL_WIDTH = 460;
  const MIN_WORKSPACE_PANEL_WIDTH = 260;
  const MIN_OUTPUT_PANEL_WIDTH = MIN_WORKSPACE_PANEL_WIDTH;
  const MAX_OUTPUT_PANEL_WIDTH = 720;
const DEFAULT_PROMPT_SETTINGS = {
  meetingMinutesSystem: `# Role
You are an expert business meeting-minutes writer.

# Mission
Turn rough notes and transcripts into accurate, professional, decision-focused meeting minutes that are easy to scan, safe to share, and useful for follow-up work.

# Standard
Write like an excellent human operations partner: factual, clear, concise, and structured. The result should read like high-quality meeting minutes, not a transcript cleanup.

# Output contract
Your job is to produce a business-ready record of what matters from the meeting:
- what the meeting was about
- what was decided
- what follow-up is required
- what remains open, risky, blocked, or unresolved

Prefer reliable synthesis over coverage for its own sake.`,
  meetingMinutesRules: `# Core instructions
- Write professional meeting minutes from the source material.
- Synthesize; do not retell the meeting minute-by-minute.
- Prioritize outcomes, decisions, commitments, risks, blockers, and unresolved questions.
- Use clear sectioning and concise business language.
- Use bullets when they improve scanability; avoid bloated prose.
- Remove filler, repetition, false starts, side chatter, and spoken-language clutter.

# Source handling
- Use the provided manual notes, transcript text, uploaded material, and template context together.
- When sources differ, prefer the most specific, credible, and decision-relevant formulation that is supported by the material.
- Manual notes may contain the user's intended emphasis; preserve that emphasis when it does not conflict with stronger evidence in the transcript or source text.

# Section behavior
- Follow the requested template sections and write each section according to its purpose.
- If a section has little or no supported content, keep it very brief rather than inventing filler.
- If a section is not applicable, omit it only if the surrounding app/template logic clearly allows omission; otherwise keep it concise and factual.

# Accuracy and restraint
- Preserve only what is supported by the source material.
- Do not invent decisions, owners, due dates, or rationale that were not stated or strongly supported.
- If the source is ambiguous, reflect that uncertainty briefly instead of guessing.
- Merge duplicate points and normalize inconsistent wording without changing meaning.
- Distinguish clearly between discussion, decision, and action.
- Do not promote a suggestion or open question into a decision unless the source supports that conclusion.

# Actionability
- Capture action items, owners, and timing when they are present.
- Call out open issues, pending decisions, and required follow-up clearly.
- Keep the output proportionate to the meeting: concise for short sessions, fuller for substantial ones.
- If an owner or timing is missing, preserve the action but do not fabricate the missing detail.

# Writing style
- Neutral, professional, business-ready.
- Specific and information-dense.
- Avoid transcript phrasing, conversational clutter, and unnecessary scene-setting.
- For each discussion point heading, prefer flowing text that captures the substance of the discussion.
- Use bullets only when they materially improve scanability, such as for decisions or action items.
- Make the result easy for a busy colleague to scan in under a minute.

# Output priorities
1. Main outcome and business significance
2. Decisions made
3. Action items and follow-up
4. Risks, blockers, and open questions

# Final checks
- Ensure the output reads like polished meeting minutes, not notes or a transcript.
- Ensure important follow-up items are easy to find.
- Ensure nothing material has been invented to make the document feel more complete.`,
  personalNotesSystem: `# Role
You are an expert editor for personal notes, work notes, and dictated memos.

# Mission
Turn rough writing or dictated speech into a clear, readable note that preserves the writer's meaning, useful detail, and practical intent.

# Standard
Improve clarity and reusability without over-writing, over-formalizing, or turning a simple note into something more elaborate than the source calls for.

# Output contract
Produce a note that is easier to reuse later:
- clearer than the source
- faithful to the source
- proportionate to the source
- structured only when structure genuinely helps`,
  personalNotesRules: `# Core instructions
- Polish the source into a clean, readable note.
- Preserve the original meaning, practical intent, and useful specifics.
- Remove spoken clutter, false starts, repetition, and minor grammar issues.
- Keep the note proportionate to the source: short notes should stay short.

# Structure
- Apply light structure only when it genuinely improves reuse.
- Use brief headings or bullets when the source naturally supports them.
- Do not force meeting-minute structure onto simple notes or dictations.

# Accuracy and restraint
- Do not invent facts, conclusions, or action items.
- If wording is ambiguous, prefer conservative cleanup over reinterpretation.
- Preserve tasks, reminders, questions, and follow-ups clearly when they appear.

# Writing style
- Natural, clear, and efficient.
- Slightly polished, not corporate for its own sake.
- Easy to skim later and easy to search.

# Final checks
- Ensure the note still feels like the user's note, only clearer.
- Ensure important reminders, questions, and next steps remain easy to spot.
- Ensure the result is not over-structured relative to the source.

# Output priorities
1. Readability
2. Faithfulness to the source
3. Useful light structure
4. Brevity when brevity fits`,
  revisionRules: `# Core instructions
- Apply only the requested improvements to the current output.
- Keep the existing meaning, structure, and intent unless the request explicitly asks for deeper restructuring.
- Make the smallest set of changes needed to satisfy the revision request well.

# Preservation
- Preserve decisions, action items, owners, dates, risks, and open questions unless the user explicitly asks to change them.
- Do not add new facts, invented rationale, or extra content that was not already present.
- Keep headings, section order, and document logic stable unless the request clearly requires a different arrangement.

# Editing behavior
- Improve clarity, wording, tone, grammar, and concision where requested.
- Remove repetition, awkward phrasing, and low-value filler when it improves the result.
- If the request is narrow, keep the edit narrow.

# Style
- Keep the result polished, professional, and easy to scan.
- Avoid unnecessary rewrites that make the text feel like a different document.

# Final checks
- Ensure the revised output still feels like the same document, just improved in the requested way.
- Ensure no important follow-up content was dropped during editing.`,
  translationRules: `# Core instructions
- Translate the current output faithfully into the requested language.
- Preserve the same structure, headings, emphasis, and practical meaning.
- Keep decisions, action items, owners, dates, and risks explicit and easy to find.

# Preservation
- Do not summarize, omit, soften, or expand the content unless the user explicitly asks for adaptation rather than translation.
- Preserve names, product names, acronyms, and technical terms unless there is a clear standard localized form.
- Keep the relative tone of the original: professional, clear, and business-ready.

# Formatting
- Preserve headings, bullets, numbering, and section order.
- Preserve action-item formatting and scanability.
- Keep translated wording natural in the target language without becoming overly literal or awkward.

# Final checks
- Ensure the translation reads like a polished native-language document.
- Ensure nothing important was dropped or materially changed.
- Ensure the result remains aligned with the original document's purpose and structure.`,
  additionalPrompts: [],
};
const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_MODES = {
  browser: "browser",
  file: "file",
};
const TRANSCRIPTION_MODELS = {
  "gpt-4o-mini-transcribe": {
    label: "GPT-4o mini transcribe",
    description: "Best value for most recorded meeting audio and speaker playback.",
    pricing: "$0.003 per minute",
    pricingDate: "2026-03-29",
  },
  "gpt-4o-transcribe": {
    label: "GPT-4o transcribe",
    description: "Higher-quality transcription when accuracy matters more than speed or cost.",
    pricing: "$0.006 per minute",
    pricingDate: "2026-03-29",
  },
  "gpt-4o-transcribe-diarize": {
    label: "GPT-4o transcribe diarize",
    description: "Best when you want stronger speaker separation in addition to transcription.",
    pricing: "$0.009 per minute",
    pricingDate: "2026-03-29",
  },
};
const RELEVANT_TRANSCRIPTION_MODEL_IDS = [
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
];
const LEGACY_MEETING_MINUTES_BULLET_RULE =
  "- For each discussion point heading, provide 2-5 crisp bullets that capture the substance of the discussion.";
const UPDATED_MEETING_MINUTES_PROSE_RULES = [
  "- For each discussion point heading, prefer flowing text that captures the substance of the discussion.",
  "- Use bullets only when they materially improve scanability, such as for decisions or action items.",
];
const THEME_DESCRIPTIONS = {
  "fluent-slate": "A calm professional default with restrained blue accents and quiet neutral surfaces.",
  "atlas-blue": "A familiar enterprise look with crisp structure, clarity, and dependable blue emphasis.",
  "graphite-forest": "A low-fatigue theme for long sessions, with deep neutrals and muted green focus accents.",
  "stone-olive": "A warmer premium theme with stone neutrals and olive accents that still feels serious and productive.",
  "nordic-teal": "A crisp contemporary theme with cool neutrals and teal accents for a modern technical feel.",
  "copper-ink": "A warmer executive-style theme with editorial contrast and muted copper emphasis.",
};

let localDataFileHandle = null;
let storageHandleDbPromise = null;
let storagePersistTimeout = null;
let isApplyingStoragePayload = false;
let mobileMoreSheetOpen = false;
let mobileOutputSheetOpen = false;
let aiSettingsOpenedFromSettings = false;
let confirmModalResolver = null;
let eventsBound = false;

function isMobileLayout() {
  return MOBILE_LAYOUT_QUERY.matches;
}

function hasSessionContent(session = getActiveSession()) {
  if (!session) {
    return false;
  }

  const customFieldValues = Object.values(session.customFieldValues || {}).some((value) => String(value || "").trim());
  return Boolean(
    session.rawNotes?.trim()
    || session.liveTranscript?.trim()
    || session.uploadedTranscript?.trim()
    || session.participants?.trim()
    || session.title?.trim()
    || session.highlights?.length
    || customFieldValues
  );
}
const DEFAULT_EXPORT_PRESET = "modern-aptos";
const EXPORT_STYLE_PRESETS = {
  "modern-aptos": {
    label: "Modern Aptos",
    description: "Balanced Microsoft 365-style business typography with a calm sans-serif hierarchy.",
    style: {
      titleFont: "Aptos Display, Aptos, Calibri, Arial, sans-serif",
      headingFont: "Aptos, Calibri, Arial, sans-serif",
      bodyFont: "Aptos, Calibri, Arial, sans-serif",
      metaFont: "Aptos, Calibri, Arial, sans-serif",
      titleSize: 22,
      headingSize: 12.5,
      bodySize: 11,
      metaSize: 9.5,
      lineHeight: 1.5,
    },
  },
  "enterprise-helvetica": {
    label: "Enterprise Sans",
    description: "Neutral, executive-ready sans serif pairing with slightly tighter spacing for efficient reading.",
    style: {
      titleFont: "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
      headingFont: "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
      bodyFont: "Arial, Helvetica, sans-serif",
      metaFont: "Arial, Helvetica, sans-serif",
      titleSize: 21,
      headingSize: 12,
      bodySize: 10.5,
      metaSize: 9,
      lineHeight: 1.45,
    },
  },
  "editorial-georgia": {
    label: "Editorial Serif",
    description: "Serif headlines with clean sans-serif body text for a more formal, client-facing tone.",
    style: {
      titleFont: "Georgia, Cambria, \"Times New Roman\", serif",
      headingFont: "Georgia, Cambria, \"Times New Roman\", serif",
      bodyFont: "Aptos, Calibri, Arial, sans-serif",
      metaFont: "Aptos, Calibri, Arial, sans-serif",
      titleSize: 24,
      headingSize: 13,
      bodySize: 11,
      metaSize: 9.5,
      lineHeight: 1.55,
    },
  },
  "board-briefing": {
    label: "Board Briefing",
    description: "Compact hierarchy and disciplined spacing for dense but readable briefing packs.",
    style: {
      titleFont: "Aptos Display, Aptos, Arial, sans-serif",
      headingFont: "Aptos, Arial, sans-serif",
      bodyFont: "Aptos, Arial, sans-serif",
      metaFont: "Aptos, Arial, sans-serif",
      titleSize: 20,
      headingSize: 11.5,
      bodySize: 10.5,
      metaSize: 8.5,
      lineHeight: 1.4,
    },
  },
  "digital-inter": {
    label: "Digital Inter",
    description: "A contemporary product-and-operations style with strong clarity and a slightly tighter digital rhythm.",
    style: {
      titleFont: "Inter, Segoe UI, Arial, sans-serif",
      headingFont: "Inter, Segoe UI, Arial, sans-serif",
      bodyFont: "\"Source Sans 3\", Inter, Arial, sans-serif",
      metaFont: "\"Source Sans 3\", Inter, Arial, sans-serif",
      titleSize: 21,
      headingSize: 12,
      bodySize: 10.5,
      metaSize: 9,
      lineHeight: 1.45,
    },
  },
};
const DEFAULT_AI_MODEL_CATALOG = [
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models",
    useCase: "Use when you want the strongest note quality, nuanced restructuring, and the best professional polish.",
    inputPrice: "$2.50",
    cachedInputPrice: "$0.25",
    outputPrice: "$15.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5.4-pro",
    label: "GPT-5.4 pro",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4-pro",
    useCase: "Use for especially high-stakes notes where precision matters more than latency or cost.",
    inputPrice: "$15.00",
    cachedInputPrice: null,
    outputPrice: "$120.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5",
    useCase: "Use for premium note polishing when you want very strong reasoning but lower cost than GPT-5.4.",
    inputPrice: "$1.25",
    cachedInputPrice: "$0.125",
    outputPrice: "$10.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5-mini",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models/gpt-5",
    useCase: "Use for the best quality-to-cost balance for everyday meetings. This is the recommended default.",
    inputPrice: "$0.25",
    cachedInputPrice: "$0.025",
    outputPrice: "$2.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models",
    useCase: "Use when you want near-frontier note quality at low cost and fast turnaround.",
    inputPrice: "$0.25",
    cachedInputPrice: "$0.025",
    outputPrice: "$2.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4-nano",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models",
    useCase: "Use for ultra-fast, lowest-cost cleanup where light polishing is enough.",
    inputPrice: "$0.05",
    cachedInputPrice: "$0.005",
    outputPrice: "$0.40",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5-nano",
    label: "GPT-5 nano",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5-nano",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models/gpt-5",
    useCase: "Use for the lowest-cost cleanup when speed matters more than nuanced phrasing or structure.",
    inputPrice: "$0.05",
    cachedInputPrice: "$0.005",
    outputPrice: "$0.40",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4.1",
    useCase: "Use if you want a strong non-reasoning model with stable text quality for polished summaries.",
    inputPrice: "$2.00",
    cachedInputPrice: "$0.50",
    outputPrice: "$8.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
    useCase: "Use for fast, lower-cost note formatting with solid quality on typical business meetings.",
    inputPrice: "$0.40",
    cachedInputPrice: "$0.10",
    outputPrice: "$1.60",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 nano",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4.1-nano",
    useCase: "Use for extremely cost-sensitive workflows where you mainly want lightweight cleanup.",
    inputPrice: "$0.10",
    cachedInputPrice: "$0.025",
    outputPrice: "$0.40",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4o",
    useCase: "Use for versatile multimodal work or when you want a familiar general-purpose model for polished notes.",
    inputPrice: "$2.50",
    cachedInputPrice: "$1.25",
    outputPrice: "$10.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4o-mini",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models/gpt-4o",
    useCase: "Use for inexpensive, responsive note cleanup when you still want a capable mainstream model.",
    inputPrice: "$0.15",
    cachedInputPrice: "$0.075",
    outputPrice: "$0.60",
    pricingDate: "2026-03-28",
  },
];

function getAllTemplates() {
  const customTemplates = Array.isArray(settings?.customTemplates) ? settings.customTemplates : [];
  const builtIns = Object.values(BUILT_IN_TEMPLATES);
  return [...builtIns, ...customTemplates];
}

function cloneTemplateForCustomTemplate(template, options = {}) {
  const source = template ? normalizeCustomTemplate(template) : createCustomTemplate();
  const baseLabel = options.label || source.label || "Custom template";

  return {
    ...source,
    id: `custom-${crypto.randomUUID()}`,
    label: options.label ?? `${baseLabel} copy`,
    isExpanded: true,
    sourceTemplateId: source.sourceTemplateId || source.id || "",
    headers: normalizeTemplateHeaders(source.headers),
    customFields: normalizeTemplateCustomFields(source.customFields),
    fields: normalizeTemplateFields(source.fields),
  };
}

function getTemplateBehaviorId(template) {
  if (!template) {
    return "meeting";
  }

  const sourceTemplateId = typeof template.sourceTemplateId === "string" ? template.sourceTemplateId : "";
  return sourceTemplateId || template.id || "meeting";
}

function getTemplateTitleFieldLabel(template) {
  const behaviorId = getTemplateBehaviorId(template);
  if (behaviorId === "personalNote") {
    return "Quick note title";
  }
  if (behaviorId === "oneToOneCall") {
    return "1:1 / Phone call title";
  }
  return "Meeting title";
}

function getTemplateDefinition(templateId) {
  if (BUILT_IN_TEMPLATES[templateId]) {
    return BUILT_IN_TEMPLATES[templateId];
  }

  return (settings?.customTemplates || []).find((template) => template.id === templateId) || BUILT_IN_TEMPLATES.meeting;
}

function createDefaultSettings() {
  return {
    apiKey: "",
    model: "gpt-5-mini",
    transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
    dictationLanguage: "auto",
    lastBackupAt: 0,
    themeFamily: "fluent-slate",
    themeMode: "light",
    recentSessionsExpanded: false,
    abbreviationDirectory: [],
    todoItems: [],
    participantDirectory: [],
    participantDirectoryInitialized: false,
    defaultCustomHeaders: [],
    customTemplates: [],
    templateUsageCounts: {},
    templateLauncherTemplateIds: ["meeting", "personalNote", "oneToOneCall"],
    selectedQuickTemplateId: "meeting",
    exportStylePreset: DEFAULT_EXPORT_PRESET,
    exportStyle: normalizeExportStyle(EXPORT_STYLE_PRESETS[DEFAULT_EXPORT_PRESET].style),
    promptSettings: { ...DEFAULT_PROMPT_SETTINGS },
      storageMode: STORAGE_MODES.browser,
      storageFileName: "",
      storageFileConnected: false,
      storageLastSyncAt: 0,
      outputPanelWidth: DEFAULT_OUTPUT_PANEL_WIDTH,
    };
  }

let settings = createDefaultSettings();
let sessions = [];
let aiModelCatalog = filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({ ...model })));
let activeSessionId = null;
let recognition = null;
let isRecording = false;
let finalTranscript = "";
let dictationSeedText = "";
let currentDictationLanguage = getInitialDictationLanguage();
let pendingLanguageRestart = false;
let draftSaveTimeout = null;
let aiCatalogRefreshCounter = 0;
let lastAiCatalogRefreshAttemptAt = 0;
let serviceWorkerRegistration = null;
let hasPendingAppUpdate = false;
let isRefreshingForUpdate = false;
let activeSettingsSection = "appearance";
let activeAiSettingsSection = "connection";
let latestRemoteVersion = APP_VERSION;
let sessionFilterQuery = "";
let selectedSessionIds = new Set();
let selectedParticipantNames = new Set();
let desktopWorkspaceView = "capture";
let participantDirectoryExpanded = false;
let todoFilterQuery = "";
let todoSortKey = "addedAt";
let todoSortDirection = "desc";
let activeTodoDetailId = null;
let outputPanelWidth = 440;
let transcriptVisualState = "idle";
let mediaRecorder = null;
let mediaRecorderStream = null;
let mediaRecorderSourceStream = null;
let mediaRecorderChunks = [];
let audioRecordingSessionId = null;
let activeAudioCaptureMode = "meeting";
const audioDrafts = new Map();
let pendingAudioDbPromise = null;
let appStateDbPromise = null;
const AI_MODEL_REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function initializeApp() {
  if (!eventsBound) {
    bindEvents();
    eventsBound = true;
  }

  try {
    settings = await loadSettings();
    sessions = await loadSessions();
    aiModelCatalog = await loadAiModelCatalog();
  } catch (error) {
    console.error("Legacy PWA storage init failed, falling back to browser-local defaults.", error);
    settings = normalizeStoredSettings(readLegacyLocalStorageJson(SETTINGS_KEY));
    sessions = normalizeImportedSessions(readLegacyLocalStorageJson(STORAGE_KEY) || []);
    aiModelCatalog = filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({ ...model })));
    if (dictationStatus) {
      dictationStatus.textContent = "Browser database setup was unavailable, so NoteSmith fell back to local browser storage for this session.";
    }
  }

  activeSessionId = sessions[0]?.id ?? null;
  
    applyTheme(settings.themeFamily, settings.themeMode);
    applyOutputPanelWidth();
    settings.model = resolveSelectedModel(settings.model);
  syncParticipantDirectoryFromAllSessions();

  if (!sessions.length) {
    const startupSession = createSession();
    sessions = [startupSession];
    activeSessionId = startupSession.id;
    persistSessions();
  }

  setupSpeechRecognition();
  render();
  registerServiceWorker();
  updateHeroMeta();
  maybeRefreshAiModelCatalog({ force: true });
  try {
    await initializeStorageMode();
  } catch (error) {
    console.error("Storage mode initialization failed.", error);
    settings.storageMode = STORAGE_MODES.browser;
    updateStorageUi();
    updateSessionStorageUi();
    if (sessionStorageStatus) {
      sessionStorageStatus.textContent = "Browser storage is active. Advanced storage setup could not be restored in this browser session.";
    }
  }
  window.setTimeout(() => {
    maybeShowBackupReminder();
  }, 350);
}

void initializeApp().catch((error) => {
  console.error("Legacy PWA initialization failed.", error);
  if (!eventsBound) {
    bindEvents();
    eventsBound = true;
  }
  if (!sessions.length) {
    const startupSession = createSession();
    sessions = [startupSession];
    activeSessionId = startupSession.id;
  }
  render();
  if (dictationStatus) {
    dictationStatus.textContent = "NoteSmith recovered from a startup issue. Core session editing is available, but some browser features may need a reload.";
  }
});

  function bindEvents() {
    document.addEventListener("click", handlePrimaryChromeClick);
    if (outputResizeHandle && workspaceLayout) {
      outputResizeHandle.addEventListener("pointerdown", startOutputResize);
      outputResizeHandle.addEventListener("mousedown", startOutputResize);
    }
  mobileDictationToggle?.addEventListener("click", () => {
    if (mobileDictationToggle.dataset.captureMode === "audio") {
      toggleAudioCapture("room");
      return;
    }
    toggleDictation();
  });
  mobileGenerateButton?.addEventListener("click", () => {
    polishButton.click();
  });
  mobileOpenMoreButton?.addEventListener("click", openMobileMoreSheet);
  closeMobileMoreButton?.addEventListener("click", closeMobileSheets);
  mobileOpenOutputButton?.addEventListener("click", openMobileOutputSheet);
  mobileOpenOutputBarButton?.addEventListener("click", openMobileOutputSheet);
  closeMobileOutputButton?.addEventListener("click", closeMobileSheets);
  mobileSheetBackdrop?.addEventListener("click", closeMobileSheets);
  mobileOpenTodoButton?.addEventListener("click", () => {
    closeMobileSheets();
    openTodoPanel();
  });
  mobileOpenSettingsButton?.addEventListener("click", () => {
    closeMobileSheets();
    openSettings();
  });
  mobileOpenInstructionsButton?.addEventListener("click", () => {
    closeMobileSheets();
    openInstructions();
  });
  mobileOpenBackupButton?.addEventListener("click", () => {
    closeMobileSheets();
    openBackupPanel();
  });

  sessionFilterInput.addEventListener("input", () => {
    sessionFilterQuery = sessionFilterInput.value.trim().toLowerCase();
    renderSessionList();
  });

  selectAllSessionsInput?.addEventListener("change", () => {
    const visibleSessionIds = getVisibleSessions().map((session) => session.id);
    if (selectAllSessionsInput.checked) {
      visibleSessionIds.forEach((sessionId) => selectedSessionIds.add(sessionId));
    } else {
      visibleSessionIds.forEach((sessionId) => selectedSessionIds.delete(sessionId));
    }
    renderSessionList();
  });

  deleteSelectedSessionsButton?.addEventListener("click", async () => {
    const selectedIds = Array.from(selectedSessionIds).filter((sessionId) => sessions.some((session) => session.id === sessionId));
    if (!selectedIds.length) {
      return;
    }

    const confirmed = await showConfirmModal({
      eyebrow: "Delete sessions",
      title: "Delete selected sessions?",
      message: `Are you sure you want to delete ${selectedIds.length} selected sessions? This cannot be undone.`,
      confirmLabel: "Delete selected",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    deleteSessions(selectedIds);
  });

  toggleSessionsPanelButton?.addEventListener("click", () => {
    toggleRecentSessionsPanel();
  });

  [collapseSessionsPanelButton, sessionsPanelBackdrop].forEach((button) => {
    button?.addEventListener("click", () => {
      setRecentSessionsExpanded(false);
    });
  });

  desktopViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setDesktopWorkspaceView(button.dataset.desktopView);
    });
  });

  exportSessionsButton.addEventListener("click", exportSessions);
  importSessionsButton.addEventListener("click", () => {
    importSessionsInput.click();
  });
  importSessionsInput.addEventListener("change", importSessionsFromFile);

  saveLocalFileButton.addEventListener("click", async () => {
    await saveSessionsToLocalFile();
  });

  [openTodoMainButton, openTodoOutputButton].forEach((button) => {
    button?.addEventListener("click", openTodoPanel);
  });
  [openBackupPanelButton, openBackupOutputButton].forEach((button) => {
    button?.addEventListener("click", openBackupPanel);
  });
  openInstructionsButton?.addEventListener("click", openInstructions);
  [openSettingsButton, openSettingsOutputButton].forEach((button) => {
    button?.addEventListener("click", openSettings);
  });
  closeInstructionsBackdrop?.addEventListener("click", closeInstructions);
  closeInstructionsButton?.addEventListener("click", closeInstructions);
  closeRecordingsBackdrop?.addEventListener("click", closeRecordingsModal);
  closeRecordingsButton?.addEventListener("click", closeRecordingsModal);
  closeWorkspacePanelBackdrop.addEventListener("click", closeWorkspacePanel);
  closeWorkspacePanelButton.addEventListener("click", closeWorkspacePanel);
  closeConfirmModalBackdrop.addEventListener("click", () => closeConfirmModal(false));
  closeConfirmModalButton.addEventListener("click", () => closeConfirmModal(false));
  confirmModalCancelButton.addEventListener("click", () => closeConfirmModal(false));
  confirmModalConfirmButton.addEventListener("click", () => closeConfirmModal(true));
  openSessionsShortcutButton.addEventListener("click", () => {
    closeWorkspacePanel();
    setRecentSessionsExpanded(true);
  });
  openBackupShortcutButton.addEventListener("click", () => {
    closeWorkspacePanel();
    openBackupPanel();
  });

  closeBackupPanelBackdrop.addEventListener("click", closeBackupPanel);
  closeBackupPanelButton.addEventListener("click", closeBackupPanel);
  closeTodoPanelBackdrop.addEventListener("click", closeTodoPanel);
  closeTodoPanelButton.addEventListener("click", closeTodoPanel);
  closeTodoDetailBackdrop?.addEventListener("click", closeTodoDetailModal);
  closeTodoDetailButton?.addEventListener("click", closeTodoDetailModal);
  todoFilterInput?.addEventListener("input", () => {
    todoFilterQuery = todoFilterInput.value.trim().toLowerCase();
    renderTodoList();
  });
  [
    [todoSortCompletedButton, "completed"],
    [todoSortDescriptionButton, "description"],
    [todoSortAddedButton, "addedAt"],
    [todoSortSessionsButton, "sessions"],
  ].forEach(([button, key]) => {
    button?.addEventListener("click", () => {
      if (todoSortKey === key) {
        todoSortDirection = todoSortDirection === "asc" ? "desc" : "asc";
      } else {
        todoSortKey = key;
        todoSortDirection = key === "addedAt" ? "desc" : "asc";
      }
      renderTodoList();
    });
  });

  openParticipantSettingsButton.addEventListener("click", () => {
    openSettings();
    window.setTimeout(() => {
      setActiveSettingsSection("participants");
      participantDirectoryInput.focus();
    }, 0);
  });

  addAbbreviationButton.addEventListener("click", () => {
    addAbbreviationToDirectory(abbreviationShortInput.value, abbreviationFullInput.value);
  });

  abbreviationDirectoryList.addEventListener("input", (event) => {
    const item = event.target.closest(".abbreviation-directory-item");
    if (!item) {
      return;
    }

    const currentShort = item.dataset.abbreviationShort;
    const nextShort = item.querySelector(".abbreviation-short-name").value;
    const nextFull = item.querySelector(".abbreviation-full-name").value;

    settings.abbreviationDirectory = normalizeAbbreviationDirectory(
      (settings.abbreviationDirectory || []).map((entry) => {
        if (entry.short !== currentShort) {
          return entry;
        }

        return {
          short: nextShort,
          full: nextFull,
        };
      })
    );
    persistSettings();
    renderAbbreviationDirectoryManager();
  });

  abbreviationDirectoryList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".abbreviation-directory-remove");
    if (!removeButton) {
      return;
    }

    const item = removeButton.closest(".abbreviation-directory-item");
    const shortValue = item?.dataset.abbreviationShort;
    settings.abbreviationDirectory = normalizeAbbreviationDirectory(
      (settings.abbreviationDirectory || []).filter((entry) => entry.short !== shortValue)
    );
    persistSettings();
    renderAbbreviationDirectoryManager();
  });

  todoList?.addEventListener("change", (event) => {
    const item = event.target.closest(".todo-item");
    if (!item) {
      return;
    }

    const todoId = item.dataset.todoId;
    settings.todoItems = normalizeTodoItems((settings.todoItems || []).map((todo) => (
      todo.id === todoId
        ? {
            ...todo,
            completed: item.querySelector(".todo-item-complete").checked,
          }
        : todo
    )));
    persistSettings();
    renderTodoList();
  });

  todoList?.addEventListener("click", async (event) => {
    const removeButton = event.target.closest(".todo-item-remove");
    if (!removeButton) {
      return;
    }

    const item = removeButton.closest(".todo-item");
    const todoId = item?.dataset.todoId;
    const todo = normalizeTodoItems(settings.todoItems).find((entry) => entry.id === todoId);
    if (!todo) {
      return;
    }

    const confirmed = await showConfirmModal({
      eyebrow: "Delete to-do",
      title: "Remove this to-do item?",
      message: `Remove "${todo.description}" from your personal to-do list?`,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    settings.todoItems = normalizeTodoItems((settings.todoItems || []).filter((entry) => entry.id !== todoId));
    persistSettings();
    renderTodoList();
  });

  todoList?.addEventListener("dblclick", (event) => {
    const item = event.target.closest(".todo-item");
    if (!item) {
      return;
    }

    openTodoDetailModal(item.dataset.todoId);
  });

  todoDetailComplete?.addEventListener("change", () => {
    syncActiveTodoDetailFromInputs();
    const todo = getTodoItemById(activeTodoDetailId);
    if (todo) {
      todoDetailTitle.textContent = todo.description;
    }
  });

  todoDetailDescription?.addEventListener("input", () => {
    syncActiveTodoDetailFromInputs();
    todoDetailTitle.textContent = polishTodoText(todoDetailDescription.value) || "To-do details";
  });

  todoDetailComments?.addEventListener("input", () => {
    syncActiveTodoDetailFromInputs();
  });

  todoDetailRemoveButton?.addEventListener("click", async () => {
    const todo = getTodoItemById(activeTodoDetailId);
    if (!todo) {
      return;
    }

    const confirmed = await showConfirmModal({
      eyebrow: "Delete to-do",
      title: "Remove this to-do item?",
      message: `Remove "${todo.description}" from your personal to-do list?`,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    settings.todoItems = normalizeTodoItems((settings.todoItems || []).filter((entry) => entry.id !== todo.id));
    persistSettings();
    renderTodoList();
    closeTodoDetailModal();
  });

  toggleParticipantDirectoryButton.addEventListener("click", () => {
    participantDirectoryExpanded = !participantDirectoryExpanded;
    updateParticipantDirectoryVisibility();
  });

  updateAppButton.addEventListener("click", () => {
    applyLatestAppUpdate();
  });

  closeSettingsBackdrop.addEventListener("click", closeSettings);
  closeSettingsButton.addEventListener("click", closeSettings);
  settingsNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.settingsTab === "ai") {
        openAiSettingsFromSettings();
        return;
      }
      setActiveSettingsSection(button.dataset.settingsTab);
    });
  });
  themeFamilySelect.addEventListener("input", previewThemeSelection);
  themeFamilySelect.addEventListener("change", previewThemeSelection);
  themeModeSelect.addEventListener("input", previewThemeSelection);
  themeModeSelect.addEventListener("change", previewThemeSelection);
  exportStylePresetSelect.addEventListener("change", () => {
    applyExportPresetToInputs(exportStylePresetSelect.value);
    settings.exportStylePreset = exportStylePresetSelect.value;
    settings.exportStyle = readExportStyleInputs();
    persistSettings();
    dictationStatus.textContent = `${getExportStyleDisplayName(settings.exportStylePreset)} export style saved.`;
  });
  storageModeBrowserInput?.addEventListener("change", async () => {
    if (!storageModeBrowserInput.checked) {
      return;
    }
    await switchToBrowserStorageMode();
    dictationStatus.textContent = "Browser storage is now active.";
  });
  storageModeFileInput?.addEventListener("change", () => {
    if (!storageModeFileInput.checked) {
      return;
    }
    settings.storageMode = STORAGE_MODES.file;
    settings.storageFileConnected = false;
    persistSettings();
    updateStorageUi();
    dictationStatus.textContent = "Choose or create a local data file to finish switching storage mode.";
  });
  createStorageFileButton?.addEventListener("click", async () => {
    try {
      await createLocalDataFile();
      dictationStatus.textContent = "A local data file was created and connected.";
    } catch (error) {
      if (error?.name === "AbortError") {
        dictationStatus.textContent = "Creating a local data file was cancelled.";
      } else {
        dictationStatus.textContent = `Could not create the local data file: ${error.message}`;
      }
    }
  });
  useStorageFileButton?.addEventListener("click", async () => {
    try {
      await useExistingLocalDataFile();
      dictationStatus.textContent = "The local data file is now connected.";
    } catch (error) {
      if (error?.name === "AbortError") {
        dictationStatus.textContent = "Choosing a local data file was cancelled.";
      } else {
        dictationStatus.textContent = `Could not use that local data file: ${error.message}`;
      }
    }
  });
  reconnectStorageFileButton?.addEventListener("click", async () => {
    try {
      await reconnectLocalDataFile();
      dictationStatus.textContent = "The local data file was reconnected.";
    } catch (error) {
      dictationStatus.textContent = `Could not reconnect the local data file: ${error.message}`;
    }
  });
  disconnectStorageFileButton?.addEventListener("click", async () => {
    await switchToBrowserStorageMode();
    dictationStatus.textContent = "Switched back to browser storage.";
  });
  [
    exportTitleFontInput,
    exportHeadingFontInput,
    exportBodyFontInput,
    exportMetaFontInput,
    exportTitleSizeInput,
    exportHeadingSizeInput,
    exportBodySizeInput,
    exportMetaSizeInput,
    exportLineHeightInput,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      exportStylePresetSelect.value = "custom";
      settings.exportStylePreset = "custom";
      settings.exportStyle = readExportStyleInputs();
      persistSettings();
      updateExportStyleDescription();
    });
  });

  addCustomTemplateButton.addEventListener("click", () => {
    const nextTemplate = createCustomTemplate();
    settings.customTemplates = [...settings.customTemplates, nextTemplate];
    persistSettings();
    renderTemplateOptions();
    renderCustomTemplates(nextTemplate.id);
  });

  duplicateTemplateButton?.addEventListener("click", () => {
    const templateId = duplicateTemplateSourceSelect?.value;
    if (!templateId) {
      duplicateTemplateSourceSelect?.focus();
      return;
    }

    const sourceTemplate = getTemplateDefinition(templateId);
    const nextTemplate = cloneTemplateForCustomTemplate(sourceTemplate);
    settings.customTemplates = [...settings.customTemplates, nextTemplate];
    persistSettings();
    renderTemplateOptions();
    renderCustomTemplates(nextTemplate.id);
  });

  addDirectoryParticipantButton.addEventListener("click", () => {
    addParticipantToDirectory(participantDirectoryInput.value);
  });

  participantDirectoryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addParticipantToDirectory(participantDirectoryInput.value);
    }
  });

  selectAllParticipantsInput?.addEventListener("change", () => {
    const participantNames = settings.participantDirectory || [];
    if (selectAllParticipantsInput.checked) {
      selectedParticipantNames = new Set(participantNames);
    } else {
      selectedParticipantNames.clear();
    }
    renderParticipantDirectoryManager();
  });

  deleteSelectedParticipantsButton?.addEventListener("click", async () => {
    const selectedNames = Array.from(selectedParticipantNames).filter((name) => (settings.participantDirectory || []).includes(name));
    if (!selectedNames.length) {
      return;
    }

    const confirmed = await showConfirmModal({
      eyebrow: "Delete participants",
      title: "Delete selected participants?",
      message: `Are you sure you want to delete ${selectedNames.length} selected participants from the saved list?`,
      confirmLabel: "Delete selected",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    settings.participantDirectory = normalizeParticipantDirectory(
      (settings.participantDirectory || []).filter((entry) => !selectedParticipantNames.has(entry))
    );
    settings.participantDirectoryInitialized = true;
    selectedParticipantNames.clear();
    persistSettings();
    renderParticipantDirectoryManager();
    renderParticipantSuggestions();
  });

  participantDirectoryList.addEventListener("input", (event) => {
    const item = event.target.closest(".participant-directory-item");
    if (!item) {
      return;
    }

    const previousName = item.dataset.participantName || "";
    const nextName = event.target.value;
    settings.participantDirectory = normalizeParticipantDirectory(
      settings.participantDirectory.map((name) => (name === previousName ? nextName : name))
    );
    if (selectedParticipantNames.has(previousName)) {
      selectedParticipantNames.delete(previousName);
      if (nextName.trim()) {
        selectedParticipantNames.add(nextName.trim());
      }
    }
    settings.participantDirectoryInitialized = true;
    persistSettings();
    item.dataset.participantName = nextName.trim();
    renderParticipantDirectoryManager();
    renderParticipantSuggestions();
  });

  participantDirectoryList.addEventListener("click", (event) => {
    const selectInput = event.target.closest(".participant-directory-select");
    if (selectInput) {
      return;
    }

    const removeButton = event.target.closest(".participant-directory-remove");
    if (!removeButton) {
      return;
    }

    const item = removeButton.closest(".participant-directory-item");
    const name = item?.dataset.participantName || "";
    settings.participantDirectory = normalizeParticipantDirectory(
      settings.participantDirectory.filter((entry) => entry !== name)
    );
    selectedParticipantNames.delete(name);
    settings.participantDirectoryInitialized = true;
    persistSettings();
    renderParticipantDirectoryManager();
    renderParticipantSuggestions();
  });

  participantDirectoryList.addEventListener("change", (event) => {
    const selectInput = event.target.closest(".participant-directory-select");
    if (!selectInput) {
      return;
    }

    const item = selectInput.closest(".participant-directory-item");
    const name = item?.dataset.participantName || "";
    if (!name) {
      return;
    }

    if (selectInput.checked) {
      selectedParticipantNames.add(name);
    } else {
      selectedParticipantNames.delete(name);
    }

    updateParticipantSelectionControls();
  });

  pendingRecordingsList?.addEventListener("click", async (event) => {
    const openButton = event.target.closest(".pending-recording-open");
    if (openButton) {
      const item = openButton.closest(".pending-recording-item");
      const sessionId = item?.dataset.sessionId;
      if (!sessionId) {
        return;
      }

      if (audioRecordingSessionId) {
        await stopAudioCapture();
      }
      activeSessionId = sessionId;
      render();
      return;
    }

    const deleteButton = event.target.closest(".pending-recording-delete");
    if (!deleteButton) {
      return;
    }

    const item = deleteButton.closest(".pending-recording-item");
    const sessionId = item?.dataset.sessionId;
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!sessionId || !session) {
      return;
    }

    const recordingLabel = normalizePendingAudioDraftMeta(session.pendingAudioDraftMeta)?.fileName || "this recording";
    const confirmed = await showConfirmModal({
      eyebrow: "Delete recording",
      title: "Delete this recording?",
      message: `Are you sure you want to delete ${recordingLabel} from "${session.title.trim() || "Untitled session"}"?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    await clearAudioDraft(sessionId);
    renderPendingRecordings();
    audioCaptureStatus.textContent = "Recording deleted.";
  });

  participantChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) {
      return;
    }

    const participantName = chip.dataset.participantName;
    const currentParticipants = parseParticipants(getActiveSession().participants);
    const nextParticipants = normalizeParticipantDirectory([...currentParticipants, participantName]);
    const nextValue = nextParticipants.join(", ");
    participantsInput.value = nextValue;
    updateActiveSession({ participants: nextValue }, true);
    syncParticipantDirectoryWithSession(nextValue);
  });

  customTemplateList.addEventListener("input", (event) => {
    const item = event.target.closest(".custom-template-item");
    if (!item) {
      return;
    }

    const templateId = item.dataset.templateId;
    const nextTemplates = settings.customTemplates.map((template) => {
      if (template.id !== templateId) {
        return template;
      }

      return readCustomTemplateItem(item, template);
    });

    settings.customTemplates = nextTemplates;
    persistSettings();
    renderTemplateOptions();
    const templateNameLabel = item.querySelector(".custom-template-name-label");
    const templateNameInput = item.querySelector(".custom-template-name");
    if (templateNameLabel && templateNameInput) {
      templateNameLabel.textContent = templateNameInput.value.trim() || "New template";
    }
    if (event.target.closest(".template-header-item")) {
      const sectionItem = event.target.closest(".template-header-item");
      const sectionLabel = sectionItem?.querySelector(".template-header-label");
      const titleInput = sectionItem?.querySelector(".template-header-title");
      if (sectionLabel && titleInput) {
        sectionLabel.textContent = titleInput.value.trim() || "New template section";
      }
    }
    if (event.target.closest(".template-field-item")) {
      const fieldItem = event.target.closest(".template-field-item");
      const fieldLabel = fieldItem?.querySelector(".template-field-label");
      const fieldNameInput = fieldItem?.querySelector(".template-field-name");
      const fieldTypeBadge = fieldItem?.querySelector(".template-field-type-badge");
      const fieldTypeInput = fieldItem?.querySelector(".template-field-type");
      if (fieldLabel && fieldNameInput) {
        fieldLabel.textContent = fieldNameInput.value.trim() || "New field";
      }
      if (fieldTypeBadge && fieldTypeInput) {
        fieldTypeBadge.textContent = fieldTypeInput.value;
      }
    }
    renderSessionList();
    const session = getActiveSession();
    if (session.template === templateId) {
        const updatedTemplate = nextTemplates.find((template) => template.id === templateId);
        updateActiveSessionSilently({
          templateSectionStates: normalizeTemplateSectionStates(session.templateSectionStates, updatedTemplate?.headers || []),
          customFieldValues: normalizeCustomFieldValues(session.customFieldValues, updatedTemplate?.customFields || []),
        });
        applyTemplateUi(session);
        renderCustomHeaders();
    }
  });

  customTemplateList.addEventListener("click", (event) => {
    const templateItem = event.target.closest(".custom-template-item");
    if (!templateItem) {
      return;
    }

    const templateId = templateItem.dataset.templateId;

    if (event.target.closest(".custom-template-edit")) {
      settings.customTemplates = settings.customTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          isExpanded: !(template.isExpanded === true),
        };
      });
      persistSettings();
      renderCustomTemplates(templateId);
      return;
    }

      if (event.target.closest(".custom-template-remove")) {
        settings.customTemplates = settings.customTemplates.filter((template) => template.id !== templateId);
        settings.templateLauncherTemplateIds = normalizeTemplateLauncherIds(
          settings.templateLauncherTemplateIds.filter((id) => id !== templateId)
        );
        persistSettings();
        sessions = sessions.map((session) => ({
          ...session,
        template: session.template === templateId ? "meeting" : session.template,
      }));
      persistSessions();
      render();
      return;
    }

      if (event.target.closest(".custom-template-save")) {
        settings.customTemplates = settings.customTemplates.map((template) => {
          if (template.id !== templateId) {
            return template;
        }

        return {
          ...readCustomTemplateItem(templateItem, template),
          isExpanded: false,
        };
      });
      persistSettings();
      renderTemplateOptions();
      renderCustomTemplates(templateId);
      dictationStatus.textContent = "Template saved locally.";
      const session = getActiveSession();
      if (session.template === templateId) {
        const updatedTemplate = settings.customTemplates.find((template) => template.id === templateId);
        updateActiveSessionSilently({
          templateSectionStates: normalizeTemplateSectionStates(session.templateSectionStates, updatedTemplate?.headers || []),
          customFieldValues: normalizeCustomFieldValues(session.customFieldValues, updatedTemplate?.customFields || []),
        });
        applyTemplateUi(session);
        renderCustomHeaders();
        }
        return;
      }

      if (event.target.closest(".custom-template-duplicate")) {
        const sourceTemplate = settings.customTemplates.find((template) => template.id === templateId);
        if (!sourceTemplate) {
          return;
        }

        const nextTemplate = cloneTemplateForCustomTemplate(sourceTemplate);
        settings.customTemplates = [...settings.customTemplates, nextTemplate];
        persistSettings();
        renderTemplateOptions();
        renderCustomTemplates(nextTemplate.id);
        return;
      }

      if (event.target.closest(".custom-template-header-add")) {
      const addForm = templateItem.querySelector(".custom-template-header-add-form");
      setElementVisibility(addForm, true);
      addForm?.querySelector(".custom-template-new-header-title")?.focus();
      return;
    }

    if (event.target.closest(".custom-template-header-cancel")) {
      const addForm = templateItem.querySelector(".custom-template-header-add-form");
      addForm.querySelector(".custom-template-new-header-title").value = "";
      addForm.querySelector(".custom-template-new-header-instructions").value = "";
      setElementVisibility(addForm, false);
      return;
    }

    if (event.target.closest(".custom-template-header-save")) {
      const addForm = templateItem.querySelector(".custom-template-header-add-form");
      const title = addForm.querySelector(".custom-template-new-header-title").value.trim();
      const instructions = addForm.querySelector(".custom-template-new-header-instructions").value.trim();

      if (!title) {
        addForm.querySelector(".custom-template-new-header-title").focus();
        return;
      }

      settings.customTemplates = settings.customTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          headers: [...template.headers, createTemplateHeader(title, instructions)],
        };
      });
      persistSettings();
      addForm.querySelector(".custom-template-new-header-title").value = "";
      addForm.querySelector(".custom-template-new-header-instructions").value = "";
      renderCustomTemplates(templateId);
      renderTemplateOptions();
      return;
    }

    if (event.target.closest(".custom-template-field-add")) {
      const addForm = templateItem.querySelector(".custom-template-field-add-form");
      setElementVisibility(addForm, true);
      addForm?.querySelector(".custom-template-new-field-label")?.focus();
      return;
    }

    if (event.target.closest(".custom-template-field-cancel")) {
      const addForm = templateItem.querySelector(".custom-template-field-add-form");
      addForm.querySelector(".custom-template-new-field-label").value = "";
      addForm.querySelector(".custom-template-new-field-type").value = "text";
      setElementVisibility(addForm, false);
      return;
    }

    if (event.target.closest(".custom-template-field-save")) {
      const addForm = templateItem.querySelector(".custom-template-field-add-form");
      const label = addForm.querySelector(".custom-template-new-field-label").value.trim();
      const type = addForm.querySelector(".custom-template-new-field-type").value;

      if (!label) {
        addForm.querySelector(".custom-template-new-field-label").focus();
        return;
      }

      settings.customTemplates = settings.customTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          customFields: [...normalizeTemplateCustomFields(template.customFields), { id: crypto.randomUUID(), label, type, isExpanded: false }],
        };
      });
      persistSettings();
      addForm.querySelector(".custom-template-new-field-label").value = "";
      addForm.querySelector(".custom-template-new-field-type").value = "text";
      renderCustomTemplates(templateId);
      renderTemplateOptions();
      return;
    }

    const headerEditButton = event.target.closest(".template-header-edit");
    if (headerEditButton) {
      const headerItem = headerEditButton.closest(".template-header-item");
      const headerId = headerItem?.dataset.headerId;
      settings.customTemplates = settings.customTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          headers: template.headers.map((header) => (
            header.id === headerId
              ? { ...header, isExpanded: !(header.isExpanded === true) }
              : header
          )),
        };
      });
      persistSettings();
      renderCustomTemplates(templateId);
      return;
    }

    const fieldEditButton = event.target.closest(".template-field-edit");
    if (fieldEditButton) {
      const fieldItem = fieldEditButton.closest(".template-field-item");
      const fieldId = fieldItem?.dataset.fieldId;
      settings.customTemplates = settings.customTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          customFields: normalizeTemplateCustomFields(template.customFields).map((field) => (
            field.id === fieldId ? { ...field, isExpanded: !(field.isExpanded === true) } : field
          )),
        };
      });
      persistSettings();
      renderCustomTemplates(templateId);
      return;
    }

    const headerRemoveButton = event.target.closest(".template-header-remove");
    if (headerRemoveButton) {
      const headerItem = headerRemoveButton.closest(".template-header-item");
      const headerId = headerItem?.dataset.headerId;
      settings.customTemplates = settings.customTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          headers: template.headers.filter((header) => header.id !== headerId),
        };
      });
      persistSettings();
      renderCustomTemplates(templateId);
      renderTemplateOptions();
    }

    const fieldRemoveButton = event.target.closest(".template-field-remove");
    if (fieldRemoveButton) {
      const fieldItem = fieldRemoveButton.closest(".template-field-item");
      const fieldId = fieldItem?.dataset.fieldId;
      settings.customTemplates = settings.customTemplates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          customFields: normalizeTemplateCustomFields(template.customFields).filter((field) => field.id !== fieldId),
        };
      });
      persistSettings();
      renderCustomTemplates(templateId);
      renderTemplateOptions();
    }
  });

  openAiSettingsInlineButton.addEventListener("click", openAiSettingsFromSettings);
  [
    [promptGenerationSystemInput, "meetingMinutesSystem"],
    [promptGenerationRulesInput, "meetingMinutesRules"],
    [promptPersonalNotesSystemInput, "personalNotesSystem"],
    [promptPersonalNotesRulesInput, "personalNotesRules"],
    [promptRevisionRulesInput, "revisionRules"],
    [promptTranslationRulesInput, "translationRules"],
  ].forEach(([input, key]) => {
    input?.addEventListener("input", () => {
      settings.promptSettings = normalizePromptSettings({
        ...settings.promptSettings,
        [key]: input.value,
      });
      persistSettings();
    });
  });
  resetPromptSettingsButton?.addEventListener("click", () => {
    settings.promptSettings = normalizePromptSettings({
      ...DEFAULT_PROMPT_SETTINGS,
      additionalPrompts: (settings.promptSettings?.additionalPrompts || []).map((prompt) => ({
        ...prompt,
        enabled: false,
      })),
    });
    persistSettings();
    syncPromptSettingsUi();
    dictationStatus.textContent = "Prompt defaults restored from the latest built-in app prompts. Your reusable prompt blocks were kept and unchecked.";
  });
  addPromptBlockButton?.addEventListener("click", () => {
    settings.promptSettings = normalizePromptSettings({
      ...settings.promptSettings,
      additionalPrompts: [
        ...(settings.promptSettings?.additionalPrompts || []),
        { id: crypto.randomUUID(), label: "", text: "", enabled: true },
      ],
    });
    persistSettings();
    syncPromptSettingsUi();
  });
  promptAdditionalList?.addEventListener("input", (event) => {
    const item = event.target.closest(".prompt-block-item");
    if (!item) {
      return;
    }

    const promptId = item.dataset.promptId;
    const enabled = item.querySelector(".prompt-block-enabled")?.checked !== false;
    const nextLabel = item.querySelector(".prompt-block-label")?.value || "";
    const nextText = item.querySelector(".prompt-block-text")?.value || "";
    settings.promptSettings = normalizePromptSettings({
      ...settings.promptSettings,
      additionalPrompts: (settings.promptSettings?.additionalPrompts || []).map((prompt) => (
        prompt.id === promptId ? {
          ...prompt,
          enabled,
          label: nextLabel,
          text: nextText,
        } : prompt
      )),
    });
    persistSettings();
  });
  promptAdditionalList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".prompt-block-remove");
    if (!removeButton) {
      return;
    }

    const item = removeButton.closest(".prompt-block-item");
    const promptId = item?.dataset.promptId;
    settings.promptSettings = normalizePromptSettings({
      ...settings.promptSettings,
      additionalPrompts: (settings.promptSettings?.additionalPrompts || []).filter((prompt) => prompt.id !== promptId),
    });
    persistSettings();
    syncPromptSettingsUi();
  });
  closeAiSettingsBackdrop.addEventListener("click", closeAiSettings);
  closeAiSettingsButton.addEventListener("click", closeAiSettings);
  closeBackupReminderBackdrop.addEventListener("click", closeBackupReminder);
  closeBackupReminderButton.addEventListener("click", closeBackupReminder);
  backupReminderLaterButton.addEventListener("click", closeBackupReminder);
  backupReminderExportButton.addEventListener("click", () => {
    exportSessions();
    closeBackupReminder();
  });
  backupReminderSaveLocalButton.addEventListener("click", async () => {
    const didSave = await saveSessionsToLocalFile();
    if (didSave) {
      closeBackupReminder();
    }
  });
  aiSettingsNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveAiSettingsSection(button.dataset.aiSettingsTab);
    });
  });
  modelOptions.addEventListener("click", (event) => {
    const option = event.target.closest(".model-option");
    if (!option) {
      return;
    }

    modelSelect.value = option.dataset.modelId;
    persistAiSettings();
  });

  transcriptionModelOptions?.addEventListener("click", (event) => {
    const option = event.target.closest(".model-option");
    if (!option) {
      return;
    }

    const nextModelId = option.dataset.transcriptionModelId;
    if (!nextModelId) {
      return;
    }

    transcriptionModelSelect.value = resolveSelectedTranscriptionModel(nextModelId);
    persistAiSettings();
  });

  aiSettingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    closeAiSettings({ returnToSettings: true });
  });

  apiKeyInput.addEventListener("input", () => {
    persistAiSettings();
  });

  dictationLanguageSelect.addEventListener("change", () => {
    settings.dictationLanguage = dictationLanguageSelect.value;
    persistSettings();
    currentDictationLanguage = resolveDictationLanguage(rawNotesInput.value.trim() || navigator.language);

    if (recognition && !isRecording) {
      recognition.lang = currentDictationLanguage;
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settingsModal.classList.contains("is-hidden")) {
      closeSettings();
    }

    if (event.key === "Escape" && !instructionsModal.classList.contains("is-hidden")) {
      closeInstructions();
    }

    if (event.key === "Escape" && !aiSettingsModal.classList.contains("is-hidden")) {
      closeAiSettings();
    }

    if (event.key === "Escape" && !backupReminderModal.classList.contains("is-hidden")) {
      closeBackupReminder();
    }

    if (event.key === "Escape" && !backupPanelModal.classList.contains("is-hidden")) {
      closeBackupPanel();
    }

    if (event.key === "Escape" && !recordingsModal.classList.contains("is-hidden")) {
      closeRecordingsModal();
    }

    if (event.key === "Escape" && !todoPanelModal.classList.contains("is-hidden")) {
      closeTodoPanel();
    }

    if (event.key === "Escape" && !todoDetailModal.classList.contains("is-hidden")) {
      closeTodoDetailModal();
    }

    if (event.key === "Escape" && !workspacePanelModal.classList.contains("is-hidden")) {
      closeWorkspacePanel();
    }

    if (event.key === "Escape" && !confirmModal.classList.contains("is-hidden")) {
      closeConfirmModal(false);
    }

    if (event.key === "Escape" && (mobileMoreSheetOpen || mobileOutputSheetOpen)) {
      closeMobileSheets();
    }

    if (event.key === "Escape" && getRecentSessionsExpanded()) {
      setRecentSessionsExpanded(false);
    }
  });

  window.addEventListener("resize", () => {
    updateRecentSessionsPanelUi();
    syncMobileUi();
  });
  MOBILE_LAYOUT_QUERY.addEventListener("change", syncMobileUi);

  [
    meetingTitleInput,
    templateSelect,
    participantsInput,
    meetingDateInput,
    meetingStartTimeInput,
    meetingEndTimeInput,
    rawNotesInput,
  ].forEach((field) => {
    field.addEventListener("input", () => {
      const session = getActiveSession();
      const patch = {
        [field.id === "meeting-title"
          ? "title"
          : field.id === "meeting-template"
            ? "template"
            : field.id === "participants"
              ? "participants"
              : field.id === "meeting-date"
                ? "meetingDate"
                : field.id === "meeting-start-time"
                  ? "meetingStartTime"
                    : field.id === "meeting-end-time"
                      ? "meetingEndTime"
              : "rawNotes"]: field.value,
      };

      const nextSession = {
        ...session,
        ...patch,
      };

      if (
        session.template === "oneToOneCall"
        && field.id !== "meeting-title"
        && (!session.title.trim() || isAutoGeneratedTitle(session.title))
      ) {
        patch.title = getDefaultTitleForTemplate(getTemplateDefinition(session.template), Date.now(), nextSession);
        meetingTitleInput.value = patch.title;
      }

      updateActiveSession(patch, true);

      if (field.id === "participants") {
        renderParticipantSuggestions();
      }
    });
  });

  meetingAgendaInput.addEventListener("input", () => {
    const richTextValue = getRichTextContent(meetingAgendaInput);
    setRichTextContent(meetingAgendaInput, richTextValue);
    updateActiveSession({ agenda: richTextValue }, true);
  });

  document.querySelectorAll(".rich-text-command[data-target=\"meeting-agenda\"]").forEach((button) => {
    button.addEventListener("click", () => {
      applyRichTextCommand(meetingAgendaInput, button.dataset.command);
      updateActiveSession({ agenda: getRichTextContent(meetingAgendaInput) }, true);
    });
  });

  uploadedTranscriptInput.addEventListener("input", () => {
    updateActiveSession({ uploadedTranscript: uploadedTranscriptInput.value }, true);
    applyTemplateUi(getActiveSession());
  });

  templateCustomFieldsContainer.addEventListener("input", (event) => {
    const input = event.target.closest(".template-custom-field-input");
    if (!input) {
      return;
    }

    const session = getActiveSession();
    updateActiveSession({
      customFieldValues: {
        ...(session.customFieldValues || {}),
        [input.dataset.customFieldId]: input.value,
      },
    }, true);
  });

  templateSelect.addEventListener("change", () => {
    applySelectedTemplate(templateSelect.value);
  });

  [
    transcribeOnlyInput,
    includeAgendaInput,
    includeSummaryInput,
    includeHighlightsInput,
    includeDecisionsInput,
    includeActionsInput,
  ].forEach((input) => {
    input.addEventListener("change", () => {
      updateActiveSession({
        transcribeOnly: transcribeOnlyInput.checked,
        sections: {
          includeAgenda: includeAgendaInput.checked,
          includeSummary: includeSummaryInput.checked,
          includeHighlights: includeHighlightsInput.checked,
          includeDecisions: includeDecisionsInput.checked,
          includeActions: includeActionsInput.checked,
        },
      }, true);
    });
  });

  templateSectionList?.addEventListener("change", (event) => {
    const input = event.target.closest(".template-section-include");
    if (!input) {
      return;
    }

    const session = getActiveSession();
    const sectionId = input.dataset.sectionId;

    updateActiveSession({
      templateSectionStates: {
        ...(session.templateSectionStates || {}),
        [sectionId]: input.checked,
      },
    }, true);
  });

  outputLanguageSelect.addEventListener("change", () => {
    updateActiveSession({ outputLanguage: outputLanguageSelect.value }, true);
  });

  detailLevelInput.addEventListener("input", () => {
    updateDetailLevelLabel();
    updateActiveSession({ detailLevel: Number(detailLevelInput.value) }, true);
  });

  additionalInstructionsInput.addEventListener("input", () => {
    updateActiveSession({ additionalInstructions: additionalInstructionsInput.value }, true);
  });

  addCustomHeaderButton.addEventListener("click", () => {
    setElementVisibility(customHeaderAddForm, true);
    newCustomHeaderTitleInput.focus();
  });

  saveCustomHeaderButton.addEventListener("click", () => {
    const title = newCustomHeaderTitleInput.value.trim();
    const instructions = newCustomHeaderInstructionsInput.value.trim();

    if (!title) {
      newCustomHeaderTitleInput.focus();
      return;
    }

    const session = getActiveSession();
    const nextHeaders = [
      ...session.customHeaders,
      createCustomHeader(title, instructions),
    ];
    updateActiveSession({ customHeaders: nextHeaders }, true);
    resetCustomHeaderAddForm();
  });

  cancelCustomHeaderButton.addEventListener("click", () => {
    resetCustomHeaderAddForm();
  });

  customHeaderList.addEventListener("input", (event) => {
    const target = event.target;
    const item = target.closest(".custom-header-item");
    if (!item) {
      return;
    }

    const index = Number(item.dataset.index);
    const session = getActiveSession();
    const nextHeaders = session.customHeaders.map((header, currentIndex) => {
      if (currentIndex !== index) {
        return header;
      }

      return {
        ...header,
        include: item.querySelector(".custom-header-include").checked,
        title: item.querySelector(".custom-header-title").value,
        instructions: item.querySelector(".custom-header-instructions").value,
        isExpanded: !item.querySelector(".custom-header-editor").classList.contains("is-hidden-field"),
      };
    });
    updateActiveSessionSilently({ customHeaders: nextHeaders });
  });

  customHeaderList.addEventListener("click", (event) => {
    const editButton = event.target.closest(".custom-header-edit");
    if (editButton) {
      const item = editButton.closest(".custom-header-item");
      const editor = item?.querySelector(".custom-header-editor");
      const isOpen = !editor.classList.contains("is-hidden-field");
      const nextOpen = !isOpen;
      setElementVisibility(editor, nextOpen);
      editButton.textContent = nextOpen ? "Close" : "Edit";
      const index = Number(item.dataset.index);
      const session = getActiveSession();
      const nextHeaders = session.customHeaders.map((header, currentIndex) => {
        if (currentIndex !== index) {
          return header;
        }

        return {
          ...header,
          isExpanded: nextOpen,
        };
      });
      updateActiveSessionSilently({ customHeaders: nextHeaders });
      if (nextOpen) {
        item.querySelector(".custom-header-title")?.focus();
      }
      return;
    }

    const removeButton = event.target.closest(".custom-header-remove");
    if (!removeButton) {
      return;
    }

    const item = removeButton.closest(".custom-header-item");
    const index = Number(item.dataset.index);
    const session = getActiveSession();
    const nextHeaders = session.customHeaders.filter((_, currentIndex) => currentIndex !== index);
    updateActiveSession({ customHeaders: nextHeaders }, true);
  });

  highlightsInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const value = highlightsInput.value.trim();

    if (!value) {
      return;
    }

    const session = getActiveSession();
    const nextHighlights = [...new Set([...session.highlights, value])];
    updateActiveSession({ highlights: nextHighlights }, true);
    highlightsInput.value = "";
  });

  polishButton.addEventListener("click", async () => {
    let session = getActiveSession();
    polishButton.disabled = true;
    polishButton.textContent = "Generating output...";
    polishButton.classList.add("is-busy");
    setAppStatus("Generating", APP_STATUS_STATES.generating);

    try {
      const pendingAudioDraft = await getAudioDraft(session.id);
      const shouldAutoTranscribePendingAudio = Boolean(pendingAudioDraft) && !hasTextInputForGeneration(session);
      if (shouldAutoTranscribePendingAudio) {
        if (!settings.apiKey) {
          throw new Error("Recorded audio is available, but it has not been transcribed yet. Add an OpenAI API key and click \"Transcribe audio\" first.");
        }

        audioCaptureStatus.textContent = "Transcribing recorded audio before generation...";
        const transcriptText = await transcribeAudioDraftWithOpenAI(pendingAudioDraft, settings, {
          onProgress: (message) => {
            audioCaptureStatus.textContent = message;
          },
        });
        const nextTranscript = [session.liveTranscript?.trim(), transcriptText.trim()]
          .filter(Boolean)
          .join("\n\n");

        updateActiveSession({ liveTranscript: nextTranscript }, true);
        liveTranscriptInput.value = nextTranscript;
        setTranscriptFieldState("live", "transcribed", "Transcribed audio");
        revealTranscriptSurface("live");
        await clearAudioDraft(session.id);
        audioCaptureStatus.textContent = "Recorded audio was transcribed and added to the Live transcript field.";
        session = getActiveSession();
      } else if (pendingAudioDraft) {
        audioCaptureStatus.textContent = "Using the notes and transcript already in this session. Pending audio was not auto-transcribed.";
      }

      const polishedHtml = settings.apiKey
        ? await polishWithOpenAI(session, settings)
        : buildLocalPolishedNotes(session);

      updateActiveSession({ polishedHtml }, false);
      syncTodoItemsFromSession(getActiveSession());
      renderOutput();
      const addedParticipants = await maybeOfferParticipantDirectoryUpdate(getActiveSession().participants);
      if (isMobileLayout()) {
        openMobileOutputSheet();
      } else {
        setDesktopWorkspaceView("output");
      }
      const generationStatus = settings.apiKey
        ? (session.transcribeOnly ? "AI transcription complete." : "AI polishing complete.")
        : session.outputLanguage && session.outputLanguage !== "auto"
          ? "No API key found in AI Settings, so a local polish pass was used. Language translation requires AI polishing."
          : (session.transcribeOnly ? "No API key found in AI Settings, so a local transcription cleanup was used instead." : "No API key found in AI Settings, so a local polish pass was used instead.");
      dictationStatus.textContent = addedParticipants
        ? `${generationStatus} Added ${addedParticipants} ${addedParticipants === 1 ? "participant" : "participants"} to the saved list.`
        : generationStatus;
    } catch (error) {
      if (settings.apiKey) {
        dictationStatus.textContent = session.transcribeOnly
          ? `AI transcription failed: ${error.message}. No local fallback was applied.`
          : `AI polishing failed: ${error.message}. No local fallback was applied, so the output was not replaced with a weaker local draft.`;
      } else {
        const polishedHtml = buildLocalPolishedNotes(session);
        updateActiveSession({ polishedHtml }, false);
        syncTodoItemsFromSession(getActiveSession());
        renderOutput();
        const addedParticipants = await maybeOfferParticipantDirectoryUpdate(getActiveSession().participants);
        if (isMobileLayout()) {
          openMobileOutputSheet();
        } else {
          setDesktopWorkspaceView("output");
        }
        const fallbackStatus = session.transcribeOnly
          ? `AI transcription failed: ${error.message}. A local transcription cleanup was used instead.`
          : `AI polishing failed: ${error.message}. A local polish pass was used instead.`;
        dictationStatus.textContent = addedParticipants
          ? `${fallbackStatus} Added ${addedParticipants} ${addedParticipants === 1 ? "participant" : "participants"} to the saved list.`
          : fallbackStatus;
      }
    } finally {
      polishButton.disabled = false;
      polishButton.textContent = "Generate";
      polishButton.classList.remove("is-busy");
      setAppStatus("Saved locally", APP_STATUS_STATES.idle);
    }
  });

  dictationToggle.addEventListener("click", toggleDictation);

  audioRecordToggle.addEventListener("click", () => {
    toggleAudioCapture("room");
  });

  audioScreenToggle?.addEventListener("click", () => {
    toggleAudioCapture("screen");
  });

  uploadAudioButton.addEventListener("click", () => {
    audioFileInput.click();
  });
  manageRecordingsButton?.addEventListener("click", openRecordingsModal);

  uploadTranscriptButton.addEventListener("click", () => {
    transcriptFileInput.click();
  });

  audioFileInput.addEventListener("change", async () => {
    const [file] = [...audioFileInput.files];
    if (!file) {
      return;
    }

    try {
      await setAudioDraft({
        blob: file,
        fileName: file.name || `audio-upload-${Date.now()}.webm`,
        mimeType: file.type || "audio/webm",
        size: file.size,
        source: "upload",
      });
    } catch {
      audioCaptureStatus.textContent = "The audio file could not be saved locally for later transcription.";
    }
    audioFileInput.value = "";
  });

  transcriptFileInput.addEventListener("change", async () => {
    const [file] = [...transcriptFileInput.files];
    if (!file) {
      return;
    }

    try {
      const transcriptText = await readTranscriptFile(file);
      updateActiveSession({ uploadedTranscript: transcriptText }, false);
      syncFieldsFromSession();
      setElementVisibility(uploadedTranscriptDisclosure, true);
      if (uploadedTranscriptDisclosure) {
        uploadedTranscriptDisclosure.open = true;
      }
      applyTemplateUi(getActiveSession());
      revealTranscriptSurface("uploaded", { focus: true });
      audioCaptureStatus.textContent = `Transcript uploaded from ${file.name} and added to the Transcript field.`;
    } catch (error) {
      audioCaptureStatus.textContent = error.message || "That transcript file could not be read in this browser.";
    } finally {
      transcriptFileInput.value = "";
    }
  });

  transcribeAudioButton.addEventListener("click", async () => {
    const session = getActiveSession();
    const audioDraft = await getAudioDraft(session.id);
    let wasSuccessful = false;

    if (!audioDraft) {
      audioCaptureStatus.textContent = "Record or upload audio first, then transcribe it.";
      return;
    }

    if (!settings.apiKey) {
      audioCaptureStatus.textContent = "Add an OpenAI API key in AI Settings before transcribing recorded or uploaded audio.";
      return;
    }

    transcribeAudioButton.disabled = true;
    transcribeAudioButton.textContent = "Transcribing...";
    setAppStatus("Generating", APP_STATUS_STATES.generating);
    audioCaptureStatus.textContent = "Transcribing the selected audio and adding it to the Live transcript field...";

    try {
      const transcriptText = await transcribeAudioDraftWithOpenAI(audioDraft, settings, {
        onProgress: (message) => {
          audioCaptureStatus.textContent = message;
        },
      });
      const nextTranscript = [session.liveTranscript?.trim(), transcriptText.trim()]
        .filter(Boolean)
        .join("\n\n");

      updateActiveSession({ liveTranscript: nextTranscript }, true);
      liveTranscriptInput.value = nextTranscript;
      setTranscriptFieldState("live", "transcribed", "Transcribed audio");
      revealTranscriptSurface("live");
      dictationStatus.textContent = `Audio transcription complete with ${getTranscriptionModelLabel(settings.transcriptionModel)}.`;
      await clearAudioDraft(session.id);
      audioCaptureStatus.textContent = "Audio transcription complete. The transcript has been added to the Live transcript field.";
      wasSuccessful = true;
    } catch (error) {
      audioCaptureStatus.textContent = `Audio transcription failed: ${error.message}`;
    } finally {
      transcribeAudioButton.textContent = "Transcribe audio";
      if (!wasSuccessful) {
        syncAudioCaptureUi(getActiveSession());
      }
      setAppStatus("Saved locally", APP_STATUS_STATES.idle);
    }
  });

  copyOutputButton.addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session.polishedHtml) {
      dictationStatus.textContent = "Create polished notes first, then copy them from here.";
      return;
    }

    const textVersion = polishedOutput.innerText.trim();

    try {
      await navigator.clipboard.writeText(textVersion);
      dictationStatus.textContent = "Polished notes copied to your clipboard.";
    } catch {
      dictationStatus.textContent = "Clipboard access was blocked. You can still select and copy the text manually.";
    }
  });

  exportWordButton.addEventListener("click", () => {
    exportCurrentSessionAsWord();
  });

  exportPdfButton.addEventListener("click", () => {
    exportCurrentSessionAsPdf();
  });

  translateOutputButton.addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session?.polishedHtml) {
      outputFeedbackStatus.textContent = "Generate output first, then translate it from here.";
      return;
    }

    if (!settings.apiKey) {
      outputFeedbackStatus.textContent = "Add an OpenAI API key in AI Settings to translate the output.";
      return;
    }

    const currentLanguage = detectOutputContentLanguage(session);
    const targetLanguage = getOppositeOutputLanguage(currentLanguage);
    const targetLabel = getOutputLanguageLabel(targetLanguage);
    const previousLabel = translateOutputButton.textContent;

    translateOutputButton.disabled = true;
    translateOutputButton.textContent = `Translating to ${targetLabel}...`;
    outputFeedbackStatus.textContent = `Translating the current output to ${targetLabel}...`;
    setAppStatus("Generating", APP_STATUS_STATES.generating);

    try {
      const translatedHtml = await translateOutputWithOpenAI(session, settings, targetLanguage);
      updateActiveSession({
        polishedHtml: translatedHtml,
        previousPolishedHtml: session.polishedHtml,
        outputLanguage: targetLanguage === OUTPUT_LANGUAGES.swedish ? "sv" : "en",
      }, false);
      renderOutput();
      if (isMobileLayout()) {
        openMobileOutputSheet();
      }
      outputFeedbackStatus.textContent = `Output translated to ${targetLabel}. You can revert to the previous version if needed.`;
    } catch (error) {
      outputFeedbackStatus.textContent = `Could not translate the output: ${error.message}`;
    } finally {
      translateOutputButton.disabled = false;
      translateOutputButton.textContent = previousLabel;
      setAppStatus("Saved locally", APP_STATUS_STATES.idle);
      updateExportButtons();
    }
  });

  outputFeedbackInput.addEventListener("input", () => {
    updateActiveSession({ outputFeedback: outputFeedbackInput.value }, true);
  });

  polishedOutput.addEventListener("input", () => {
    const session = getActiveSession();
    if (!session?.polishedHtml) {
      return;
    }

    updateActiveSessionSilently({ polishedHtml: polishedOutput.innerHTML });
    updateExportButtons();
    outputFeedbackStatus.textContent = "Output edits are saved automatically.";
  });

  improveOutputButton.addEventListener("click", async () => {
    const session = getActiveSession();
    const feedback = outputFeedbackInput.value.trim();

    if (!session.polishedHtml) {
      outputFeedbackStatus.textContent = "Create polished notes first, then request improvements.";
      return;
    }

    if (!feedback) {
      outputFeedbackStatus.textContent = "Add a short comment describing how the output should improve.";
      return;
    }

    improveOutputButton.disabled = true;
    improveOutputButton.textContent = "Updating...";
    outputFeedbackStatus.textContent = "Updating the polished output based on your comments...";

    try {
      const revisedHtml = settings.apiKey
        ? await revisePolishedNotesWithOpenAI(session, settings, feedback)
        : buildRevisedLocalPolishedNotes(session, feedback);

      updateActiveSession({
        polishedHtml: revisedHtml,
        previousPolishedHtml: session.polishedHtml,
        outputFeedback: "",
      }, false);
      renderOutput();
      if (isMobileLayout()) {
        openMobileOutputSheet();
      }
      outputFeedbackStatus.textContent = settings.apiKey
        ? "Updated output is ready. You can revert to the previous version if needed."
        : "A local revision was generated from your comments. You can revert to the previous version if needed.";
    } catch (error) {
      outputFeedbackStatus.textContent = `Could not update the output: ${error.message}`;
    } finally {
      improveOutputButton.disabled = false;
      improveOutputButton.textContent = "Update Output";
    }
  });

  revertOutputButton.addEventListener("click", () => {
    const session = getActiveSession();
    if (!session.previousPolishedHtml) {
      outputFeedbackStatus.textContent = "There is no previous polished version to revert to.";
      return;
    }

    updateActiveSession({
      polishedHtml: session.previousPolishedHtml,
      previousPolishedHtml: "",
    }, false);
    renderOutput();
    if (isMobileLayout()) {
      openMobileOutputSheet();
    }
    outputFeedbackStatus.textContent = "Reverted to the previous polished version.";
  });
}

bindMobileStatusMirrors();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    checkForRemoteAppUpdate().catch(() => {
      // Ignore version check failures when service workers are unavailable.
    });
    return;
  }

  window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").then((registration) => {
        serviceWorkerRegistration = registration;
        bindServiceWorkerRegistration(registration);
      registration.update().catch(() => {
        // Keep the app functional even if update checks fail.
      });
      checkForRemoteAppUpdate().catch(() => {
        // Ignore version check failures and keep the local app usable.
      });
    }).catch(() => {
      // Keep the app functional even if the service worker cannot be registered.
      checkForRemoteAppUpdate().catch(() => {
        // Ignore version check failures and keep the local app usable.
      });
      });
    });
  window.addEventListener("focus", () => {
    maybeRefreshAiModelCatalog();
    if (serviceWorkerRegistration) {
      serviceWorkerRegistration.update().catch(() => {
        // Ignore focus refresh failures.
      });
    }
    checkForRemoteAppUpdate().catch(() => {
      // Ignore focus version check failures.
    });
  });
}

function bindServiceWorkerRegistration(registration) {
  clearAppUpdateAvailable();

  if (registration.waiting) {
    markAppUpdateAvailable();
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) {
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        markAppUpdateAvailable();
      }
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isRefreshingForUpdate) {
      return;
    }

    isRefreshingForUpdate = true;
    window.location.reload();
  });

  window.setInterval(() => {
    registration.update().catch(() => {
      // Ignore background refresh failures.
    });
    checkForRemoteAppUpdate().catch(() => {
      // Ignore background version check failures.
    });
  }, REMOTE_VERSION_CHECK_INTERVAL_MS);
}

function markAppUpdateAvailable(nextVersion = latestRemoteVersion) {
  hasPendingAppUpdate = true;
  latestRemoteVersion = nextVersion || latestRemoteVersion;
  if (appUpdateNotice) {
    appUpdateNotice.classList.remove("is-hidden-field");
    appUpdateNotice.textContent = latestRemoteVersion && latestRemoteVersion !== APP_VERSION
      ? `New version: ${latestRemoteVersion}`
      : "New version available";
  }
  updateAppButton.classList.remove("is-hidden-field");
  updateAppButton.textContent = latestRemoteVersion && latestRemoteVersion !== APP_VERSION
    ? `Refresh app (${latestRemoteVersion})`
    : "Refresh app";
  setAppStatus("Update available", APP_STATUS_STATES.warning);
}

function clearAppUpdateAvailable() {
  hasPendingAppUpdate = false;
  latestRemoteVersion = APP_VERSION;
  if (appUpdateNotice) {
    appUpdateNotice.classList.add("is-hidden-field");
    appUpdateNotice.textContent = "New version available";
  }
  updateAppButton.classList.add("is-hidden-field");
  updateAppButton.textContent = "Refresh app";
  if (saveStatus.textContent === "Update available") {
    setAppStatus("Saved locally", APP_STATUS_STATES.idle);
  }
}

function setAppStatus(label, state = APP_STATUS_STATES.idle) {
  saveStatus.textContent = label;
  saveStatus.dataset.state = state;
  syncMobileUi();
}

function applyCurrentTheme() {
  applyTheme(settings.themeFamily, settings.themeMode);
}

function applyLatestAppUpdate() {
  if (!serviceWorkerRegistration) {
    forceReloadLatestVersion();
    return;
  }

  if (serviceWorkerRegistration.waiting) {
    setAppStatus("Updating app", APP_STATUS_STATES.updating);
    serviceWorkerRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }

  if (hasPendingAppUpdate) {
    setAppStatus("Reloading latest version", APP_STATUS_STATES.updating);
    forceReloadLatestVersion();
    return;
  }

  setAppStatus("Checking for updates", APP_STATUS_STATES.updating);
  serviceWorkerRegistration.update()
    .then(() => {
      if (serviceWorkerRegistration.waiting) {
        setAppStatus("Updating app", APP_STATUS_STATES.updating);
        serviceWorkerRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      setAppStatus("Refreshing latest version", APP_STATUS_STATES.updating);
      forceReloadLatestVersion();
    })
    .catch(() => {
      setAppStatus("Trying a full refresh", APP_STATUS_STATES.updating);
      forceReloadLatestVersion();
    });
}

async function forceReloadLatestVersion() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  } catch {
    // If cleanup fails, still attempt a reload so the user is not blocked.
  }

  const reloadUrl = new URL(window.location.href);
  reloadUrl.searchParams.set("refresh", String(Date.now()));
  window.location.replace(reloadUrl.toString());
}

async function checkForRemoteAppUpdate() {
  const remoteVersion = await fetchRemoteAppVersion();
  if (!remoteVersion) {
    return;
  }

  latestRemoteVersion = remoteVersion;
  if (compareAppVersions(remoteVersion, APP_VERSION) <= 0) {
    return;
  }

  markAppUpdateAvailable(remoteVersion);
  if (canAutoApplyUpdate()) {
    setAppStatus("Updating app", APP_STATUS_STATES.updating);
    window.setTimeout(() => {
      if (hasPendingAppUpdate && !isRefreshingForUpdate) {
        applyLatestAppUpdate();
      }
    }, 900);
  }
}

async function fetchRemoteAppVersion() {
  const requestUrl = new URL("./app.js", window.location.href);
  requestUrl.searchParams.set("version-check", String(Date.now()));

  const response = await fetch(requestUrl.toString(), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const source = await response.text();
  const match = source.match(/const APP_VERSION = "([^"]+)";/);
  return match?.[1] || "";
}

function compareAppVersions(left, right) {
  const normalize = (value) => String(value || "")
    .replace(/^[^\d]*/, "")
    .split(".")
    .map((part) => Number(part.replace(/[^\d]/g, "")) || 0);

  const leftParts = normalize(left);
  const rightParts = normalize(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

function canAutoApplyUpdate() {
  const currentState = saveStatus.dataset.state || APP_STATUS_STATES.idle;
  return !isRecording
    && ![APP_STATUS_STATES.generating, APP_STATUS_STATES.saving, APP_STATUS_STATES.updating].includes(currentState);
}

function render() {
  applyCurrentTheme();
  renderTemplateOptions();
  renderTemplateQuickSelectors();
  renderSessionList();
  renderTodoList();
  syncFieldsFromSession();
  renderHighlights();
  renderParticipantSuggestions();
  renderTemplateSectionOptions();
  renderCustomHeaders();
  renderOutput();
  syncAudioCaptureUi();
  updateSessionStorageUi();
  updateExportButtons();
  syncSettingsForm();
  updateRecentSessionsPanelUi();
  syncMobileUi();
}

function renderTemplateOptions() {
  const activeTemplateId = getActiveSession()?.template || "meeting";
  const customTemplates = (settings.customTemplates || []).filter((template) => template?.id);
  const currentValue = templateSelect.value;

  templateSelect.innerHTML = "";

  const standardGroup = document.createElement("optgroup");
  standardGroup.label = "Standard";

  Object.values(BUILT_IN_TEMPLATES).forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.label;
    standardGroup.appendChild(option);
  });

  templateSelect.appendChild(standardGroup);

  if (customTemplates.length) {
    const customGroup = document.createElement("optgroup");
    customGroup.label = "My templates";

    customTemplates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.label || "Untitled template";
      customGroup.appendChild(option);
    });

    templateSelect.appendChild(customGroup);
  }

  templateSelect.value = getTemplateDefinition(activeTemplateId).id || currentValue || "meeting";
  renderDuplicateTemplateOptions();
  renderTemplateLauncherVisibilityOptions();
}

function renderDuplicateTemplateOptions() {
  if (!duplicateTemplateSourceSelect) {
    return;
  }

  const currentValue = duplicateTemplateSourceSelect.value;
  duplicateTemplateSourceSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose template to duplicate";
  duplicateTemplateSourceSelect.appendChild(placeholder);

  const standardGroup = document.createElement("optgroup");
  standardGroup.label = "Standard";
  Object.values(BUILT_IN_TEMPLATES).forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.label;
    standardGroup.appendChild(option);
  });
  duplicateTemplateSourceSelect.appendChild(standardGroup);

  if ((settings.customTemplates || []).length) {
    const customGroup = document.createElement("optgroup");
    customGroup.label = "My templates";
    settings.customTemplates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.label || "Untitled template";
      customGroup.appendChild(option);
    });
    duplicateTemplateSourceSelect.appendChild(customGroup);
  }

  if (getAllTemplates().some((template) => template.id === currentValue)) {
    duplicateTemplateSourceSelect.value = currentValue;
  }
}

function renderTemplateLauncherVisibilityOptions() {
  if (!templateLauncherVisibilityList) {
    return;
  }

  settings.templateLauncherTemplateIds = normalizeTemplateLauncherIds(settings.templateLauncherTemplateIds);
  templateLauncherVisibilityList.innerHTML = "";

  getAllTemplates().forEach((template) => {
    const label = document.createElement("label");
    label.className = "config-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = template.id;
    input.checked = settings.templateLauncherTemplateIds.includes(template.id);
    input.addEventListener("change", () => {
      const nextIds = input.checked
        ? [...settings.templateLauncherTemplateIds, template.id]
        : settings.templateLauncherTemplateIds.filter((templateId) => templateId !== template.id);
      settings.templateLauncherTemplateIds = normalizeTemplateLauncherIds(nextIds);
      persistSettings();
      renderTemplateQuickSelectors();
      renderTemplateLauncherVisibilityOptions();
    });

    const copy = document.createElement("span");
    copy.textContent = template.label || "Untitled template";

    label.appendChild(input);
    label.appendChild(copy);
    templateLauncherVisibilityList.appendChild(label);
  });
}

function normalizeTemplateUsageCounts(input) {
  if (!input || typeof input !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => typeof key === "string" && key && Number.isFinite(value) && Number(value) > 0)
      .map(([key, value]) => [key, Number(value)])
  );
}

function normalizeTemplateLauncherIds(input, availableTemplateIds = null) {
  if (!Array.isArray(input)) {
    return ["meeting", "oneToOneCall", "personalNote"];
  }

  const validTemplateIds = new Set(
    Array.isArray(availableTemplateIds) && availableTemplateIds.length
      ? availableTemplateIds
      : getAllTemplates().map((template) => template.id)
  );
  const seen = new Set();

  const normalized = input
    .filter((templateId) => typeof templateId === "string" && templateId && validTemplateIds.has(templateId))
    .filter((templateId) => {
      if (seen.has(templateId)) {
        return false;
      }
      seen.add(templateId);
      return true;
    });

  return normalized.length ? normalized : ["meeting", "oneToOneCall", "personalNote"].filter((templateId) => validTemplateIds.has(templateId));
}

function getPreferredDesktopTemplateId() {
  return "meeting";
}

function recordTemplateUsage(templateId) {
  if (!templateId) {
    return;
  }

  settings.templateUsageCounts = normalizeTemplateUsageCounts(settings.templateUsageCounts);
  settings.templateUsageCounts[templateId] = (settings.templateUsageCounts[templateId] || 0) + 1;
  persistSettings();
}

function applySelectedTemplate(templateId, options = {}) {
  const currentSession = getActiveSession();
  const template = getTemplateDefinition(templateId);
  const behaviorId = getTemplateBehaviorId(template);
  const shouldRecordUsage = options.recordUsage !== false;

  if (shouldRecordUsage) {
    recordTemplateUsage(template.id);
  }

  const defaultSchedule = getDefaultMeetingScheduleForTemplate(template);
  const patch = {
    template: template.id,
    transcribeOnly: getDefaultTranscribeOnlyForTemplate(template),
    templateSectionStates: normalizeTemplateSectionStates({}, template.headers || []),
    customFieldValues: normalizeCustomFieldValues({}, template.customFields || []),
  };

  if (behaviorId === "oneToOneCall" || behaviorId === "personalNote") {
      if (!currentSession.meetingDate) {
        patch.meetingDate = defaultSchedule.meetingDate;
      }
      if (!currentSession.meetingStartTime) {
        patch.meetingStartTime = defaultSchedule.meetingStartTime;
      }
      patch.meetingEndTime = "";
  }

  if (!currentSession.title.trim() || isAutoGeneratedTitle(currentSession.title)) {
    patch.title = getDefaultTitleForTemplate(template, Date.now(), {
      ...currentSession,
      ...patch,
    });
    meetingTitleInput.value = patch.title;
  }

  templateSelect.value = template.id;
  transcribeOnlyInput.checked = patch.transcribeOnly;
  updateActiveSession(patch, true);
  applyTemplateUi({ ...currentSession, ...patch });
  dictationStatus.textContent = patch.transcribeOnly
    ? `Template selected: ${template.label}. This session will generate a cleaned transcript by default.`
    : `Template selected: ${template.label}. Click "Generate" whenever you want a professional summary.`;
}

function renderTemplateQuickSelectors() {
  if (!templateQuickSelectors) {
    return;
  }

  settings.templateLauncherTemplateIds = normalizeTemplateLauncherIds(settings.templateLauncherTemplateIds);
  const preferredOrder = ["meeting", "personalNote", "oneToOneCall"];
  const rankedTemplates = getAllTemplates()
    .filter((template) => settings.templateLauncherTemplateIds.includes(template.id))
    .slice()
    .sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left.id);
      const rightIndex = preferredOrder.indexOf(right.id);
      const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      if (normalizedLeftIndex !== normalizedRightIndex) {
        return normalizedLeftIndex - normalizedRightIndex;
      }
      return left.label.localeCompare(right.label);
    });

  templateQuickSelectors.innerHTML = "";

  rankedTemplates.forEach((template) => {
    if (!template) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button template-quick-button";
    button.textContent = `New ${template.label}`;
    button.addEventListener("click", () => {
      createAndOpenNewSession(template.id);
    });
    templateQuickSelectors.appendChild(button);
  });
}

function renderSessionList() {
  sessionList.innerHTML = "";
  sessionFilterInput.value = sessionFilterQuery;
  const visibleSessions = getVisibleSessions();
  selectedSessionIds = new Set(Array.from(selectedSessionIds).filter((sessionId) => sessions.some((session) => session.id === sessionId)));

    visibleSessions.forEach((session) => {
      const fragment = sessionItemTemplate.content.cloneNode(true);
      const selectInput = fragment.querySelector(".session-select");
      const button = fragment.querySelector(".session-button");
      const deleteButton = fragment.querySelector(".session-delete");
      const name = fragment.querySelector(".session-name");
      const meta = fragment.querySelector(".session-meta");
      const preview = fragment.querySelector(".session-preview");

      name.textContent = session.title.trim() || "Untitled session";
      meta.textContent = `${getTemplateDefinition(session.template).label} · ${formatDate(session.updatedAt)} ${formatTime(session.updatedAt)}`;
      preview.textContent = buildSessionPreview(session);
      button.classList.toggle("is-active", session.id === activeSessionId);
      selectInput.checked = selectedSessionIds.has(session.id);

    selectInput.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    selectInput.addEventListener("change", () => {
      if (selectInput.checked) {
        selectedSessionIds.add(session.id);
      } else {
        selectedSessionIds.delete(session.id);
      }
      updateSessionSelectionControls(visibleSessions);
    });

      button.addEventListener("click", () => {
        if (audioRecordingSessionId) {
          void stopAudioCapture();
        }
        activeSessionId = session.id;
        persistSettings();
        render();
      });

    deleteButton.addEventListener("click", async () => {
      const sessionName = session.title.trim() || "Untitled session";
      const confirmed = await showConfirmModal({
        eyebrow: "Delete session",
        title: "Delete this session?",
        message: `Are you sure you want to delete "${sessionName}"? This cannot be undone.`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
      });

      if (!confirmed) {
        return;
      }

      deleteSession(session.id);
    });

    sessionList.appendChild(fragment);
  });

  emptySessions.classList.toggle("is-visible", visibleSessions.length === 0);
  emptySessions.querySelector("p").textContent = sessionFilterQuery
    ? "No sessions match your filter yet. Try a different search."
    : "No saved sessions yet. Start with a fresh note and it will appear here automatically.";
  updateSessionSelectionControls(visibleSessions);
}

function renderTodoList() {
  if (!todoList || !emptyTodos || !todoItemTemplate) {
    return;
  }

  if (todoFilterInput) {
    todoFilterInput.value = todoFilterQuery;
  }

  const items = normalizeTodoItems(settings.todoItems)
    .filter((item) => {
      if (!todoFilterQuery) {
        return true;
      }

      const searchableText = [
        item.description,
        item.addedAt,
        item.comments,
        ...normalizeTodoSessionRefs(item.sessionRefs).map((ref) => ref.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(todoFilterQuery);
    })
    .slice()
    .sort((left, right) => {
      const leftSessions = normalizeTodoSessionRefs(left.sessionRefs).map((ref) => ref.title).join(", ");
      const rightSessions = normalizeTodoSessionRefs(right.sessionRefs).map((ref) => ref.title).join(", ");
      const leftValue = todoSortKey === "completed"
        ? Number(left.completed)
        : todoSortKey === "description"
          ? left.description
          : todoSortKey === "sessions"
              ? leftSessions
              : left.addedAt;
      const rightValue = todoSortKey === "completed"
        ? Number(right.completed)
        : todoSortKey === "description"
          ? right.description
          : todoSortKey === "sessions"
              ? rightSessions
              : right.addedAt;

      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue || "").localeCompare(String(rightValue || ""), undefined, { sensitivity: "base" });

      return todoSortDirection === "asc" ? comparison : -comparison;
    });

  todoList.innerHTML = "";
  emptyTodos.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => {
    const fragment = todoItemTemplate.content.cloneNode(true);
    const article = fragment.querySelector(".todo-item");
    const checkbox = fragment.querySelector(".todo-item-complete");
    const description = fragment.querySelector(".todo-item-description");
    const added = fragment.querySelector(".todo-item-added");
    const sessions = fragment.querySelector(".todo-item-sessions");

    article.dataset.todoId = item.id;
    article.classList.toggle("is-complete", item.completed);
    checkbox.checked = item.completed;
    description.textContent = item.description;
    article.title = item.description;
    added.textContent = item.addedAt;

    const sessionLabels = normalizeTodoSessionRefs(item.sessionRefs)
      .map((ref) => ref.title)
      .filter(Boolean);
    sessions.textContent = sessionLabels.join(", ") || "—";

    todoList.appendChild(fragment);
  });

  updateTodoSortUi();
}

function updateTodoSortUi() {
  const controls = [
    [todoSortCompletedButton, "completed"],
    [todoSortDescriptionButton, "description"],
    [todoSortAddedButton, "addedAt"],
    [todoSortSessionsButton, "sessions"],
  ];

  controls.forEach(([button, key]) => {
    if (!button) {
      return;
    }

    const isActive = todoSortKey === key;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    const baseLabel = button.textContent.replace(/\s+[▲▼]$/, "");
    button.textContent = isActive ? `${baseLabel} ${todoSortDirection === "asc" ? "▲" : "▼"}` : baseLabel;
  });
}

function getVisibleSessions() {
  return sessions.filter((session) => {
    if (!sessionFilterQuery) {
      return true;
    }

    const searchableText = [
      session.title,
      getTemplateDefinition(session.template).label,
      session.participants,
      getAgendaText(session),
      session.meetingDate,
      session.rawNotes,
      session.liveTranscript,
      session.uploadedTranscript,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(sessionFilterQuery);
  });
}

function updateSessionSelectionControls(visibleSessions = getVisibleSessions()) {
  const visibleSessionIds = visibleSessions.map((session) => session.id);
  const selectedVisibleCount = visibleSessionIds.filter((sessionId) => selectedSessionIds.has(sessionId)).length;
  const totalSelectedCount = Array.from(selectedSessionIds).filter((sessionId) => sessions.some((session) => session.id === sessionId)).length;
  const hasVisibleSessions = visibleSessionIds.length > 0;

  selectAllSessionsInput.checked = hasVisibleSessions && selectedVisibleCount === visibleSessionIds.length;
  selectAllSessionsInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleSessionIds.length;
  selectAllSessionsInput.disabled = !hasVisibleSessions;

  deleteSelectedSessionsButton.disabled = totalSelectedCount === 0;
  deleteSelectedSessionsButton.textContent = totalSelectedCount > 0
    ? `Delete selected (${totalSelectedCount})`
    : "Delete selected";
}

function applyTemplateUi(session) {
  const template = getTemplateDefinition(session.template);
  const behaviorId = getTemplateBehaviorId(template);
  const fields = template.fields || BUILT_IN_TEMPLATES.meeting.fields;
  const liveTranscriptEnabled = fields.liveTranscript !== false;
  const isQuickNote = behaviorId === "personalNote";
  const isOneToOneCall = behaviorId === "oneToOneCall";
  const isDictationActive = isRecording && !audioRecordingSessionId;
  const showParticipants = fields.participants !== false;
  const showHighlights = fields.highlights !== false;
  const showMeetingDate = fields.meetingDate === true;
  const showMeetingStartTime = fields.meetingStartTime === true;
  const showMeetingEndTime = fields.meetingEndTime === true;
  const showAgenda = fields.agenda === true;
  const showMeetingSchedule = showMeetingDate || showMeetingStartTime || showMeetingEndTime;
  const showManualNotes = fields.manualNotes !== false;
  const showLiveTranscript = liveTranscriptEnabled && isDictationActive;
  const showUploadedTranscript = liveTranscriptEnabled;
  const showTitle = fields.title !== false;
  const templateCustomFields = normalizeTemplateCustomFields(template.customFields);
  const showContextDisclosure = showParticipants || templateCustomFields.length > 0;

  setElementVisibility(titleField, showTitle);
  setElementVisibility(participantsField, showParticipants);
  setElementVisibility(participantDirectoryPanel, showParticipants);
  setElementVisibility(contextDisclosure, showContextDisclosure);
  setElementVisibility(meetingScheduleField, showMeetingSchedule);
  setElementVisibility(meetingDateField, showMeetingDate);
  setElementVisibility(meetingStartTimeField, showMeetingStartTime);
  setElementVisibility(meetingEndTimeField, showMeetingEndTime);
  setElementVisibility(meetingAgendaField, showAgenda);
  setElementVisibility(highlightsField, showHighlights);
  setElementVisibility(highlightChips, showHighlights);
  setElementVisibility(highlightsSection, showHighlights);
  setElementVisibility(manualNotesField, showManualNotes);
  setElementVisibility(liveTranscriptDisclosure, showLiveTranscript);
  if (!showLiveTranscript && liveTranscriptDisclosure) {
    liveTranscriptDisclosure.open = false;
  }
  setElementVisibility(uploadedTranscriptDisclosure, showUploadedTranscript);
  if (!showUploadedTranscript && uploadedTranscriptDisclosure) {
    uploadedTranscriptDisclosure.open = false;
  } else if (showUploadedTranscript && session.uploadedTranscript?.trim() && uploadedTranscriptDisclosure) {
    uploadedTranscriptDisclosure.open = true;
  }
  renderTemplateCustomFields(session, template);
  titleFieldLabel.textContent = getTemplateTitleFieldLabel(template);
  if (participantsFieldLabel) {
    participantsFieldLabel.textContent = isOneToOneCall ? "Participant" : "Participants";
  }
  updateTranscribeOnlyUi(session);

  meetingTitleInput.placeholder = isQuickNote
    ? formatDateTimeForTitle(Date.now())
    : isOneToOneCall
      ? formatDateTimeForTitle(Date.now())
      : "Weekly project meeting";
  participantsInput.placeholder = isOneToOneCall ? "Add participant" : "Add participants";

  if (!SpeechRecognition) {
    syncAudioCaptureUi(session);
    return;
  }

  if (!liveTranscriptEnabled) {
    if (isRecording && recognition) {
      recognition.stop();
      isRecording = false;
    }
    dictationToggle.disabled = true;
    dictationToggle.classList.remove("is-recording");
    dictationToggle.textContent = "Recording Hidden";
    return;
  }

  dictationToggle.disabled = false;
  dictationToggle.textContent = isRecording ? "Stop dictation" : "Start dictation";
  syncAudioCaptureUi(session);
}

function renderTemplateCustomFields(session, template = getTemplateDefinition(session.template)) {
  templateCustomFieldsContainer.innerHTML = "";
  const customFields = normalizeTemplateCustomFields(template.customFields);
  setElementVisibility(templateCustomFieldsContainer, customFields.length > 0);

  customFields.forEach((field) => {
    const label = document.createElement("label");
    label.className = "field";
    label.dataset.customFieldId = field.id;

    const title = document.createElement("span");
    title.className = "field-label";
    title.textContent = field.label.trim();

    const input = document.createElement("input");
    input.className = "template-custom-field-input";
    input.type = field.type;
    input.value = session.customFieldValues?.[field.id] ?? "";
    input.dataset.customFieldId = field.id;

    label.appendChild(title);
    label.appendChild(input);
    templateCustomFieldsContainer.appendChild(label);
  });
}

function updateTranscribeOnlyUi(session = getActiveSession()) {
  const isTranscriptOnly = session?.transcribeOnly === true;

  structuredSectionInputs.forEach((input) => {
    input.disabled = isTranscriptOnly;
    input.closest(".config-option")?.classList.toggle("is-disabled", isTranscriptOnly);
  });

  customHeaderList.classList.toggle("is-disabled", isTranscriptOnly);
  addCustomHeaderButton.disabled = isTranscriptOnly;
  addCustomHeaderButton.classList.toggle("is-disabled", isTranscriptOnly);
  templateSectionList?.classList.toggle("is-disabled", isTranscriptOnly);

  if (isTranscriptOnly) {
    resetCustomHeaderAddForm();
  }

  templateSectionList
    ?.querySelectorAll("input")
    .forEach((control) => {
      control.disabled = isTranscriptOnly;
      control.closest(".config-option")?.classList.toggle("is-disabled", isTranscriptOnly);
    });

  customHeaderList
    .querySelectorAll("input, textarea, button")
    .forEach((control) => {
      control.disabled = isTranscriptOnly;
    });

  polishButton.textContent = "Generate";
}

function normalizePendingAudioDraftMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const fileName = typeof meta.fileName === "string" ? meta.fileName : "";
  const mimeType = typeof meta.mimeType === "string" ? meta.mimeType : "audio/webm";
  const source = typeof meta.source === "string" ? meta.source : "upload";
  const size = Number.isFinite(meta.size) ? Number(meta.size) : 0;
  const createdAt = Number.isFinite(meta.createdAt) ? Number(meta.createdAt) : Date.now();

  if (!fileName || size <= 0) {
    return null;
  }

  return {
    fileName,
    mimeType,
    source,
    size,
    createdAt,
  };
}

function patchSessionById(sessionId, patch, shouldPersist = true) {
  sessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    return {
      ...session,
      ...patch,
      updatedAt: Date.now(),
    };
  });

  sessions.sort((first, second) => second.updatedAt - first.updatedAt);
  if (shouldPersist) {
    persistSessions();
  }
  renderSessionList();
}

function openPendingAudioDb() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("This browser does not support IndexedDB for pending recordings."));
  }

  if (!pendingAudioDbPromise) {
    pendingAudioDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PENDING_AUDIO_DB_NAME, 1);

      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PENDING_AUDIO_STORE_NAME)) {
          db.createObjectStore(PENDING_AUDIO_STORE_NAME);
        }
      });

      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("Pending audio storage could not be opened.")));
    });
  }

  return pendingAudioDbPromise;
}

async function saveAudioDraftToIndexedDb(sessionId, draft) {
  const db = await openPendingAudioDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_AUDIO_STORE_NAME, "readwrite");
    transaction.objectStore(PENDING_AUDIO_STORE_NAME).put({
      blob: draft.blob,
      fileName: draft.fileName,
      mimeType: draft.mimeType,
      source: draft.source,
      size: draft.size,
      createdAt: draft.createdAt,
    }, sessionId);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error || new Error("Pending audio could not be saved.")));
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("Pending audio save was aborted.")));
  });
}

async function loadAudioDraftFromIndexedDb(sessionId) {
  const db = await openPendingAudioDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_AUDIO_STORE_NAME, "readonly");
    const request = transaction.objectStore(PENDING_AUDIO_STORE_NAME).get(sessionId);
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error || new Error("Pending audio could not be loaded.")));
  });
}

async function deleteAudioDraftFromIndexedDb(sessionId) {
  const db = await openPendingAudioDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_AUDIO_STORE_NAME, "readwrite");
    transaction.objectStore(PENDING_AUDIO_STORE_NAME).delete(sessionId);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error || new Error("Pending audio could not be deleted.")));
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("Pending audio delete was aborted.")));
  });
}

async function getAudioDraft(sessionId = activeSessionId) {
  if (!sessionId) {
    return null;
  }

  if (audioDrafts.has(sessionId)) {
    return audioDrafts.get(sessionId) || null;
  }

  const storedDraft = await loadAudioDraftFromIndexedDb(sessionId).catch(() => null);
  if (!storedDraft?.blob) {
    return null;
  }

  const hydratedDraft = {
    blob: storedDraft.blob,
    fileName: storedDraft.fileName,
    mimeType: storedDraft.mimeType || storedDraft.blob?.type || "audio/webm",
    source: storedDraft.source || "upload",
    size: storedDraft.size ?? storedDraft.blob?.size ?? 0,
    createdAt: storedDraft.createdAt || Date.now(),
  };
  audioDrafts.set(sessionId, hydratedDraft);
  return hydratedDraft;
}

async function clearAudioDraft(sessionId = activeSessionId) {
  if (!sessionId) {
    return;
  }

  audioDrafts.delete(sessionId);
  await deleteAudioDraftFromIndexedDb(sessionId).catch(() => {});
  patchSessionById(sessionId, { pendingAudioDraftMeta: null }, true);

  if (sessionId === activeSessionId) {
    syncAudioCaptureUi(getActiveSession());
  }
}

async function setAudioDraft(draft, sessionId = activeSessionId) {
  if (!sessionId) {
    return;
  }

  if (!draft) {
    await clearAudioDraft(sessionId);
    return;
  }

  const normalizedDraft = {
    blob: draft.blob,
    fileName: draft.fileName,
    mimeType: draft.mimeType || draft.blob?.type || "audio/webm",
    source: draft.source || "upload",
    size: draft.size ?? draft.blob?.size ?? 0,
    createdAt: draft.createdAt || Date.now(),
  };

  audioDrafts.set(sessionId, normalizedDraft);
  await saveAudioDraftToIndexedDb(sessionId, normalizedDraft);
  patchSessionById(sessionId, {
    pendingAudioDraftMeta: normalizePendingAudioDraftMeta(normalizedDraft),
  }, true);

  if (sessionId === activeSessionId) {
    syncAudioCaptureUi(getActiveSession());
  }
}

function formatAudioFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function syncAudioCaptureUi(session = getActiveSession()) {
  const template = session ? getTemplateDefinition(session.template) : BUILT_IN_TEMPLATES.meeting;
  const supportsTranscriptField = template.fields?.liveTranscript !== false;
  const audioDraftMeta = normalizePendingAudioDraftMeta(session?.pendingAudioDraftMeta);
  const isAudioRecording = audioRecordingSessionId === session?.id;
  const canTranscribe = Boolean(audioDraftMeta) && !isAudioRecording;
  const isRoomRecording = isAudioRecording && activeAudioCaptureMode === "room-meeting";
  const isScreenRecording = isAudioRecording && activeAudioCaptureMode === "screen-meeting";

  setElementVisibility(audioRecordToggle?.closest(".audio-capture-card"), supportsTranscriptField);

  if (!supportsTranscriptField || !audioCaptureStatus || !audioRecordToggle || !transcribeAudioButton || !uploadAudioButton) {
    return;
  }

  audioRecordToggle.disabled = (!SUPPORTS_AUDIO_RECORDING && !isAudioRecording) || isScreenRecording;
  setCaptureButtonContent(
    audioRecordToggle,
    isRoomRecording ? "Stop room / hybrid meeting" : "Start room / hybrid meeting",
    isRoomRecording
      ? "Save recording for transcription"
      : "Use mic for room voices and nearby speakers",
  );
  audioRecordToggle.classList.toggle("is-recording", isRoomRecording);

  if (audioScreenToggle) {
    audioScreenToggle.disabled = (!SUPPORTS_MEETING_CAPTURE && !isScreenRecording) || isRoomRecording;
    setCaptureButtonContent(
      audioScreenToggle,
      isScreenRecording ? "Stop screen / browser audio" : "Start screen / browser audio",
      isScreenRecording
        ? "Save recording for transcription"
        : (SUPPORTS_MEETING_CAPTURE
          ? "Use direct in-computer audio from a tab or screen"
          : "Not available in this browser"),
    );
    audioScreenToggle.classList.toggle("is-recording", isScreenRecording);
  }

  uploadAudioButton.disabled = isAudioRecording;
  transcribeAudioButton.disabled = !canTranscribe;
  if (manageRecordingsButton) {
    manageRecordingsButton.disabled = sessions.every((entry) => !normalizePendingAudioDraftMeta(entry.pendingAudioDraftMeta));
  }

  if (isAudioRecording) {
    audioCaptureStatus.textContent = activeAudioCaptureMode === "screen-meeting"
      ? "Screen / browser audio capture is running. Keep sharing the tab, window, or screen until you are ready to transcribe."
      : "Room / hybrid meeting capture is running through the microphone. Stop when you are ready to transcribe.";
    return;
  }

  if (!SUPPORTS_AUDIO_RECORDING && !SUPPORTS_MEETING_CAPTURE) {
    audioCaptureStatus.textContent = "Live meeting recording is unavailable in this browser. Upload audio instead.";
  } else if (audioDraftMeta) {
    const sourceLabel = audioDraftMeta.source === "upload"
      ? "Uploaded audio ready"
      : audioDraftMeta.source === "screen-meeting-capture"
        ? "Screen / browser audio ready"
        : audioDraftMeta.source === "room-meeting-capture"
          ? "Room / hybrid meeting ready"
        : "Recorded audio ready";
      const sizeHint = audioDraftMeta.size > MAX_AUDIO_UPLOAD_BYTES
        ? " It will be split into smaller parts automatically before transcription."
        : "";
      audioCaptureStatus.textContent = `${sourceLabel}: ${audioDraftMeta.fileName} (${formatAudioFileSize(audioDraftMeta.size)}). Click "Transcribe audio" to add it to the Live transcript field.${sizeHint}`;
  } else {
      audioCaptureStatus.textContent = "";
  }

  syncMobileUi();
  renderPendingRecordings();
}

function renderPendingRecordings() {
  if (!pendingRecordingsPanel || !pendingRecordingsList) {
    return;
  }

  pendingRecordingsList.innerHTML = "";
  const sessionsWithPendingAudio = sessions
    .map((session) => ({
      session,
      meta: normalizePendingAudioDraftMeta(session.pendingAudioDraftMeta),
    }))
    .filter((entry) => entry.meta);

  pendingRecordingsPanel.hidden = sessionsWithPendingAudio.length === 0;

  sessionsWithPendingAudio.forEach(({ session, meta }) => {
    const fragment = pendingRecordingItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".pending-recording-item");
    item.dataset.sessionId = session.id;
    fragment.querySelector(".pending-recording-session").textContent = session.title.trim() || "Untitled session";
    const sourceLabel = meta.source === "upload"
      ? "Uploaded audio"
      : meta.source === "screen-meeting-capture"
        ? "Screen / browser audio"
        : meta.source === "room-meeting-capture"
          ? "Room / hybrid meeting"
        : "Recorded audio";
    fragment.querySelector(".pending-recording-meta").textContent = `${meta.fileName} • ${formatAudioFileSize(meta.size)} • ${sourceLabel}`;
    pendingRecordingsList.appendChild(fragment);
  });
}

function setElementVisibility(element, isVisible) {
  if (!element) {
    return;
  }

  element.classList.toggle("is-hidden-field", !isVisible);
  element.hidden = !isVisible;
  element.style.display = isVisible ? "" : "none";
}

function resetCustomHeaderAddForm() {
  newCustomHeaderTitleInput.value = "";
  newCustomHeaderInstructionsInput.value = "";
  setElementVisibility(customHeaderAddForm, false);
}

function renderCustomTemplates(focusTemplateId = null) {
  customTemplateList.innerHTML = "";

  settings.customTemplates.forEach((template) => {
    const fragment = customTemplateTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".custom-template-item");
    const nameLabel = fragment.querySelector(".custom-template-name-label");
    const summary = fragment.querySelector(".custom-template-summary");
    const nameInput = fragment.querySelector(".custom-template-name");
    const instructionsInput = fragment.querySelector(".custom-template-instructions");
    const headerList = fragment.querySelector(".template-header-list");
    const fieldList = fragment.querySelector(".template-field-list");
    const body = fragment.querySelector(".custom-template-body");
    const editButton = fragment.querySelector(".custom-template-edit");

    item.dataset.templateId = template.id;
    nameLabel.textContent = template.label || "New template";
    summary.textContent = buildTemplateSummary(template);
    nameInput.value = template.label;
    instructionsInput.value = template.templateInstructions;
    fragment.querySelector(".custom-template-show-title").checked = template.fields.title !== false;
    fragment.querySelector(".custom-template-show-participants").checked = template.fields.participants !== false;
    fragment.querySelector(".custom-template-show-agenda").checked = template.fields.agenda === true;
    fragment.querySelector(".custom-template-show-highlights").checked = template.fields.highlights !== false;
    fragment.querySelector(".custom-template-show-manual-notes").checked = template.fields.manualNotes !== false;
    fragment.querySelector(".custom-template-show-live-transcript").checked = template.fields.liveTranscript !== false;
    fragment.querySelector(".custom-template-show-meeting-date").checked = template.fields.meetingDate === true;
    fragment.querySelector(".custom-template-show-meeting-start-time").checked = template.fields.meetingStartTime === true;
    fragment.querySelector(".custom-template-show-meeting-end-time").checked = template.fields.meetingEndTime === true;

    template.headers.forEach((header) => {
      const headerFragment = templateHeaderTemplate.content.cloneNode(true);
      const headerItem = headerFragment.querySelector(".template-header-item");
      const headerLabel = headerFragment.querySelector(".template-header-label");
      const headerEditor = headerFragment.querySelector(".template-header-editor");
      const headerEditButton = headerFragment.querySelector(".template-header-edit");
      headerItem.dataset.headerId = header.id;
      headerLabel.textContent = header.title || "New template section";
      headerFragment.querySelector(".template-header-title").value = header.title;
      headerFragment.querySelector(".template-header-instructions").value = header.instructions;
      setElementVisibility(headerEditor, header.isExpanded === true);
      headerEditButton.textContent = header.isExpanded === true ? "Close" : "Edit";
      headerList.appendChild(headerFragment);
    });

    normalizeTemplateCustomFields(template.customFields).forEach((field) => {
      const fieldFragment = templateFieldTemplate.content.cloneNode(true);
      const fieldItem = fieldFragment.querySelector(".template-field-item");
      const fieldLabel = fieldFragment.querySelector(".template-field-label");
      const fieldEditor = fieldFragment.querySelector(".template-field-editor");
      const fieldEditButton = fieldFragment.querySelector(".template-field-edit");
      const fieldTypeBadge = fieldFragment.querySelector(".template-field-type-badge");
      fieldItem.dataset.fieldId = field.id;
      fieldLabel.textContent = field.label || "New field";
      fieldFragment.querySelector(".template-field-name").value = field.label;
      fieldFragment.querySelector(".template-field-type").value = field.type;
      fieldTypeBadge.textContent = field.type;
      setElementVisibility(fieldEditor, field.isExpanded === true);
      fieldEditButton.textContent = field.isExpanded === true ? "Close" : "Edit";
      fieldList.appendChild(fieldFragment);
    });

    setElementVisibility(body, template.isExpanded === true);
    editButton.textContent = template.isExpanded === true ? "Close" : "Edit";

    customTemplateList.appendChild(fragment);
  });

  if (focusTemplateId) {
    const focusTarget = customTemplateList.querySelector(`[data-template-id="${focusTemplateId}"] .custom-template-name`);
    focusTarget?.focus();
  }
}

function syncFieldsFromSession() {
  const session = getActiveSession();
  const template = getTemplateDefinition(session.template);

  titleDisplay.textContent = session.title.trim() || "Untitled session";
  meetingTitleInput.value = session.title;
  templateSelect.value = template.id;
  apiKeyInput.value = settings.apiKey ?? "";
  modelSelect.value = resolveSelectedModel(settings.model);
  participantsInput.value = session.participants;
  meetingDateInput.value = session.meetingDate ?? "";
  meetingStartTimeInput.value = session.meetingStartTime ?? "";
  meetingEndTimeInput.value = session.meetingEndTime ?? "";
  setRichTextContent(meetingAgendaInput, session.agenda ?? "");
  includeAgendaInput.checked = session.sections.includeAgenda;
  transcribeOnlyInput.checked = session.transcribeOnly === true;
  includeSummaryInput.checked = session.sections.includeSummary;
  includeHighlightsInput.checked = session.sections.includeHighlights;
  includeDecisionsInput.checked = session.sections.includeDecisions;
  includeActionsInput.checked = session.sections.includeActions;
  outputLanguageSelect.value = session.outputLanguage ?? "auto";
  detailLevelInput.value = String(session.detailLevel ?? 3);
  additionalInstructionsInput.value = session.additionalInstructions ?? "";
  updateDetailLevelLabel();
  dictationLanguageSelect.value = settings.dictationLanguage ?? "auto";
  liveTranscriptInput.value = session.liveTranscript ?? "";
  uploadedTranscriptInput.value = session.uploadedTranscript ?? "";
  setTranscriptFieldState("live", resolveLiveTranscriptSource(session), getLiveTranscriptSourceLabel(session));
  setTranscriptFieldState(
    "uploaded",
    session.uploadedTranscript?.trim() ? "uploaded" : "uploaded-ready",
    "Uploaded transcript"
  );
  rawNotesInput.value = session.rawNotes;
  renderTemplateCustomFields(session, template);
  outputFeedbackInput.value = session.outputFeedback ?? "";
  outputFeedbackStatus.textContent = session.polishedHtml
    ? "Add comments here when you want the polished output adjusted. You can always revert the latest revision."
    : "Generate polished notes first, then use comments here to request improvements.";
  setAppStatus("Saved locally", APP_STATUS_STATES.idle);
  syncAudioCaptureUi(session);
  applyTemplateUi(session);
}

function openAiSettings(options = {}) {
  const { fromSettings = false } = options;
  aiSettingsOpenedFromSettings = fromSettings;
  apiKeyInput.value = settings.apiKey ?? "";
  modelSelect.value = resolveSelectedModel(settings.model);
  transcriptionModelSelect.value = resolveSelectedTranscriptionModel(settings.transcriptionModel);
  renderAiModelOptions();
  updateTranscriptionModelDescription();
  updateModelPricingStatus();
  aiSettingsModal.classList.remove("is-hidden");
  aiSettingsModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  setActiveAiSettingsSection(activeAiSettingsSection);
  maybeRefreshAiModelCatalog({ force: true });
  const targetControl = aiSettingsModal.querySelector(`[data-ai-settings-section="${activeAiSettingsSection}"] input, [data-ai-settings-section="${activeAiSettingsSection}"] select, [data-ai-settings-section="${activeAiSettingsSection}"] button`);
  targetControl?.focus();
}

function openAiSettingsFromSettings() {
  closeSettings();
  window.setTimeout(() => {
    openAiSettings({ fromSettings: true });
  }, 0);
}

function closeAiSettings(options = {}) {
  const { returnToSettings = false } = options;
  aiSettingsModal.classList.add("is-hidden");
  aiSettingsModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();

  if (returnToSettings || aiSettingsOpenedFromSettings) {
    aiSettingsOpenedFromSettings = false;
    activeSettingsSection = "ai";
    openSettings();
    return;
  }

  aiSettingsOpenedFromSettings = false;
  const focusTarget = !settingsModal.classList.contains("is-hidden")
    ? openAiSettingsInlineButton
    : openSettingsButton;
  focusTarget?.focus();
}

function openBackupReminder() {
  backupReminderModal.classList.remove("is-hidden");
  backupReminderModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  backupReminderExportButton.focus();
}

function closeBackupReminder() {
  backupReminderModal.classList.add("is-hidden");
  backupReminderModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
}

function openBackupPanel() {
  backupPanelModal.classList.remove("is-hidden");
  backupPanelModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  exportSessionsButton.focus();
}

function closeBackupPanel() {
  backupPanelModal.classList.add("is-hidden");
  backupPanelModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  if (!workspacePanelModal.classList.contains("is-hidden")) {
    openBackupShortcutButton.focus();
    return;
  }
  openBackupPanelButton.focus();
}

function openRecordingsModal() {
  renderPendingRecordings();
  recordingsModal.classList.remove("is-hidden");
  recordingsModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  pendingRecordingsList.querySelector("button")?.focus();
}

function closeRecordingsModal() {
  recordingsModal.classList.add("is-hidden");
  recordingsModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  manageRecordingsButton?.focus();
}

function openTodoPanel() {
  renderTodoList();
  todoPanelModal.classList.remove("is-hidden");
  todoPanelModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  todoList.querySelector("input, textarea, button")?.focus();
}

function closeTodoPanel() {
  todoPanelModal.classList.add("is-hidden");
  todoPanelModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  (openTodoOutputButton || openTodoMainButton)?.focus();
}

function getTodoItemById(todoId) {
  return normalizeTodoItems(settings.todoItems).find((item) => item.id === todoId) || null;
}

function syncActiveTodoDetailFromInputs() {
  if (!activeTodoDetailId) {
    return;
  }

  settings.todoItems = normalizeTodoItems((settings.todoItems || []).map((item) => (
    item.id === activeTodoDetailId
      ? {
          ...item,
          completed: todoDetailComplete.checked,
          description: polishTodoText(todoDetailDescription.value) || item.description,
          comments: todoDetailComments.value,
        }
      : item
  )));
  persistSettings();
  renderTodoList();
}

function openTodoDetailModal(todoId) {
  const todo = getTodoItemById(todoId);
  if (!todo) {
    return;
  }

  activeTodoDetailId = todo.id;
  todoDetailTitle.textContent = todo.description;
  todoDetailComplete.checked = todo.completed;
  todoDetailDescription.value = todo.description;
  todoDetailAdded.textContent = todo.addedAt;
  todoDetailSessions.textContent = normalizeTodoSessionRefs(todo.sessionRefs).map((ref) => ref.title).filter(Boolean).join(", ") || "—";
  todoDetailComments.value = todo.comments || "";
  todoDetailModal.classList.remove("is-hidden");
  todoDetailModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  todoDetailDescription.focus();
}

function closeTodoDetailModal() {
  todoDetailModal.classList.add("is-hidden");
  todoDetailModal.setAttribute("aria-hidden", "true");
  activeTodoDetailId = null;
  syncModalScrollLock();
}

function openWorkspacePanel() {
  workspacePanelModal.classList.remove("is-hidden");
  workspacePanelModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  openSessionsShortcutButton.focus();
}

function closeWorkspacePanel() {
  workspacePanelModal.classList.add("is-hidden");
  workspacePanelModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  (openBackupPanelButton || openSessionsMainButton)?.focus();
}

function showConfirmModal({
  eyebrow = "Please confirm",
  title = "Are you sure?",
  message = "Confirm this action to continue.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
} = {}) {
  confirmModalEyebrow.textContent = eyebrow;
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  confirmModalConfirmButton.textContent = confirmLabel;
  confirmModalCancelButton.textContent = cancelLabel;
  confirmModal.classList.remove("is-hidden");
  confirmModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  confirmModalConfirmButton.focus();

  return new Promise((resolve) => {
    confirmModalResolver = resolve;
  });
}

function closeConfirmModal(result) {
  confirmModal.classList.add("is-hidden");
  confirmModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  const resolver = confirmModalResolver;
  confirmModalResolver = null;
  resolver?.(result);
}

function setActiveAiSettingsSection(sectionId) {
  activeAiSettingsSection = aiSettingsSections.some((section) => section.dataset.aiSettingsSection === sectionId)
    ? sectionId
    : "connection";

  aiSettingsNavButtons.forEach((button) => {
    const isActive = button.dataset.aiSettingsTab === activeAiSettingsSection;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  aiSettingsSections.forEach((section) => {
    const isActive = section.dataset.aiSettingsSection === activeAiSettingsSection;
    section.classList.toggle("is-hidden-field", !isActive);
    section.hidden = !isActive;
  });
}

function openSettings() {
  if (activeSettingsSection === "ai") {
    activeSettingsSection = "appearance";
  }
  applyCurrentTheme();
  syncSettingsForm();
  settingsModal.classList.remove("is-hidden");
  settingsModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  setActiveSettingsSection(activeSettingsSection);
  const targetControl = settingsModal.querySelector(`[data-settings-section="${activeSettingsSection}"] input, [data-settings-section="${activeSettingsSection}"] select, [data-settings-section="${activeSettingsSection}"] button`);
  targetControl?.focus();
}

function closeSettings() {
  applyCurrentTheme();
  settingsModal.classList.add("is-hidden");
  settingsModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  openSettingsButton.focus();
}

function openInstructions() {
  instructionsModal.classList.remove("is-hidden");
  instructionsModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  closeInstructionsButton?.focus();
}

function closeInstructions() {
  instructionsModal.classList.add("is-hidden");
  instructionsModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  (openInstructionsButton || mobileOpenInstructionsButton || openSettingsButton)?.focus();
}

function setActiveSettingsSection(sectionId) {
  activeSettingsSection = settingsSections.some((section) => section.dataset.settingsSection === sectionId)
    ? sectionId
    : "appearance";

  settingsNavButtons.forEach((button) => {
    const isActive = button.dataset.settingsTab === activeSettingsSection;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  settingsSections.forEach((section) => {
    const isActive = section.dataset.settingsSection === activeSettingsSection;
    section.classList.toggle("is-hidden-field", !isActive);
    section.hidden = !isActive;
  });
}

function resolveSelectedTranscriptionModel(modelId) {
  return getVisibleTranscriptionModels().some(([visibleModelId]) => visibleModelId === modelId)
    ? modelId
    : DEFAULT_TRANSCRIPTION_MODEL;
}

function getTranscriptionModelLabel(modelId) {
  return TRANSCRIPTION_MODELS[resolveSelectedTranscriptionModel(modelId)]?.label || TRANSCRIPTION_MODELS[DEFAULT_TRANSCRIPTION_MODEL].label;
}

function updateTranscriptionModelDescription() {
  if (!transcriptionModelDescription || !transcriptionModelSelect) {
    return;
  }

  const modelId = resolveSelectedTranscriptionModel(transcriptionModelSelect.value || settings.transcriptionModel);
  transcriptionModelSelect.value = modelId;
  const model = TRANSCRIPTION_MODELS[modelId] || TRANSCRIPTION_MODELS[DEFAULT_TRANSCRIPTION_MODEL];
  const visibleModels = getVisibleTranscriptionModels();
  transcriptionModelDescription.textContent = visibleModels.length === 1
    ? `${model.description} This is currently the only relevant OpenAI transcription model shown for this app.`
    : `${model.description} Only OpenAI transcription models relevant for NoteSmith sessions are shown here.`;

  if (transcriptionModelPricing) {
    transcriptionModelPricing.textContent = `Estimated transcription cost: about ${model.pricing}. Pricing info date: ${model.pricingDate}.`;
  }
}

function renderTranscriptionModelOptions() {
  if (!transcriptionModelOptions || !transcriptionModelSelect) {
    return;
  }

  const visibleModels = getVisibleTranscriptionModels();
  const selectedModel = resolveSelectedTranscriptionModel(transcriptionModelSelect.value || settings.transcriptionModel);
  transcriptionModelSelect.value = selectedModel;

  transcriptionModelOptions.innerHTML = visibleModels
    .map(([modelId, model]) => {
      const isSelected = modelId === selectedModel;
      const selectedClass = isSelected ? " is-selected" : "";
      const badgeLabel = visibleModels.length === 1
        ? "Only option"
        : (isSelected ? "Selected" : "Choose");
      return `
        <button class="model-option${selectedClass}" data-transcription-model-id="${escapeHtml(modelId)}" type="button" aria-pressed="${String(isSelected)}">
          <span class="model-option-header">
            <span class="model-option-name">${escapeHtml(model.label)}</span>
            <span class="model-option-badge">${badgeLabel}</span>
          </span>
          <span class="model-option-copy">${escapeHtml(model.description)}</span>
          <span class="model-option-price">${escapeHtml(`Estimated cost: ${model.pricing}`)}</span>
          <span class="model-option-meta">Pricing date: ${escapeHtml(model.pricingDate)}</span>
        </button>
      `;
    })
    .join("");
}

function getVisibleTranscriptionModels() {
  return RELEVANT_TRANSCRIPTION_MODEL_IDS
    .filter((modelId) => TRANSCRIPTION_MODELS[modelId])
    .map((modelId) => [modelId, TRANSCRIPTION_MODELS[modelId]]);
}

function syncModalScrollLock() {
  const hasOpenModal = !aiSettingsModal.classList.contains("is-hidden")
    || !settingsModal.classList.contains("is-hidden")
    || !instructionsModal.classList.contains("is-hidden")
    || !backupReminderModal.classList.contains("is-hidden")
    || !backupPanelModal.classList.contains("is-hidden")
    || !recordingsModal.classList.contains("is-hidden")
    || !todoPanelModal.classList.contains("is-hidden")
    || !todoDetailModal.classList.contains("is-hidden")
    || !workspacePanelModal.classList.contains("is-hidden")
    || !confirmModal.classList.contains("is-hidden")
    || (isMobileLayout() && (mobileMoreSheetOpen || mobileOutputSheetOpen));
  document.body.classList.toggle("modal-open", hasOpenModal);
}

function closeMobileSheets() {
  mobileMoreSheetOpen = false;
  mobileOutputSheetOpen = false;
  editorSidebar.classList.remove("is-mobile-open");
  outputPanel.classList.remove("is-mobile-open");
  if (mobileSheetBackdrop) {
    mobileSheetBackdrop.hidden = true;
  }
  syncModalScrollLock();
}

function openMobileMoreSheet() {
  if (!isMobileLayout()) {
    return;
  }
  mobileOutputSheetOpen = false;
  mobileMoreSheetOpen = true;
  editorSidebar.classList.add("is-mobile-open");
  outputPanel.classList.remove("is-mobile-open");
  if (mobileSheetBackdrop) {
    mobileSheetBackdrop.hidden = false;
  }
  syncModalScrollLock();
}

function openMobileOutputSheet() {
  if (!isMobileLayout()) {
    return;
  }
  mobileMoreSheetOpen = false;
  mobileOutputSheetOpen = true;
  editorSidebar.classList.remove("is-mobile-open");
  outputPanel.classList.add("is-mobile-open");
  if (mobileSheetBackdrop) {
    mobileSheetBackdrop.hidden = false;
  }
  syncModalScrollLock();
}

function setDesktopWorkspaceView(view) {
  desktopWorkspaceView = view === "output" ? "output" : "capture";
  updateDesktopWorkspaceViewUi();
}

function updateDesktopWorkspaceViewUi() {
  if (!editorPanel || !outputPanel) {
    return;
  }

  const isMobile = isMobileLayout();

  desktopViewButtons.forEach((button) => {
    const view = button.dataset.desktopView === "output" ? "output" : "capture";
    const isActive = desktopWorkspaceView === view;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = false;
  });

  const hideEditor = false;
  const hideOutput = false;
  editorPanel.classList.toggle("desktop-panel-hidden", hideEditor);
  outputPanel.classList.toggle("desktop-panel-hidden", hideOutput);
}

function syncMobileUi() {
  const session = getActiveSession();
  if (!session) {
    return;
  }

  const canGenerate = hasSessionContent(session);
  const hasOutput = Boolean(session.polishedHtml);
  const template = getTemplateDefinition(session.template);
  const supportsTranscriptField = template.fields.liveTranscript !== false;
  const canDictate = supportsTranscriptField && Boolean(recognition);
  const isRecordingAudio = audioRecordingSessionId === session.id;

  setElementVisibility(mobileGenerateButton, canGenerate);
  setElementVisibility(mobileOpenOutputBarButton, hasOutput);
  setElementVisibility(mobileOpenOutputButton, hasOutput);
  setElementVisibility(mobileDictationToggle, supportsTranscriptField);

  if (mobileGenerateButton) {
    mobileGenerateButton.textContent = polishButton.textContent;
    mobileGenerateButton.disabled = polishButton.disabled;
  }

  updateDesktopWorkspaceViewUi();

  if (mobileDictationToggle) {
    const titleNode = mobileDictationToggle.querySelector(".capture-mode-title");
    const hintNode = mobileDictationToggle.querySelector(".capture-mode-hint");

    if (canDictate) {
      if (titleNode) {
        titleNode.textContent = isRecording ? "Stop dictation" : "Start dictation";
      } else {
        mobileDictationToggle.textContent = isRecording ? "Stop dictation" : "Start dictation";
      }
      if (hintNode) {
        hintNode.textContent = isRecording ? "Live browser transcription" : "Best for personal dictation";
      }
      mobileDictationToggle.classList.toggle("is-recording", dictationToggle.classList.contains("is-recording"));
      mobileDictationToggle.disabled = dictationToggle.disabled;
      mobileDictationToggle.dataset.captureMode = "dictation";
    } else {
      if (titleNode) {
        titleNode.textContent = isRecordingAudio ? "Stop room / hybrid meeting" : "Start room / hybrid meeting";
      } else {
        mobileDictationToggle.textContent = isRecordingAudio ? "Stop room / hybrid meeting" : "Start room / hybrid meeting";
      }
      if (hintNode) {
        hintNode.textContent = SUPPORTS_AUDIO_RECORDING
          ? "Use mic for room voices and nearby speakers"
          : "Use More to upload audio";
      }
      mobileDictationToggle.classList.toggle("is-recording", isRecordingAudio);
      mobileDictationToggle.disabled = !SUPPORTS_AUDIO_RECORDING && !isRecordingAudio;
      mobileDictationToggle.dataset.captureMode = "audio";
    }
  }

  if (manualNotesDisclosure) {
    if (!isMobileLayout()) {
      manualNotesDisclosure.open = true;
      manualNotesDisclosure.dataset.mobileInitialized = "false";
    } else if (manualNotesDisclosure.dataset.mobileInitialized !== "true") {
      manualNotesDisclosure.open = false;
      manualNotesDisclosure.dataset.mobileInitialized = "true";
    }
  }

  if (contextDisclosure) {
    if (!isMobileLayout()) {
      contextDisclosure.open = true;
      contextDisclosure.dataset.mobileInitialized = "false";
    } else if (contextDisclosure.dataset.mobileInitialized !== "true") {
      contextDisclosure.open = false;
      contextDisclosure.dataset.mobileInitialized = "true";
    }
  }

  [contextCardDisclosure, highlightsCardDisclosure].forEach((disclosure) => {
    if (!disclosure) {
      return;
    }

    if (isMobileLayout()) {
      disclosure.open = true;
      disclosure.dataset.mobileInitialized = "false";
    }
  });

  if (!isMobileLayout()) {
    closeMobileSheets();
  }
}

function syncMobileCaptureStatus(text = "") {
  if (!mobileCaptureStatus) {
    return;
  }

  const nextText = String(text || "").trim()
    || "Start a room / hybrid meeting, use screen / browser audio, or use More to upload audio.";
  mobileCaptureStatus.textContent = nextText;
}

function bindMobileStatusMirrors() {
  if (!mobileCaptureStatus) {
    return;
  }

  const mirrorStatus = (element) => {
    if (!element) {
      return;
    }

    syncMobileCaptureStatus(element.textContent);
    const observer = new MutationObserver(() => {
      syncMobileCaptureStatus(element.textContent);
    });
    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  };

  mirrorStatus(dictationStatus);
  mirrorStatus(audioCaptureStatus);
}

function persistAiSettings({ announce = true } = {}) {
  settings.apiKey = apiKeyInput.value.trim();
  settings.model = resolveSelectedModel(modelSelect.value);
  settings.transcriptionModel = resolveSelectedTranscriptionModel(transcriptionModelSelect.value);
  persistSettings();
  updateHeroMeta();
  updateTranscriptionModelDescription();
  renderAiModelOptions();
  renderTranscriptionModelOptions();
  syncAudioCaptureUi(getActiveSession());

  if (announce) {
    dictationStatus.textContent = settings.apiKey
      ? `AI settings updated. ${getAiModelLabel(settings.model)} is ready for polishing, and ${getTranscriptionModelLabel(settings.transcriptionModel)} is ready for audio transcription.`
      : "AI settings updated without an API key. Local polishing will be used until you add one.";
  }
}

function renderAiModelOptions() {
  const selectedModel = resolveSelectedModel(modelSelect.value || settings.model);
  modelSelect.value = selectedModel;
  modelOptions.innerHTML = getVisibleAiModels()
    .map((model) => {
      const selectedClass = model.id === selectedModel ? " is-selected" : "";
      return `
        <button class="model-option${selectedClass}" data-model-id="${escapeHtml(model.id)}" type="button" aria-pressed="${String(model.id === selectedModel)}">
          <span class="model-option-header">
            <span class="model-option-name">${escapeHtml(model.label)}</span>
            <span class="model-option-badge">${model.id === selectedModel ? "Selected" : "Choose"}</span>
          </span>
          <span class="model-option-copy">${escapeHtml(model.useCase)}</span>
          <span class="model-option-price">${escapeHtml(formatModelPricing(model))}</span>
          <span class="model-option-meta">Pricing date: ${escapeHtml(formatCatalogDate(model.pricingDate))}</span>
        </button>
      `;
    })
    .join("");
}

function resolveSelectedModel(modelId) {
  const visibleModels = getVisibleAiModels();
  if (visibleModels.some((model) => model.id === modelId)) {
    return modelId;
  }

  return visibleModels.find((model) => model.id === "gpt-5-mini")?.id
    || visibleModels[0]?.id
    || "gpt-5-mini";
}

function getAiModelLabel(modelId) {
  return getVisibleAiModels().find((model) => model.id === resolveSelectedModel(modelId))?.label || "GPT-5 mini";
}

function updateHeroMeta() {
  if (appVersionLabel) {
    appVersionLabel.textContent = `${APP_VERSION} · IndexedDB`;
  }

  if (appModelsLabel) {
    appModelsLabel.textContent = `Output: ${getAiModelLabel(settings.model)} · Audio: ${getTranscriptionModelLabel(settings.transcriptionModel)}`;
  }
}

function updateModelPricingStatus(message) {
  if (message) {
    modelPricingStatus.textContent = message;
    return;
  }

  const latestDate = getVisibleAiModels()
    .map((model) => model.pricingDate)
    .filter(Boolean)
    .sort()
    .at(-1);

  modelPricingStatus.textContent = latestDate
    ? `Showing cost-eligible OpenAI models from the latest saved snapshot on ${formatCatalogDate(latestDate)}. Live catalog refresh starts automatically when the app opens.`
    : "Showing bundled model guidance. Live catalog refresh starts automatically when the app opens.";
}

function getVisibleAiModels() {
  return filterRelevantAiModels(aiModelCatalog);
}

function filterRelevantAiModels(models) {
  return models
    .filter((model) => {
      const inputPrice = parsePrice(model.inputPrice);
      return Number.isFinite(inputPrice) && inputPrice <= MAX_MODEL_INPUT_PRICE_PER_MILLION;
    })
    .sort((first, second) => {
      const priceDelta = parsePrice(first.inputPrice) - parsePrice(second.inputPrice);
      if (priceDelta !== 0) {
        return priceDelta;
      }

      return first.label.localeCompare(second.label);
    });
}

async function refreshAiModelCatalog() {
  lastAiCatalogRefreshAttemptAt = Date.now();
  const refreshId = ++aiCatalogRefreshCounter;
  updateModelPricingStatus("Refreshing the official OpenAI model catalog and pricing in the background...");

  try {
    const refreshedCatalog = await fetchLatestAiModelCatalog();
    if (refreshId !== aiCatalogRefreshCounter) {
      return;
    }

    aiModelCatalog = refreshedCatalog;
    persistAiModelCatalog();
    renderAiModelOptions();
    updateModelPricingStatus(`Catalog refreshed from official OpenAI docs on ${formatCatalogDate(new Date().toISOString())}.`);
  } catch {
    if (refreshId !== aiCatalogRefreshCounter) {
      return;
    }

    updateModelPricingStatus("Using the saved model snapshot. Live catalog refresh from official OpenAI docs could not be completed in this browser.");
  }
}

function maybeRefreshAiModelCatalog({ force = false } = {}) {
  if (!force && Date.now() - lastAiCatalogRefreshAttemptAt < AI_MODEL_REFRESH_MIN_INTERVAL_MS) {
    return;
  }

  void refreshAiModelCatalog();
}

async function fetchLatestAiModelCatalog() {
  const availableModelIds = await fetchAvailableOpenAiModelIds();
  const results = await Promise.allSettled(
    DEFAULT_AI_MODEL_CATALOG
      .filter((model) => availableModelIds.has(model.id))
      .map(async (model) => {
        const prices = await fetchOfficialModelPricing(model);
        return {
          ...model,
          ...prices,
          pricingDate: new Date().toISOString(),
        };
      }),
  );

  let successCount = 0;
  const availableCatalog = DEFAULT_AI_MODEL_CATALOG.filter((model) => availableModelIds.has(model.id));
  const mergedCatalog = availableCatalog.map((model, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      successCount += 1;
      return result.value;
    }

    const cachedModel = aiModelCatalog.find((item) => item.id === model.id);
    return cachedModel ? { ...model, ...cachedModel } : { ...model };
  });

  if (!successCount) {
    throw new Error("No official model pricing could be refreshed.");
  }

  return mergedCatalog;
}

async function fetchAvailableOpenAiModelIds() {
  const sources = [
    "https://developers.openai.com/api/docs/models/all",
    "https://developers.openai.com/api/docs/models",
  ];
  let combinedText = "";
  let successCount = 0;

  for (const url of sources) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const text = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
      combinedText += ` ${text}`;
      successCount += 1;
    } catch {
      // Ignore and fall back to the saved catalog if nothing can be fetched.
    }
  }

  if (!successCount) {
    return new Set(getVisibleAiModels().map((model) => model.id));
  }

  const normalizedText = combinedText.replace(/\s+/g, " ").trim().toLowerCase();
  const availableIds = DEFAULT_AI_MODEL_CATALOG
    .filter((model) => {
      const normalizedId = model.id.toLowerCase();
      const normalizedLabel = model.label.toLowerCase();
      return normalizedText.includes(normalizedId) || normalizedText.includes(normalizedLabel);
    })
    .map((model) => model.id);

  if (!availableIds.length) {
    return new Set(getVisibleAiModels().map((model) => model.id));
  }

  return new Set(availableIds);
}

async function fetchOfficialModelPricing(model) {
  const urls = [model.docUrl, model.fallbackDocUrl].filter(Boolean);
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const text = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
      const prices = extractModelPrices(text, model.label);

      if (prices) {
        return prices;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Pricing could not be loaded for ${model.label}.`);
}

function extractModelPrices(pageText, modelLabel) {
  const normalizedText = pageText.replace(/\s+/g, " ").trim();
  const modelSection = modelLabel === "GPT-5.4"
    ? normalizedText
    : extractModelSection(normalizedText, modelLabel);
  const pricingText = extractPricingSection(modelSection || normalizedText);

  if (!pricingText) {
    return null;
  }

  const inputMatch = pricingText.match(/Input\s*\$([\d.]+)/i);
  const cachedInputMatch = pricingText.match(/Cached input\s*\$([\d.]+)/i);
  const outputMatch = pricingText.match(/Output\s*\$([\d.]+)/i);

  if (!inputMatch || !outputMatch) {
    return null;
  }

  return {
    inputPrice: `$${inputMatch[1]}`,
    cachedInputPrice: cachedInputMatch ? `$${cachedInputMatch[1]}` : null,
    outputPrice: `$${outputMatch[1]}`,
  };
}

function extractModelSection(pageText, modelLabel) {
  const escapedLabel = modelLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`${escapedLabel}[\\s\\S]*?(?=(GPT-[\\d.]+(?: mini| nano| pro)?|Rate limits|Snapshots|Modalities|$))`, "i");
  return pageText.match(sectionPattern)?.[0] || pageText;
}

function extractPricingSection(pageText) {
  return pageText.match(/Text tokens[\s\S]*?(?=(Modalities|Endpoints|Features|Snapshots|Rate limits|$))/i)?.[0]
    || pageText.match(/Input price[\s\S]*?(?=(Latency|Max output|Context window|Tools|Knowledge cutoff|$))/i)?.[0]
    || pageText;
}

function formatModelPricing(model) {
  const parts = [`Input ${model.inputPrice} per 1 million tokens`];
  if (model.cachedInputPrice) {
    parts.push(`Cached input ${model.cachedInputPrice} per 1 million tokens`);
  }
  parts.push(`Output ${model.outputPrice} per 1 million tokens`);
  parts.push(`Approx. 1 page input: ${formatUsd(calculateApproxPageCost(model.inputPrice))}`);
  parts.push(`Approx. 1 page output: ${formatUsd(calculateApproxPageCost(model.outputPrice))}`);
  return parts.join(" • ");
}

function formatCatalogDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return formatIsoDate(date);
}

function parsePrice(value) {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalized = value.replace(/[^0-9.]/g, "");
  return Number.parseFloat(normalized);
}

function calculateApproxPageCost(pricePerMillionTokens) {
  const parsedPrice = parsePrice(pricePerMillionTokens);
  if (!Number.isFinite(parsedPrice)) {
    return Number.NaN;
  }

  return (parsedPrice / 1_000_000) * APPROX_TOKENS_PER_PAGE;
}

function formatUsd(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  if (value >= 0.01) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toFixed(6)}`;
}

function normalizeExportStyle(style) {
  const fallback = EXPORT_STYLE_PRESETS[DEFAULT_EXPORT_PRESET].style;
  return {
    titleFont: typeof style?.titleFont === "string" && style.titleFont.trim() ? style.titleFont.trim() : fallback.titleFont,
    headingFont: typeof style?.headingFont === "string" && style.headingFont.trim() ? style.headingFont.trim() : fallback.headingFont,
    bodyFont: typeof style?.bodyFont === "string" && style.bodyFont.trim() ? style.bodyFont.trim() : fallback.bodyFont,
    metaFont: typeof style?.metaFont === "string" && style.metaFont.trim() ? style.metaFont.trim() : fallback.metaFont,
    titleSize: clampNumber(style?.titleSize, 16, 36, fallback.titleSize),
    headingSize: clampNumber(style?.headingSize, 10, 24, fallback.headingSize),
    bodySize: clampNumber(style?.bodySize, 9, 18, fallback.bodySize),
    metaSize: clampNumber(style?.metaSize, 8, 16, fallback.metaSize),
    lineHeight: clampNumber(style?.lineHeight, 1.1, 2, fallback.lineHeight),
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function mapPdfFontFamily(fontValue) {
  const normalized = String(fontValue || "").toLowerCase();
  if (/(garamond|georgia|times|serif)/.test(normalized)) {
    return "times";
  }

  if (/(courier|mono|consolas)/.test(normalized)) {
    return "courier";
  }

  return "helvetica";
}

function renderHighlights() {
  const session = getActiveSession();
  highlightChips.innerHTML = "";

  session.highlights.forEach((highlight, index) => {
    const fragment = highlightChipTemplate.content.cloneNode(true);
    const chip = fragment.querySelector(".chip");
    const chipText = fragment.querySelector(".chip-text");

    chipText.textContent = highlight;
    chip.setAttribute("aria-label", `Remove highlight ${highlight}`);
    chip.addEventListener("click", () => {
      const nextHighlights = session.highlights.filter((_, currentIndex) => currentIndex !== index);
      updateActiveSession({ highlights: nextHighlights }, true);
    });

    highlightChips.appendChild(fragment);
  });
}

function renderParticipantSuggestions() {
  const session = getActiveSession();
  const selectedParticipants = new Set(parseParticipants(session.participants));
  const availableParticipants = (settings.participantDirectory || []).filter((name) => !selectedParticipants.has(name));

  participantSuggestions.innerHTML = availableParticipants
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");

  participantChips.innerHTML = "";
  availableParticipants.forEach((name) => {
    const fragment = highlightChipTemplate.content.cloneNode(true);
    const chip = fragment.querySelector(".chip");
    const chipText = fragment.querySelector(".chip-text");
    const chipRemove = fragment.querySelector(".chip-remove");

    chip.dataset.participantName = name;
    chipText.textContent = name;
    chipRemove.textContent = "+";
    chip.setAttribute("aria-label", `Add participant ${name}`);
    participantChips.appendChild(fragment);
  });

  if (!participantsField.hidden) {
    setElementVisibility(participantDirectoryPanel, true);
  }

  updateParticipantDirectoryVisibility();
}

function updateParticipantDirectoryVisibility() {
  setElementVisibility(participantChips, participantDirectoryExpanded);
  if (toggleParticipantDirectoryLabel) {
    toggleParticipantDirectoryLabel.textContent = participantDirectoryExpanded ? "Hide list" : "Show list";
  }
  toggleParticipantDirectoryButton.setAttribute("aria-expanded", String(participantDirectoryExpanded));
}

function renderParticipantDirectoryManager() {
  participantDirectoryList.innerHTML = "";
  selectedParticipantNames = new Set(
    Array.from(selectedParticipantNames).filter((name) => (settings.participantDirectory || []).includes(name))
  );

  (settings.participantDirectory || []).forEach((name) => {
    const fragment = participantDirectoryItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".participant-directory-item");
    const selectInput = fragment.querySelector(".participant-directory-select");
    const input = fragment.querySelector(".participant-directory-name");
    item.dataset.participantName = name;
    selectInput.checked = selectedParticipantNames.has(name);
    input.value = name;
    participantDirectoryList.appendChild(fragment);
  });

  updateParticipantSelectionControls();
}

function updateParticipantSelectionControls() {
  const participantNames = settings.participantDirectory || [];
  const selectedCount = participantNames.filter((name) => selectedParticipantNames.has(name)).length;
  const hasParticipants = participantNames.length > 0;

  selectAllParticipantsInput.checked = hasParticipants && selectedCount === participantNames.length;
  selectAllParticipantsInput.indeterminate = selectedCount > 0 && selectedCount < participantNames.length;
  selectAllParticipantsInput.disabled = !hasParticipants;

  deleteSelectedParticipantsButton.disabled = selectedCount === 0;
  deleteSelectedParticipantsButton.textContent = selectedCount > 0
    ? `Delete selected (${selectedCount})`
    : "Delete selected";
}

function renderAbbreviationDirectoryManager() {
  abbreviationDirectoryList.innerHTML = "";

  (settings.abbreviationDirectory || []).forEach((entry) => {
    const fragment = abbreviationDirectoryItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".abbreviation-directory-item");
    const shortInput = fragment.querySelector(".abbreviation-short-name");
    const fullInput = fragment.querySelector(".abbreviation-full-name");
    item.dataset.abbreviationShort = entry.short;
    shortInput.value = entry.short;
    fullInput.value = entry.full;
    abbreviationDirectoryList.appendChild(fragment);
  });
}

function renderCustomHeaders() {
  const session = getActiveSession();
  customHeaderList.innerHTML = "";

  session.customHeaders.forEach((header, index) => {
    const fragment = customHeaderTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".custom-header-item");
    const includeInput = fragment.querySelector(".custom-header-include");
    const toggleLabel = fragment.querySelector(".custom-header-toggle-label");
    const titleInput = fragment.querySelector(".custom-header-title");
    const instructionsInput = fragment.querySelector(".custom-header-instructions");
    const editor = fragment.querySelector(".custom-header-editor");
    const editButton = fragment.querySelector(".custom-header-edit");

    item.dataset.index = String(index);
    includeInput.checked = header.include !== false;
    toggleLabel.textContent = header.title.trim() || `Custom Section ${index + 1}`;
    titleInput.value = header.title;
    instructionsInput.value = header.instructions;
    setElementVisibility(editor, header.isExpanded === true);
    editButton.textContent = header.isExpanded === true ? "Close" : "Edit";

    customHeaderList.appendChild(fragment);
  });

  updateTranscribeOnlyUi(session);
}

function renderTemplateSectionOptions() {
  const session = getActiveSession();
  const template = getTemplateDefinition(session.template);
  const templateSections = normalizeTemplateHeaders(template.headers || []);

  if (!templateSectionList) {
    return;
  }

  templateSectionList.innerHTML = "";
  setElementVisibility(templateSectionList, templateSections.length > 0);

  templateSections.forEach((section, index) => {
    const label = document.createElement("label");
    label.className = "config-option template-section-option";
    label.innerHTML = `
      <input class="template-section-include" data-section-id="${escapeHtml(section.id)}" type="checkbox" ${session.templateSectionStates?.[section.id] !== false ? "checked" : ""}>
      <span>${escapeHtml(section.title.trim() || `Template Section ${index + 1}`)}</span>
    `;
    templateSectionList.appendChild(label);
  });
}

function updateDetailLevelLabel() {
  detailLevelLabel.textContent = getDetailLevelLabel(Number(detailLevelInput.value));
}

function renderOutput() {
  const session = getActiveSession();
  const exportStyle = getCurrentExportStyle();
  polishedOutput.style.setProperty("--output-title-font", exportStyle.titleFont);
  polishedOutput.style.setProperty("--output-heading-font", exportStyle.headingFont);
  polishedOutput.style.setProperty("--output-body-font", exportStyle.bodyFont);
  polishedOutput.style.setProperty("--output-meta-font", exportStyle.metaFont);
  polishedOutput.style.setProperty("--output-title-size", `${exportStyle.titleSize}pt`);
  polishedOutput.style.setProperty("--output-heading-size", `${exportStyle.headingSize}pt`);
  polishedOutput.style.setProperty("--output-body-size", `${exportStyle.bodySize}pt`);
  polishedOutput.style.setProperty("--output-meta-size", `${exportStyle.metaSize}pt`);
  polishedOutput.style.setProperty("--output-line-height", String(exportStyle.lineHeight));

  if (!session.polishedHtml) {
    polishedOutput.contentEditable = "false";
    polishedOutput.spellcheck = false;
    polishedOutput.classList.remove("is-editable");
    polishedOutput.innerHTML = `
      <div class="output-empty">
        <div>
          <h3>Your finished notes will appear here.</h3>
          <p>Add notes or transcript above, include highlights if useful, then click <strong>Generate</strong>.</p>
        </div>
      </div>
    `;
    updateTranslateButton();
    return;
  }

  polishedOutput.innerHTML = session.polishedHtml;
  polishedOutput.contentEditable = "true";
  polishedOutput.spellcheck = true;
  polishedOutput.classList.add("is-editable");
  updateTranslateButton();
  syncMobileUi();
}

function updateExportButtons() {
  const hasOutput = Boolean(getActiveSession()?.polishedHtml);
  exportWordButton.disabled = !hasOutput;
  exportPdfButton.disabled = !hasOutput;
  translateOutputButton.disabled = !hasOutput;
  improveOutputButton.disabled = !hasOutput;
  revertOutputButton.disabled = !Boolean(getActiveSession()?.previousPolishedHtml);
  updateTranslateButton();
  syncMobileUi();
}

function updateTranslateButton() {
  const session = getActiveSession();
  if (!session?.polishedHtml) {
    translateOutputButton.textContent = "Translate";
    return;
  }

  const currentLanguage = detectOutputContentLanguage(session);
  const targetLanguage = getOppositeOutputLanguage(currentLanguage);
  translateOutputButton.textContent = `Translate to ${getOutputLanguageLabel(targetLanguage)}`;
}

function updateActiveSession(patch, shouldScheduleSave) {
  sessions = sessions.map((session) => {
    if (session.id !== activeSessionId) {
      return session;
    }

    return {
      ...session,
      ...patch,
      updatedAt: Date.now(),
    };
  });

  sessions.sort((first, second) => second.updatedAt - first.updatedAt);
  setAppStatus(
    shouldScheduleSave ? "Saving changes" : "Saved locally",
    shouldScheduleSave ? APP_STATUS_STATES.saving : APP_STATUS_STATES.idle
  );
  renderSessionList();

  if (patch.title !== undefined) {
    titleDisplay.textContent = patch.title.trim() || "Untitled session";
  }

  if (patch.highlights !== undefined) {
    renderHighlights();
  }

  if (patch.customHeaders !== undefined) {
    syncDefaultCustomHeaders(patch.customHeaders);
    renderCustomHeaders();
  }

  if (patch.templateSectionStates !== undefined || patch.template !== undefined) {
    renderTemplateSectionOptions();
  }

  if (patch.transcribeOnly !== undefined) {
    updateTranscribeOnlyUi(getActiveSession());
  }

  if (shouldScheduleSave) {
    schedulePersist();
  } else {
    persistSessions();
  }
}

function updateActiveSessionSilently(patch) {
  sessions = sessions.map((session) => {
    if (session.id !== activeSessionId) {
      return session;
    }

    return {
      ...session,
      ...patch,
      updatedAt: Date.now(),
    };
  });

  sessions.sort((first, second) => second.updatedAt - first.updatedAt);
  setAppStatus("Saving changes", APP_STATUS_STATES.saving);
  if (patch.customHeaders !== undefined) {
    syncDefaultCustomHeaders(patch.customHeaders);
  }
  if (patch.templateSectionStates !== undefined || patch.template !== undefined) {
    renderTemplateSectionOptions();
  }
  renderSessionList();
  schedulePersist();
}

function syncDefaultCustomHeaders(customHeaders) {
  settings.defaultCustomHeaders = normalizeCustomHeaders(customHeaders).map((header) => ({
    ...header,
    isExpanded: false,
  }));
  persistSettings();
}

function schedulePersist() {
  window.clearTimeout(draftSaveTimeout);
  draftSaveTimeout = window.setTimeout(() => {
    persistSessions();
    setAppStatus("Saved locally", APP_STATUS_STATES.idle);
  }, 220);
}

function createSession(templateId = null) {
  const defaultTemplate = getTemplateDefinition(templateId || (isMobileLayout() ? "personalNote" : getPreferredDesktopTemplateId()));
  const createdAt = Date.now();
  const defaultSchedule = getDefaultMeetingScheduleForTemplate(defaultTemplate, createdAt);
  const defaultTitle = getDefaultTitleForTemplate(defaultTemplate, createdAt, {
    meetingDate: defaultSchedule.meetingDate,
    meetingStartTime: defaultSchedule.meetingStartTime,
    meetingEndTime: defaultSchedule.meetingEndTime,
    participants: "",
  });
  return {
    id: crypto.randomUUID(),
    title: defaultTitle,
    template: defaultTemplate.id,
    participants: "",
    meetingDate: defaultSchedule.meetingDate,
    meetingStartTime: defaultSchedule.meetingStartTime,
    meetingEndTime: defaultSchedule.meetingEndTime,
    agenda: "",
    sections: createDefaultSections(),
    transcribeOnly: getDefaultTranscribeOnlyForTemplate(defaultTemplate),
    outputLanguage: "auto",
    detailLevel: 3,
    additionalInstructions: "",
    templateSectionStates: createTemplateSectionStates(defaultTemplate.headers || []),
    customFieldValues: normalizeCustomFieldValues({}, defaultTemplate.customFields || []),
    customHeaders: cloneCustomHeadersForSession(settings.defaultCustomHeaders || []),
    highlights: [],
    liveTranscript: "",
    uploadedTranscript: "",
    pendingAudioDraftMeta: null,
    rawNotes: "",
    outputFeedback: "",
    polishedHtml: "",
    previousPolishedHtml: "",
    updatedAt: createdAt,
  };
}

function createAndOpenNewSession(templateId = null) {
  if (audioRecordingSessionId) {
    void stopAudioCapture();
  }
  const nextSession = createSession(templateId);
  sessions.unshift(nextSession);
  activeSessionId = nextSession.id;
  persistSettings();
  persistSessions();
  render();
  if (contextCardDisclosure) {
    contextCardDisclosure.open = nextSession.template === "meeting";
  }
  meetingTitleInput.focus();
}

function cloneCustomHeadersForSession(customHeaders) {
  return normalizeCustomHeaders(customHeaders).map((header) => ({
    ...header,
    id: crypto.randomUUID(),
    isExpanded: false,
  }));
}

function createCustomTemplate() {
  return {
    id: `custom-${crypto.randomUUID()}`,
    label: "",
    sourceTemplateId: "",
    isExpanded: true,
    summaryLead: "This note focused on the most important business updates and follow-ups.",
    sections: ["Overview", "Key Discussion Points", "Decisions", "Action Items"],
    templateInstructions: "",
    headers: [],
    customFields: [],
    fields: {
      title: true,
      participants: true,
      agenda: false,
      highlights: true,
      manualNotes: true,
      liveTranscript: true,
      meetingDate: false,
      meetingStartTime: false,
      meetingEndTime: false,
    },
  };
}

function buildTemplateSummary(template) {
  const enabledFields = [
    template.fields.title !== false ? "title" : null,
    template.fields.participants !== false ? "participants" : null,
    template.fields.agenda === true ? "agenda" : null,
    template.fields.highlights !== false ? "highlights" : null,
    template.fields.manualNotes !== false ? "manual notes" : null,
    template.fields.liveTranscript !== false ? "live transcript" : null,
    template.fields.meetingDate === true ? "date" : null,
    template.fields.meetingStartTime === true ? "start time" : null,
    template.fields.meetingEndTime === true ? "end time" : null,
  ].filter(Boolean);

  return `${enabledFields.length + normalizeTemplateCustomFields(template.customFields).length} fields · ${normalizeTemplateHeaders(template.headers).length} sections`;
}

function createTemplateHeader(title = "", instructions = "") {
  return {
    id: crypto.randomUUID(),
    title,
    instructions,
  };
}

function createTemplateSectionStates(headers = []) {
  return normalizeTemplateHeaders(headers).reduce((accumulator, header) => {
    accumulator[header.id] = true;
    return accumulator;
  }, {});
}

function normalizeTemplateSectionStates(templateSectionStates, headers = []) {
  const normalizedHeaders = normalizeTemplateHeaders(headers);
  const nextState = {};

  normalizedHeaders.forEach((header) => {
    nextState[header.id] = templateSectionStates?.[header.id] !== false;
  });

  return nextState;
}

function readCustomTemplateItem(item, fallbackTemplate) {
  const name = item.querySelector(".custom-template-name").value.trim();
  const nextTemplate = {
    ...fallbackTemplate,
    label: name,
    templateInstructions: item.querySelector(".custom-template-instructions").value,
    fields: {
      title: item.querySelector(".custom-template-show-title").checked,
      participants: item.querySelector(".custom-template-show-participants").checked,
      agenda: item.querySelector(".custom-template-show-agenda").checked,
      highlights: item.querySelector(".custom-template-show-highlights").checked,
      manualNotes: item.querySelector(".custom-template-show-manual-notes").checked,
      liveTranscript: item.querySelector(".custom-template-show-live-transcript").checked,
      meetingDate: item.querySelector(".custom-template-show-meeting-date").checked,
      meetingStartTime: item.querySelector(".custom-template-show-meeting-start-time").checked,
      meetingEndTime: item.querySelector(".custom-template-show-meeting-end-time").checked,
    },
  };

  const headerItems = [...item.querySelectorAll(".template-header-item")];
  nextTemplate.headers = headerItems.map((headerItem) => ({
    id: headerItem.dataset.headerId || crypto.randomUUID(),
    title: headerItem.querySelector(".template-header-title").value,
    instructions: headerItem.querySelector(".template-header-instructions").value,
    isExpanded: !headerItem.querySelector(".template-header-editor").classList.contains("is-hidden-field"),
  }));

  const fieldItems = [...item.querySelectorAll(".template-field-item")];
  nextTemplate.customFields = fieldItems.map((fieldItem) => ({
    id: fieldItem.dataset.fieldId || crypto.randomUUID(),
    label: fieldItem.querySelector(".template-field-name").value,
    type: fieldItem.querySelector(".template-field-type").value,
    isExpanded: !fieldItem.querySelector(".template-field-editor").classList.contains("is-hidden-field"),
  }));

  return normalizeCustomTemplate(nextTemplate);
}

function deleteSession(sessionId) {
  selectedSessionIds.delete(sessionId);
  void clearAudioDraft(sessionId);
  sessions = sessions.filter((session) => session.id !== sessionId);

  if (!sessions.length) {
    const nextSession = createSession();
    sessions = [nextSession];
    activeSessionId = nextSession.id;
  } else if (activeSessionId === sessionId) {
    activeSessionId = sessions[0].id;
  }

  persistSessions();
  render();
}

function deleteSessions(sessionIds) {
  const idsToDelete = new Set(sessionIds);
  selectedSessionIds = new Set(Array.from(selectedSessionIds).filter((sessionId) => !idsToDelete.has(sessionId)));
  sessionIds.forEach((sessionId) => {
    void clearAudioDraft(sessionId);
  });
  sessions = sessions.filter((session) => !idsToDelete.has(session.id));

  if (!sessions.length) {
    const nextSession = createSession();
    sessions = [nextSession];
    activeSessionId = nextSession.id;
  } else if (idsToDelete.has(activeSessionId)) {
    activeSessionId = sessions[0].id;
  }

  persistSessions();
  render();
}

function getActiveSession() {
  return sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
}

function hasTextInputForGeneration(session) {
  return Boolean(
    session?.liveTranscript?.trim()
    || session?.uploadedTranscript?.trim()
    || session?.rawNotes?.trim()
  );
}

function buildLocalPolishedNotes(session) {
  if (session.transcribeOnly) {
    return buildTranscriptOnlyHtml(session);
  }

  const template = getTemplateDefinition(session.template);
  const sectionConfig = normalizeSectionConfig(session.sections);
  const outputLanguage = resolveOutputLanguage(session);
  const copy = getOutputCopy(outputLanguage);
  const normalizedLines = normalizeNotes(buildCombinedNotes(session));
  const grouped = splitIntoSections(normalizedLines, template.sections);
  const highlights = session.highlights.length ? session.highlights : deriveHighlights(normalizedLines);
  const actions = deriveActionItems(normalizedLines);
  const decisions = deriveDecisions(normalizedLines);
  const summary = buildSummary(session, template, normalizedLines, highlights, actions, outputLanguage);
  const customSectionsMarkup = buildLocalCustomSectionsMarkup(session, copy, template);
  const agenda = getAgendaText(session);
  const participants = session.participants
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const showParticipants = template.fields?.participants !== false;
  const meetingScheduleMeta = buildMeetingScheduleMeta(session);

  const discussionMarkup = grouped.length
    ? grouped
        .map((group) => `
          <section class="output-section">
            <h4>${escapeHtml(localizeHeading(group.heading, copy))}</h4>
            <ul>${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
        `)
        .join("")
    : `
      <section class="output-section">
        <h4>${escapeHtml(localizeHeading(template.sections[1], copy))}</h4>
        <p>${escapeHtml(copy.noDiscussion)}</p>
      </section>
    `;

  return `
    <article class="output-doc">
      <header class="output-header">
        <h3>${escapeHtml(session.title.trim() || "Untitled session")}</h3>
        <p class="output-meta">
          ${escapeHtml(template.label)} - ${formatDate(session.updatedAt)}
          ${meetingScheduleMeta ? ` - ${escapeHtml(meetingScheduleMeta)}` : ""}
          ${showParticipants && participants.length ? ` - Participants: ${escapeHtml(participants.join(", "))}` : ""}
        </p>
      </header>

      ${sectionConfig.includeAgenda ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.agendaHeading)}</h4>
          <p>${escapeHtml(agenda || copy.noAgenda).replace(/\n/g, "<br>")}</p>
        </section>
      ` : ""}

      ${sectionConfig.includeSummary ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.summaryHeading)}</h4>
          <p>${escapeHtml(summary)}</p>
        </section>
      ` : ""}

      ${sectionConfig.includeHighlights ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.highlightsHeading)}</h4>
            <ul>${toListMarkup(highlights, copy.noHighlights)}</ul>
        </section>
      ` : ""}

      ${discussionMarkup}

      ${customSectionsMarkup}

      ${sectionConfig.includeDecisions ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.decisionsHeading)}</h4>
            <ul>${toListMarkup(decisions, copy.noDecisions)}</ul>
        </section>
      ` : ""}

      ${sectionConfig.includeActions ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.actionsHeading)}</h4>
            <ul>${toListMarkup(actions, copy.noActions)}</ul>
        </section>
      ` : ""}
    </article>
  `;
}

function buildTranscriptOnlyHtml(session, transcriptText = "") {
  const template = getTemplateDefinition(session.template);
  const outputLanguage = resolveOutputLanguage(session);
  const sourceText = transcriptText.trim() || buildCombinedNotes(session).trim();
  const normalizedParagraphs = sourceText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const participants = parseParticipants(session.participants);
  const meetingScheduleMeta = buildMeetingScheduleMeta(session);
  const bodyMarkup = normalizedParagraphs.length
    ? normalizedParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
    : `<p>${escapeHtml(outputLanguage === OUTPUT_LANGUAGES.swedish ? "Ingen text att transkribera." : "No transcript available yet.")}</p>`;

  return `
    <article class="output-doc">
      <header class="output-header">
        <h3>${escapeHtml(session.title.trim() || (outputLanguage === OUTPUT_LANGUAGES.swedish ? "Transkribering" : "Transcript"))}</h3>
        <p class="output-meta">
          ${escapeHtml(template.label)} - ${formatDate(session.updatedAt)}
          ${meetingScheduleMeta ? ` - ${escapeHtml(meetingScheduleMeta)}` : ""}
          ${template.fields?.participants !== false && participants.length ? ` - Participants: ${escapeHtml(participants.join(", "))}` : ""}
        </p>
      </header>
      <section class="output-section">
        <h4>${escapeHtml(outputLanguage === OUTPUT_LANGUAGES.swedish ? "Transkribering" : "Transcript")}</h4>
        ${bodyMarkup}
      </section>
    </article>
  `;
}

async function polishWithOpenAI(session, activeSettings) {
  if (session.transcribeOnly) {
    return transcribeWithOpenAI(session, activeSettings);
  }

  const template = getTemplateDefinition(session.template);
  const outputLanguage = resolveOutputLanguage(session);
  const prompt = buildAiPrompt(session, template, outputLanguage);
  const promptSettings = normalizePromptSettings(activeSettings.promptSettings);
  const generationSystemText = template.id === "personalNote"
    ? promptSettings.personalNotesSystem
    : promptSettings.meetingMinutesSystem;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: activeSettings.model || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: generationSystemText,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meeting_notes",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              agenda: { type: "string" },
              summary: { type: "string" },
              highlights: {
                type: "array",
                items: { type: "string" },
              },
              discussionPoints: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    heading: { type: "string" },
                    items: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["heading", "items"],
                },
              },
              decisions: {
                type: "array",
                items: { type: "string" },
              },
              actionItems: {
                type: "array",
                items: { type: "string" },
              },
              customSections: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    heading: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["heading", "content"],
                },
              },
            },
            required: ["title", "agenda", "summary", "highlights", "discussionPoints", "decisions", "actionItems", "customSections"],
          },
        },
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "The OpenAI request did not complete successfully.";
    throw new Error(message);
  }

  const responseText = extractResponseText(payload);

  if (!responseText) {
    throw new Error("The OpenAI response did not include any readable output text.");
  }

  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("The OpenAI response could not be parsed into structured notes.");
  }

  return buildAiOutputHtml(session, template, parsed, outputLanguage);
}

async function transcribeWithOpenAI(session, activeSettings) {
  const outputLanguage = resolveOutputLanguage(session);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: activeSettings.model || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You clean up rough spoken or written notes into a faithful transcript. Do not summarize or polish into business-note sections. Preserve meaning, order, and language. Fix obvious transcription mistakes, punctuation, and paragraphing only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Output language: ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}`,
                "Mode: Transcribe only. Do not summarize, categorize, or convert into meeting-note sections.",
                "Live transcript:",
                session.liveTranscript?.trim() || "No transcript provided.",
                "",
                "Uploaded transcript:",
                session.uploadedTranscript?.trim() || "No uploaded transcript provided.",
                "",
                "Manual notes:",
                session.rawNotes?.trim() || "No manual notes provided.",
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "The OpenAI transcription request did not complete successfully.";
    throw new Error(message);
  }

  const responseText = extractResponseText(payload);
  if (!responseText) {
    throw new Error("The OpenAI transcription response did not include any readable text.");
  }

  return buildTranscriptOnlyHtml(session, responseText);
}

async function translateOutputWithOpenAI(session, activeSettings, targetLanguage) {
  const sourceHtml = session.polishedHtml || polishedOutput.innerHTML || "";
  const sourceLanguage = detectOutputContentLanguage(session);
  const promptSettings = normalizePromptSettings(activeSettings.promptSettings);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: activeSettings.model || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You translate existing HTML meeting notes. Preserve the HTML structure faithfully and return only translated HTML with no commentary or markdown fences.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Translate this HTML from ${getOutputLanguageLabel(sourceLanguage)} to ${getOutputLanguageLabel(targetLanguage)}.`,
                promptSettings.translationRules,
                "",
                "Additional prompt blocks:",
                formatAdditionalPromptsForPrompt(promptSettings.additionalPrompts),
                "",
                "Current HTML:",
                sourceHtml,
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "The OpenAI translation request did not complete successfully.";
    throw new Error(message);
  }

  const responseText = stripCodeFences(extractResponseText(payload));
  if (!responseText) {
    throw new Error("The OpenAI translation response did not include any readable HTML.");
  }

  return responseText;
}

async function transcribeAudioDraftWithOpenAI(audioDraft, activeSettings, options = {}) {
  if (!audioDraft?.blob) {
    throw new Error("No audio file is available to transcribe.");
  }
  const file = audioDraft.blob instanceof File
    ? audioDraft.blob
    : new File([audioDraft.blob], audioDraft.fileName || buildAudioRecordingFileName(), {
      type: audioDraft.mimeType || audioDraft.blob.type || "audio/webm",
    });

  const reportProgress = typeof options.onProgress === "function"
    ? options.onProgress
    : () => {};

  if (file.size <= MAX_AUDIO_UPLOAD_BYTES) {
    reportProgress("Transcribing audio...");
    return transcribeSingleAudioFileWithOpenAI(file, activeSettings);
  }

  reportProgress("Preparing large audio file for chunked transcription...");
  const chunks = await splitAudioFileForTranscription(file);
  const transcripts = [];

  for (let index = 0; index < chunks.length; index += 1) {
    reportProgress(`Transcribing audio part ${index + 1} of ${chunks.length}...`);
    const transcript = await transcribeSingleAudioFileWithOpenAI(chunks[index], activeSettings);
    if (transcript.trim()) {
      transcripts.push(transcript.trim());
    }
  }

  const combinedTranscript = transcripts.join("\n\n").trim();
  if (!combinedTranscript) {
    throw new Error("The audio chunks were processed, but no transcript text was returned.");
  }

  return combinedTranscript;
}

async function transcribeSingleAudioFileWithOpenAI(file, activeSettings) {
  const formData = new FormData();
  const transcriptionModel = resolveSelectedTranscriptionModel(activeSettings.transcriptionModel);
  const isDiarizationModel = transcriptionModel.includes("diarize");

  formData.append("file", file);
  formData.append("model", transcriptionModel);

  if (!isDiarizationModel) {
    formData.append(
      "prompt",
      "Transcribe the audio faithfully. Preserve the original language, keep both nearby and speaker voices when they are audible, and return only the transcript text with clean punctuation."
    );
  }

  const forcedLanguage = settings.dictationLanguage === "sv-SE"
    ? "sv"
    : settings.dictationLanguage === "en-US"
      ? "en"
      : "";

  if (forcedLanguage) {
    formData.append("language", forcedLanguage);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${activeSettings.apiKey}`,
    },
    body: formData,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.error?.message || "The OpenAI audio transcription request did not complete successfully.";
    throw new Error(message);
  }

  const transcriptText = typeof payload === "string"
    ? payload
    : payload?.text || payload?.transcript || "";

  if (!transcriptText.trim()) {
    throw new Error("The OpenAI audio transcription response did not include any readable transcript text.");
  }

  return transcriptText.trim();
}

async function splitAudioFileForTranscription(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("This browser cannot split large audio files automatically. Please try a smaller file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContextClass();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const monoSamples = mixAudioBufferToMono(audioBuffer);
    const samplesPerChunk = Math.max(
      audioBuffer.sampleRate,
      Math.floor((AUDIO_CHUNK_TARGET_BYTES - 44) / 2)
    );
    const totalChunks = Math.ceil(monoSamples.length / samplesPerChunk);
    const baseName = (file.name || "audio")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "audio";
    const chunks = [];

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * samplesPerChunk;
      const end = Math.min(monoSamples.length, start + samplesPerChunk);
      const chunkSamples = monoSamples.slice(start, end);
      const wavBlob = createMonoWavBlob(chunkSamples, audioBuffer.sampleRate);
      chunks.push(new File([wavBlob], `${baseName}-part-${index + 1}.wav`, { type: "audio/wav" }));
    }

    return chunks;
  } catch {
    throw new Error("This large audio file could not be decoded for automatic splitting in this browser. Try wav, m4a, mp3, or a smaller file.");
  } finally {
    if (typeof audioContext.close === "function") {
      await audioContext.close().catch(() => {});
    }
  }
}

function mixAudioBufferToMono(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  if (channelCount <= 1) {
    return audioBuffer.getChannelData(0).slice();
  }

  const mixed = new Float32Array(length);
  for (let channel = 0; channel < channelCount; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mixed[index] += channelData[index] / channelCount;
    }
  }

  return mixed;
}

function createMonoWavBlob(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeWavString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeWavString(view, 8, "WAVE");
  writeWavString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeWavString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeWavString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

async function readTranscriptFile(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();

  if (extension === "doc") {
    throw new Error("Legacy .doc files are not supported in the browser yet. Please save the file as .docx or .txt and upload it again.");
  }

  if (extension === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (!window.mammoth?.extractRawText) {
      throw new Error("Word document support did not load in this browser. Please try again or upload the transcript as .txt.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const text = String(result?.value || "").replace(/\r\n/g, "\n").trim();

    if (!text) {
      throw new Error("The uploaded Word document did not contain any readable transcript text.");
    }

    return text;
  }

  const text = (await file.text()).replace(/\r\n/g, "\n").trim();
  if (!text) {
    throw new Error("The uploaded transcript file did not contain any readable text.");
  }

  return text;
}

async function revisePolishedNotesWithOpenAI(session, activeSettings, feedback) {
  if (session.transcribeOnly) {
    return buildRevisedLocalPolishedNotes(session, feedback);
  }

  const template = getTemplateDefinition(session.template);
  const outputLanguage = resolveOutputLanguage(session);
  const prompt = buildAiRevisionPrompt(session, template, outputLanguage, feedback);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: activeSettings.model || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You revise polished professional notes based on user feedback. Keep the notes accurate, professional, business-focused, and grounded in the supplied notes. Apply the requested improvements without inventing facts. Preserve the language of the source notes. Exclude private matters, greetings, and small talk.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meeting_notes_revision",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
              agenda: { type: "string" },
              discussionPoints: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    heading: { type: "string" },
                    items: { type: "array", items: { type: "string" } },
                  },
                  required: ["heading", "items"],
                },
              },
              decisions: { type: "array", items: { type: "string" } },
              actionItems: { type: "array", items: { type: "string" } },
              customSections: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    heading: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["heading", "content"],
                },
              },
            },
            required: ["title", "agenda", "summary", "highlights", "discussionPoints", "decisions", "actionItems", "customSections"],
          },
        },
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "The OpenAI revision request did not complete successfully.";
    throw new Error(message);
  }

  const responseText = extractResponseText(payload);
  if (!responseText) {
    throw new Error("The OpenAI revision response did not include any readable output text.");
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("The OpenAI revision response could not be parsed into structured notes.");
  }

  return buildAiOutputHtml(session, template, parsed, outputLanguage);
}

function buildAiPrompt(session, template, outputLanguage) {
  const sectionConfig = normalizeSectionConfig(session.sections);
  const sourceLanguage = detectSourceLanguage(session);
  const templateHeaders = formatTemplateHeadersForPrompt(template.headers || [], session);
  const templateCustomFields = formatTemplateCustomFieldsForPrompt(template, session);
  const promptSettings = normalizePromptSettings(settings.promptSettings);
  const generationRules = template.id === "personalNote"
    ? promptSettings.personalNotesRules
    : promptSettings.meetingMinutesRules;
  return [
    `Template: ${template.label}`,
    `Meeting title: ${session.title.trim() || "Untitled session"}`,
    `Meeting schedule: ${buildMeetingSchedulePromptText(session)}`,
    `Participants: ${template.fields?.participants === false ? "Not applicable for this template" : session.participants.trim() || "Not provided"}`,
    `Agenda: ${getAgendaText(session) || "Not provided"}`,
    `User-added highlights: ${session.highlights.length ? session.highlights.join(" | ") : "None"}`,
    `Output language: ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}`,
    `Detail level: ${getDetailLevelLabel(session.detailLevel ?? 3)}`,
    `Include agenda: ${sectionConfig.includeAgenda ? "yes" : "no"}`,
    `Include executive summary: ${sectionConfig.includeSummary ? "yes" : "no"}`,
    `Include highlights: ${sectionConfig.includeHighlights ? "yes" : "no"}`,
    `Include decisions: ${sectionConfig.includeDecisions ? "yes" : "no"}`,
    `Include action items: ${sectionConfig.includeActions ? "yes" : "no"}`,
    "Live transcript:",
    session.liveTranscript?.trim() || "No transcript provided.",
    "",
    "Uploaded transcript:",
    session.uploadedTranscript?.trim() || "No uploaded transcript provided.",
    "",
    "Manual notes:",
    session.rawNotes.trim() || "No manual notes provided.",
    "",
    "Template-specific instructions:",
    template.templateInstructions?.trim() || "No template-specific instructions.",
    "",
    "Template-specific input fields and values:",
    templateCustomFields,
    "",
    "Template-specific sections and instructions:",
    templateHeaders,
    "",
    "Custom sections and instructions:",
    formatCustomHeadersForPrompt(session.customHeaders),
    "",
    "Known user abbreviations and full wording:",
    formatAbbreviationsForPrompt(settings.abbreviationDirectory),
    "",
    "Additional user instructions:",
    session.additionalInstructions?.trim() || "No additional instructions.",
    "",
    "Additional prompt blocks:",
    formatAdditionalPromptsForPrompt(promptSettings.additionalPrompts),
    "",
    "Return polished professional notes in the requested schema.",
    "Requirements:",
    `- Write the output in ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}.`,
    sourceLanguage !== outputLanguage
      ? `- Translate the notes from ${sourceLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"} into ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}.`
      : "- Keep the wording in the same language as the source notes.",
    `- Match this detail level: ${getDetailLevelLabel(session.detailLevel ?? 3)}.`,
    "- Keep the summary to 3-5 sentences.",
    generationRules,
  ].join("\n");
}

function buildAiRevisionPrompt(session, template, outputLanguage, feedback) {
  const sectionConfig = normalizeSectionConfig(session.sections);
  const currentOutputText = htmlToPlainText(session.polishedHtml);
  const sourceLanguage = detectSourceLanguage(session);
  const templateHeaders = formatTemplateHeadersForPrompt(template.headers || [], session);
  const templateCustomFields = formatTemplateCustomFieldsForPrompt(template, session);
  const promptSettings = normalizePromptSettings(settings.promptSettings);

  return [
    `Template: ${template.label}`,
    `Meeting title: ${session.title.trim() || "Untitled session"}`,
    `Meeting schedule: ${buildMeetingSchedulePromptText(session)}`,
    `Participants: ${template.fields?.participants === false ? "Not applicable for this template" : session.participants.trim() || "Not provided"}`,
    `Agenda: ${getAgendaText(session) || "Not provided"}`,
    `Output language: ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}`,
    `Detail level: ${getDetailLevelLabel(session.detailLevel ?? 3)}`,
    `Include agenda: ${sectionConfig.includeAgenda ? "yes" : "no"}`,
    `Include executive summary: ${sectionConfig.includeSummary ? "yes" : "no"}`,
    `Include highlights: ${sectionConfig.includeHighlights ? "yes" : "no"}`,
    `Include decisions: ${sectionConfig.includeDecisions ? "yes" : "no"}`,
    `Include action items: ${sectionConfig.includeActions ? "yes" : "no"}`,
    "User feedback for improving the current polished output:",
    feedback,
    "",
    "Current polished output:",
    currentOutputText || "No current polished output provided.",
    "",
    "Live transcript:",
    session.liveTranscript?.trim() || "No transcript provided.",
    "",
    "Uploaded transcript:",
    session.uploadedTranscript?.trim() || "No uploaded transcript provided.",
    "",
    "Manual notes:",
    session.rawNotes.trim() || "No manual notes provided.",
    "",
    "Template-specific instructions:",
    template.templateInstructions?.trim() || "No template-specific instructions.",
    "",
    "Template-specific input fields and values:",
    templateCustomFields,
    "",
    "Template-specific sections and instructions:",
    templateHeaders,
    "",
    "Custom sections and instructions:",
    formatCustomHeadersForPrompt(session.customHeaders),
    "",
    "Known user abbreviations and full wording:",
    formatAbbreviationsForPrompt(settings.abbreviationDirectory),
    "",
    "Additional user instructions:",
    session.additionalInstructions?.trim() || "No additional instructions.",
    "",
    "Additional prompt blocks:",
    formatAdditionalPromptsForPrompt(promptSettings.additionalPrompts),
    "",
    "Return a revised version in the requested schema.",
    "Requirements:",
    `- Write the output in ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}.`,
    sourceLanguage !== outputLanguage
      ? `- Translate the revised notes into ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"} while keeping the meaning faithful to the source notes.`
      : "- Keep the revised notes in the same language as the source notes.",
    promptSettings.revisionRules,
  ].join("\n");
}

function buildAiOutputHtml(session, template, aiNotes, outputLanguage) {
  const sectionConfig = normalizeSectionConfig(session.sections);
  const copy = getOutputCopy(outputLanguage);
  const customSectionsMarkup = buildAiCustomSectionsMarkup(aiNotes.customSections);
  const agendaText = typeof aiNotes.agenda === "string" ? aiNotes.agenda.trim() : "";
  const participants = session.participants
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const showParticipants = template.fields?.participants !== false;
  const meetingScheduleMeta = buildMeetingScheduleMeta(session);

  const discussionMarkup = aiNotes.discussionPoints.length
    ? aiNotes.discussionPoints
        .map((group) => `
          <section class="output-section">
            <h4>${escapeHtml(group.heading)}</h4>
            <ul>${toListMarkup(group.items, copy.noDiscussionDetails)}</ul>
          </section>
        `)
        .join("")
    : `
      <section class="output-section">
        <h4>${escapeHtml(localizeHeading(template.sections[1], copy))}</h4>
        <p>${escapeHtml(copy.noDiscussion)}</p>
      </section>
    `;

  return `
    <article class="output-doc">
      <header class="output-header">
        <h3>${escapeHtml(aiNotes.title || session.title.trim() || "Untitled session")}</h3>
        <p class="output-meta">
          ${escapeHtml(template.label)} - ${formatDate(session.updatedAt)}
          ${meetingScheduleMeta ? ` - ${escapeHtml(meetingScheduleMeta)}` : ""}
          ${showParticipants && participants.length ? ` - Participants: ${escapeHtml(participants.join(", "))}` : ""}
        </p>
      </header>

      ${sectionConfig.includeAgenda ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.agendaHeading)}</h4>
          <p>${escapeHtml(agendaText || getAgendaText(session) || copy.noAgenda).replace(/\n/g, "<br>")}</p>
        </section>
      ` : ""}

      ${sectionConfig.includeSummary ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.summaryHeading)}</h4>
          <p>${escapeHtml(aiNotes.summary)}</p>
        </section>
      ` : ""}

      ${sectionConfig.includeHighlights ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.highlightsHeading)}</h4>
          <ul>${toListMarkup(aiNotes.highlights, copy.noHighlights)}</ul>
        </section>
      ` : ""}

      ${discussionMarkup}

      ${customSectionsMarkup}

      ${sectionConfig.includeDecisions ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.decisionsHeading)}</h4>
          <ul>${toListMarkup(aiNotes.decisions, copy.noDecisions)}</ul>
        </section>
      ` : ""}

      ${sectionConfig.includeActions ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.actionsHeading)}</h4>
          <ul>${toListMarkup(aiNotes.actionItems, copy.noActions)}</ul>
        </section>
      ` : ""}
    </article>
  `;
}

function buildRevisedLocalPolishedNotes(session, feedback) {
  const revisedSession = {
    ...session,
    additionalInstructions: [session.additionalInstructions?.trim(), `Revision request: ${feedback}`]
      .filter(Boolean)
      .join("\n"),
  };

  return buildLocalPolishedNotes(revisedSession);
}

function createDefaultSections() {
  return {
    includeAgenda: true,
    includeSummary: true,
    includeHighlights: true,
    includeDecisions: true,
    includeActions: true,
  };
}

function normalizeSectionConfig(sectionConfig) {
  return {
    ...createDefaultSections(),
    ...(sectionConfig || {}),
  };
}

function normalizeOutputLanguagePreference(value) {
  return ["auto", "sv", "en"].includes(value) ? value : "auto";
}

function buildCombinedNotes(session) {
  const scheduleLine = buildMeetingScheduleText(session);
  const agendaText = getAgendaText(session);
  const agendaLine = agendaText ? `Agenda: ${agendaText}` : "";
  return [scheduleLine, agendaLine, session.liveTranscript?.trim(), session.uploadedTranscript?.trim(), session.rawNotes?.trim()]
    .filter(Boolean)
    .map((part) => expandKnownAbbreviations(part, settings.abbreviationDirectory))
    .join("\n\n");
}

function htmlToPlainText(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html || "";
  const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeRichTextHtml(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(html || "");
  const allowedTags = new Set(["p", "br", "strong", "b", "em", "i", "ul", "ol", "li"]);
  wrapper.querySelectorAll("*").forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (!allowedTags.has(tagName)) {
      const fragment = document.createDocumentFragment();
      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }
      element.replaceWith(fragment);
      return;
    }
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
  });
  const normalized = wrapper.innerHTML
    .replace(/<div>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>")
    .trim();
  if (!normalized) return "";
  if (!/<(p|ul|ol|li|br)\b/i.test(normalized)) {
    return `<p>${normalized}</p>`;
  }
  return normalized;
}

function setRichTextContent(element, html) {
  if (!element) return;
  const normalized = sanitizeRichTextHtml(html);
  if (element.innerHTML !== normalized) {
    element.innerHTML = normalized;
  }
  element.dataset.empty = htmlToPlainText(normalized).trim() ? "false" : "true";
}

function getRichTextContent(element) {
  if (!element) return "";
  return sanitizeRichTextHtml(element.innerHTML);
}

function getAgendaText(session) {
  return htmlToPlainText(session?.agenda || "");
}

function applyRichTextCommand(target, command) {
  if (!target || !command) return;
  target.focus();
  document.execCommand(command);
  setRichTextContent(target, target.innerHTML);
}

function stripCodeFences(text) {
  return String(text || "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload?.output)) {
    return "";
  }

  const textParts = payload.output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((part) => part?.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean);

  return textParts.join("\n").trim();
}

function normalizeNotes(rawNotes) {
  return rawNotes
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*\-\u2022]+/, "").trim())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandKnownAbbreviations(text, abbreviationDirectory = settings.abbreviationDirectory) {
  let nextText = String(text || "");
  const abbreviations = normalizeAbbreviationDirectory(abbreviationDirectory);

  abbreviations.forEach((entry) => {
    const pattern = new RegExp(`\\b${escapeRegExp(entry.short)}\\b`, "gi");
    nextText = nextText.replace(pattern, entry.full);
  });

  return nextText;
}

function formatAbbreviationsForPrompt(abbreviationDirectory) {
  const abbreviations = normalizeAbbreviationDirectory(abbreviationDirectory);
  if (!abbreviations.length) {
    return "No abbreviations provided.";
  }

  return abbreviations
    .map((entry, index) => `${index + 1}. ${entry.short} = ${entry.full}`)
    .join("\n");
}

function splitIntoSections(lines, headings) {
  if (!lines.length) {
    return [];
  }

  const groups = headings.map((heading) => ({ heading, items: [] }));

  lines.forEach((line, index) => {
    const targetIndex = Math.min(index % groups.length, groups.length - 1);
    groups[targetIndex].items.push(toSentence(line));
  });

  return groups.filter((group) => group.items.length);
}

function deriveHighlights(lines) {
  return lines.slice(0, 3).map((line) => toSentence(line));
}

function deriveActionItems(lines) {
  const actionLines = lines.filter((line) =>
    /(^todo\b|^action\b|^next\b|follow up|send|share|prepare|review|deliver|schedule|confirm|update)/i.test(line)
  );

  return uniqueItems(actionLines.length ? actionLines : lines.filter((_, index) => index % 3 === 0).slice(0, 4))
    .map((line) => toActionSentence(line));
}

function deriveDecisions(lines) {
  const decisionLines = lines.filter((line) =>
    /(decided|decision|agreed|approved|will use|chosen|selected|prioritized)/i.test(line)
  );

  return uniqueItems(decisionLines).map((line) => toSentence(line));
}

function buildSummary(session, template, lines, highlights, actions, outputLanguage = OUTPUT_LANGUAGES.english) {
  const parts = [
    outputLanguage === OUTPUT_LANGUAGES.swedish
      ? localizeSummaryLead(template.summaryLead)
      : template.summaryLead,
  ];

  if (highlights.length) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? `Viktiga teman var ${joinNaturalLanguage(highlights.slice(0, 3).map((item) => item.toLowerCase()), outputLanguage)}.`
        : `Key themes included ${joinNaturalLanguage(highlights.slice(0, 3).map((item) => item.toLowerCase()), outputLanguage)}.`
    );
  }

  if (actions.length) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? `M\u00f6tet avslutades med ${actions.length} konkreta ${actions.length === 1 ? "uppf\u00f6ljningspunkt" : "uppf\u00f6ljningspunkter"}.`
        : `The meeting closed with ${actions.length} concrete follow-up ${actions.length === 1 ? "item" : "items"}.`
    );
  } else if (lines.length) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? "De insamlade anteckningarna organiserades till en tydligare skriftlig sammanfattning f\u00f6r uppf\u00f6ljning."
        : "The captured notes were organized into a clearer written record for follow-up."
    );
  }

  if (!session.rawNotes.trim()) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? "L\u00e4gg till anteckningar f\u00f6r att skapa en mer inneh\u00e5llsrik sammanfattning."
        : "Add raw notes to generate a richer summary."
    );
  }

  return parts.join(" ");
}

function toListMarkup(items, fallback) {
  if (!items.length) {
    return `<li>${escapeHtml(fallback)}</li>`;
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function toSentence(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function toActionSentence(text) {
  const cleaned = text.replace(/^(todo|action|next)\s*[:\-]?\s*/i, "").trim();
  if (!cleaned) {
    return "";
  }

  const sentence = toSentence(cleaned);
  return sentence.startsWith("Need to") || sentence.startsWith("Please")
    ? sentence
    : `Follow up to ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function joinNaturalLanguage(items, outputLanguage = OUTPUT_LANGUAGES.english) {
  if (items.length <= 1) {
    return items[0] ?? (outputLanguage === OUTPUT_LANGUAGES.swedish ? "flera viktiga diskussionspunkter" : "several important discussion points");
  }

  if (items.length === 2) {
    return `${items[0]} ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "och" : "and"} ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "och" : "and"} ${items.at(-1)}`;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${formatIsoDate(date)} ${formatIsoTime(date)}`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatIsoTime(date);
}

function formatMeetingDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return formatIsoDate(date);
}

function formatMeetingTime(timeValue) {
  if (!timeValue) {
    return "";
  }

  return timeValue;
}

function buildMeetingScheduleMeta(session) {
  const datePart = formatMeetingDate(session.meetingDate);
  const startPart = formatMeetingTime(session.meetingStartTime);
  const endPart = formatMeetingTime(session.meetingEndTime);
  const timePart = startPart && endPart
    ? `${startPart}-${endPart}`
    : startPart || endPart;

  return [datePart, timePart].filter(Boolean).join(", ");
}

function buildMeetingScheduleText(session) {
  const scheduleMeta = buildMeetingScheduleMeta(session);
  return scheduleMeta ? `Meeting schedule: ${scheduleMeta}` : "";
}

function buildMeetingSchedulePromptText(session) {
  return buildMeetingScheduleMeta(session) || "Not provided";
}

function formatDateTimeForTitle(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${formatIsoDate(date)} ${formatIsoTime(date)}`;
}

function getDefaultMeetingScheduleForTemplate(template, timestamp = Date.now()) {
  const behaviorId = getTemplateBehaviorId(template);
  if (behaviorId !== "oneToOneCall" && behaviorId !== "personalNote") {
      return {
        meetingDate: "",
        meetingStartTime: "",
        meetingEndTime: "",
    };
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return {
      meetingDate: "",
      meetingStartTime: "",
      meetingEndTime: "",
    };
  }

  const isoDate = formatIsoDate(date);
  const isoTime = formatIsoTime(date);
  return {
    meetingDate: isoDate,
    meetingStartTime: isoTime,
    meetingEndTime: "",
  };
}

function getPrimaryParticipantName(participants) {
  return (participants || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)[0] || "";
}

function getDefaultTitleForTemplate(template, timestamp = Date.now(), sessionData = {}) {
  const behaviorId = getTemplateBehaviorId(template);
  if (behaviorId === "personalNote") {
    return formatDateTimeForTitle(timestamp);
  }

  if (behaviorId === "oneToOneCall") {
    return formatDateTimeForTitle(timestamp);
  }

  return "";
}

function getDefaultTranscribeOnlyForTemplate(template) {
  return template.id === "personalNote";
}

function isAutoGeneratedTitle(title) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s+.+)?$/.test(title.trim());
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setCaptureButtonContent(button, title, hint = "") {
  if (!button) {
    return;
  }

  const titleNode = button.querySelector(".capture-mode-title");
  const hintNode = button.querySelector(".capture-mode-hint");
  if (titleNode) {
    titleNode.textContent = title;
  } else {
    button.textContent = title;
  }
  if (hintNode) {
    hintNode.textContent = hint;
  }
}

function revealTranscriptSurface(mode = "live", { focus = false } = {}) {
  const isUploaded = mode === "uploaded";
  const disclosure = isUploaded ? uploadedTranscriptDisclosure : liveTranscriptDisclosure;
  const field = isUploaded ? uploadedTranscriptField : liveTranscriptField;
  const input = isUploaded ? uploadedTranscriptInput : liveTranscriptInput;

  if (!field || !input) {
    return;
  }

  if (!isMobileLayout()) {
    setDesktopWorkspaceView("capture");
  } else {
    closeMobileSheets();
  }

  if (disclosure) {
    setElementVisibility(disclosure, true);
    if (focus) {
      disclosure.open = true;
    }
  }
  window.requestAnimationFrame(() => {
    (disclosure || field).scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (focus) {
      input.focus();
    }
  });
}

function buildSessionPreview(session) {
  const previewSource = [
    session.rawNotes,
    session.liveTranscript,
    session.uploadedTranscript,
    session.participants,
  ]
    .find((value) => typeof value === "string" && value.trim());

  if (!previewSource) {
    return "Open to continue capturing or polishing this session.";
  }

  return previewSource.replace(/\s+/g, " ").trim().slice(0, 96);
}

function handlePrimaryChromeClick(event) {
  const button = event.target.closest(
    "#open-sessions-main, #mobile-open-sessions, #open-settings, #mobile-open-settings, #open-instructions, #mobile-open-instructions, #open-backup-panel, #mobile-open-backup"
  );

  if (!button) {
    return;
  }

  if (button.matches("#open-sessions-main, #mobile-open-sessions")) {
    if (button.matches("#mobile-open-sessions")) {
      closeMobileSheets();
    }
    toggleRecentSessionsPanel(button.matches("#mobile-open-sessions") ? true : undefined);
    return;
  }

  if (button.matches("#open-settings, #mobile-open-settings")) {
    if (button.matches("#mobile-open-settings")) {
      closeMobileSheets();
    }
    openSettings();
    return;
  }

  if (button.matches("#open-instructions, #mobile-open-instructions")) {
    if (button.matches("#mobile-open-instructions")) {
      closeMobileSheets();
    }
    openInstructions();
    return;
  }

  if (button.matches("#open-backup-panel, #mobile-open-backup")) {
    if (button.matches("#mobile-open-backup")) {
      closeMobileSheets();
    }
    openBackupPanel();
  }
}

function resolveLiveTranscriptSource(session = getActiveSession()) {
  if (isRecording && recognition) {
    return "dictation";
  }

  if (audioRecordingSessionId === session?.id && /meeting/.test(activeAudioCaptureMode || "")) {
    return "meeting";
  }

  if (session?.liveTranscript?.trim()) {
    return "transcribed";
  }

  return "live-ready";
}

function getLiveTranscriptSourceLabel(session = getActiveSession()) {
  const source = resolveLiveTranscriptSource(session);
  if (source === "dictation") {
    return "Live dictation";
  }
  if (source === "meeting") {
    return "Meeting recording";
  }
  if (source === "transcribed") {
    return "Transcribed audio";
  }
  return "Ready for live notes";
}

function setTranscriptFieldState(kind, source, label) {
  const field = kind === "uploaded" ? uploadedTranscriptField : liveTranscriptField;
  const badge = kind === "uploaded" ? uploadedTranscriptBadge : liveTranscriptBadge;
  if (!field) {
    return;
  }

  field.dataset.transcriptSource = source;
  if (badge) {
    badge.textContent = label;
  }
}

function applyOutputPanelWidth() {
  if (!workspaceLayout) {
    return;
  }

  const width = clampNumber(settings.outputPanelWidth, MIN_OUTPUT_PANEL_WIDTH, MAX_OUTPUT_PANEL_WIDTH, DEFAULT_OUTPUT_PANEL_WIDTH);
  workspaceLayout.style.setProperty("--output-panel-width", `${width}px`);
}

function startOutputResize(event) {
  if (isMobileLayout() || !workspaceLayout) {
    return;
  }

  event.preventDefault();
  const workspaceBounds = workspaceLayout.getBoundingClientRect();
  const styles = window.getComputedStyle(workspaceLayout);
  const columnGap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
  const handleWidth = outputResizeHandle?.getBoundingClientRect().width ?? 10;
  const maxWidthForEqualMinimums = Math.max(
    MIN_OUTPUT_PANEL_WIDTH,
    workspaceBounds.width - handleWidth - columnGap * 2 - MIN_WORKSPACE_PANEL_WIDTH
  );
  const isPointerEvent = typeof PointerEvent !== "undefined" && event instanceof PointerEvent;

  const onMove = (moveEvent) => {
    const nextWidth = clampNumber(
      workspaceBounds.right - moveEvent.clientX,
      MIN_OUTPUT_PANEL_WIDTH,
      Math.min(MAX_OUTPUT_PANEL_WIDTH, maxWidthForEqualMinimums),
      DEFAULT_OUTPUT_PANEL_WIDTH
    );
    settings.outputPanelWidth = nextWidth;
    applyOutputPanelWidth();
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("mousemove", onMove);
    persistSettings();
  };

  if (isPointerEvent) {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return;
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp, { once: true });
}

function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function createRecorderForStream(stream) {
  const mimeType = getAudioRecordingMimeType();
  return mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
}

async function getScreenAudioCaptureStream() {
  if (!SUPPORTS_MEETING_CAPTURE) {
    return null;
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
  const audioTracks = displayStream.getAudioTracks();
  if (!audioTracks.length) {
    stopMediaStream(displayStream);
    throw new Error("No shared in-computer audio was available. Try sharing a browser tab and enabling audio, or use Room / hybrid meeting instead.");
  }

  return {
    recorderStream: new MediaStream(audioTracks),
    sourceStream: displayStream,
    mode: "screen-meeting",
    status: "Screen / browser audio started. Keep sharing the tab, window, or screen until you are ready to transcribe.",
  };
}

async function getMicrophoneCaptureStream() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  return {
    recorderStream: stream,
    sourceStream: null,
    mode: "room-meeting",
    status: "Room / hybrid meeting started. The microphone is now recording people in the room and any voices coming through nearby speakers.",
  };
}

async function resolveAudioCaptureStream(requestedMode = "room") {
  if (requestedMode === "screen") {
    if (!SUPPORTS_MEETING_CAPTURE) {
      throw new Error("Direct in-computer audio is not available in this browser. Use Room / hybrid meeting or upload audio instead.");
    }
    return getScreenAudioCaptureStream();
  }

  if (SUPPORTS_AUDIO_RECORDING) {
    return getMicrophoneCaptureStream();
  }

  throw new Error("Microphone recording is not available in this browser. Use screen / browser audio or upload audio instead.");
}

function setupSpeechRecognition() {
  if (!SpeechRecognition) {
    dictationToggle.disabled = true;
    setCaptureButtonContent(dictationToggle, "Dictation unavailable", "Use a meeting recording mode or upload audio");
    dictationStatus.textContent = "This browser does not expose speech recognition, but the rest of the app is ready to use.";
    setAppStatus("Recording unavailable", APP_STATUS_STATES.warning);
    syncMobileUi();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = resolveDictationLanguage(rawNotesInput.value.trim() || navigator.language);

  recognition.addEventListener("result", (event) => {
    let interimTranscript = "";
    let detectedLanguage = currentDictationLanguage;

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      detectedLanguage = settings.dictationLanguage === "auto"
        ? detectPreferredLanguage(transcript, detectedLanguage)
        : settings.dictationLanguage;
      if (event.results[index].isFinal) {
        finalTranscript += `${transcript.trim()} `;
      } else {
        interimTranscript += transcript;
      }
    }

    const nextValue = [dictationSeedText.trim(), finalTranscript.trim(), interimTranscript.trim()]
      .filter(Boolean)
      .join(dictationSeedText.trim() ? "\n" : "");

    liveTranscriptInput.value = nextValue;
    updateActiveSession({ liveTranscript: nextValue }, true);
    dictationStatus.textContent = `Dictation is active in ${formatDictationLanguage(currentDictationLanguage)}. Keep talking and your notes will appear in the live transcript field.`;

    if (settings.dictationLanguage === "auto" && detectedLanguage !== currentDictationLanguage) {
      currentDictationLanguage = detectedLanguage;
      recognition.lang = currentDictationLanguage;
      pendingLanguageRestart = true;
      recognition.stop();
    }
  });

    recognition.addEventListener("end", () => {
    if (isRecording) {
      recognition.lang = currentDictationLanguage;
      pendingLanguageRestart = false;
      recognition.start();
      return;
    }

    finalTranscript = "";
    dictationSeedText = "";
    pendingLanguageRestart = false;
    setTranscriptFieldState("live", resolveLiveTranscriptSource(getActiveSession()), getLiveTranscriptSourceLabel(getActiveSession()));
    setCaptureButtonContent(dictationToggle, "Start dictation", "Best for personal dictation");
    dictationToggle.classList.remove("is-recording");
      dictationStatus.textContent = "Dictation stopped. You can continue typing or restart capture anytime.";
      setAppStatus("Saved locally", APP_STATUS_STATES.idle);
      applyTemplateUi(getActiveSession());
      syncMobileUi();
    });

  recognition.addEventListener("error", (event) => {
    isRecording = false;
    finalTranscript = "";
    dictationSeedText = "";
    pendingLanguageRestart = false;
    setTranscriptFieldState("live", resolveLiveTranscriptSource(getActiveSession()), getLiveTranscriptSourceLabel(getActiveSession()));
    setCaptureButtonContent(dictationToggle, "Start dictation", "Best for personal dictation");
    dictationToggle.classList.remove("is-recording");
      dictationStatus.textContent = `Dictation error: ${event.error}. You can still take notes manually.`;
      setAppStatus("Recording error", APP_STATUS_STATES.warning);
      applyTemplateUi(getActiveSession());
      syncMobileUi();
    });
  }

function toggleDictation() {
  if (!recognition) {
    dictationStatus.textContent = "Live dictation is not available in this browser. You can still record audio or type notes manually.";
    setAppStatus("Recording unavailable", APP_STATUS_STATES.warning);
    syncMobileUi();
    return;
  }

    if (isRecording) {
      isRecording = false;
      try {
        recognition.stop();
      } catch {
      setCaptureButtonContent(dictationToggle, "Start dictation", "Best for personal dictation");
      dictationToggle.classList.remove("is-recording");
        dictationStatus.textContent = "Dictation stopped.";
        setAppStatus("Saved locally", APP_STATUS_STATES.idle);
        applyTemplateUi(getActiveSession());
        syncMobileUi();
      }
      return;
  }

  try {
    isRecording = true;
    finalTranscript = "";
    dictationSeedText = liveTranscriptInput.value.trim();
    currentDictationLanguage = resolveDictationLanguage(dictationSeedText || navigator.language);
    recognition.lang = currentDictationLanguage;
    setTranscriptFieldState("live", "dictation", "Live dictation");
    revealTranscriptSurface("live");
    recognition.start();
    setCaptureButtonContent(dictationToggle, "Stop dictation", "Live browser transcription");
    dictationToggle.classList.add("is-recording");
      dictationStatus.textContent = `Listening in ${formatDictationLanguage(currentDictationLanguage)}. The app will switch between Swedish and English when the speech pattern changes.`;
      setAppStatus("Recording", APP_STATUS_STATES.recording);
      if (liveTranscriptDisclosure) {
        liveTranscriptDisclosure.open = false;
      }
      applyTemplateUi(getActiveSession());
      syncMobileUi();
    } catch (error) {
      isRecording = false;
    setCaptureButtonContent(dictationToggle, "Start dictation", "Best for personal dictation");
    dictationToggle.classList.remove("is-recording");
      dictationStatus.textContent = `Could not start live dictation: ${error.message || "this browser blocked it"}. Try a meeting recording mode or upload audio instead.`;
      setAppStatus("Recording unavailable", APP_STATUS_STATES.warning);
      applyTemplateUi(getActiveSession());
      syncMobileUi();
    }
  }

function getAudioRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function buildAudioRecordingFileName() {
  return `meeting-notes-audio-${formatDateTimeForTitle(Date.now()).replace(/[ :]/g, "-")}.webm`;
}

async function stopAudioCapture() {
  if (!mediaRecorder) {
    return;
  }

  const recorder = mediaRecorder;
  const activeSessionForRecording = audioRecordingSessionId;

  await new Promise((resolve) => {
    const finalize = () => {
      recorder.removeEventListener("stop", finalize);
      resolve();
    };

    recorder.addEventListener("stop", finalize);
    recorder.stop();
  });

  if (mediaRecorderStream) {
    stopMediaStream(mediaRecorderStream);
  }
  stopMediaStream(mediaRecorderSourceStream);

  const mimeType = recorder.mimeType || "audio/webm";
  const audioBlob = new Blob(mediaRecorderChunks, { type: mimeType });
  mediaRecorder = null;
  mediaRecorderStream = null;
  mediaRecorderSourceStream = null;
  mediaRecorderChunks = [];
  audioRecordingSessionId = null;

  if (audioBlob.size > 0) {
    try {
      await setAudioDraft({
        blob: audioBlob,
        fileName: buildAudioRecordingFileName(),
        mimeType,
        size: audioBlob.size,
        source: activeAudioCaptureMode === "screen-meeting"
          ? "screen-meeting-capture"
          : activeAudioCaptureMode === "room-meeting"
            ? "room-meeting-capture"
            : "recording",
      }, activeSessionForRecording);
      setTranscriptFieldState("live", resolveLiveTranscriptSource(getActiveSession()), getLiveTranscriptSourceLabel(getActiveSession()));
      audioCaptureStatus.textContent = "Capture stopped. Your recording is saved locally and ready to transcribe into the Live transcript field.";
    } catch {
      setTranscriptFieldState("live", resolveLiveTranscriptSource(getActiveSession()), getLiveTranscriptSourceLabel(getActiveSession()));
      audioCaptureStatus.textContent = "Capture stopped, but the recording could not be saved locally for later transcription.";
    }
    } else {
      syncAudioCaptureUi(getActiveSession());
    }
  
    setAppStatus("Saved locally", APP_STATUS_STATES.idle);
    applyTemplateUi(getActiveSession());
  }

async function toggleAudioCapture(requestedMode = "room") {
  if (audioRecordingSessionId) {
    await stopAudioCapture();
    return;
  }

  try {
    const capture = await resolveAudioCaptureStream(requestedMode);
    setTranscriptFieldState("live", "meeting", requestedMode === "screen" ? "Screen / browser audio" : "Room / hybrid meeting");
    revealTranscriptSurface("live");
    mediaRecorderStream = capture.recorderStream;
    mediaRecorderSourceStream = capture.sourceStream;
    mediaRecorderChunks = [];
    audioRecordingSessionId = activeSessionId;
    activeAudioCaptureMode = capture.mode;
    mediaRecorder = createRecorderForStream(capture.recorderStream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        mediaRecorderChunks.push(event.data);
      }
    });

      mediaRecorder.addEventListener("error", () => {
      stopMediaStream(mediaRecorderStream);
      stopMediaStream(mediaRecorderSourceStream);
      mediaRecorder = null;
      mediaRecorderStream = null;
      mediaRecorderSourceStream = null;
      mediaRecorderChunks = [];
      audioRecordingSessionId = null;
        audioCaptureStatus.textContent = "Meeting recording failed. You can still upload audio instead.";
        setAppStatus("Recording error", APP_STATUS_STATES.warning);
        applyTemplateUi(getActiveSession());
        syncAudioCaptureUi(getActiveSession());
      });

    mediaRecorder.start();
      audioCaptureStatus.textContent = capture.status;
      setAppStatus("Recording", APP_STATUS_STATES.recording);
      applyTemplateUi(getActiveSession());
      syncAudioCaptureUi(getActiveSession());
    } catch (error) {
      audioCaptureStatus.textContent = error?.message || "Meeting recording was blocked. You can still upload audio instead.";
      setAppStatus("Recording unavailable", APP_STATUS_STATES.warning);
      applyTemplateUi(getActiveSession());
      syncMobileUi();
    }
  }

function persistSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  void safeWriteAppStateValue(STORAGE_KEY, sessions);
  queueStorageFilePersist();
}

async function openAppStateDb() {
  if (!("indexedDB" in window)) {
    return null;
  }

  if (!appStateDbPromise) {
    appStateDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(APP_STATE_DB_NAME, APP_STATE_DB_VERSION);

      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(APP_STATE_STORE_NAME)) {
          db.createObjectStore(APP_STATE_STORE_NAME);
        }
      });

      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("App state database could not be opened.")));
    });
  }

  return appStateDbPromise;
}

async function readAppStateValue(key) {
  const db = await openAppStateDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(APP_STATE_STORE_NAME, "readonly");
    const request = transaction.objectStore(APP_STATE_STORE_NAME).get(key);
    request.addEventListener("success", () => resolve(request.result ?? null));
    request.addEventListener("error", () => reject(request.error || new Error(`Could not load ${key} from browser database.`)));
  });
}

async function safeReadAppStateValue(key) {
  try {
    return await readAppStateValue(key);
  } catch (error) {
    console.warn(`Could not read ${key} from browser database. Falling back to legacy browser storage.`, error);
    return null;
  }
}

async function writeAppStateValue(key, value) {
  const db = await openAppStateDb();
  if (!db) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(APP_STATE_STORE_NAME, "readwrite");
    transaction.objectStore(APP_STATE_STORE_NAME).put(value, key);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error || new Error(`Could not save ${key} to browser database.`)));
  });
}

async function safeWriteAppStateValue(key, value) {
  try {
    await writeAppStateValue(key, value);
  } catch (error) {
    console.warn(`Could not save ${key} to browser database.`, error);
  }
}

function readLegacyLocalStorageJson(key) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function loadSessions() {
  const persisted = await safeReadAppStateValue(STORAGE_KEY);
  if (Array.isArray(persisted)) {
    return normalizeImportedSessions(persisted);
  }

  const legacy = readLegacyLocalStorageJson(STORAGE_KEY);
  const nextSessions = Array.isArray(legacy) ? normalizeImportedSessions(legacy) : [];
  if (nextSessions.length) {
    void safeWriteAppStateValue(STORAGE_KEY, nextSessions);
  }
  return nextSessions;
}

function isLocalDataFileMode() {
  return settings.storageMode === STORAGE_MODES.file;
}

function supportsLocalDataFileMode() {
  return typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";
}

function buildSharedDataPayload() {
  return {
    app: "Meeting Notes Studio",
    version: 1,
    updatedAt: new Date().toISOString(),
    sessions,
    settingsSubset: {
      participantDirectory: settings.participantDirectory || [],
      abbreviationDirectory: settings.abbreviationDirectory || [],
      customTemplates: settings.customTemplates || [],
    },
  };
}

function applySharedDataPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("The selected data file is not valid.");
  }

  if (payload.version !== undefined && Number(payload.version) !== 1) {
    throw new Error("This data file uses an unsupported version.");
  }

  const importedSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const settingsSubset = payload.settingsSubset && typeof payload.settingsSubset === "object"
    ? payload.settingsSubset
    : {};

  isApplyingStoragePayload = true;
  try {
    settings.participantDirectory = normalizeParticipantDirectory(settingsSubset.participantDirectory);
    settings.abbreviationDirectory = normalizeAbbreviationDirectory(settingsSubset.abbreviationDirectory);
    settings.customTemplates = normalizeCustomTemplates(settingsSubset.customTemplates);
    sessions = normalizeImportedSessions(importedSessions);
    if (!sessions.length) {
      const freshSession = createSession();
      sessions = [freshSession];
    }
    activeSessionId = sessions[0]?.id ?? null;
  } finally {
    isApplyingStoragePayload = false;
  }
}

async function openStorageHandleDb() {
  if (!("indexedDB" in window)) {
    throw new Error("This browser does not support persistent file-handle storage.");
  }

  if (!storageHandleDbPromise) {
    storageHandleDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(STORAGE_HANDLE_DB_NAME, 1);

      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORAGE_HANDLE_STORE_NAME)) {
          db.createObjectStore(STORAGE_HANDLE_STORE_NAME);
        }
      });

      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("Storage handle database could not be opened.")));
    });
  }

  return storageHandleDbPromise;
}

async function saveLocalDataFileHandle(handle) {
  const db = await openStorageHandleDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORAGE_HANDLE_STORE_NAME, "readwrite");
    transaction.objectStore(STORAGE_HANDLE_STORE_NAME).put(handle, STORAGE_HANDLE_KEY);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error || new Error("Could not save the local data file handle.")));
  });
}

async function loadLocalDataFileHandle() {
  const db = await openStorageHandleDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORAGE_HANDLE_STORE_NAME, "readonly");
    const request = transaction.objectStore(STORAGE_HANDLE_STORE_NAME).get(STORAGE_HANDLE_KEY);
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error || new Error("Could not load the local data file handle.")));
  });
}

async function clearLocalDataFileHandle() {
  const db = await openStorageHandleDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORAGE_HANDLE_STORE_NAME, "readwrite");
    transaction.objectStore(STORAGE_HANDLE_STORE_NAME).delete(STORAGE_HANDLE_KEY);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error || new Error("Could not clear the local data file handle.")));
  });
}

async function ensureHandlePermission(handle, readWrite = true) {
  if (!handle) {
    return false;
  }

  const options = readWrite ? { mode: "readwrite" } : {};
  if (typeof handle.queryPermission === "function") {
    const permission = await handle.queryPermission(options);
    if (permission === "granted") {
      return true;
    }
  }

  if (typeof handle.requestPermission === "function") {
    const permission = await handle.requestPermission(options);
    return permission === "granted";
  }

  return true;
}

async function readSharedDataFile(handle) {
  const hasPermission = await ensureHandlePermission(handle, false);
  if (!hasPermission) {
    throw new Error("Permission to read the local data file was not granted.");
  }

  const file = await handle.getFile();
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("The selected data file is not valid JSON.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("The selected data file is not valid JSON.");
  }

  return payload;
}

async function writeSharedDataFile(handle) {
  const hasPermission = await ensureHandlePermission(handle, true);
  if (!hasPermission) {
    throw new Error("Permission to write to the local data file was not granted.");
  }

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(buildSharedDataPayload(), null, 2));
  await writable.close();
}

function updateStorageConnectionState(isConnected, fileName = settings.storageFileName || "") {
  settings.storageFileConnected = isConnected;
  settings.storageFileName = fileName;
  if (isConnected) {
    settings.storageLastSyncAt = Date.now();
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  void writeAppStateValue(SETTINGS_KEY, settings);
}

async function connectLocalDataFileHandle(handle, options = {}) {
  const payload = await readSharedDataFile(handle);
  localDataFileHandle = handle;
  await saveLocalDataFileHandle(handle);
  applySharedDataPayload(payload);
  syncParticipantDirectoryFromAllSessions();
  settings.storageMode = STORAGE_MODES.file;
  updateStorageConnectionState(true, handle.name || "Local data file");
  if (options.prependFreshSession === true) {
    const freshSession = createSession();
    sessions = [freshSession, ...sessions];
    activeSessionId = freshSession.id;
  }
  persistSessions();
  persistSettings();
  render();
}

async function createLocalDataFile() {
  if (!supportsLocalDataFileMode()) {
    throw new Error("Local data file mode is not supported in this browser.");
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: `meeting-notes-data-${new Date().toISOString().slice(0, 10)}.json`,
    types: [
      {
        description: "JSON files",
        accept: {
          "application/json": [".json"],
        },
      },
    ],
  });

  settings.storageMode = STORAGE_MODES.file;
  localDataFileHandle = handle;
  await writeSharedDataFile(handle);
  await saveLocalDataFileHandle(handle);
  updateStorageConnectionState(true, handle.name || "Local data file");
  persistSettings();
  render();
}

async function useExistingLocalDataFile() {
  if (!supportsLocalDataFileMode()) {
    throw new Error("Local data file mode is not supported in this browser.");
  }

  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: "JSON files",
        accept: {
          "application/json": [".json"],
        },
      },
    ],
  });

  await connectLocalDataFileHandle(handle, { prependFreshSession: false });
}

async function reconnectLocalDataFile(options = {}) {
  const handle = localDataFileHandle || await loadLocalDataFileHandle();
  if (!handle) {
    throw new Error("No previously selected local data file was found.");
  }

  await connectLocalDataFileHandle(handle, { prependFreshSession: false, ...options });
}

async function switchToBrowserStorageMode() {
  settings.storageMode = STORAGE_MODES.browser;
  localDataFileHandle = null;
  updateStorageConnectionState(false, "");
  await clearLocalDataFileHandle().catch(() => {});
  persistSettings();
  render();
}

function queueStorageFilePersist() {
  if (!isLocalDataFileMode() || !localDataFileHandle || isApplyingStoragePayload) {
    return;
  }

  window.clearTimeout(storagePersistTimeout);
  storagePersistTimeout = window.setTimeout(() => {
    void persistSharedDataFile();
  }, 260);
}

async function persistSharedDataFile() {
  if (!isLocalDataFileMode() || !localDataFileHandle || isApplyingStoragePayload) {
    return;
  }

  try {
    await writeSharedDataFile(localDataFileHandle);
    updateStorageConnectionState(true, localDataFileHandle.name || settings.storageFileName || "Local data file");
    updateStorageUi();
  } catch {
    updateStorageConnectionState(false, settings.storageFileName || "");
    updateStorageUi();
  }
}

async function initializeStorageMode() {
  if (!isLocalDataFileMode()) {
    updateStorageUi();
    return;
  }

  try {
    await reconnectLocalDataFile({ prependFreshSession: true });
    dictationStatus.textContent = "Connected to your local data file.";
  } catch (error) {
    updateStorageConnectionState(false, settings.storageFileName || "");
    updateStorageUi();
    dictationStatus.textContent = `Local data file mode is selected, but the file needs to be reconnected. ${error.message}`;
  }
}

function syncParticipantDirectoryFromAllSessions() {
  if (settings.participantDirectoryInitialized === true) {
    return;
  }

  settings.participantDirectory = normalizeParticipantDirectory([
    ...(settings.participantDirectory || []),
    ...sessions.flatMap((session) => parseParticipants(session.participants)),
  ]);
  settings.participantDirectoryInitialized = true;
  persistSettings();
}

function persistAiModelCatalog() {
  localStorage.setItem(AI_MODEL_CATALOG_KEY, JSON.stringify(aiModelCatalog));
  void safeWriteAppStateValue(AI_MODEL_CATALOG_KEY, aiModelCatalog);
}

function normalizeStoredSettings(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return createDefaultSettings();
  }

  const legacyThemeMode = parsed.theme === "dark" ? "dark" : "light";
  const legacyThemeFamilyMap = {
    olive: "stone-olive",
    blue: "atlas-blue",
    teal: "nordic-teal",
    forest: "graphite-forest",
  };
  const normalizedThemeFamily = THEME_DESCRIPTIONS[parsed.themeFamily]
    ? parsed.themeFamily
    : legacyThemeFamilyMap[parsed.themeFamily] || createDefaultSettings().themeFamily;
  const legacyExportPresetMap = {
    "refined-garamond": "board-briefing",
  };
  const normalizedExportStylePreset = legacyExportPresetMap[parsed.exportStylePreset] || parsed.exportStylePreset;
  const exportStylePreset = EXPORT_STYLE_PRESETS[normalizedExportStylePreset] ? normalizedExportStylePreset : DEFAULT_EXPORT_PRESET;
  const normalizedCustomTemplates = normalizeCustomTemplates(parsed.customTemplates);
  const availableTemplateIds = [
    ...Object.values(BUILT_IN_TEMPLATES).map((template) => template.id),
    ...normalizedCustomTemplates.map((template) => template.id),
  ];

  return {
    ...createDefaultSettings(),
    ...parsed,
    apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    lastBackupAt: Number.isFinite(parsed.lastBackupAt) ? Number(parsed.lastBackupAt) : 0,
    themeFamily: normalizedThemeFamily,
    themeMode: parsed.themeMode === "dark" || parsed.themeMode === "light" ? parsed.themeMode : legacyThemeMode,
    transcriptionModel: resolveSelectedTranscriptionModel(parsed.transcriptionModel),
    recentSessionsExpanded: parsed.recentSessionsExpanded === true,
    abbreviationDirectory: normalizeAbbreviationDirectory(parsed.abbreviationDirectory),
    todoItems: normalizeTodoItems(parsed.todoItems),
    participantDirectory: normalizeParticipantDirectory(parsed.participantDirectory),
      participantDirectoryInitialized: parsed.participantDirectoryInitialized === true
        || normalizeParticipantDirectory(parsed.participantDirectory).length > 0,
      defaultCustomHeaders: normalizeCustomHeaders(parsed.defaultCustomHeaders),
      customTemplates: normalizedCustomTemplates,
      templateUsageCounts: normalizeTemplateUsageCounts(parsed.templateUsageCounts),
      templateLauncherTemplateIds: normalizeTemplateLauncherIds(parsed.templateLauncherTemplateIds, availableTemplateIds),
      selectedQuickTemplateId: availableTemplateIds.includes(parsed.selectedQuickTemplateId) ? parsed.selectedQuickTemplateId : "meeting",
      exportStylePreset,
    exportStyle: normalizeExportStyle({
      ...EXPORT_STYLE_PRESETS[exportStylePreset].style,
      ...(parsed.exportStyle || {}),
    }),
      promptSettings: normalizePromptSettings(parsed.promptSettings),
      storageMode: parsed.storageMode === STORAGE_MODES.file ? STORAGE_MODES.file : STORAGE_MODES.browser,
      storageFileName: typeof parsed.storageFileName === "string" ? parsed.storageFileName : "",
      storageFileConnected: parsed.storageFileConnected === true,
      storageLastSyncAt: Number.isFinite(parsed.storageLastSyncAt) ? Number(parsed.storageLastSyncAt) : 0,
      outputPanelWidth: clampNumber(parsed.outputPanelWidth, MIN_OUTPUT_PANEL_WIDTH, MAX_OUTPUT_PANEL_WIDTH, DEFAULT_OUTPUT_PANEL_WIDTH),
    };
  }

async function loadAiModelCatalog() {
  const persisted = await safeReadAppStateValue(AI_MODEL_CATALOG_KEY);
  const source = Array.isArray(persisted) && persisted.length
    ? persisted
    : readLegacyLocalStorageJson(AI_MODEL_CATALOG_KEY);

  if (!Array.isArray(source) || !source.length) {
    return filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({ ...model })));
  }

  const byId = new Map(source.map((model) => [model.id, model]));
  const normalized = filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({
    ...model,
    ...(byId.get(model.id) || {}),
  })));
  if (!persisted) {
    void safeWriteAppStateValue(AI_MODEL_CATALOG_KEY, normalized);
  }
  return normalized;
}

async function loadSettings() {
  const persisted = await safeReadAppStateValue(SETTINGS_KEY);
  if (persisted) {
    return normalizeStoredSettings(persisted);
  }

  const legacy = readLegacyLocalStorageJson(SETTINGS_KEY);
  const normalized = normalizeStoredSettings(legacy);
  if (legacy) {
    void safeWriteAppStateValue(SETTINGS_KEY, normalized);
  }
  return normalized;
}

function normalizePromptSettings(promptSettings) {
  const migrateMeetingMinutesRules = (rules) => {
    if (typeof rules !== "string" || !rules.trim()) {
      return "";
    }
    if (!rules.includes(LEGACY_MEETING_MINUTES_BULLET_RULE)) {
      return rules;
    }
    return rules.replace(LEGACY_MEETING_MINUTES_BULLET_RULE, UPDATED_MEETING_MINUTES_PROSE_RULES.join("\n"));
  };

  return {
    meetingMinutesSystem: typeof promptSettings?.meetingMinutesSystem === "string" && promptSettings.meetingMinutesSystem.trim()
      ? promptSettings.meetingMinutesSystem
      : (typeof promptSettings?.generationSystem === "string" && promptSettings.generationSystem.trim()
        ? promptSettings.generationSystem
        : DEFAULT_PROMPT_SETTINGS.meetingMinutesSystem),
    meetingMinutesRules: (() => {
      const storedRules =
        typeof promptSettings?.meetingMinutesRules === "string" && promptSettings.meetingMinutesRules.trim()
          ? promptSettings.meetingMinutesRules
          : (typeof promptSettings?.generationRules === "string" && promptSettings.generationRules.trim()
            ? promptSettings.generationRules
            : DEFAULT_PROMPT_SETTINGS.meetingMinutesRules);
      return migrateMeetingMinutesRules(storedRules) || DEFAULT_PROMPT_SETTINGS.meetingMinutesRules;
    })(),
    personalNotesSystem: typeof promptSettings?.personalNotesSystem === "string" && promptSettings.personalNotesSystem.trim()
      ? promptSettings.personalNotesSystem
      : DEFAULT_PROMPT_SETTINGS.personalNotesSystem,
    personalNotesRules: typeof promptSettings?.personalNotesRules === "string" && promptSettings.personalNotesRules.trim()
      ? promptSettings.personalNotesRules
      : DEFAULT_PROMPT_SETTINGS.personalNotesRules,
    revisionRules: typeof promptSettings?.revisionRules === "string" && promptSettings.revisionRules.trim()
      ? promptSettings.revisionRules
      : DEFAULT_PROMPT_SETTINGS.revisionRules,
    translationRules: typeof promptSettings?.translationRules === "string" && promptSettings.translationRules.trim()
      ? promptSettings.translationRules
      : DEFAULT_PROMPT_SETTINGS.translationRules,
    additionalPrompts: normalizeAdditionalPrompts(promptSettings?.additionalPrompts),
  };
}

function normalizeAdditionalPrompts(additionalPrompts) {
  if (!Array.isArray(additionalPrompts)) {
    return [];
  }

  return additionalPrompts
    .map((prompt) => ({
      id: typeof prompt?.id === "string" && prompt.id.trim() ? prompt.id : crypto.randomUUID(),
      enabled: prompt?.enabled !== false,
      label: typeof prompt?.label === "string" ? prompt.label.trim() : "",
      text: typeof prompt?.text === "string" ? prompt.text.trim() : "",
    }));
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  void safeWriteAppStateValue(SETTINGS_KEY, settings);
  queueStorageFilePersist();
}

function markBackupCompleted() {
  settings.lastBackupAt = Date.now();
  persistSettings();
}

function shouldShowBackupReminder() {
  const lastBackupAt = Number(settings.lastBackupAt || 0);
  return !lastBackupAt || (Date.now() - lastBackupAt) >= BACKUP_REMINDER_INTERVAL_MS;
}

function maybeShowBackupReminder() {
  if (shouldShowBackupReminder()) {
    openBackupReminder();
  }
}

function parseParticipants(value) {
  return String(value || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function normalizeParticipantDirectory(participants) {
  if (!Array.isArray(participants)) {
    return [];
  }

  const uniqueByKey = new Map();
  participants
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLocaleLowerCase();
      if (!uniqueByKey.has(key)) {
        uniqueByKey.set(key, name);
      }
    });

  return [...uniqueByKey.values()].sort((first, second) => first.localeCompare(second, undefined, { sensitivity: "base" }));
}

function normalizeTodoItems(todoItems) {
  if (!Array.isArray(todoItems)) {
    return [];
  }

  return todoItems
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id : crypto.randomUUID(),
      completed: item.completed === true,
      description: typeof item.description === "string" ? item.description.trim() : "",
      addedAt: typeof item.addedAt === "string" && item.addedAt.trim() ? item.addedAt : formatIsoDate(new Date()),
      sessionRefs: normalizeTodoSessionRefs(item.sessionRefs),
      comments: typeof item.comments === "string" ? item.comments : "",
    }))
    .filter((item) => item.description);
}

function normalizeTodoSessionRefs(sessionRefs) {
  if (!Array.isArray(sessionRefs)) {
    return [];
  }

  const seen = new Set();
  return sessionRefs
    .filter((ref) => ref && typeof ref === "object")
    .map((ref) => ({
      sessionId: typeof ref.sessionId === "string" ? ref.sessionId : "",
      title: typeof ref.title === "string" ? ref.title.trim() : "",
    }))
    .filter((ref) => ref.sessionId || ref.title)
    .filter((ref) => {
      const key = `${ref.sessionId}::${ref.title.toLocaleLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function polishTodoText(text) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—•]+/, "")
    .trim();

  if (!normalized) {
    return "";
  }

  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return capitalized.replace(/[.]+$/, "");
}

function extractTodoEntriesFromManualNotes(rawNotes) {
  const matches = String(rawNotes || "").matchAll(/(?:^|\n)\s*todo:?\s+(.+)/gi);
  return [...matches]
    .map((match) => polishTodoText(match[1]))
    .filter(Boolean);
}

function buildTodoSessionRef(session) {
  return {
    sessionId: session.id,
    title: session.title?.trim() || "Untitled session",
  };
}

function syncTodoItemsFromSession(session) {
  const extractedTodos = extractTodoEntriesFromManualNotes(session.rawNotes);
  if (!extractedTodos.length) {
    return;
  }

  const sessionRef = buildTodoSessionRef(session);
  const existingItems = normalizeTodoItems(settings.todoItems);
  const byDescription = new Map(
    existingItems.map((item) => [item.description.toLocaleLowerCase(), item])
  );

  extractedTodos.forEach((description) => {
    const key = description.toLocaleLowerCase();
    const existingItem = byDescription.get(key);

    if (existingItem) {
      existingItem.sessionRefs = normalizeTodoSessionRefs([...(existingItem.sessionRefs || []), sessionRef]);
      return;
    }

    byDescription.set(key, {
      id: crypto.randomUUID(),
      completed: false,
      description,
      addedAt: formatIsoDate(new Date()),
      sessionRefs: [sessionRef],
      comments: "",
    });
  });

  settings.todoItems = [...byDescription.values()];
  persistSettings();
}

function syncParticipantDirectoryWithSession(value) {
  const nextDirectory = normalizeParticipantDirectory([
    ...(settings.participantDirectory || []),
    ...parseParticipants(value),
  ]);

  if (JSON.stringify(nextDirectory) === JSON.stringify(settings.participantDirectory || [])) {
    return;
  }

  settings.participantDirectory = nextDirectory;
  settings.participantDirectoryInitialized = true;
  persistSettings();
  renderParticipantSuggestions();
  renderParticipantDirectoryManager();
}

function getUnsavedParticipantNames(value) {
  const knownParticipants = new Set(
    normalizeParticipantDirectory(settings.participantDirectory || []).map((name) => name.toLocaleLowerCase())
  );
  return parseParticipants(value).filter((name) => !knownParticipants.has(name.toLocaleLowerCase()));
}

async function maybeOfferParticipantDirectoryUpdate(value) {
  const newParticipants = getUnsavedParticipantNames(value);
  if (!newParticipants.length) {
    return 0;
  }

  const confirmed = await showConfirmModal({
    eyebrow: "Participants",
    title: newParticipants.length === 1 ? "Add new participant to saved list?" : "Add new participants to saved list?",
    message:
      newParticipants.length === 1
        ? `"${newParticipants[0]}" appears in the meeting Participants field but is not yet saved. Add it to the saved Participants list for future quick selection?`
        : `${newParticipants.join(", ")} appear in the meeting Participants field but are not yet saved. Add them to the saved Participants list for future quick selection?`,
    confirmLabel: newParticipants.length === 1 ? "Add participant" : "Add participants",
    cancelLabel: "Not now",
  });

  if (!confirmed) {
    return 0;
  }

  syncParticipantDirectoryWithSession(newParticipants.join(", "));
  return newParticipants.length;
}

function addParticipantToDirectory(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    participantDirectoryInput.focus();
    return;
  }

  settings.participantDirectory = normalizeParticipantDirectory([
    ...(settings.participantDirectory || []),
    trimmed,
  ]);
  settings.participantDirectoryInitialized = true;
  persistSettings();
  participantDirectoryInput.value = "";
  renderParticipantDirectoryManager();
  renderParticipantSuggestions();
  participantDirectoryInput.focus();
}

function normalizeAbbreviationDirectory(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const byKey = new Map();
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const short = String(entry.short || "").trim();
    const full = String(entry.full || "").trim();
    if (!short || !full) {
      return;
    }

    byKey.set(short.toLocaleLowerCase(), { short, full });
  });

  return [...byKey.values()].sort((first, second) => first.short.localeCompare(second.short, undefined, { sensitivity: "base" }));
}

function addAbbreviationToDirectory(shortValue, fullValue) {
  const short = String(shortValue || "").trim();
  const full = String(fullValue || "").trim();

  if (!short) {
    abbreviationShortInput.focus();
    return;
  }

  if (!full) {
    abbreviationFullInput.focus();
    return;
  }

  settings.abbreviationDirectory = normalizeAbbreviationDirectory([
    ...(settings.abbreviationDirectory || []),
    { short, full },
  ]);
  persistSettings();
  abbreviationShortInput.value = "";
  abbreviationFullInput.value = "";
  renderAbbreviationDirectoryManager();
  abbreviationShortInput.focus();
}

function applyTheme(themeFamily, themeMode) {
  const resolvedFamily = THEME_DESCRIPTIONS[themeFamily] ? themeFamily : "fluent-slate";
  const resolvedMode = themeMode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", `${resolvedFamily}-${resolvedMode}`);
}

function syncSettingsForm() {
  themeFamilySelect.value = THEME_DESCRIPTIONS[settings.themeFamily] ? settings.themeFamily : "fluent-slate";
  themeModeSelect.value = settings.themeMode === "dark" ? "dark" : "light";
  exportStylePresetSelect.value = EXPORT_STYLE_PRESETS[settings.exportStylePreset] ? settings.exportStylePreset : "custom";
  writeExportStyleInputs(getCurrentExportStyle());
  updateThemeDescription();
  updateExportStyleDescription();
  updateStorageUi();
  syncPromptSettingsUi();
  renderCustomTemplates();
  renderAbbreviationDirectoryManager();
  renderParticipantDirectoryManager();
}

function syncPromptSettingsUi() {
  const promptSettings = normalizePromptSettings(settings.promptSettings);
  promptGenerationSystemInput.value = promptSettings.meetingMinutesSystem;
  promptGenerationRulesInput.value = promptSettings.meetingMinutesRules;
  promptPersonalNotesSystemInput.value = promptSettings.personalNotesSystem;
  promptPersonalNotesRulesInput.value = promptSettings.personalNotesRules;
  promptRevisionRulesInput.value = promptSettings.revisionRules;
  promptTranslationRulesInput.value = promptSettings.translationRules;
  renderAdditionalPromptBlocks(promptSettings.additionalPrompts);
}

function renderAdditionalPromptBlocks(additionalPrompts) {
  promptAdditionalList.innerHTML = "";

  additionalPrompts.forEach((prompt) => {
    const fragment = promptBlockTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".prompt-block-item");
    item.dataset.promptId = prompt.id;
    fragment.querySelector(".prompt-block-enabled").checked = prompt.enabled !== false;
    fragment.querySelector(".prompt-block-label").value = prompt.label;
    fragment.querySelector(".prompt-block-text").value = prompt.text;
    promptAdditionalList.appendChild(fragment);
  });
}

function updateStorageUi() {
  if (!storageModeBrowserInput || !storageModeFileInput) {
    return;
  }

  const isFileMode = isLocalDataFileMode();
  storageModeBrowserInput.checked = !isFileMode;
  storageModeFileInput.checked = isFileMode;

  const supported = supportsLocalDataFileMode();
  storageModeFileInput.disabled = !supported;
  createStorageFileButton.disabled = !supported;
  useStorageFileButton.disabled = !supported;
  reconnectStorageFileButton.disabled = !supported;

  if (!supported) {
    storageModeCopy.textContent = "This browser uses local IndexedDB storage. Your sessions stay on this device, and you can still export a backup whenever you want.";
    storageStatusCopy.textContent = "No separate local data file is connected in this browser.";
    disconnectStorageFileButton.disabled = true;
    return;
  }

  if (!isFileMode) {
    storageModeCopy.textContent = "Browser storage is active in local IndexedDB. Your sessions stay in this browser profile, and backup/export remains available from the Data Backup menu.";
    storageStatusCopy.textContent = "No separate local data file is connected.";
    reconnectStorageFileButton.disabled = true;
    disconnectStorageFileButton.disabled = true;
    return;
  }

  storageModeCopy.textContent = "Local data file mode is active. Sessions and related settings are written to a file on this computer for extra control and backup.";
  storageStatusCopy.textContent = settings.storageFileConnected
    ? `Connected to ${settings.storageFileName || "your local data file"}. Last sync: ${settings.storageLastSyncAt ? `${formatDate(settings.storageLastSyncAt)} ${formatTime(settings.storageLastSyncAt)}` : "just now"}.`
    : `Local data file mode is selected${settings.storageFileName ? ` for ${settings.storageFileName}` : ""}, but the file needs to be reconnected.`;
  reconnectStorageFileButton.disabled = false;
  disconnectStorageFileButton.disabled = false;
}

function getRecentSessionsExpanded() {
  return settings.recentSessionsExpanded === true;
}

function setRecentSessionsExpanded(nextExpanded) {
  settings.recentSessionsExpanded = nextExpanded;
  persistSettings();
  updateRecentSessionsPanelUi();
}

function toggleRecentSessionsPanel(forceExpanded) {
  const nextExpanded = typeof forceExpanded === "boolean" ? forceExpanded : !getRecentSessionsExpanded();
  setRecentSessionsExpanded(nextExpanded);
}

function updateRecentSessionsPanelUi() {
  const isExpanded = getRecentSessionsExpanded();
  sessionsPanel.classList.toggle("is-open", isExpanded);
  const showBackdrop = isExpanded && window.innerWidth <= 1200;
  sessionsPanelBackdrop.hidden = !showBackdrop;
  sessionsPanelBackdrop.classList.toggle("is-visible", showBackdrop);
  document.body.classList.toggle("sessions-panel-open", isExpanded);
  toggleSessionsPanelButton?.setAttribute("aria-expanded", String(isExpanded));
  openSessionsMainButton?.setAttribute("aria-expanded", String(isExpanded));
  collapseSessionsPanelButton?.setAttribute("aria-expanded", String(isExpanded));
  openSessionsMainButton?.classList.toggle("is-active", isExpanded);
}

function getThemeDisplayName(themeFamily) {
  const themeNames = {
    "fluent-slate": "Fluent Slate",
    "atlas-blue": "Atlas Blue",
    "graphite-forest": "Graphite Forest",
    "stone-olive": "Stone Olive",
    "nordic-teal": "Nordic Teal",
    "copper-ink": "Copper Ink",
  };

  return themeNames[themeFamily] || themeNames["fluent-slate"];
}

function updateThemeDescription() {
  settingsThemeDescription.textContent = THEME_DESCRIPTIONS[themeFamilySelect.value] || THEME_DESCRIPTIONS["fluent-slate"];
}

function previewThemeSelection() {
  settings.themeFamily = themeFamilySelect.value;
  settings.themeMode = themeModeSelect.value;
  persistSettings();
  applyCurrentTheme();
  updateThemeDescription();
}

function getCurrentExportStyle() {
  const presetId = settings.exportStylePreset;
  const presetStyle = EXPORT_STYLE_PRESETS[presetId]?.style || EXPORT_STYLE_PRESETS[DEFAULT_EXPORT_PRESET].style;
  return normalizeExportStyle({
    ...presetStyle,
    ...(settings.exportStyle || {}),
  });
}

function applyExportPresetToInputs(presetId) {
  const nextStyle = presetId === "custom"
    ? readExportStyleInputs()
    : normalizeExportStyle(EXPORT_STYLE_PRESETS[presetId]?.style || EXPORT_STYLE_PRESETS[DEFAULT_EXPORT_PRESET].style);
  writeExportStyleInputs(nextStyle);
  updateExportStyleDescription();
}

function writeExportStyleInputs(style) {
  exportTitleFontInput.value = style.titleFont;
  exportHeadingFontInput.value = style.headingFont;
  exportBodyFontInput.value = style.bodyFont;
  exportMetaFontInput.value = style.metaFont;
  exportTitleSizeInput.value = String(style.titleSize);
  exportHeadingSizeInput.value = String(style.headingSize);
  exportBodySizeInput.value = String(style.bodySize);
  exportMetaSizeInput.value = String(style.metaSize);
  exportLineHeightInput.value = String(style.lineHeight);
}

function readExportStyleInputs() {
  return normalizeExportStyle({
    titleFont: exportTitleFontInput.value,
    headingFont: exportHeadingFontInput.value,
    bodyFont: exportBodyFontInput.value,
    metaFont: exportMetaFontInput.value,
    titleSize: exportTitleSizeInput.value,
    headingSize: exportHeadingSizeInput.value,
    bodySize: exportBodySizeInput.value,
    metaSize: exportMetaSizeInput.value,
    lineHeight: exportLineHeightInput.value,
  });
}

function updateExportStyleDescription() {
  if (exportStylePresetSelect.value === "custom") {
    exportStyleDescription.textContent = "Your personal export style. These font choices and sizes are saved locally and used for future Word and PDF exports.";
    return;
  }

  exportStyleDescription.textContent = EXPORT_STYLE_PRESETS[exportStylePresetSelect.value]?.description
    || EXPORT_STYLE_PRESETS[DEFAULT_EXPORT_PRESET].description;
}

function getExportStyleDisplayName(presetId) {
  return EXPORT_STYLE_PRESETS[presetId]?.label || "Personal style";
}

function updateSessionStorageUi() {
  saveLocalFileButton.disabled = !SUPPORTS_FILE_SAVE;
  sessionStorageStatus.textContent = SUPPORTS_FILE_SAVE
    ? "Export a backup, import one later, or save directly to a local file on supported browsers."
    : "Export and import are available here. Direct local file saving depends on browser support and is unavailable in this browser.";
}

function buildSessionsExportPayload() {
  return {
    app: "Meeting Notes Studio",
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: sessions,
  };
}

function exportCurrentSessionAsWord() {
  const session = getActiveSession();

  if (!session?.polishedHtml) {
    dictationStatus.textContent = "Create polished notes first, then export the session.";
    return;
  }

  const title = session.title.trim() || "Meeting Notes";
  const documentHtml = buildWordDocumentHtml(title, session.polishedHtml, getCurrentExportStyle());
  const blob = new Blob([documentHtml], { type: "application/msword" });
  saveBlobAsFile(blob, `${toFileSafeName(title)}.doc`, "application/msword")
    .then((result) => {
      dictationStatus.textContent = result === "saved"
        ? "The current session was saved as a Word document."
        : "The current session was exported as a Word document.";
    })
    .catch((error) => {
      dictationStatus.textContent = error?.name === "AbortError"
        ? "Word export was cancelled."
        : `Word export failed: ${error.message}`;
    });
}

function exportCurrentSessionAsPdf() {
  const session = getActiveSession();

  if (!session?.polishedHtml) {
    dictationStatus.textContent = "Create polished notes first, then export the session.";
    return;
  }

  if (!window.jspdf?.jsPDF) {
    dictationStatus.textContent = "PDF export is unavailable because the PDF library did not load.";
    return;
  }

  if (window.html2canvas) {
    exportCurrentSessionAsStyledPdf(session).catch(() => {
      exportCurrentSessionAsBasicPdf(session);
    });
    return;
  }

  exportCurrentSessionAsBasicPdf(session);
}

async function exportCurrentSessionAsStyledPdf(session) {
  const exportData = getCurrentSessionExportData();
  const exportStyle = getCurrentExportStyle();
  const { jsPDF } = window.jspdf;
  const previewElement = buildPdfPreviewElement(session, exportStyle);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const canvas = await window.html2canvas(previewElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const pdf = new jsPDF({
      unit: "pt",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageData = canvas.toDataURL("image/png");
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
      heightLeft -= pageHeight;
    }

    const pdfBlob = pdf.output("blob");
    const result = await saveBlobAsFile(pdfBlob, `${toFileSafeName(exportData.title)}.pdf`, "application/pdf");
    dictationStatus.textContent = result === "saved"
      ? "The current session was saved as a PDF document."
      : "The current session was exported as a PDF document.";
  } finally {
    previewElement.remove();
  }
}

function exportCurrentSessionAsBasicPdf(session) {
  const exportData = getCurrentSessionExportData();
  const exportStyle = getCurrentExportStyle();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 56;

  const ensurePageSpace = (heightNeeded = 22) => {
    if (cursorY + heightNeeded <= pageHeight - margin) {
      return;
    }

    pdf.addPage();
    cursorY = 56;
  };

  const writeLines = (text, fontName, fontStyle, fontSize = 11, lineHeight = 18) => {
    pdf.setFont(fontName, fontStyle);
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, contentWidth);
    lines.forEach((line) => {
      ensurePageSpace(lineHeight);
      pdf.text(line, margin, cursorY);
      cursorY += lineHeight;
    });
  };

  pdf.setFont(mapPdfFontFamily(exportStyle.titleFont), "bold");
  pdf.setFontSize(exportStyle.titleSize);
  pdf.text(exportData.title, margin, cursorY);
  cursorY += exportStyle.titleSize + 6;

  writeLines(
    exportData.meta,
    mapPdfFontFamily(exportStyle.metaFont),
    "normal",
    exportStyle.metaSize,
    exportStyle.metaSize * exportStyle.lineHeight,
  );
  cursorY += 10;

  exportData.sections.forEach((section) => {
    ensurePageSpace(26);
    pdf.setFont(mapPdfFontFamily(exportStyle.headingFont), "bold");
    pdf.setFontSize(exportStyle.headingSize);
    pdf.text(section.heading, margin, cursorY);
    cursorY += exportStyle.headingSize + 6;

    if (section.type === "list") {
      section.items.forEach((item) => {
        const bulletLines = pdf.splitTextToSize(`• ${item}`, contentWidth - 10);
        pdf.setFont(mapPdfFontFamily(exportStyle.bodyFont), "normal");
        pdf.setFontSize(exportStyle.bodySize);
        bulletLines.forEach((line) => {
          ensurePageSpace(exportStyle.bodySize * exportStyle.lineHeight);
          pdf.text(line, margin + 8, cursorY);
          cursorY += exportStyle.bodySize * exportStyle.lineHeight;
        });
      });
    } else {
      writeLines(
        section.text,
        mapPdfFontFamily(exportStyle.bodyFont),
        "normal",
        exportStyle.bodySize,
        exportStyle.bodySize * exportStyle.lineHeight,
      );
    }

    cursorY += 8;
  });

  const pdfBlob = pdf.output("blob");
  saveBlobAsFile(pdfBlob, `${toFileSafeName(exportData.title)}.pdf`, "application/pdf")
    .then((result) => {
      dictationStatus.textContent = result === "saved"
        ? "The current session was saved as a PDF document."
        : "The current session was exported as a PDF document.";
    })
    .catch((error) => {
      dictationStatus.textContent = error?.name === "AbortError"
        ? "PDF export was cancelled."
        : `PDF export failed: ${error.message}`;
    });
}

function buildPdfPreviewElement(session, exportStyle) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  container.style.color = "#1f1f1f";
  container.style.padding = "56px 64px";
  container.style.fontFamily = exportStyle.bodyFont;
  container.style.fontSize = `${exportStyle.bodySize}pt`;
  container.style.lineHeight = String(exportStyle.lineHeight);
  container.style.boxSizing = "border-box";

  container.innerHTML = `
    <style>
      .pdf-export-doc { color: #1f1f1f; }
      .pdf-export-doc .output-header { border-bottom: 1px solid #d8d1c6; padding-bottom: 12px; margin-bottom: 18px; }
      .pdf-export-doc .output-header h3 { font-family: ${exportStyle.titleFont}; font-size: ${exportStyle.titleSize}pt; margin: 0 0 10px; line-height: 1.1; }
      .pdf-export-doc .output-meta { font-family: ${exportStyle.metaFont}; font-size: ${exportStyle.metaSize}pt; color: #6d6258; margin: 0; }
      .pdf-export-doc .output-section { margin-top: 18px; }
      .pdf-export-doc .output-section h4 { font-family: ${exportStyle.headingFont}; font-size: ${exportStyle.headingSize}pt; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; color: #405238; }
      .pdf-export-doc .output-section p,
      .pdf-export-doc .output-section li { font-family: ${exportStyle.bodyFont}; font-size: ${exportStyle.bodySize}pt; line-height: ${exportStyle.lineHeight}; }
      .pdf-export-doc .output-section ul { margin: 0; padding-left: 20px; }
      .pdf-export-doc .output-section li { margin: 0 0 8px; }
    </style>
    <div class="pdf-export-doc">${session.polishedHtml}</div>
  `;

  document.body.appendChild(container);
  return container;
}

function getCurrentSessionExportData() {
  const session = getActiveSession();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = session.polishedHtml;

  const title = wrapper.querySelector(".output-header h3")?.textContent?.trim() || session.title.trim() || "Meeting Notes";
  const meta = wrapper.querySelector(".output-meta")?.textContent?.replace(/\s+/g, " ").trim() || "";
  const sections = [...wrapper.querySelectorAll(".output-section")].map((section) => {
    const heading = section.querySelector("h4")?.textContent?.trim() || "";
    const listItems = [...section.querySelectorAll("li")].map((item) => item.textContent.trim()).filter(Boolean);
    const paragraphText = [...section.querySelectorAll("p")]
      .map((item) => item.textContent.trim())
      .filter(Boolean)
      .join(" ");

    if (listItems.length) {
      return {
        heading,
        type: "list",
        items: listItems,
      };
    }

    return {
      heading,
      type: "text",
      text: paragraphText,
    };
  });

  return { title, meta, sections };
}

function buildWordDocumentHtml(title, bodyHtml, exportStyle) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: ${exportStyle.bodyFont}; font-size: ${exportStyle.bodySize}pt; color: #1f1f1f; margin: 40px; line-height: ${exportStyle.lineHeight}; }
    h3 { font-family: ${exportStyle.titleFont}; font-size: ${exportStyle.titleSize}pt; margin: 0 0 10px; }
    h4 { font-family: ${exportStyle.headingFont}; font-size: ${exportStyle.headingSize}pt; text-transform: uppercase; letter-spacing: 0.08em; margin: 24px 0 10px; color: #405238; }
    p { margin: 0 0 10px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 0 0 8px; font-family: ${exportStyle.bodyFont}; font-size: ${exportStyle.bodySize}pt; }
    .output-header { border-bottom: 1px solid #d8d1c6; padding-bottom: 12px; margin-bottom: 18px; }
    .output-meta { font-family: ${exportStyle.metaFont}; font-size: ${exportStyle.metaSize}pt; color: #6d6258; }
    .output-doc { display: block; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function saveBlobAsFile(blob, filename, mimeType) {
  downloadBlob(blob, filename);
  return "downloaded";
}

function toFileSafeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "meeting-notes";
}

function exportSessions() {
  const payload = buildSessionsExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `meeting-notes-sessions-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  markBackupCompleted();
  sessionStorageStatus.textContent = "Sessions exported to a JSON file.";
}

async function importSessionsFromFile(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const importedSessions = Array.isArray(payload) ? payload : payload.sessions;

    if (!Array.isArray(importedSessions) || !importedSessions.length) {
      throw new Error("No valid sessions were found in that file.");
    }

    sessions = normalizeImportedSessions(importedSessions);
    activeSessionId = sessions[0].id;
    persistSessions();
    render();
    sessionStorageStatus.textContent = `Imported ${sessions.length} session${sessions.length === 1 ? "" : "s"} from file.`;
  } catch (error) {
    sessionStorageStatus.textContent = `Import failed: ${error.message}`;
  } finally {
    importSessionsInput.value = "";
  }
}

async function saveSessionsToLocalFile() {
  if (!SUPPORTS_FILE_SAVE) {
    sessionStorageStatus.textContent = "Direct local file saving is not supported in this browser.";
    return false;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `meeting-notes-sessions-${new Date().toISOString().slice(0, 10)}.json`,
      types: [
        {
          description: "JSON files",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(buildSessionsExportPayload(), null, 2));
    await writable.close();
    markBackupCompleted();
    sessionStorageStatus.textContent = "Sessions were saved to your chosen local file.";
    return true;
  } catch (error) {
    if (error?.name === "AbortError") {
      sessionStorageStatus.textContent = "Local file save was cancelled.";
      return false;
    }

    sessionStorageStatus.textContent = `Local file save failed: ${error.message}`;
    return false;
  }
}

function normalizeImportedSessions(importedSessions) {
  return importedSessions
    .filter((session) => session && typeof session === "object")
    .map((session) => {
      const templateId = typeof session.template === "string" ? session.template : "meeting";
      const template = getTemplateDefinition(templateId);

      return {
      id: typeof session.id === "string" && session.id ? session.id : crypto.randomUUID(),
      title: typeof session.title === "string" && session.title ? session.title : (template.id === "personalNote" ? getDefaultTitleForTemplate(template) : ""),
      template: template.id,
      participants: typeof session.participants === "string" ? session.participants : "",
      meetingDate: typeof session.meetingDate === "string" ? session.meetingDate : "",
      meetingStartTime: typeof session.meetingStartTime === "string" ? session.meetingStartTime : "",
      meetingEndTime: typeof session.meetingEndTime === "string" ? session.meetingEndTime : "",
      agenda: typeof session.agenda === "string" ? session.agenda : "",
      sections: normalizeSectionConfig(session.sections),
      transcribeOnly: typeof session.transcribeOnly === "boolean"
        ? session.transcribeOnly
        : getDefaultTranscribeOnlyForTemplate(template),
      outputLanguage: normalizeOutputLanguagePreference(session.outputLanguage),
      detailLevel: normalizeDetailLevel(session.detailLevel),
      additionalInstructions: typeof session.additionalInstructions === "string" ? session.additionalInstructions : "",
      templateSectionStates: normalizeTemplateSectionStates(session.templateSectionStates, template.headers || []),
      customFieldValues: normalizeCustomFieldValues(session.customFieldValues, template.customFields || []),
      customHeaders: normalizeCustomHeaders(session.customHeaders),
      highlights: Array.isArray(session.highlights) ? session.highlights.filter((item) => typeof item === "string") : [],
      liveTranscript: typeof session.liveTranscript === "string" ? session.liveTranscript : "",
      uploadedTranscript: typeof session.uploadedTranscript === "string" ? session.uploadedTranscript : "",
      pendingAudioDraftMeta: normalizePendingAudioDraftMeta(session.pendingAudioDraftMeta),
      rawNotes: typeof session.rawNotes === "string" ? session.rawNotes : "",
      outputFeedback: typeof session.outputFeedback === "string" ? session.outputFeedback : "",
      polishedHtml: typeof session.polishedHtml === "string" ? session.polishedHtml : "",
      previousPolishedHtml: typeof session.previousPolishedHtml === "string" ? session.previousPolishedHtml : "",
      updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : Date.now(),
    };
    })
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

function createCustomHeader(title = "", instructions = "") {
  return {
    id: crypto.randomUUID(),
    include: true,
    title,
    instructions,
    isExpanded: false,
  };
}

function normalizeCustomTemplates(customTemplates) {
  if (!Array.isArray(customTemplates)) {
    return [];
  }

  return customTemplates
    .filter((template) => template && typeof template === "object")
    .map((template) => normalizeCustomTemplate(template))
    .filter((template) => template.id);
}

function normalizeCustomTemplate(template) {
  const fallback = createCustomTemplate();
  return {
    ...fallback,
    ...template,
    id: typeof template.id === "string" && template.id ? template.id : fallback.id,
    label: typeof template.label === "string" ? template.label : "",
    sourceTemplateId: typeof template.sourceTemplateId === "string" ? template.sourceTemplateId : "",
    isExpanded: template.isExpanded === true,
    summaryLead: typeof template.summaryLead === "string" && template.summaryLead.trim()
      ? template.summaryLead
      : fallback.summaryLead,
    sections: Array.isArray(template.sections) && template.sections.length
      ? template.sections.filter((section) => typeof section === "string" && section.trim()).slice(0, 4)
      : fallback.sections,
    templateInstructions: typeof template.templateInstructions === "string" ? template.templateInstructions : "",
    headers: normalizeTemplateHeaders(template.headers),
    customFields: normalizeTemplateCustomFields(template.customFields),
    fields: normalizeTemplateFields(template.fields),
  };
}

function normalizeTemplateFields(fields) {
  return {
    title: fields?.title !== false,
    participants: fields?.participants !== false,
    agenda: fields?.agenda === true,
    highlights: fields?.highlights !== false,
    manualNotes: fields?.manualNotes !== false,
    liveTranscript: fields?.liveTranscript !== false,
    meetingDate: fields?.meetingDate === true,
    meetingStartTime: fields?.meetingStartTime === true,
    meetingEndTime: fields?.meetingEndTime === true,
  };
}

function normalizeTemplateHeaders(headers) {
  if (!Array.isArray(headers)) {
    return [];
  }

  return headers
    .filter((header) => header && typeof header === "object")
    .map((header) => ({
      id: typeof header.id === "string" && header.id ? header.id : crypto.randomUUID(),
      title: typeof header.title === "string" ? header.title : "",
      instructions: typeof header.instructions === "string" ? header.instructions : "",
      isExpanded: header.isExpanded === true,
    }))
    .filter((header) => header.title.trim());
}

function normalizeTemplateCustomFields(customFields) {
  if (!Array.isArray(customFields)) {
    return [];
  }

  return customFields
    .filter((field) => field && typeof field === "object")
    .map((field) => ({
      id: typeof field.id === "string" && field.id ? field.id : crypto.randomUUID(),
      label: typeof field.label === "string" ? field.label : "",
      type: ["text", "number", "date", "time"].includes(field.type) ? field.type : "text",
      isExpanded: field.isExpanded === true,
    }))
    .filter((field) => field.label.trim());
}

function normalizeCustomFieldValues(values, customFields = []) {
  const normalizedFields = normalizeTemplateCustomFields(customFields);
  const nextValues = {};

  normalizedFields.forEach((field) => {
    const rawValue = values?.[field.id];
    nextValues[field.id] = typeof rawValue === "string" ? rawValue : "";
  });

  return nextValues;
}

function normalizeCustomHeaders(customHeaders) {
  if (!Array.isArray(customHeaders)) {
    return [];
  }

  return customHeaders
    .filter((header) => header && typeof header === "object")
    .map((header) => ({
      id: typeof header.id === "string" && header.id ? header.id : crypto.randomUUID(),
      include: header.include !== false,
      title: typeof header.title === "string" ? header.title : "",
      instructions: typeof header.instructions === "string" ? header.instructions : "",
      isExpanded: header.isExpanded === true,
    }));
}

function normalizeDetailLevel(detailLevel) {
  const parsed = Number(detailLevel);
  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(parsed)));
}

function getDetailLevelLabel(detailLevel) {
  const labels = {
    1: "Very short and concise",
    2: "Concise",
    3: "Balanced detail",
    4: "Detailed",
    5: "Very detailed",
  };

  return labels[normalizeDetailLevel(detailLevel)];
}

function formatCustomHeadersForPrompt(customHeaders) {
  if (!customHeaders.length) {
    return "No custom sections.";
  }

  return customHeaders
    .filter((header) => header.include !== false)
    .map((header, index) => {
      const title = header.title.trim() || `Custom Section ${index + 1}`;
      const instructions = header.instructions.trim() || "No extra instructions.";
      return `${index + 1}. ${title}: ${instructions}`;
    })
    .join("\n");
}

function buildLocalCustomSectionsMarkup(session, copy, template) {
  const customHeaders = [
    ...normalizeTemplateHeaders(template?.headers).filter((header) => session.templateSectionStates?.[header.id] !== false),
    ...session.customHeaders.filter((header) => header.include !== false && header.title.trim()),
  ];

  return customHeaders
    .map((header) => `
      <section class="output-section">
        <h4>${escapeHtml(header.title.trim())}</h4>
        <p>${escapeHtml(copy.customSectionFallback)}</p>
      </section>
    `)
    .join("");
}

function buildAiCustomSectionsMarkup(customSections = []) {
  return customSections
    .filter((section) => section.heading?.trim() && section.content?.trim())
    .map((section) => `
      <section class="output-section">
        <h4>${escapeHtml(section.heading.trim())}</h4>
        <p>${escapeHtml(section.content.trim())}</p>
      </section>
    `)
    .join("");
}

function formatTemplateHeadersForPrompt(headers, session = null) {
  const normalizedHeaders = normalizeTemplateHeaders(headers);
  const visibleHeaders = session
    ? normalizedHeaders.filter((header) => session.templateSectionStates?.[header.id] !== false)
    : normalizedHeaders;

  if (!visibleHeaders.length) {
    return "No template-specific sections.";
  }

  return visibleHeaders
    .map((header, index) => `${index + 1}. ${header.title.trim()}: ${header.instructions.trim() || "No extra instructions."}`)
    .join("\n");
}

function formatTemplateCustomFieldsForPrompt(template, session) {
  const customFields = normalizeTemplateCustomFields(template.customFields);
  if (!customFields.length) {
    return "No template-specific input fields.";
  }

  return customFields
    .map((field, index) => {
      const value = session.customFieldValues?.[field.id]?.trim() || "Not provided";
      return `${index + 1}. ${field.label.trim()} (${field.type}): ${value}`;
    })
    .join("\n");
}

function formatAdditionalPromptsForPrompt(additionalPrompts) {
  const prompts = normalizeAdditionalPrompts(additionalPrompts).filter((prompt) => prompt.enabled !== false && (prompt.label || prompt.text));
  if (!prompts.length) {
    return "No additional prompt blocks.";
  }

  return prompts
    .map((prompt, index) => `${index + 1}. ${prompt.label || `Prompt block ${index + 1}`}: ${prompt.text || "No prompt text provided."}`)
    .join("\n");
}

function detectSourceLanguage(session) {
  const sample = [
    session.title,
    session.participants,
    getAgendaText(session),
    ...(session.highlights || []),
    session.rawNotes,
  ]
    .filter(Boolean)
    .join(" ");

  return detectPreferredLanguage(sample || navigator.language, DICTATION_LANGUAGES.english) === DICTATION_LANGUAGES.swedish
    ? OUTPUT_LANGUAGES.swedish
    : OUTPUT_LANGUAGES.english;
}

function resolveOutputLanguage(session) {
  const preference = normalizeOutputLanguagePreference(session.outputLanguage);
  if (preference === "sv") {
    return OUTPUT_LANGUAGES.swedish;
  }

  if (preference === "en") {
    return OUTPUT_LANGUAGES.english;
  }

  return detectSourceLanguage(session);
}

function detectOutputContentLanguage(session) {
  const outputText = htmlToPlainText(session?.polishedHtml || polishedOutput.innerHTML);
  return detectPreferredLanguage(outputText || navigator.language, DICTATION_LANGUAGES.english) === DICTATION_LANGUAGES.swedish
    ? OUTPUT_LANGUAGES.swedish
    : OUTPUT_LANGUAGES.english;
}

function getOppositeOutputLanguage(outputLanguage) {
  return outputLanguage === OUTPUT_LANGUAGES.swedish
    ? OUTPUT_LANGUAGES.english
    : OUTPUT_LANGUAGES.swedish;
}

function getOutputLanguageLabel(outputLanguage) {
  return outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English";
}

function getOutputCopy(outputLanguage) {
  if (outputLanguage === OUTPUT_LANGUAGES.swedish) {
    return {
      agendaHeading: "Agenda",
      summaryHeading: "Sammanfattning",
      highlightsHeading: "H\u00f6jdpunkter",
      decisionsHeading: "Beslut",
      actionsHeading: "\u00c5tg\u00e4rder",
      participantsLabel: "Deltagare",
      noAgenda: "Ingen agenda angavs.",
      noHighlights: "Inga h\u00f6jdpunkter har lagts till \u00e4n.",
      noDecisions: "Inga tydliga beslut dokumenterades.",
      noActions: "Inga \u00e5tg\u00e4rder identifierades.",
      noDiscussion: "Inga detaljerade diskussionspunkter har registrerats \u00e4n.",
      noDiscussionDetails: "Inga detaljer registrerades.",
      customSectionFallback: "Den h\u00e4r anpassade sektionen \u00e4r b\u00e4st att generera med AI-polering.",
      headingMap: {
        Overview: "\u00d6versikt",
        "Key Discussion Points": "Viktiga diskussionspunkter",
        Decisions: "Beslut",
        "Action Items": "\u00c5tg\u00e4rder",
        "Progress Updates": "Statusuppdateringar",
        Blockers: "Blockerare",
        "Next Actions": "N\u00e4sta steg",
        "Client Priorities": "Kundprioriteringar",
        Commitments: "\u00c5taganden",
        "Follow-Up Actions": "Uppf\u00f6ljnings\u00e5tg\u00e4rder",
        "Topics Discussed": "Diskuterade \u00e4mnen",
        "Support Needed": "Behov av st\u00f6d",
        "Next Steps": "N\u00e4sta steg",
        "Candidate Highlights": "Kandidatens styrkor",
        Signals: "Observationer",
      },
    };
  }

  return {
    agendaHeading: "Agenda",
    summaryHeading: "Summary",
    highlightsHeading: "Highlights",
    decisionsHeading: "Decisions",
    actionsHeading: "Action Items",
    participantsLabel: "Participants",
    noAgenda: "No agenda was provided.",
    noHighlights: "No highlights added yet.",
    noDecisions: "No explicit decisions were recorded.",
    noActions: "No action items were identified.",
    noDiscussion: "No detailed discussion points were captured yet.",
    noDiscussionDetails: "No details captured.",
    customSectionFallback: "This custom section is best generated with AI polishing.",
    headingMap: {},
  };
}

function localizeHeading(heading, copy) {
  return copy.headingMap?.[heading] || heading;
}

function getInitialDictationLanguage() {
  return /^sv\b/i.test(navigator.language || "")
    ? DICTATION_LANGUAGES.swedish
    : DICTATION_LANGUAGES.english;
}

function resolveDictationLanguage(sampleText) {
  if (settings.dictationLanguage && settings.dictationLanguage !== "auto") {
    return settings.dictationLanguage;
  }

  return detectPreferredLanguage(sampleText, getInitialDictationLanguage());
}

function detectPreferredLanguage(text, fallbackLanguage) {
  const sample = (text || "").toLowerCase();
  const swedishScore = scoreLanguage(sample, [
    /\b(och|det|att|som|inte|med|f\u00f6r|har|p\u00e5|\u00e4r|vi|ska|ocks\u00e5|m\u00f6te|beslut|\u00e5tg\u00e4rd|uppf\u00f6ljning|n\u00e4sta|deltagare|sammanfattning)\b/g,
    /[\u00e5\u00e4\u00f6]/g,
  ]);
  const englishScore = scoreLanguage(sample, [
    /\b(and|the|that|with|for|not|have|this|will|meeting|decision|action|follow-up|summary|next|participants)\b/g,
  ]);
  const normalizedFallback = fallbackLanguage || getInitialDictationLanguage();
  const scoreDelta = swedishScore - englishScore;

  if (sample.length < 12) {
    return normalizedFallback;
  }

  if (/[\u00e5\u00e4\u00f6]/.test(sample) || /\b(jag|detta|ocks\u00e5|m\u00f6te|n\u00e4sta|uppf\u00f6ljning)\b/.test(sample)) {
    return DICTATION_LANGUAGES.swedish;
  }

  if (/\b(the|and|with|meeting|summary|action items)\b/.test(sample) && englishScore >= swedishScore + 2) {
    return DICTATION_LANGUAGES.english;
  }

  if (Math.abs(scoreDelta) < 2) {
    return normalizedFallback;
  }

  return scoreDelta > 0 ? DICTATION_LANGUAGES.swedish : DICTATION_LANGUAGES.english;
}



function scoreLanguage(sample, patterns) {
  return patterns.reduce((score, pattern) => {
    const matches = sample.match(pattern);
    return score + (matches ? matches.length : 0);
  }, 0);
}

function formatDictationLanguage(languageCode) {
  return languageCode === DICTATION_LANGUAGES.swedish ? "Swedish" : "English";
}

function localizeSummaryLead(summaryLead) {
  const translations = {
    "This meeting focused on key updates, decisions, and next steps.": "M\u00f6tet fokuserade p\u00e5 viktiga uppdateringar, beslut och n\u00e4sta steg.",
    "The standup reviewed progress, current blockers, and immediate priorities.": "Standupen gick igenom framsteg, aktuella hinder och omedelbara prioriteringar.",
    "The client conversation centered on needs, expectations, and agreed follow-ups.": "Kundsamtalet fokuserade p\u00e5 behov, f\u00f6rv\u00e4ntningar och \u00f6verenskomna uppf\u00f6ljningar.",
    "The 1:1 covered current priorities, support needed, and development opportunities.": "1:1-m\u00f6tet tog upp aktuella prioriteringar, behov av st\u00f6d och utvecklingsm\u00f6jligheter.",
    "The interview explored background, strengths, and role alignment.": "Intervjun behandlade bakgrund, styrkor och hur kandidaten passar rollen.",
  };

  return translations[summaryLead] || summaryLead;
}



