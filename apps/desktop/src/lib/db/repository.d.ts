import { type AttachmentRecord, type ActivityRecord, type CalendarItemRecord, type CaptureMode, type DesktopAppSnapshot, type EntityLinkRecord, type LocalAppSettings, type SessionRecord, type TemplateDefinition, type TodoRecord } from "@notesmith/domain";
import type { AIRequestHistoryEntry } from "../ai/history";
import { type AIModelPricingSnapshot } from "../ai/modelPricing";
export declare const createDefaultSettings: () => LocalAppSettings;
export declare const createDefaultSnapshot: () => DesktopAppSnapshot;
export interface EntityRepository {
    loadSessions(): Promise<SessionRecord[]>;
    saveSessions(records: SessionRecord[]): Promise<void>;
    loadTemplates(): Promise<TemplateDefinition[]>;
    saveTemplates(records: TemplateDefinition[]): Promise<void>;
    loadTodos(): Promise<TodoRecord[]>;
    saveTodos(records: TodoRecord[]): Promise<void>;
    loadActivities(): Promise<ActivityRecord[]>;
    saveActivities(records: ActivityRecord[]): Promise<void>;
    loadCalendarItems(): Promise<CalendarItemRecord[]>;
    saveCalendarItems(records: CalendarItemRecord[]): Promise<void>;
    loadEntityLinks(): Promise<EntityLinkRecord[]>;
    saveEntityLinks(records: EntityLinkRecord[]): Promise<void>;
    loadAttachments(): Promise<AttachmentRecord[]>;
    saveAttachments(records: AttachmentRecord[]): Promise<void>;
    loadSettings(): Promise<LocalAppSettings>;
    saveSettings(record: LocalAppSettings): Promise<void>;
    loadAITextCache(): Promise<Array<{
        key: string;
        value: string;
        createdAt: number;
        expiresAt: number;
    }>>;
    saveAITextCache(records: Array<{
        key: string;
        value: string;
        createdAt: number;
        expiresAt: number;
    }>): Promise<void>;
    loadAIRequestHistory(): Promise<AIRequestHistoryEntry[]>;
    saveAIRequestHistory(records: AIRequestHistoryEntry[]): Promise<void>;
    loadAIModelPricing(): Promise<AIModelPricingSnapshot | null>;
    saveAIModelPricing(snapshot: AIModelPricingSnapshot): Promise<void>;
}
export interface AppRepository extends EntityRepository {
    loadSnapshot(): Promise<DesktopAppSnapshot>;
    saveSnapshot(snapshot: DesktopAppSnapshot): Promise<void>;
}
export declare const createAppRepository: () => AppRepository;
export declare const createSessionRecord: (templateId: string, captureMode?: CaptureMode) => SessionRecord;
export declare const upsertSession: (sessions: SessionRecord[], nextSession: SessionRecord) => SessionRecord[];
export declare const upsertTemplate: (templates: TemplateDefinition[], nextTemplate: TemplateDefinition) => TemplateDefinition[];
export declare const upsertTodo: (todos: TodoRecord[], nextTodo: TodoRecord) => TodoRecord[];
export declare const upsertActivity: (activities: ActivityRecord[], nextActivity: ActivityRecord) => ActivityRecord[];
export declare const upsertCalendarItem: (items: CalendarItemRecord[], nextItem: CalendarItemRecord) => CalendarItemRecord[];
