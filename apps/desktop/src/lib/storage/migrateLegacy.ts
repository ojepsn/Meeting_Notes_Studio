import type {
  CaptureMode,
  DesktopAppSnapshot,
  PromptBlock,
  PromptProfile,
  SessionRecord,
  TemplateFieldType,
  TemplateDefinition,
  TodoRecord,
} from "@notesmith/domain";
import { BUILTIN_TEMPLATES } from "@notesmith/domain";
import {
  DEFAULT_MEETING_MINUTES_RULES,
  DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
  DEFAULT_PERSONAL_NOTES_RULES,
  DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
  DEFAULT_REVISION_RULES,
  DEFAULT_TRANSLATION_RULES,
} from "@notesmith/prompts";

const LEGACY_SESSIONS_KEY = "notesmith-sessions";
const LEGACY_SETTINGS_KEY = "notesmith-settings";

type LegacySession = {
  id?: string;
  title?: string;
  template?: string;
  participants?: string;
  meetingDate?: string;
  meetingStartTime?: string;
  meetingEndTime?: string;
  highlights?: string[];
  liveTranscript?: string;
  uploadedTranscript?: string;
  rawNotes?: string;
  polishedHtml?: string;
  updatedAt?: number;
  detailLevel?: number;
  customFieldValues?: Record<string, string>;
};

type LegacyPromptBlock = {
  id?: string;
  enabled?: boolean;
  label?: string;
  text?: string;
};

type LegacyCustomTemplate = {
  id?: string;
  label?: string;
  templateInstructions?: string;
  headers?: Array<{ id?: string; title?: string; instructions?: string }>;
  customFields?: Array<{ id?: string; label?: string; type?: string }>;
  fields?: Record<string, boolean>;
};

type LegacyTodo = {
  id?: string;
  completed?: boolean;
  description?: string;
  comments?: string;
  addedAt?: string;
  sessionRefs?: Array<{ sessionId?: string; title?: string }>;
};

type LegacySettings = {
  themeFamily?: string;
  outputLanguage?: "same" | "sv" | "en";
  templateUsageCounts?: Record<string, number>;
  participantDirectory?: string[];
  abbreviationDirectory?: Array<{ id?: string; shortForm?: string; fullForm?: string }>;
  promptSettings?: {
    generationSystem?: string;
    generationRules?: string;
    revisionRules?: string;
    translationRules?: string;
    additionalPrompts?: LegacyPromptBlock[];
  };
  todoItems?: LegacyTodo[];
  customTemplates?: LegacyCustomTemplate[];
};

const toHtmlText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

const normalizePromptBlocks = (blocks: LegacyPromptBlock[] | undefined): PromptBlock[] =>
  Array.isArray(blocks)
    ? blocks
        .map((block) => ({
          id: typeof block.id === "string" && block.id.trim() ? block.id : crypto.randomUUID(),
          enabled: block.enabled !== false,
          label: typeof block.label === "string" ? block.label.trim() : "",
          body: typeof block.text === "string" ? block.text.trim() : "",
        }))
        .filter((block) => block.label || block.body)
    : [];

const normalizePromptProfile = (settings: LegacySettings | null): PromptProfile => ({
  meetingMinutesSystem:
    typeof settings?.promptSettings?.generationSystem === "string" && settings.promptSettings.generationSystem.trim()
      ? settings.promptSettings.generationSystem
      : DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
  meetingMinutesRules:
    typeof settings?.promptSettings?.generationRules === "string" && settings.promptSettings.generationRules.trim()
      ? settings.promptSettings.generationRules
      : DEFAULT_MEETING_MINUTES_RULES,
  personalNotesSystem: DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
  personalNotesRules: DEFAULT_PERSONAL_NOTES_RULES,
  revisionRules:
    typeof settings?.promptSettings?.revisionRules === "string" && settings.promptSettings.revisionRules.trim()
      ? settings.promptSettings.revisionRules
      : DEFAULT_REVISION_RULES,
  translationRules:
    typeof settings?.promptSettings?.translationRules === "string" && settings.promptSettings.translationRules.trim()
      ? settings.promptSettings.translationRules
      : DEFAULT_TRANSLATION_RULES,
  extraBlocks: normalizePromptBlocks(settings?.promptSettings?.additionalPrompts),
});

const mapLegacyTemplateId = (legacyId?: string) => {
  if (legacyId === "personalNote") return "personal-note";
  if (legacyId === "oneToOneCall") return "one-on-one";
  if (legacyId === "meeting") return "meeting";
  return legacyId || "meeting";
};

const inferCaptureModeFromTemplateId = (templateId: string): CaptureMode => {
  if (templateId === "personal-note") return "quick-note";
  if (templateId === "voice-memo") return "voice-note";
  return "meeting-note";
};

const mapLegacyThemeFamily = (legacyTheme?: string) => {
  switch (legacyTheme) {
    case "classic-blue":
      return "atlas-blue-light";
    case "graphite-forest":
      return "graphite-forest-light";
    case "modern-olive":
      return "stone-olive-light";
    default:
      return "fluent-slate-light";
  }
};

const mapLegacySessions = (sessions: LegacySession[] | null): SessionRecord[] =>
  Array.isArray(sessions)
    ? sessions.map((session) => ({
        id: typeof session.id === "string" && session.id ? session.id : crypto.randomUUID(),
        templateId: mapLegacyTemplateId(session.template),
        captureMode: inferCaptureModeFromTemplateId(mapLegacyTemplateId(session.template)),
        title: typeof session.title === "string" ? session.title : "",
        participantText: typeof session.participants === "string" ? session.participants : "",
        date: typeof session.meetingDate === "string" ? session.meetingDate : "",
        startTime: typeof session.meetingStartTime === "string" ? session.meetingStartTime : "",
        endTime: typeof session.meetingEndTime === "string" ? session.meetingEndTime : "",
        quickHighlights: Array.isArray(session.highlights) ? session.highlights.join(", ") : "",
        detailLevel: typeof session.detailLevel === "number" ? Math.min(5, Math.max(1, Math.round(session.detailLevel))) : 3,
        manualNotes: typeof session.rawNotes === "string" ? session.rawNotes : "",
        liveTranscript: typeof session.liveTranscript === "string" ? session.liveTranscript : "",
        uploadedTranscript: typeof session.uploadedTranscript === "string" ? session.uploadedTranscript : "",
        customFieldValues:
          session.customFieldValues && typeof session.customFieldValues === "object" ? session.customFieldValues : {},
        excludedSectionIds: [],
        output: typeof session.polishedHtml === "string" ? toHtmlText(session.polishedHtml) : "",
        createdAt: new Date(typeof session.updatedAt === "number" ? session.updatedAt : Date.now()).toISOString(),
        updatedAt: new Date(typeof session.updatedAt === "number" ? session.updatedAt : Date.now()).toISOString(),
      }))
    : [];

const mapLegacyTodos = (todos: LegacyTodo[] | undefined): TodoRecord[] =>
  Array.isArray(todos)
    ? todos
        .map((todo) => ({
          id: typeof todo.id === "string" && todo.id.trim() ? todo.id : crypto.randomUUID(),
          description: typeof todo.description === "string" ? todo.description.trim() : "",
          isDone: todo.completed === true,
          comments: typeof todo.comments === "string" ? todo.comments : "",
          createdAt: typeof todo.addedAt === "string" && todo.addedAt.trim() ? todo.addedAt : new Date().toISOString(),
          sessionIds: Array.isArray(todo.sessionRefs)
            ? todo.sessionRefs
                .map((ref) => (typeof ref?.sessionId === "string" ? ref.sessionId : ""))
                .filter(Boolean)
            : [],
        }))
        .filter((todo) => todo.description)
    : [];

const mapLegacyTemplates = (customTemplates: LegacyCustomTemplate[] | undefined): TemplateDefinition[] => {
  const mapped = Array.isArray(customTemplates)
    ? customTemplates
        .map((template) => ({
          id: typeof template.id === "string" && template.id.trim() ? template.id : crypto.randomUUID(),
          name: typeof template.label === "string" && template.label.trim() ? template.label.trim() : "Custom template",
          kind: "custom" as const,
          captureModes: ["meeting-note", "quick-note", "voice-note"] as CaptureMode[],
          promptInstructions: typeof template.templateInstructions === "string" ? template.templateInstructions : "",
          fields: [
            { id: crypto.randomUUID(), key: "title", label: "Title", type: "text" as const, enabled: template.fields?.title !== false, required: false, position: 1 },
            { id: crypto.randomUUID(), key: "participants", label: "Participants", type: "text" as const, enabled: template.fields?.participants === true, required: false, position: 2 },
            { id: crypto.randomUUID(), key: "date", label: "Date", type: "date" as const, enabled: template.fields?.meetingDate === true, required: false, position: 3 },
            { id: crypto.randomUUID(), key: "startTime", label: "Start time", type: "time" as const, enabled: template.fields?.meetingStartTime === true, required: false, position: 4 },
            { id: crypto.randomUUID(), key: "endTime", label: "End time", type: "time" as const, enabled: template.fields?.meetingEndTime === true, required: false, position: 5 },
            ...(Array.isArray(template.customFields)
              ? template.customFields.map((field, index) => ({
                  id: typeof field.id === "string" && field.id.trim() ? field.id : crypto.randomUUID(),
                  key: `custom-${index + 1}`,
                  label: typeof field.label === "string" && field.label.trim() ? field.label.trim() : `Custom field ${index + 1}`,
                  type: normalizeFieldType(field.type),
                  enabled: true,
                  required: false,
                  position: 10 + index,
                }))
              : []),
          ],
          sections: Array.isArray(template.headers)
            ? template.headers.map((section, index) => ({
                id: typeof section.id === "string" && section.id.trim() ? section.id : crypto.randomUUID(),
                title: typeof section.title === "string" && section.title.trim() ? section.title.trim() : `Section ${index + 1}`,
                instructions: typeof section.instructions === "string" ? section.instructions : "",
                enabledByDefault: true,
                position: index + 1,
              }))
            : [],
        }))
        .filter((template) => template.name)
    : [];

  return [...BUILTIN_TEMPLATES, ...mapped];
};

export const loadLegacyBrowserSnapshot = (): DesktopAppSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawSessions = window.localStorage.getItem(LEGACY_SESSIONS_KEY);
    const rawSettings = window.localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!rawSessions && !rawSettings) {
      return null;
    }

    const parsedSessions = rawSessions ? (JSON.parse(rawSessions) as LegacySession[]) : [];
    const parsedSettings = rawSettings ? (JSON.parse(rawSettings) as LegacySettings) : null;
    const templateUsageCounts = parsedSettings?.templateUsageCounts ?? {};
    const preferredDesktopTemplateId = Object.entries(templateUsageCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      sessions: mapLegacySessions(parsedSessions),
      templates: mapLegacyTemplates(parsedSettings?.customTemplates),
      todos: mapLegacyTodos(parsedSettings?.todoItems),
      attachments: [],
      settings: {
        theme: mapLegacyThemeFamily(parsedSettings?.themeFamily),
        outputLanguage: parsedSettings?.outputLanguage || "same",
        preferredDesktopTemplateId: mapLegacyTemplateId(preferredDesktopTemplateId),
        apiKey: "",
        textModel: "gpt-5.4-mini",
        transcriptionModel: "gpt-4o-mini-transcribe",
        savedParticipants: Array.isArray(parsedSettings?.participantDirectory) ? parsedSettings.participantDirectory.filter(Boolean) : [],
        abbreviations: Array.isArray(parsedSettings?.abbreviationDirectory)
          ? parsedSettings.abbreviationDirectory
              .map((entry) => ({
                id: typeof entry.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID(),
                shortForm: typeof entry.shortForm === "string" ? entry.shortForm.trim() : "",
                fullForm: typeof entry.fullForm === "string" ? entry.fullForm.trim() : "",
              }))
              .filter((entry) => entry.shortForm && entry.fullForm)
          : [],
        promptProfile: normalizePromptProfile(parsedSettings),
      },
    };
  } catch {
    return null;
  }
};
const normalizeFieldType = (value: string | undefined): TemplateFieldType => {
  if (value === "number" || value === "date" || value === "time" || value === "textarea") {
    return value;
  }
  return "text";
};
