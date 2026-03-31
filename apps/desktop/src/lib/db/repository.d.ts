import { type AttachmentRecord, type DesktopAppSnapshot, type LocalAppSettings, type SessionRecord, type TemplateDefinition, type TodoRecord } from "@notesmith/domain";
export declare const createDefaultSettings: () => LocalAppSettings;
export declare const createDefaultSnapshot: () => DesktopAppSnapshot;
export interface EntityRepository {
    loadSessions(): Promise<SessionRecord[]>;
    saveSessions(records: SessionRecord[]): Promise<void>;
    loadTemplates(): Promise<TemplateDefinition[]>;
    saveTemplates(records: TemplateDefinition[]): Promise<void>;
    loadTodos(): Promise<TodoRecord[]>;
    saveTodos(records: TodoRecord[]): Promise<void>;
    loadAttachments(): Promise<AttachmentRecord[]>;
    saveAttachments(records: AttachmentRecord[]): Promise<void>;
    loadSettings(): Promise<LocalAppSettings>;
    saveSettings(record: LocalAppSettings): Promise<void>;
}
export interface AppRepository extends EntityRepository {
    loadSnapshot(): Promise<DesktopAppSnapshot>;
    saveSnapshot(snapshot: DesktopAppSnapshot): Promise<void>;
}
export declare const createAppRepository: () => AppRepository;
export declare const createSessionRecord: (templateId: string) => SessionRecord;
export declare const upsertSession: (sessions: SessionRecord[], nextSession: SessionRecord) => SessionRecord[];
export declare const upsertTemplate: (templates: TemplateDefinition[], nextTemplate: TemplateDefinition) => TemplateDefinition[];
export declare const upsertTodo: (todos: TodoRecord[], nextTodo: TodoRecord) => TodoRecord[];
