export type TemplateKind = "builtin" | "custom";
export type TemplateFieldType = "text" | "number" | "date" | "time" | "textarea";
export type CaptureMode = "meeting-note" | "quick-note" | "voice-note";
export type CaptureWorkspaceDensity = "full" | "minimal";

export interface TemplateField {
  id: string;
  key: string;
  label: string;
  type: TemplateFieldType;
  enabled: boolean;
  required: boolean;
  position: number;
}

export interface TemplateSection {
  id: string;
  title: string;
  instructions: string;
  enabledByDefault: boolean;
  position: number;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  kind: TemplateKind;
  captureModes: CaptureMode[];
  fields: TemplateField[];
  sections: TemplateSection[];
  promptInstructions?: string;
}

export interface SessionRecord {
  id: string;
  captureMode: CaptureMode;
  templateId: string;
  title: string;
  isPrivate: boolean;
  deletedAt?: string | null;
  participantText: string;
  project: string;
  domain: string;
  activity: string;
  tagsText: string;
  date: string;
  startTime: string;
  endTime: string;
  quickHighlights: string;
  transcribeOnly: boolean;
  outputLanguage: "same" | "sv" | "en";
  detailLevel: number;
  additionalInstructions: string;
  manualNotes: string;
  liveTranscript: string;
  uploadedTranscript: string;
  customFieldValues: Record<string, string>;
  excludedSectionIds: string[];
  output: string;
  outputVersions: Array<{
    id: string;
    output: string;
    generatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TodoRecord {
  id: string;
  description: string;
  participantText?: string;
  isDone: boolean;
  completedAt?: string | null;
  isPrivate: boolean;
  isPriority?: boolean;
  comments: string;
  activityId: string;
  domain: string;
  project: string;
  activity: string;
  doOn: string;
  dueDate: string;
  detailsHtml: string;
  createdAt: string;
  updatedAt?: string;
  sessionIds: string[];
}

export type TaskRecord = TodoRecord;

export interface ArchivedTaskRecord {
  id: string;
  title: string;
  isPrivate: boolean;
  domain: string;
  project: string;
  activity: string;
  activityId: string;
  deletedAt: string;
  originalCreatedAt: string;
  originalCompletedAt?: string | null;
}

export interface ActivityRecord {
  id: string;
  type: "task" | "meeting";
  parentActivityId: string;
  description: string;
  participantText?: string;
  isDone: boolean;
  isPrivate: boolean;
  comments: string;
  domain: string;
  project: string;
  activity: string;
  doOn: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  detailsHtml: string;
  timeRequiredMinutes: number;
  actualTimeSpentMinutes: number;
  createdAt: string;
  updatedAt?: string;
  sessionIds: string[];
}

export interface TimeLogRecord {
  id: string;
  targetType: "todo" | "activity";
  targetId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarItemRecord {
  id: string;
  targetType: "todo" | "activity";
  targetId: string;
  date: string;
  startSlot: number;
  durationSlots: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityLinkRecord {
  id: string;
  fromType: "activity" | "todo" | "session";
  fromId: string;
  toType: "activity" | "todo" | "session";
  toId: string;
  relation: "has_session";
  createdAt: string;
  updatedAt?: string;
}

export interface PromptBlock {
  id: string;
  label: string;
  body: string;
  enabled: boolean;
}

export interface PromptProfile {
  meetingMinutesSystem: string;
  meetingMinutesRules: string;
  personalNotesSystem: string;
  personalNotesRules: string;
  revisionRules: string;
  translationRules: string;
  extraBlocks: PromptBlock[];
}

export interface TimeReportPreset {
  id: string;
  label: string;
  fromDate: string;
  toDate: string;
  domain: string;
  project: string;
}

export interface ProjectLinkRecord {
  id: string;
  project: string;
  domain: string;
}

export interface ChecklistItemRecord {
  id: string;
  label: string;
  isChecked: boolean;
  notes: string;
  position: number;
  checkedAt?: string | null;
}

export interface ChecklistRecord {
  id: string;
  ownerType: "project" | "todo";
  ownerId: string;
  title: string;
  description: string;
  archived: boolean;
  templateId?: string | null;
  recurrenceRuleId?: string | null;
  recurrenceKey?: string | null;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItemRecord[];
}

export interface ChecklistTemplateRecord {
  id: string;
  title: string;
  category: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItemRecord[];
}

export type ChecklistRecurrenceCadence = "weekly" | "monthly";

export interface ChecklistRecurrenceRecord {
  id: string;
  ownerType: "project" | "todo";
  ownerId: string;
  templateId: string;
  cadence: ChecklistRecurrenceCadence;
  createdAt: string;
  updatedAt: string;
  lastInstantiatedPeriodKey?: string | null;
}

export interface AttachmentRecord {
  id: string;
  sessionId: string;
  kind: "audio" | "image" | "pdf" | "document" | "transcript";
  filename: string;
  mimeType: string;
  filePath: string;
  sizeBytes: number;
  caption: string;
  includeInOutput: boolean;
  outputPosition: number;
  createdAt: string;
  updatedAt?: string;
}

export type DeletedEntityType =
  | "session"
  | "todo"
  | "activity"
  | "timelog"
  | "calendarItem"
  | "entityLink"
  | "attachment"
  | "checklist"
  | "checklistTemplate"
  | "checklistRecurrence";

export interface DeletedEntityRecord {
  entityType: DeletedEntityType;
  entityId: string;
  deletedAt: string;
}

export interface PreferredParticipantName {
  id: string;
  shortForm: string;
  fullName: string;
}

export interface RuleSuggestionRecord {
  id: string;
  type: "abbreviation" | "preferred_name";
  sourceValue: string;
  suggestedValue: string;
  evidenceCount: number;
  confidence: number;
  status: "pending" | "accepted" | "ignored";
  ignoreForever: boolean;
  observedSessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssistantQueryMemoryRecord {
  id: string;
  fingerprint: string;
  learnedFromQuestion: string;
  route: "timelogs" | "sessions" | "calendar" | "todos" | "activities" | "workspace";
  clarificationAnswer: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalAppSettings {
  theme: string;
  outputLanguage: "same" | "sv" | "en";
  preferredDesktopTemplateId: string;
  outputLayoutPresetId: string;
  notesCapturePaneWidth: number;
  captureWorkspaceDensity: CaptureWorkspaceDensity;
  outputWorkspaceDensity: CaptureWorkspaceDensity;
  calendarDaysInView: 3 | 5 | 7 | 14;
  calendarSlotHeight: 12 | 16 | 22;
  calendarIsFullScreen: boolean;
  calendarFullScreenPreferenceInitialized?: boolean;
  calendarDetailsPaneWidth: number;
  calendarScrollTop: number;
  calendarScrollLeft: number;
  calendarVisibilityFilter?: "all" | "public" | "private";
  calendarShowPrivate?: boolean;
  calendarShowBusiness?: boolean;
  calendarShowPriorityOnly?: boolean;
  baselineWorkEnabled: boolean;
  baselineWorkActivityId: string;
  apiKey: string;
  textModel: string;
  transcriptionModel: string;
  savedParticipants: string[];
  savedProjects: string[];
  savedDomains: string[];
  savedActivities: string[];
  savedTags: string[];
  projectLinks: ProjectLinkRecord[];
  timeReportPresets: TimeReportPreset[];
  abbreviations: Array<{ id: string; shortForm: string; fullForm: string }>;
  preferredParticipantNames: PreferredParticipantName[];
  ruleSuggestions: RuleSuggestionRecord[];
  assistantQueryMemories?: AssistantQueryMemoryRecord[];
  promptProfile: PromptProfile;
}

export interface DesktopAppSnapshot {
  sessions: SessionRecord[];
  templates: TemplateDefinition[];
  todos: TodoRecord[];
  checklists: ChecklistRecord[];
  checklistTemplates: ChecklistTemplateRecord[];
  checklistRecurrences: ChecklistRecurrenceRecord[];
  archivedTasks: ArchivedTaskRecord[];
  activities: ActivityRecord[];
  timelogs: TimeLogRecord[];
  calendarItems: CalendarItemRecord[];
  entityLinks: EntityLinkRecord[];
  attachments: AttachmentRecord[];
  deletedEntities?: DeletedEntityRecord[];
  settings: LocalAppSettings;
}

export const DEFAULT_TEMPLATE_BY_CAPTURE_MODE: Record<CaptureMode, string> = {
  "meeting-note": "meeting",
  "quick-note": "personal-note",
  "voice-note": "voice-memo",
};

export const getPrimaryCaptureMode = (template: Pick<TemplateDefinition, "captureModes">): CaptureMode => {
  const captureModes = template.captureModes ?? [];
  if (captureModes.includes("meeting-note")) return "meeting-note";
  if (captureModes.includes("quick-note")) return "quick-note";
  if (captureModes.includes("voice-note")) return "voice-note";
  return "meeting-note";
};

export const getTemplatesForCaptureMode = (
  templates: TemplateDefinition[],
  captureMode: CaptureMode,
) => templates.filter((template) => !template.captureModes?.length || template.captureModes.includes(captureMode));

export const BUILTIN_TEMPLATES: TemplateDefinition[] = [
  {
    id: "meeting",
    name: "Meeting",
    kind: "builtin",
    captureModes: ["meeting-note"],
    fields: [
      { id: "meeting-title", key: "title", label: "Meeting title", type: "text", enabled: true, required: false, position: 1 },
      { id: "meeting-participants", key: "participants", label: "Participants", type: "text", enabled: true, required: false, position: 2 },
      { id: "meeting-date", key: "date", label: "Date", type: "date", enabled: true, required: false, position: 3 },
      { id: "meeting-start", key: "startTime", label: "Start time", type: "time", enabled: true, required: false, position: 4 },
      { id: "meeting-end", key: "endTime", label: "End time", type: "time", enabled: true, required: false, position: 5 },
      { id: "meeting-agenda", key: "agenda", label: "Agenda", type: "textarea", enabled: true, required: false, position: 6 }
    ],
    sections: [
      { id: "agenda", title: "Agenda", instructions: "Capture the planned agenda, topics, or framing points that set up the meeting.", enabledByDefault: true, position: 1 },
      { id: "summary", title: "Summary", instructions: "Summarize the most important outcome from the meeting.", enabledByDefault: false, position: 2 },
      { id: "discussion", title: "Key discussion points", instructions: "Organize the main business themes discussed.", enabledByDefault: true, position: 3 },
      { id: "decisions", title: "Decisions", instructions: "Capture explicit decisions that were made.", enabledByDefault: false, position: 4 },
      { id: "actions", title: "Action items", instructions: "List concrete next actions with owners when possible.", enabledByDefault: false, position: 5 }
    ]
  },
  {
    id: "personal-note",
    name: "Personal Note",
    kind: "builtin",
    captureModes: ["quick-note"],
    fields: [
      { id: "note-title", key: "title", label: "Note title", type: "text", enabled: true, required: false, position: 1 },
      { id: "note-participants", key: "participants", label: "Participants", type: "text", enabled: true, required: false, position: 2 },
      { id: "note-date", key: "date", label: "Date", type: "date", enabled: true, required: false, position: 3 }
    ],
    sections: [
      { id: "note-summary", title: "Summary", instructions: "Turn rough notes into a concise, polished personal note.", enabledByDefault: true, position: 1 }
    ]
  },
  {
    id: "one-on-one",
    name: "1:1 / Phone call",
    kind: "builtin",
    captureModes: ["quick-note"],
    fields: [
      { id: "call-title", key: "title", label: "Title", type: "text", enabled: true, required: false, position: 1 },
      { id: "call-participant", key: "participants", label: "Participant", type: "text", enabled: true, required: false, position: 2 },
      { id: "call-date", key: "date", label: "Date", type: "date", enabled: true, required: false, position: 3 },
      { id: "call-start", key: "startTime", label: "Start time", type: "time", enabled: true, required: false, position: 4 },
      { id: "call-end", key: "endTime", label: "End time", type: "time", enabled: true, required: false, position: 5 }
    ],
    sections: [
      { id: "call-summary", title: "Summary", instructions: "Summarize the most important outcome of the call.", enabledByDefault: true, position: 1 },
      { id: "call-follow-up", title: "Follow-up", instructions: "Capture the relevant next steps and commitments.", enabledByDefault: true, position: 2 }
    ]
  },
  {
    id: "voice-memo",
    name: "Voice Memo",
    kind: "builtin",
    captureModes: ["voice-note"],
    fields: [
      { id: "voice-title", key: "title", label: "Title", type: "text", enabled: true, required: false, position: 1 },
      { id: "voice-date", key: "date", label: "Date", type: "date", enabled: true, required: false, position: 2 }
    ],
    sections: [
      { id: "voice-summary", title: "Summary", instructions: "Turn the dictated content into a concise, polished note.", enabledByDefault: true, position: 1 },
      { id: "voice-follow-up", title: "Follow-up", instructions: "List concrete next steps or reminders when relevant.", enabledByDefault: true, position: 2 }
    ]
  }
];
