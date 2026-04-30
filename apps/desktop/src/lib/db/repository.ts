import {
  BUILTIN_TEMPLATES,
  DEFAULT_TEMPLATE_BY_CAPTURE_MODE,
  getPrimaryCaptureMode,
  type AttachmentRecord,
  type ArchivedTaskRecord,
  type ActivityRecord,
  type CalendarItemRecord,
  type ChecklistRecord,
  type ChecklistRecurrenceRecord,
  type ChecklistTemplateRecord,
  type CaptureMode,
  type DesktopAppSnapshot,
  type EntityLinkRecord,
  type LocalAppSettings,
  type SessionRecord,
  type TemplateDefinition,
  type TimeLogRecord,
  type TodoRecord,
} from "@notesmith/domain";
import type { AIRequestHistoryEntry } from "../ai/history";
import { resolvePromptProfile } from "../ai/prompts";
import {
  normalizeAIModelPricingSnapshot,
  normalizeTextModelId,
  normalizeTranscriptionModelId,
  type AIModelPricingSnapshot,
} from "../ai/modelPricing";
import { DEFAULT_OUTPUT_LAYOUT_PRESET_ID, normalizeOutputLayoutPresetId } from "../export/outputLayouts";
import { isTauriRuntime } from "../storage/environment";
import { getDesktopStorageInfo } from "../storage/desktopStorage";
import { sqliteBootstrapStatements } from "./schema";

const STORAGE_KEYS = {
  sessions: "notesmith-desktop-sessions",
  templates: "notesmith-desktop-templates",
  todos: "notesmith-desktop-todos",
  checklists: "notesmith-desktop-checklists",
  checklistTemplates: "notesmith-desktop-checklist-templates",
  checklistRecurrences: "notesmith-desktop-checklist-recurrences",
  archivedTasks: "notesmith-desktop-archived-tasks",
  activities: "notesmith-desktop-activities",
  timelogs: "notesmith-desktop-timelogs",
  calendarItems: "notesmith-desktop-calendar-items",
  entityLinks: "notesmith-desktop-entity-links",
  attachments: "notesmith-desktop-attachments",
  settings: "notesmith-desktop-settings",
  aiTextCache: "notesmith-desktop-ai-text-cache",
  aiRequestHistory: "notesmith-desktop-ai-request-history",
  aiModelPricing: "notesmith-desktop-ai-model-pricing",
};

const now = () => new Date().toISOString();

const normalizeDetailLevel = (value: number | undefined) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
};

const normalizeSessionRecord = (session: SessionRecord): SessionRecord => ({
  ...session,
  captureMode:
    session.captureMode === "quick-note" || session.captureMode === "voice-note" ? session.captureMode : "meeting-note",
  isPrivate: Boolean(session.isPrivate),
  deletedAt: typeof session.deletedAt === "string" ? session.deletedAt : null,
  project: typeof session.project === "string" ? session.project : "",
  domain: typeof session.domain === "string" ? session.domain : "",
  activity: typeof session.activity === "string" ? session.activity : "",
  tagsText: typeof session.tagsText === "string" ? session.tagsText : "",
  transcribeOnly: Boolean(session.transcribeOnly),
  outputLanguage: session.outputLanguage === "sv" || session.outputLanguage === "en" ? session.outputLanguage : "same",
  detailLevel: normalizeDetailLevel(session.detailLevel),
  additionalInstructions: typeof session.additionalInstructions === "string" ? session.additionalInstructions : "",
  customFieldValues:
    session.customFieldValues && typeof session.customFieldValues === "object" ? session.customFieldValues : {},
  excludedSectionIds: Array.isArray(session.excludedSectionIds) ? session.excludedSectionIds : [],
  outputVersions: Array.isArray(session.outputVersions)
    ? session.outputVersions
        .filter(
          (version): version is SessionRecord["outputVersions"][number] =>
            Boolean(version) &&
            typeof version.id === "string" &&
            typeof version.output === "string" &&
            typeof version.generatedAt === "string",
        )
        .filter((version) => version.output.trim())
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    : session.output.trim()
      ? [
          {
            id: crypto.randomUUID(),
            output: session.output,
            generatedAt: session.updatedAt || session.createdAt || now(),
          },
        ]
      : [],
});

const normalizeAttachmentRecord = (attachment: AttachmentRecord): AttachmentRecord => ({
  ...attachment,
  caption: typeof attachment.caption === "string" ? attachment.caption : "",
  includeInOutput: Boolean(attachment.includeInOutput),
  outputPosition: Number.isFinite(Number(attachment.outputPosition)) ? Number(attachment.outputPosition) : 0,
});

const normalizeTodoRecord = (todo: TodoRecord): TodoRecord => ({
  ...todo,
  completedAt: typeof todo.completedAt === "string" ? todo.completedAt : null,
  isPrivate: Boolean(todo.isPrivate),
  isPriority: Boolean(todo.isPriority),
  comments: typeof todo.comments === "string" ? todo.comments : "",
  activityId: typeof todo.activityId === "string" ? todo.activityId : "",
  domain: typeof todo.domain === "string" ? todo.domain : "",
  project: typeof todo.project === "string" ? todo.project : "",
  activity: typeof todo.activity === "string" ? todo.activity : "",
  doOn: typeof todo.doOn === "string" ? todo.doOn : "",
  dueDate: typeof todo.dueDate === "string" ? todo.dueDate : "",
  detailsHtml:
    typeof todo.detailsHtml === "string"
      ? todo.detailsHtml
      : typeof todo.comments === "string"
        ? todo.comments
        : "",
  sessionIds: Array.isArray(todo.sessionIds) ? todo.sessionIds.filter((value): value is string => typeof value === "string") : [],
});

const normalizeArchivedTaskRecord = (task: ArchivedTaskRecord): ArchivedTaskRecord => ({
  id: task.id,
  title: typeof task.title === "string" ? task.title : "",
  isPrivate: Boolean(task.isPrivate),
  domain: typeof task.domain === "string" ? task.domain : "",
  project: typeof task.project === "string" ? task.project : "",
  activity: typeof task.activity === "string" ? task.activity : "",
  activityId: typeof task.activityId === "string" ? task.activityId : "",
  deletedAt: typeof task.deletedAt === "string" && task.deletedAt ? task.deletedAt : now(),
  originalCreatedAt: typeof task.originalCreatedAt === "string" && task.originalCreatedAt ? task.originalCreatedAt : now(),
  originalCompletedAt: typeof task.originalCompletedAt === "string" ? task.originalCompletedAt : null,
});

const normalizeChecklistRecord = (checklist: ChecklistRecord): ChecklistRecord => ({
  id: checklist.id,
  ownerType: checklist.ownerType === "todo" ? "todo" : "project",
  ownerId: typeof checklist.ownerId === "string" ? checklist.ownerId : "",
  title: typeof checklist.title === "string" ? checklist.title : "",
  description: typeof checklist.description === "string" ? checklist.description : "",
  archived: Boolean(checklist.archived),
  templateId: typeof checklist.templateId === "string" ? checklist.templateId : null,
  recurrenceRuleId: typeof checklist.recurrenceRuleId === "string" ? checklist.recurrenceRuleId : null,
  recurrenceKey: typeof checklist.recurrenceKey === "string" ? checklist.recurrenceKey : null,
  createdAt: typeof checklist.createdAt === "string" && checklist.createdAt ? checklist.createdAt : now(),
  updatedAt: typeof checklist.updatedAt === "string" && checklist.updatedAt ? checklist.updatedAt : now(),
  items: Array.isArray(checklist.items)
    ? checklist.items
        .map((item, index) => ({
          id: typeof item?.id === "string" && item.id.trim() ? item.id : crypto.randomUUID(),
          label: typeof item?.label === "string" ? item.label : "",
          isChecked: Boolean(item?.isChecked),
          notes: typeof item?.notes === "string" ? item.notes : "",
          position: Number.isFinite(Number(item?.position)) ? Number(item.position) : index + 1,
          checkedAt: typeof item?.checkedAt === "string" ? item.checkedAt : null,
        }))
        .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label))
    : [],
});

const normalizeChecklistTemplateRecord = (template: ChecklistTemplateRecord): ChecklistTemplateRecord => ({
  id: template.id,
  title: typeof template.title === "string" ? template.title : "",
  category: typeof template.category === "string" ? template.category : "",
  description: typeof template.description === "string" ? template.description : "",
  createdAt: typeof template.createdAt === "string" && template.createdAt ? template.createdAt : now(),
  updatedAt: typeof template.updatedAt === "string" && template.updatedAt ? template.updatedAt : now(),
  items: Array.isArray(template.items)
    ? template.items
        .map((item, index) => ({
          id: typeof item?.id === "string" && item.id.trim() ? item.id : crypto.randomUUID(),
          label: typeof item?.label === "string" ? item.label : "",
          isChecked: Boolean(item?.isChecked),
          notes: typeof item?.notes === "string" ? item.notes : "",
          position: Number.isFinite(Number(item?.position)) ? Number(item.position) : index + 1,
          checkedAt: typeof item?.checkedAt === "string" ? item.checkedAt : null,
        }))
        .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label))
    : [],
});

const normalizeChecklistRecurrenceRecord = (rule: ChecklistRecurrenceRecord): ChecklistRecurrenceRecord => ({
  id: rule.id,
  ownerType: rule.ownerType === "todo" ? "todo" : "project",
  ownerId: typeof rule.ownerId === "string" ? rule.ownerId : "",
  templateId: typeof rule.templateId === "string" ? rule.templateId : "",
  cadence: rule.cadence === "weekly" ? "weekly" : "monthly",
  createdAt: typeof rule.createdAt === "string" && rule.createdAt ? rule.createdAt : now(),
  updatedAt: typeof rule.updatedAt === "string" && rule.updatedAt ? rule.updatedAt : now(),
  lastInstantiatedPeriodKey: typeof rule.lastInstantiatedPeriodKey === "string" ? rule.lastInstantiatedPeriodKey : null,
});

const normalizeActivityRecord = (activity: ActivityRecord): ActivityRecord => ({
  ...activity,
  type: activity.type === "meeting" ? "meeting" : "task",
  parentActivityId: typeof activity.parentActivityId === "string" ? activity.parentActivityId : "",
  isPrivate: Boolean(activity.isPrivate),
  comments: typeof activity.comments === "string" ? activity.comments : "",
  domain: typeof activity.domain === "string" ? activity.domain : "",
  project: typeof activity.project === "string" ? activity.project : "",
  activity: typeof activity.activity === "string" ? activity.activity : "",
  doOn: typeof activity.doOn === "string" ? activity.doOn : "",
  dueDate: typeof activity.dueDate === "string" ? activity.dueDate : "",
  startTime: typeof activity.startTime === "string" ? activity.startTime : "",
  endTime: typeof activity.endTime === "string" ? activity.endTime : "",
  detailsHtml:
    typeof activity.detailsHtml === "string"
      ? activity.detailsHtml
      : typeof activity.comments === "string"
        ? activity.comments
        : "",
  timeRequiredMinutes: Number.isFinite(Number(activity.timeRequiredMinutes)) ? Number(activity.timeRequiredMinutes) : 0,
  actualTimeSpentMinutes: Number.isFinite(Number(activity.actualTimeSpentMinutes)) ? Number(activity.actualTimeSpentMinutes) : 0,
  sessionIds: Array.isArray(activity.sessionIds)
    ? activity.sessionIds.filter((value): value is string => typeof value === "string")
    : [],
});

const normalizeTimeLogRecord = (timeLog: TimeLogRecord): TimeLogRecord => ({
  ...timeLog,
  targetType: timeLog.targetType === "activity" ? "activity" : "todo",
  date: typeof timeLog.date === "string" ? timeLog.date : now().slice(0, 10),
  startTime: typeof timeLog.startTime === "string" ? timeLog.startTime : "",
  endTime: typeof timeLog.endTime === "string" ? timeLog.endTime : "",
  durationMinutes: Number.isFinite(Number(timeLog.durationMinutes)) ? Math.max(0, Math.round(Number(timeLog.durationMinutes))) : 0,
  notes: typeof timeLog.notes === "string" ? timeLog.notes : "",
});

const normalizeCalendarItemRecord = (item: CalendarItemRecord): CalendarItemRecord => ({
  ...item,
  targetType: item.targetType === "activity" ? "activity" : "todo",
  date: typeof item.date === "string" ? item.date : now().slice(0, 10),
  startSlot: Number.isFinite(Number(item.startSlot)) ? Math.max(0, Math.min(287, Math.round(Number(item.startSlot)))) : 0,
  durationSlots: Number.isFinite(Number(item.durationSlots))
    ? Math.max(1, Math.min(288, Math.round(Number(item.durationSlots))))
    : 1,
});

const normalizeEntityLinkRecord = (link: EntityLinkRecord): EntityLinkRecord => ({
  ...link,
  fromType: link.fromType === "session" ? "session" : link.fromType === "todo" ? "todo" : "activity",
  toType: link.toType === "activity" ? "activity" : link.toType === "todo" ? "todo" : "session",
  relation: "has_session",
});

const normalizeTemplateRecord = (template: TemplateDefinition): TemplateDefinition => ({
  ...(BUILTIN_TEMPLATES.find((entry) => entry.id === template.id) ?? {}),
  ...template,
  kind: (BUILTIN_TEMPLATES.find((entry) => entry.id === template.id)?.kind ?? template.kind),
  captureModes: [getPrimaryCaptureMode(BUILTIN_TEMPLATES.find((entry) => entry.id === template.id) ?? template)],
});

export const createDefaultSettings = (): LocalAppSettings => ({
  theme: "fluent-slate-light",
  outputLanguage: "same",
  preferredDesktopTemplateId: "meeting",
  outputLayoutPresetId: DEFAULT_OUTPUT_LAYOUT_PRESET_ID,
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
  calendarVisibilityFilter: "all",
  calendarShowPrivate: true,
  calendarShowBusiness: true,
  baselineWorkEnabled: false,
  baselineWorkActivityId: "",
  apiKey: "",
  textModel: "gpt-5.4-mini",
  transcriptionModel: "gpt-4o-mini-transcribe",
  savedParticipants: [],
  savedProjects: [],
  savedDomains: [],
  savedActivities: [],
  savedTags: [],
  projectLinks: [],
  timeReportPresets: [],
  abbreviations: [],
  preferredParticipantNames: [],
  ruleSuggestions: [],
  assistantQueryMemories: [],
  promptProfile: resolvePromptProfile(undefined).profile,
});

const normalizePromptProfile = (promptProfile: Partial<LocalAppSettings["promptProfile"]> | undefined) => {
  return resolvePromptProfile(promptProfile).profile;
};

export const createDefaultSnapshot = (): DesktopAppSnapshot => ({
  sessions: [],
  templates: BUILTIN_TEMPLATES,
  todos: [],
  checklists: [],
  checklistTemplates: [],
  checklistRecurrences: [],
  archivedTasks: [],
  activities: [],
  timelogs: [],
  calendarItems: [],
  entityLinks: [],
  attachments: [],
  settings: createDefaultSettings(),
});

export interface EntityRepository {
  loadSessions(): Promise<SessionRecord[]>;
  saveSessions(records: SessionRecord[]): Promise<void>;
  loadTemplates(): Promise<TemplateDefinition[]>;
  saveTemplates(records: TemplateDefinition[]): Promise<void>;
  loadTodos(): Promise<TodoRecord[]>;
  saveTodos(records: TodoRecord[]): Promise<void>;
  loadChecklists(): Promise<ChecklistRecord[]>;
  saveChecklists(records: ChecklistRecord[]): Promise<void>;
  loadChecklistTemplates(): Promise<ChecklistTemplateRecord[]>;
  saveChecklistTemplates(records: ChecklistTemplateRecord[]): Promise<void>;
  loadChecklistRecurrences(): Promise<ChecklistRecurrenceRecord[]>;
  saveChecklistRecurrences(records: ChecklistRecurrenceRecord[]): Promise<void>;
  loadArchivedTasks(): Promise<ArchivedTaskRecord[]>;
  saveArchivedTasks(records: ArchivedTaskRecord[]): Promise<void>;
  loadActivities(): Promise<ActivityRecord[]>;
  saveActivities(records: ActivityRecord[]): Promise<void>;
  loadTimeLogs(): Promise<TimeLogRecord[]>;
  saveTimeLogs(records: TimeLogRecord[]): Promise<void>;
  loadCalendarItems(): Promise<CalendarItemRecord[]>;
  saveCalendarItems(records: CalendarItemRecord[]): Promise<void>;
  loadEntityLinks(): Promise<EntityLinkRecord[]>;
  saveEntityLinks(records: EntityLinkRecord[]): Promise<void>;
  loadAttachments(): Promise<AttachmentRecord[]>;
  saveAttachments(records: AttachmentRecord[]): Promise<void>;
  loadSettings(): Promise<LocalAppSettings>;
  saveSettings(record: LocalAppSettings): Promise<void>;
  loadAITextCache(): Promise<Array<{ key: string; value: string; createdAt: number; expiresAt: number }>>;
  saveAITextCache(records: Array<{ key: string; value: string; createdAt: number; expiresAt: number }>): Promise<void>;
  loadAIRequestHistory(): Promise<AIRequestHistoryEntry[]>;
  saveAIRequestHistory(records: AIRequestHistoryEntry[]): Promise<void>;
  loadAIModelPricing(): Promise<AIModelPricingSnapshot | null>;
  saveAIModelPricing(snapshot: AIModelPricingSnapshot): Promise<void>;
}

export interface AppRepository extends EntityRepository {
  loadSnapshot(): Promise<DesktopAppSnapshot>;
  saveSnapshot(snapshot: DesktopAppSnapshot): Promise<void>;
}

const readLocalJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeLocalJson = (key: string, value: unknown) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeSettings = (settings: Partial<LocalAppSettings>): LocalAppSettings => ({
  ...createDefaultSettings(),
  ...settings,
  outputLayoutPresetId: normalizeOutputLayoutPresetId(settings.outputLayoutPresetId),
  notesCapturePaneWidth: Number.isFinite(Number(settings.notesCapturePaneWidth))
    ? Math.min(980, Math.max(420, Math.round(Number(settings.notesCapturePaneWidth))))
    : 640,
  captureWorkspaceDensity: settings.captureWorkspaceDensity === "minimal" ? "minimal" : "full",
  outputWorkspaceDensity: settings.outputWorkspaceDensity === "minimal" ? "minimal" : "full",
  calendarDaysInView:
    settings.calendarDaysInView === 3 || settings.calendarDaysInView === 7 || settings.calendarDaysInView === 14
      ? settings.calendarDaysInView
      : 5,
  calendarSlotHeight: settings.calendarSlotHeight === 12 || settings.calendarSlotHeight === 22 ? settings.calendarSlotHeight : 16,
  calendarIsFullScreen: Boolean(settings.calendarIsFullScreen),
  calendarFullScreenPreferenceInitialized: Boolean(settings.calendarFullScreenPreferenceInitialized),
  calendarDetailsPaneWidth: Number.isFinite(Number(settings.calendarDetailsPaneWidth))
    ? Math.min(520, Math.max(240, Math.round(Number(settings.calendarDetailsPaneWidth))))
    : 320,
  calendarScrollTop: Number.isFinite(Number(settings.calendarScrollTop))
    ? Math.max(0, Math.round(Number(settings.calendarScrollTop)))
    : 0,
  calendarScrollLeft: Number.isFinite(Number(settings.calendarScrollLeft))
    ? Math.max(0, Math.round(Number(settings.calendarScrollLeft)))
    : 0,
  calendarVisibilityFilter:
    settings.calendarVisibilityFilter === "public" || settings.calendarVisibilityFilter === "private"
      ? settings.calendarVisibilityFilter
      : "all",
  calendarShowPrivate:
    typeof settings.calendarShowPrivate === "boolean"
      ? settings.calendarShowPrivate
      : settings.calendarVisibilityFilter === "public"
        ? false
        : true,
  calendarShowBusiness:
    typeof settings.calendarShowBusiness === "boolean"
      ? settings.calendarShowBusiness
      : settings.calendarVisibilityFilter === "private"
        ? false
        : true,
  baselineWorkEnabled: Boolean(settings.baselineWorkEnabled),
  baselineWorkActivityId:
    typeof settings.baselineWorkActivityId === "string" ? settings.baselineWorkActivityId.trim() : "",
  textModel: normalizeTextModelId(settings.textModel),
  transcriptionModel: normalizeTranscriptionModelId(settings.transcriptionModel),
  savedParticipants: Array.isArray(settings.savedParticipants)
    ? settings.savedParticipants.filter((value): value is string => typeof value === "string")
    : [],
  savedProjects: Array.isArray(settings.savedProjects)
    ? settings.savedProjects.filter((value): value is string => typeof value === "string")
    : [],
  savedDomains: Array.isArray(settings.savedDomains)
    ? settings.savedDomains.filter((value): value is string => typeof value === "string")
    : [],
  savedActivities: Array.isArray(settings.savedActivities)
    ? settings.savedActivities.filter((value): value is string => typeof value === "string")
    : [],
  savedTags: Array.isArray(settings.savedTags)
    ? settings.savedTags.filter((value): value is string => typeof value === "string")
    : [],
  projectLinks: Array.isArray(settings.projectLinks)
    ? settings.projectLinks
        .map((entry) => ({
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID(),
          project: typeof entry?.project === "string" ? entry.project.trim() : "",
          domain: typeof entry?.domain === "string" ? entry.domain.trim() : "",
        }))
        .filter((entry) => entry.project)
    : [],
  timeReportPresets: Array.isArray(settings.timeReportPresets)
    ? settings.timeReportPresets
        .map((entry) => ({
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID(),
          label: typeof entry?.label === "string" ? entry.label.trim() : "",
          fromDate: typeof entry?.fromDate === "string" ? entry.fromDate : "",
          toDate: typeof entry?.toDate === "string" ? entry.toDate : "",
          domain: typeof entry?.domain === "string" ? entry.domain.trim() : "",
          project: typeof entry?.project === "string" ? entry.project.trim() : "",
        }))
        .filter((entry) => entry.label && entry.fromDate && entry.toDate)
    : [],
  preferredParticipantNames: Array.isArray(settings.preferredParticipantNames)
    ? settings.preferredParticipantNames
        .map((entry) => ({
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID(),
          shortForm: typeof entry?.shortForm === "string" ? entry.shortForm.trim() : "",
          fullName: typeof entry?.fullName === "string" ? entry.fullName.trim() : "",
        }))
        .filter((entry) => entry.shortForm && entry.fullName)
    : [],
  ruleSuggestions: Array.isArray(settings.ruleSuggestions)
    ? settings.ruleSuggestions
        .map((entry): LocalAppSettings["ruleSuggestions"][number] => ({
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID(),
          type: entry?.type === "preferred_name" ? "preferred_name" : "abbreviation",
          sourceValue: typeof entry?.sourceValue === "string" ? entry.sourceValue.trim() : "",
          suggestedValue: typeof entry?.suggestedValue === "string" ? entry.suggestedValue.trim() : "",
          evidenceCount: Number.isFinite(Number(entry?.evidenceCount)) ? Math.max(1, Math.round(Number(entry.evidenceCount))) : 1,
          confidence: Number.isFinite(Number(entry?.confidence)) ? Math.max(0, Math.min(1, Number(entry.confidence))) : 0.5,
          status: entry?.status === "accepted" ? "accepted" : entry?.status === "ignored" ? "ignored" : "pending",
          ignoreForever: Boolean(entry?.ignoreForever),
          observedSessionIds: Array.isArray(entry?.observedSessionIds)
            ? entry.observedSessionIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : [],
          createdAt: typeof entry?.createdAt === "string" && entry.createdAt ? entry.createdAt : now(),
          updatedAt: typeof entry?.updatedAt === "string" && entry.updatedAt ? entry.updatedAt : now(),
        }))
        .filter((entry) => Boolean(entry.sourceValue && entry.suggestedValue))
    : [],
  assistantQueryMemories: Array.isArray(settings.assistantQueryMemories)
    ? settings.assistantQueryMemories
        .map((entry) => ({
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID(),
          fingerprint: typeof entry?.fingerprint === "string" ? entry.fingerprint.trim() : "",
          learnedFromQuestion: typeof entry?.learnedFromQuestion === "string" ? entry.learnedFromQuestion.trim() : "",
          route:
            entry?.route === "timelogs" ||
            entry?.route === "sessions" ||
            entry?.route === "calendar" ||
            entry?.route === "todos" ||
            entry?.route === "activities" ||
            entry?.route === "workspace"
              ? entry.route
              : "workspace",
          clarificationAnswer: typeof entry?.clarificationAnswer === "string" ? entry.clarificationAnswer.trim() : "",
          createdAt: typeof entry?.createdAt === "string" && entry.createdAt ? entry.createdAt : now(),
          updatedAt: typeof entry?.updatedAt === "string" && entry.updatedAt ? entry.updatedAt : now(),
        }))
        .filter((entry) => Boolean(entry.fingerprint))
    : [],
  promptProfile: normalizePromptProfile(settings.promptProfile),
});

class BrowserEntityRepository implements AppRepository {
  async loadSessions() {
    return readLocalJson<SessionRecord[]>(STORAGE_KEYS.sessions, createDefaultSnapshot().sessions).map(normalizeSessionRecord);
  }

  async saveSessions(records: SessionRecord[]) {
    writeLocalJson(STORAGE_KEYS.sessions, records);
  }

  async loadTemplates() {
    return readLocalJson<TemplateDefinition[]>(STORAGE_KEYS.templates, BUILTIN_TEMPLATES).map(normalizeTemplateRecord);
  }

  async saveTemplates(records: TemplateDefinition[]) {
    writeLocalJson(STORAGE_KEYS.templates, records);
  }

  async loadTodos() {
    return readLocalJson<TodoRecord[]>(STORAGE_KEYS.todos, []).map(normalizeTodoRecord);
  }

  async saveTodos(records: TodoRecord[]) {
    writeLocalJson(STORAGE_KEYS.todos, records);
  }

  async loadChecklists() {
    return readLocalJson<ChecklistRecord[]>(STORAGE_KEYS.checklists, []).map(normalizeChecklistRecord);
  }

  async saveChecklists(records: ChecklistRecord[]) {
    writeLocalJson(STORAGE_KEYS.checklists, records);
  }

  async loadChecklistTemplates() {
    return readLocalJson<ChecklistTemplateRecord[]>(STORAGE_KEYS.checklistTemplates, []).map(normalizeChecklistTemplateRecord);
  }

  async saveChecklistTemplates(records: ChecklistTemplateRecord[]) {
    writeLocalJson(STORAGE_KEYS.checklistTemplates, records);
  }

  async loadChecklistRecurrences() {
    return readLocalJson<ChecklistRecurrenceRecord[]>(STORAGE_KEYS.checklistRecurrences, []).map(normalizeChecklistRecurrenceRecord);
  }

  async saveChecklistRecurrences(records: ChecklistRecurrenceRecord[]) {
    writeLocalJson(STORAGE_KEYS.checklistRecurrences, records);
  }

  async loadActivities() {
    return readLocalJson<ActivityRecord[]>(STORAGE_KEYS.activities, []).map(normalizeActivityRecord);
  }

  async saveActivities(records: ActivityRecord[]) {
    writeLocalJson(STORAGE_KEYS.activities, records);
  }

  async loadArchivedTasks() {
    return readLocalJson<ArchivedTaskRecord[]>(STORAGE_KEYS.archivedTasks, []).map(normalizeArchivedTaskRecord);
  }

  async saveArchivedTasks(records: ArchivedTaskRecord[]) {
    writeLocalJson(STORAGE_KEYS.archivedTasks, records);
  }

  async loadTimeLogs() {
    return readLocalJson<TimeLogRecord[]>(STORAGE_KEYS.timelogs, []).map(normalizeTimeLogRecord);
  }

  async saveTimeLogs(records: TimeLogRecord[]) {
    writeLocalJson(STORAGE_KEYS.timelogs, records);
  }

  async loadCalendarItems() {
    return readLocalJson<CalendarItemRecord[]>(STORAGE_KEYS.calendarItems, []).map(normalizeCalendarItemRecord);
  }

  async saveCalendarItems(records: CalendarItemRecord[]) {
    writeLocalJson(STORAGE_KEYS.calendarItems, records);
  }

  async loadEntityLinks() {
    return readLocalJson<EntityLinkRecord[]>(STORAGE_KEYS.entityLinks, []).map(normalizeEntityLinkRecord);
  }

  async saveEntityLinks(records: EntityLinkRecord[]) {
    writeLocalJson(STORAGE_KEYS.entityLinks, records);
  }

  async loadAttachments() {
    return readLocalJson<AttachmentRecord[]>(STORAGE_KEYS.attachments, []).map(normalizeAttachmentRecord);
  }

  async saveAttachments(records: AttachmentRecord[]) {
    writeLocalJson(STORAGE_KEYS.attachments, records);
  }

  async loadSettings() {
    return normalizeSettings(readLocalJson<Partial<LocalAppSettings>>(STORAGE_KEYS.settings, createDefaultSettings()));
  }

  async saveSettings(record: LocalAppSettings) {
    writeLocalJson(STORAGE_KEYS.settings, record);
  }

  async loadAITextCache() {
    return readLocalJson<Array<{ key: string; value: string; createdAt: number; expiresAt: number }>>(STORAGE_KEYS.aiTextCache, []);
  }

  async saveAITextCache(records: Array<{ key: string; value: string; createdAt: number; expiresAt: number }>) {
    writeLocalJson(STORAGE_KEYS.aiTextCache, records);
  }

  async loadAIRequestHistory() {
    return readLocalJson<AIRequestHistoryEntry[]>(STORAGE_KEYS.aiRequestHistory, []);
  }

  async saveAIRequestHistory(records: AIRequestHistoryEntry[]) {
    writeLocalJson(STORAGE_KEYS.aiRequestHistory, records);
  }

  async loadAIModelPricing() {
    return normalizeAIModelPricingSnapshot(readLocalJson<AIModelPricingSnapshot | null>(STORAGE_KEYS.aiModelPricing, null));
  }

  async saveAIModelPricing(snapshot: AIModelPricingSnapshot) {
    writeLocalJson(STORAGE_KEYS.aiModelPricing, snapshot);
  }

  async loadSnapshot(): Promise<DesktopAppSnapshot> {
    const [sessions, templates, todos, checklists, checklistTemplates, checklistRecurrences, archivedTasks, activities, timelogs, calendarItems, entityLinks, attachments, settings] = await Promise.all([
      this.loadSessions(),
      this.loadTemplates(),
      this.loadTodos(),
      this.loadChecklists(),
      this.loadChecklistTemplates(),
      this.loadChecklistRecurrences(),
      this.loadArchivedTasks(),
      this.loadActivities(),
      this.loadTimeLogs(),
      this.loadCalendarItems(),
      this.loadEntityLinks(),
      this.loadAttachments(),
      this.loadSettings(),
    ]);

    return {
      sessions,
      templates: templates.length ? templates : BUILTIN_TEMPLATES.map(normalizeTemplateRecord),
      todos,
      checklists,
      checklistTemplates,
      checklistRecurrences,
      archivedTasks,
      activities,
      timelogs,
      calendarItems,
      entityLinks,
      attachments,
      settings,
    };
  }

  async saveSnapshot(snapshot: DesktopAppSnapshot): Promise<void> {
    await Promise.all([
      this.saveSessions(snapshot.sessions),
      this.saveTemplates(snapshot.templates),
      this.saveTodos(snapshot.todos),
      this.saveChecklists(snapshot.checklists),
      this.saveChecklistTemplates(snapshot.checklistTemplates),
      this.saveChecklistRecurrences(snapshot.checklistRecurrences),
      this.saveArchivedTasks(snapshot.archivedTasks),
      this.saveActivities(snapshot.activities),
      this.saveTimeLogs(snapshot.timelogs),
      this.saveCalendarItems(snapshot.calendarItems),
      this.saveEntityLinks(snapshot.entityLinks),
      this.saveAttachments(snapshot.attachments),
      this.saveSettings(snapshot.settings),
    ]);
  }
}

type SqlDatabase = {
  execute: (sql: string, bindValues?: unknown[]) => Promise<unknown>;
  select: <T>(sql: string, bindValues?: unknown[]) => Promise<T[]>;
};

class TauriSqliteRepository implements AppRepository {
  private dbPromise: Promise<SqlDatabase> | null = null;

  private async getDb() {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const DatabaseModule = await import("@tauri-apps/plugin-sql");
        const storageInfo = await getDesktopStorageInfo();
        const dbLocation = storageInfo?.databasePath ? `sqlite:${storageInfo.databasePath}` : "sqlite:notesmith.db";
        const db = await DatabaseModule.default.load(dbLocation);
        await Promise.all(sqliteBootstrapStatements.map((statement) => db.execute(statement)));
        await db.execute("ALTER TABLE sessions ADD COLUMN detail_level INTEGER NOT NULL DEFAULT 3").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN custom_field_values TEXT NOT NULL DEFAULT '{}'").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN excluded_section_ids TEXT NOT NULL DEFAULT '[]'").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN output_versions TEXT NOT NULL DEFAULT '[]'").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN capture_mode TEXT NOT NULL DEFAULT 'meeting-note'").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN project TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN domain TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN activity TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN tags_text TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN transcribe_only INTEGER NOT NULL DEFAULT 0").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN output_language TEXT NOT NULL DEFAULT 'same'").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN additional_instructions TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE attachments ADD COLUMN caption TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE attachments ADD COLUMN include_in_output INTEGER NOT NULL DEFAULT 0").catch(() => {});
        await db.execute("ALTER TABLE attachments ADD COLUMN output_position INTEGER NOT NULL DEFAULT 0").catch(() => {});
        await db.execute("CREATE TABLE IF NOT EXISTS calendar_items (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, schedule_date TEXT NOT NULL, start_slot INTEGER NOT NULL, duration_slots INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)").catch(() => {});
        await db.execute("CREATE TABLE IF NOT EXISTS timelogs (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, log_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, duration_minutes INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)").catch(() => {});
        await db.execute("CREATE TABLE IF NOT EXISTS archived_tasks (id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL, payload_json TEXT NOT NULL)").catch(() => {});
        await db.execute("CREATE TABLE IF NOT EXISTS checklists (id TEXT PRIMARY KEY, owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)").catch(() => {});
        await db.execute("CREATE TABLE IF NOT EXISTS checklist_templates (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)").catch(() => {});
        await db.execute("CREATE TABLE IF NOT EXISTS checklist_recurrences (id TEXT PRIMARY KEY, owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)").catch(() => {});
        return db;
      })();
    }

    return this.dbPromise;
  }

  async loadSessions() {
    const db = await this.getDb();
    const rows = await db.select<{
      id: string;
      template_id: string;
      title: string;
      deleted_at: string;
      is_private: number;
      participant_text: string;
      project: string;
      domain: string;
      activity: string;
      tags_text: string;
      transcribe_only: number;
      output_language: string;
      session_date: string;
      start_time: string;
      end_time: string;
      quick_highlights: string;
      detail_level: number;
      additional_instructions: string;
      capture_mode: string;
      manual_notes: string;
      live_transcript: string;
      uploaded_transcript: string;
      custom_field_values: string;
      excluded_section_ids: string;
      output_versions: string;
      output_text: string;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM sessions ORDER BY updated_at DESC");

    return rows.map((row) => normalizeSessionRecord({
      id: row.id,
      captureMode: row.capture_mode === "quick-note" || row.capture_mode === "voice-note" ? row.capture_mode : "meeting-note",
      templateId: row.template_id,
      title: row.title,
      deletedAt: row.deleted_at || null,
      isPrivate: Boolean(row.is_private),
      participantText: row.participant_text,
      project: row.project,
      domain: row.domain,
      activity: row.activity,
      tagsText: row.tags_text,
      transcribeOnly: Boolean(row.transcribe_only),
      outputLanguage: row.output_language === "sv" || row.output_language === "en" ? row.output_language : "same",
      date: row.session_date,
      startTime: row.start_time,
      endTime: row.end_time,
      quickHighlights: row.quick_highlights,
      detailLevel: row.detail_level,
      additionalInstructions: row.additional_instructions,
      manualNotes: row.manual_notes,
      liveTranscript: row.live_transcript,
      uploadedTranscript: row.uploaded_transcript,
      customFieldValues: row.custom_field_values ? (JSON.parse(row.custom_field_values) as Record<string, string>) : {},
      excludedSectionIds: row.excluded_section_ids ? (JSON.parse(row.excluded_section_ids) as string[]) : [],
      outputVersions: row.output_versions
        ? (JSON.parse(row.output_versions) as SessionRecord["outputVersions"])
        : [],
      output: row.output_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async saveSessions(records: SessionRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM sessions");
    await Promise.all(
      records.map((record) =>
        db.execute(
          `INSERT INTO sessions (
            id, template_id, title, deleted_at, is_private, participant_text, project, domain, activity, tags_text, transcribe_only, output_language, session_date, start_time, end_time,
            quick_highlights, detail_level, additional_instructions, capture_mode, manual_notes, live_transcript, uploaded_transcript, custom_field_values, excluded_section_ids, output_text,
            output_versions, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            record.id,
            record.templateId,
            record.title,
            record.deletedAt || "",
            record.isPrivate ? 1 : 0,
            record.participantText,
            record.project,
            record.domain,
            record.activity,
            record.tagsText,
            record.transcribeOnly ? 1 : 0,
            record.outputLanguage,
            record.date,
            record.startTime,
            record.endTime,
            record.quickHighlights,
            normalizeDetailLevel(record.detailLevel),
            record.additionalInstructions,
            record.captureMode,
            record.manualNotes,
            record.liveTranscript,
            record.uploadedTranscript,
            JSON.stringify(record.customFieldValues),
            JSON.stringify(record.excludedSectionIds),
            record.output,
            JSON.stringify(record.outputVersions),
            record.createdAt,
            record.updatedAt,
          ],
        ),
      ),
    );
  }

  async loadTemplates() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM templates ORDER BY name ASC");
    if (!rows.length) return BUILTIN_TEMPLATES;
    return rows.map((row) => normalizeTemplateRecord(JSON.parse(row.payload_json) as TemplateDefinition));
  }

  async saveTemplates(records: TemplateDefinition[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM templates");
    await Promise.all(
      records.map((record) =>
        db.execute("INSERT INTO templates (id, name, kind, payload_json) VALUES (?, ?, ?, ?)", [
          record.id,
          record.name,
          record.kind,
          JSON.stringify(record),
        ]),
      ),
    );
  }

  async loadTodos() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM todos ORDER BY created_at DESC");
    return rows.map((row) => normalizeTodoRecord(JSON.parse(row.payload_json) as TodoRecord));
  }

  async saveTodos(records: TodoRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM todos");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO todos (id, description, is_done, comments, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
          [record.id, record.description, record.isDone ? 1 : 0, record.comments, record.createdAt, JSON.stringify(record)],
        ),
      ),
    );
  }

  async loadChecklists() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM checklists ORDER BY updated_at DESC");
    return rows.map((row) => normalizeChecklistRecord(JSON.parse(row.payload_json) as ChecklistRecord));
  }

  async saveChecklists(records: ChecklistRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM checklists");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO checklists (id, owner_type, owner_id, updated_at, payload_json) VALUES (?, ?, ?, ?, ?)",
          [record.id, record.ownerType, record.ownerId, record.updatedAt, JSON.stringify(record)],
        ),
      ),
    );
  }

  async loadChecklistTemplates() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM checklist_templates ORDER BY updated_at DESC");
    return rows.map((row) => normalizeChecklistTemplateRecord(JSON.parse(row.payload_json) as ChecklistTemplateRecord));
  }

  async saveChecklistTemplates(records: ChecklistTemplateRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM checklist_templates");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO checklist_templates (id, updated_at, payload_json) VALUES (?, ?, ?)",
          [record.id, record.updatedAt, JSON.stringify(record)],
        ),
      ),
    );
  }

  async loadChecklistRecurrences() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM checklist_recurrences ORDER BY updated_at DESC");
    return rows.map((row) => normalizeChecklistRecurrenceRecord(JSON.parse(row.payload_json) as ChecklistRecurrenceRecord));
  }

  async saveChecklistRecurrences(records: ChecklistRecurrenceRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM checklist_recurrences");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO checklist_recurrences (id, owner_type, owner_id, updated_at, payload_json) VALUES (?, ?, ?, ?, ?)",
          [record.id, record.ownerType, record.ownerId, record.updatedAt, JSON.stringify(record)],
        ),
      ),
    );
  }

  async loadActivities() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM activities ORDER BY created_at DESC");
    return rows.map((row) => normalizeActivityRecord(JSON.parse(row.payload_json) as ActivityRecord));
  }

  async loadArchivedTasks() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM archived_tasks ORDER BY deleted_at DESC");
    return rows.map((row) => normalizeArchivedTaskRecord(JSON.parse(row.payload_json) as ArchivedTaskRecord));
  }

  async saveArchivedTasks(records: ArchivedTaskRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM archived_tasks");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO archived_tasks (id, deleted_at, payload_json) VALUES (?, ?, ?)",
          [record.id, record.deletedAt, JSON.stringify(record)],
        ),
      ),
    );
  }

  async saveActivities(records: ActivityRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM activities");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO activities (id, description, is_done, comments, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
          [record.id, record.description, record.isDone ? 1 : 0, record.comments, record.createdAt, JSON.stringify(record)],
        ),
      ),
    );
  }

  async loadTimeLogs() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM timelogs ORDER BY updated_at DESC");
    return rows.map((row) => normalizeTimeLogRecord(JSON.parse(row.payload_json) as TimeLogRecord));
  }

  async saveTimeLogs(records: TimeLogRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM timelogs");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO timelogs (id, target_type, target_id, log_date, start_time, end_time, duration_minutes, created_at, updated_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            record.id,
            record.targetType,
            record.targetId,
            record.date,
            record.startTime,
            record.endTime,
            record.durationMinutes,
            record.createdAt,
            record.updatedAt,
            JSON.stringify(record),
          ],
        ),
      ),
    );
  }

  async loadCalendarItems() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM calendar_items ORDER BY updated_at DESC");
    return rows.map((row) => normalizeCalendarItemRecord(JSON.parse(row.payload_json) as CalendarItemRecord));
  }

  async saveCalendarItems(records: CalendarItemRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM calendar_items");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO calendar_items (id, target_type, target_id, schedule_date, start_slot, duration_slots, created_at, updated_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            record.id,
            record.targetType,
            record.targetId,
            record.date,
            record.startSlot,
            record.durationSlots,
            record.createdAt,
            record.updatedAt,
            JSON.stringify(record),
          ],
        ),
      ),
    );
  }

  async loadEntityLinks() {
    const db = await this.getDb();
    const rows = await db.select<{ payload_json: string }>("SELECT payload_json FROM entity_links ORDER BY created_at DESC");
    return rows.map((row) => normalizeEntityLinkRecord(JSON.parse(row.payload_json) as EntityLinkRecord));
  }

  async saveEntityLinks(records: EntityLinkRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM entity_links");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO entity_links (id, from_type, from_id, to_type, to_id, relation, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [record.id, record.fromType, record.fromId, record.toType, record.toId, record.relation, record.createdAt, JSON.stringify(record)],
        ),
      ),
    );
  }

  async loadAttachments() {
    const db = await this.getDb();
    const rows = await db.select<AttachmentRecord>(
      "SELECT id, session_id as sessionId, kind, filename, mime_type as mimeType, file_path as filePath, size_bytes as sizeBytes, caption, include_in_output as includeInOutput, output_position as outputPosition, created_at as createdAt FROM attachments ORDER BY created_at DESC",
    );
    return rows.map(normalizeAttachmentRecord);
  }

  async saveAttachments(records: AttachmentRecord[]) {
    const db = await this.getDb();
    await db.execute("DELETE FROM attachments");
    await Promise.all(
      records.map((record) =>
        db.execute(
          "INSERT INTO attachments (id, session_id, kind, filename, mime_type, file_path, size_bytes, caption, include_in_output, output_position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            record.id,
            record.sessionId,
            record.kind,
            record.filename,
            record.mimeType,
            record.filePath,
            record.sizeBytes,
            record.caption,
            record.includeInOutput ? 1 : 0,
            record.outputPosition,
            record.createdAt,
          ],
        ),
      ),
    );
  }

  async loadSettings() {
    const db = await this.getDb();
    const rows = await db.select<{ value_json: string }>(
      "SELECT value_json FROM settings_local WHERE key = ?",
      ["settings"],
    );
    return rows[0]?.value_json
      ? normalizeSettings(JSON.parse(rows[0].value_json) as Partial<LocalAppSettings>)
      : createDefaultSettings();
  }

  async saveSettings(record: LocalAppSettings) {
    const db = await this.getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)",
      ["settings", JSON.stringify(record)],
    );
  }

  async loadAITextCache() {
    const db = await this.getDb();
    const rows = await db.select<{ value_json: string }>(
      "SELECT value_json FROM settings_local WHERE key = ?",
      ["ai-text-cache"],
    );

    return rows[0]?.value_json
      ? (JSON.parse(rows[0].value_json) as Array<{ key: string; value: string; createdAt: number; expiresAt: number }>)
      : [];
  }

  async saveAITextCache(records: Array<{ key: string; value: string; createdAt: number; expiresAt: number }>) {
    const db = await this.getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)",
      ["ai-text-cache", JSON.stringify(records)],
    );
  }

  async loadAIRequestHistory() {
    const db = await this.getDb();
    const rows = await db.select<{ value_json: string }>(
      "SELECT value_json FROM settings_local WHERE key = ?",
      ["ai-request-history"],
    );

    return rows[0]?.value_json
      ? (JSON.parse(rows[0].value_json) as AIRequestHistoryEntry[])
      : [];
  }

  async saveAIRequestHistory(records: AIRequestHistoryEntry[]) {
    const db = await this.getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)",
      ["ai-request-history", JSON.stringify(records)],
    );
  }

  async loadAIModelPricing() {
    const db = await this.getDb();
    const rows = await db.select<{ value_json: string }>(
      "SELECT value_json FROM settings_local WHERE key = ?",
      ["ai-model-pricing"],
    );

    return rows[0]?.value_json
      ? normalizeAIModelPricingSnapshot(JSON.parse(rows[0].value_json) as AIModelPricingSnapshot)
      : null;
  }

  async saveAIModelPricing(snapshot: AIModelPricingSnapshot) {
    const db = await this.getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)",
      ["ai-model-pricing", JSON.stringify(snapshot)],
    );
  }

  async loadSnapshot(): Promise<DesktopAppSnapshot> {
    const [sessions, templates, todos, checklists, checklistTemplates, checklistRecurrences, archivedTasks, activities, timelogs, calendarItems, entityLinks, attachments, settings] = await Promise.all([
      this.loadSessions(),
      this.loadTemplates(),
      this.loadTodos(),
      this.loadChecklists(),
      this.loadChecklistTemplates(),
      this.loadChecklistRecurrences(),
      this.loadArchivedTasks(),
      this.loadActivities(),
      this.loadTimeLogs(),
      this.loadCalendarItems(),
      this.loadEntityLinks(),
      this.loadAttachments(),
      this.loadSettings(),
    ]);

    return {
      sessions,
      templates: templates.length ? templates : BUILTIN_TEMPLATES.map(normalizeTemplateRecord),
      todos,
      checklists,
      checklistTemplates,
      checklistRecurrences,
      archivedTasks,
      activities,
      timelogs,
      calendarItems,
      entityLinks,
      attachments,
      settings,
    };
  }

  async saveSnapshot(snapshot: DesktopAppSnapshot): Promise<void> {
    await Promise.all([
      this.saveSessions(snapshot.sessions),
      this.saveTemplates(snapshot.templates),
      this.saveTodos(snapshot.todos),
      this.saveChecklists(snapshot.checklists),
      this.saveChecklistTemplates(snapshot.checklistTemplates),
      this.saveChecklistRecurrences(snapshot.checklistRecurrences),
      this.saveArchivedTasks(snapshot.archivedTasks),
      this.saveActivities(snapshot.activities),
      this.saveTimeLogs(snapshot.timelogs),
      this.saveCalendarItems(snapshot.calendarItems),
      this.saveEntityLinks(snapshot.entityLinks),
      this.saveAttachments(snapshot.attachments),
      this.saveSettings(snapshot.settings),
    ]);
  }
}

export const createAppRepository = (): AppRepository =>
  isTauriRuntime() ? new TauriSqliteRepository() : new BrowserEntityRepository();

export const createSessionRecord = (
  templateId: string,
  captureMode: CaptureMode = "meeting-note",
): SessionRecord => {
  const timestamp = new Date();
  const isoDate = timestamp.toISOString().slice(0, 10);
  const isoTime = timestamp.toTimeString().slice(0, 5);
  const defaultTitle =
    captureMode === "meeting-note"
      ? ""
      : `${isoDate} ${isoTime}`;

  return {
    id: crypto.randomUUID(),
    captureMode,
    templateId: templateId || DEFAULT_TEMPLATE_BY_CAPTURE_MODE[captureMode],
    title: defaultTitle,
    isPrivate: false,
    deletedAt: null,
    participantText: "",
    project: "",
    domain: "",
    activity: "",
    tagsText: "",
    date: isoDate,
    startTime: isoTime,
    endTime: isoTime,
    quickHighlights: "",
    transcribeOnly: false,
    outputLanguage: "same",
    detailLevel: 3,
    additionalInstructions: "",
    manualNotes: "",
    liveTranscript: "",
    uploadedTranscript: "",
    customFieldValues: {},
    excludedSectionIds: [],
    output: "",
    outputVersions: [],
    createdAt: now(),
    updatedAt: now(),
  };
};

export const upsertSession = (sessions: SessionRecord[], nextSession: SessionRecord) =>
  sessions.some((session) => session.id === nextSession.id)
    ? sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
    : [nextSession, ...sessions];

export const upsertTemplate = (templates: TemplateDefinition[], nextTemplate: TemplateDefinition) =>
  templates.some((template) => template.id === nextTemplate.id)
    ? templates.map((template) => (template.id === nextTemplate.id ? nextTemplate : template))
    : [...templates, nextTemplate];

export const upsertTodo = (todos: TodoRecord[], nextTodo: TodoRecord) =>
  todos.some((todo) => todo.id === nextTodo.id)
    ? todos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo))
    : [nextTodo, ...todos];

export const upsertActivity = (activities: ActivityRecord[], nextActivity: ActivityRecord) =>
  activities.some((activity) => activity.id === nextActivity.id)
    ? activities.map((activity) => (activity.id === nextActivity.id ? nextActivity : activity))
    : [nextActivity, ...activities];

export const upsertTimeLog = (timeLogs: TimeLogRecord[], nextTimeLog: TimeLogRecord) =>
  timeLogs.some((timeLog) => timeLog.id === nextTimeLog.id)
    ? timeLogs.map((timeLog) => (timeLog.id === nextTimeLog.id ? nextTimeLog : timeLog))
    : [nextTimeLog, ...timeLogs];

export const upsertCalendarItem = (items: CalendarItemRecord[], nextItem: CalendarItemRecord) =>
  items.some((item) => item.id === nextItem.id)
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [nextItem, ...items];
