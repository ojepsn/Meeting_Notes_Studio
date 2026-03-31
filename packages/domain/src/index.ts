export type TemplateKind = "builtin" | "custom";
export type TemplateFieldType = "text" | "number" | "date" | "time" | "textarea";

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
  fields: TemplateField[];
  sections: TemplateSection[];
  promptInstructions?: string;
}

export interface SessionRecord {
  id: string;
  templateId: string;
  title: string;
  participantText: string;
  date: string;
  startTime: string;
  endTime: string;
  quickHighlights: string;
  manualNotes: string;
  liveTranscript: string;
  uploadedTranscript: string;
  output: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoRecord {
  id: string;
  description: string;
  isDone: boolean;
  comments: string;
  createdAt: string;
  sessionIds: string[];
}

export interface PromptBlock {
  id: string;
  label: string;
  body: string;
  enabled: boolean;
}

export interface PromptProfile {
  generationSystem: string;
  generationRules: string;
  revisionRules: string;
  translationRules: string;
  extraBlocks: PromptBlock[];
}

export interface AttachmentRecord {
  id: string;
  sessionId: string;
  kind: "audio" | "image" | "pdf" | "document" | "transcript";
  filename: string;
  mimeType: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface LocalAppSettings {
  theme: string;
  outputLanguage: "same" | "sv" | "en";
  preferredDesktopTemplateId: string;
  apiKey: string;
  textModel: string;
  transcriptionModel: string;
  savedParticipants: string[];
  abbreviations: Array<{ id: string; shortForm: string; fullForm: string }>;
  promptProfile: PromptProfile;
}

export interface DesktopAppSnapshot {
  sessions: SessionRecord[];
  templates: TemplateDefinition[];
  todos: TodoRecord[];
  attachments: AttachmentRecord[];
  settings: LocalAppSettings;
}

export const BUILTIN_TEMPLATES: TemplateDefinition[] = [
  {
    id: "meeting",
    name: "Meeting",
    kind: "builtin",
    fields: [
      { id: "meeting-title", key: "title", label: "Meeting title", type: "text", enabled: true, required: false, position: 1 },
      { id: "meeting-participants", key: "participants", label: "Participants", type: "text", enabled: true, required: false, position: 2 },
      { id: "meeting-date", key: "date", label: "Date", type: "date", enabled: true, required: false, position: 3 },
      { id: "meeting-start", key: "startTime", label: "Start time", type: "time", enabled: true, required: false, position: 4 },
      { id: "meeting-end", key: "endTime", label: "End time", type: "time", enabled: true, required: false, position: 5 }
    ],
    sections: [
      { id: "summary", title: "Summary", instructions: "Summarize the most important outcome from the meeting.", enabledByDefault: true, position: 1 },
      { id: "discussion", title: "Key discussion points", instructions: "Organize the main business themes discussed.", enabledByDefault: true, position: 2 },
      { id: "decisions", title: "Decisions", instructions: "Capture explicit decisions that were made.", enabledByDefault: true, position: 3 },
      { id: "actions", title: "Action items", instructions: "List concrete next actions with owners when possible.", enabledByDefault: true, position: 4 }
    ]
  },
  {
    id: "personal-note",
    name: "Personal Note",
    kind: "builtin",
    fields: [
      { id: "note-title", key: "title", label: "Note title", type: "text", enabled: true, required: false, position: 1 },
      { id: "note-date", key: "date", label: "Date", type: "date", enabled: true, required: false, position: 2 }
    ],
    sections: [
      { id: "note-summary", title: "Summary", instructions: "Turn rough notes into a concise, polished personal note.", enabledByDefault: true, position: 1 }
    ]
  },
  {
    id: "one-on-one",
    name: "1:1 / Phone call",
    kind: "builtin",
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
  }
];
