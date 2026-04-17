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
import { resolvePromptProfile } from "../ai/prompts";
import { normalizeOutputLayoutPresetId } from "../export/outputLayouts";

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
  exportStylePreset?: string;
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

const normalizePromptProfile = (settings: LegacySettings | null): PromptProfile => {
  return resolvePromptProfile({
    generationSystem: settings?.promptSettings?.generationSystem,
    generationRules: settings?.promptSettings?.generationRules,
    revisionRules: settings?.promptSettings?.revisionRules,
    translationRules: settings?.promptSettings?.translationRules,
    extraBlocks: normalizePromptBlocks(settings?.promptSettings?.additionalPrompts),
  }).profile;
};

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

const inferCaptureModeFromLegacyTemplate = (template: LegacyCustomTemplate): CaptureMode => {
  const label = typeof template.label === "string" ? template.label.toLowerCase() : "";
  const instructions = typeof template.templateInstructions === "string" ? template.templateInstructions.toLowerCase() : "";
  const combined = `${label} ${instructions}`;

  if (combined.includes("voice") || combined.includes("dictat") || combined.includes("memo")) {
    return "voice-note";
  }

  if (template.fields?.participants || template.fields?.meetingStartTime || template.fields?.meetingEndTime) {
    return "meeting-note";
  }

  return "quick-note";
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
        isPrivate: false,
        deletedAt: null,
        participantText: typeof session.participants === "string" ? session.participants : "",
        project: "",
        domain: "",
        activity: "",
        tagsText: "",
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
        outputVersions:
          typeof session.polishedHtml === "string" && session.polishedHtml.trim()
            ? [
                {
                  id: crypto.randomUUID(),
                  output: toHtmlText(session.polishedHtml),
                  generatedAt: new Date(typeof session.updatedAt === "number" ? session.updatedAt : Date.now()).toISOString(),
                },
              ]
            : [],
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
          isPrivate: false,
          comments: typeof todo.comments === "string" ? todo.comments : "",
          activityId: "",
          domain: "",
          project: "",
          activity: "",
          doOn: "",
          dueDate: "",
          detailsHtml: typeof todo.comments === "string" ? todo.comments : "",
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
          captureModes: [inferCaptureModeFromLegacyTemplate(template)] as CaptureMode[],
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
    const legacyExportPresetId = parsedSettings?.exportStylePreset;
    const preferredDesktopTemplateId = Object.entries(templateUsageCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      sessions: mapLegacySessions(parsedSessions),
      templates: mapLegacyTemplates(parsedSettings?.customTemplates),
      todos: mapLegacyTodos(parsedSettings?.todoItems),
      activities: [],
      timelogs: [],
      calendarItems: [],
      entityLinks: [],
      attachments: [],
      settings: {
        theme: mapLegacyThemeFamily(parsedSettings?.themeFamily),
        outputLanguage: parsedSettings?.outputLanguage || "same",
        preferredDesktopTemplateId: mapLegacyTemplateId(preferredDesktopTemplateId),
        outputLayoutPresetId: normalizeOutputLayoutPresetId(legacyExportPresetId),
        notesCapturePaneWidth: 640,
        captureWorkspaceDensity: "minimal",
        outputWorkspaceDensity: "minimal",
        calendarDaysInView: 5,
        calendarSlotHeight: 16,
        calendarIsFullScreen: true,
        calendarFullScreenPreferenceInitialized: false,
        calendarDetailsPaneWidth: 320,
        calendarScrollTop: 0,
        calendarScrollLeft: 0,
        apiKey: "",
        textModel: "gpt-5.4-mini",
        transcriptionModel: "gpt-4o-mini-transcribe",
        savedParticipants: Array.isArray(parsedSettings?.participantDirectory) ? parsedSettings.participantDirectory.filter(Boolean) : [],
        savedProjects: [],
        savedDomains: [],
        savedActivities: [],
        savedTags: [],
        projectLinks: [],
        timeReportPresets: [],
        abbreviations: Array.isArray(parsedSettings?.abbreviationDirectory)
          ? parsedSettings.abbreviationDirectory
              .map((entry) => ({
                id: typeof entry.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID(),
                shortForm: typeof entry.shortForm === "string" ? entry.shortForm.trim() : "",
                fullForm: typeof entry.fullForm === "string" ? entry.fullForm.trim() : "",
              }))
              .filter((entry) => entry.shortForm && entry.fullForm)
          : [],
        preferredParticipantNames: [],
        ruleSuggestions: [],
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
