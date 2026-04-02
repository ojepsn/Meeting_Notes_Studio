import {
  BUILTIN_TEMPLATES,
  type AttachmentRecord,
  type DesktopAppSnapshot,
  type LocalAppSettings,
  type SessionRecord,
  type TemplateDefinition,
  type TodoRecord,
} from "@notesmith/domain";
import {
  DEFAULT_GENERATION_RULES,
  DEFAULT_GENERATION_SYSTEM_PROMPT,
  DEFAULT_REVISION_RULES,
  DEFAULT_TRANSLATION_RULES,
} from "@notesmith/prompts";
import type { AIRequestHistoryEntry } from "../ai/history";
import {
  normalizeAIModelPricingSnapshot,
  normalizeTextModelId,
  normalizeTranscriptionModelId,
  type AIModelPricingSnapshot,
} from "../ai/modelPricing";
import { isTauriRuntime } from "../storage/environment";
import { sqliteBootstrapStatements } from "./schema";

const STORAGE_KEYS = {
  sessions: "notesmith-desktop-sessions",
  templates: "notesmith-desktop-templates",
  todos: "notesmith-desktop-todos",
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
  detailLevel: normalizeDetailLevel(session.detailLevel),
  customFieldValues:
    session.customFieldValues && typeof session.customFieldValues === "object" ? session.customFieldValues : {},
  excludedSectionIds: Array.isArray(session.excludedSectionIds) ? session.excludedSectionIds : [],
});

const normalizeAttachmentRecord = (attachment: AttachmentRecord): AttachmentRecord => ({
  ...attachment,
  caption: typeof attachment.caption === "string" ? attachment.caption : "",
  includeInOutput: Boolean(attachment.includeInOutput),
  outputPosition: Number.isFinite(Number(attachment.outputPosition)) ? Number(attachment.outputPosition) : 0,
});

export const createDefaultSettings = (): LocalAppSettings => ({
  theme: "fluent-slate-light",
  outputLanguage: "same",
  preferredDesktopTemplateId: "meeting",
  apiKey: "",
  textModel: "gpt-5.4-mini",
  transcriptionModel: "gpt-4o-mini-transcribe",
  savedParticipants: [],
  abbreviations: [],
  promptProfile: {
    generationSystem: DEFAULT_GENERATION_SYSTEM_PROMPT,
    generationRules: DEFAULT_GENERATION_RULES,
    revisionRules: DEFAULT_REVISION_RULES,
    translationRules: DEFAULT_TRANSLATION_RULES,
    extraBlocks: [],
  },
});

export const createDefaultSnapshot = (): DesktopAppSnapshot => ({
  sessions: [
    {
      id: crypto.randomUUID(),
      templateId: "meeting",
      title: "2026-03-30 Weekly team sync",
      participantText: "Anna, Marcus, Ola",
      date: "2026-03-30",
      startTime: "09:00",
      endTime: "10:00",
      quickHighlights: "Release planning, blockers, client timeline",
      detailLevel: 3,
      manualNotes: "Talked through current blockers and the April release cut.",
      liveTranscript: "",
      uploadedTranscript: "",
      customFieldValues: {},
      excludedSectionIds: [],
      output: "",
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  templates: BUILTIN_TEMPLATES,
  todos: [],
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
  textModel: normalizeTextModelId(settings.textModel),
  transcriptionModel: normalizeTranscriptionModelId(settings.transcriptionModel),
});

class BrowserEntityRepository implements AppRepository {
  async loadSessions() {
    return readLocalJson<SessionRecord[]>(STORAGE_KEYS.sessions, createDefaultSnapshot().sessions).map(normalizeSessionRecord);
  }

  async saveSessions(records: SessionRecord[]) {
    writeLocalJson(STORAGE_KEYS.sessions, records);
  }

  async loadTemplates() {
    return readLocalJson<TemplateDefinition[]>(STORAGE_KEYS.templates, BUILTIN_TEMPLATES);
  }

  async saveTemplates(records: TemplateDefinition[]) {
    writeLocalJson(STORAGE_KEYS.templates, records);
  }

  async loadTodos() {
    return readLocalJson<TodoRecord[]>(STORAGE_KEYS.todos, []);
  }

  async saveTodos(records: TodoRecord[]) {
    writeLocalJson(STORAGE_KEYS.todos, records);
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
    const [sessions, templates, todos, attachments, settings] = await Promise.all([
      this.loadSessions(),
      this.loadTemplates(),
      this.loadTodos(),
      this.loadAttachments(),
      this.loadSettings(),
    ]);

    return {
      sessions: sessions.length ? sessions : createDefaultSnapshot().sessions,
      templates: templates.length ? templates : BUILTIN_TEMPLATES,
      todos,
      attachments,
      settings,
    };
  }

  async saveSnapshot(snapshot: DesktopAppSnapshot): Promise<void> {
    await Promise.all([
      this.saveSessions(snapshot.sessions),
      this.saveTemplates(snapshot.templates),
      this.saveTodos(snapshot.todos),
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
        const db = await DatabaseModule.default.load("sqlite:notesmith.db");
        await Promise.all(sqliteBootstrapStatements.map((statement) => db.execute(statement)));
        await db.execute("ALTER TABLE sessions ADD COLUMN detail_level INTEGER NOT NULL DEFAULT 3").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN custom_field_values TEXT NOT NULL DEFAULT '{}'").catch(() => {});
        await db.execute("ALTER TABLE sessions ADD COLUMN excluded_section_ids TEXT NOT NULL DEFAULT '[]'").catch(() => {});
        await db.execute("ALTER TABLE attachments ADD COLUMN caption TEXT NOT NULL DEFAULT ''").catch(() => {});
        await db.execute("ALTER TABLE attachments ADD COLUMN include_in_output INTEGER NOT NULL DEFAULT 0").catch(() => {});
        await db.execute("ALTER TABLE attachments ADD COLUMN output_position INTEGER NOT NULL DEFAULT 0").catch(() => {});
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
      participant_text: string;
      session_date: string;
      start_time: string;
      end_time: string;
      quick_highlights: string;
      detail_level: number;
      manual_notes: string;
      live_transcript: string;
      uploaded_transcript: string;
      custom_field_values: string;
      excluded_section_ids: string;
      output_text: string;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM sessions ORDER BY updated_at DESC");

    return rows.map((row) => normalizeSessionRecord({
      id: row.id,
      templateId: row.template_id,
      title: row.title,
      participantText: row.participant_text,
      date: row.session_date,
      startTime: row.start_time,
      endTime: row.end_time,
      quickHighlights: row.quick_highlights,
      detailLevel: row.detail_level,
      manualNotes: row.manual_notes,
      liveTranscript: row.live_transcript,
      uploadedTranscript: row.uploaded_transcript,
      customFieldValues: row.custom_field_values ? (JSON.parse(row.custom_field_values) as Record<string, string>) : {},
      excludedSectionIds: row.excluded_section_ids ? (JSON.parse(row.excluded_section_ids) as string[]) : [],
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
            id, template_id, title, participant_text, session_date, start_time, end_time,
            quick_highlights, detail_level, manual_notes, live_transcript, uploaded_transcript, custom_field_values, excluded_section_ids, output_text,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.templateId,
            record.title,
            record.participantText,
            record.date,
            record.startTime,
            record.endTime,
            record.quickHighlights,
            normalizeDetailLevel(record.detailLevel),
            record.manualNotes,
            record.liveTranscript,
            record.uploadedTranscript,
            JSON.stringify(record.customFieldValues),
            JSON.stringify(record.excludedSectionIds),
            record.output,
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
    return rows.map((row) => JSON.parse(row.payload_json) as TemplateDefinition);
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
    return rows.map((row) => JSON.parse(row.payload_json) as TodoRecord);
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
    const [sessions, templates, todos, attachments, settings] = await Promise.all([
      this.loadSessions(),
      this.loadTemplates(),
      this.loadTodos(),
      this.loadAttachments(),
      this.loadSettings(),
    ]);

    return {
      sessions: sessions.length ? sessions : createDefaultSnapshot().sessions,
      templates: templates.length ? templates : BUILTIN_TEMPLATES,
      todos,
      attachments,
      settings,
    };
  }

  async saveSnapshot(snapshot: DesktopAppSnapshot): Promise<void> {
    await Promise.all([
      this.saveSessions(snapshot.sessions),
      this.saveTemplates(snapshot.templates),
      this.saveTodos(snapshot.todos),
      this.saveAttachments(snapshot.attachments),
      this.saveSettings(snapshot.settings),
    ]);
  }
}

export const createAppRepository = (): AppRepository =>
  isTauriRuntime() ? new TauriSqliteRepository() : new BrowserEntityRepository();

export const createSessionRecord = (templateId: string): SessionRecord => {
  const timestamp = new Date();
  const isoDate = timestamp.toISOString().slice(0, 10);
  const isoTime = timestamp.toTimeString().slice(0, 5);

  return {
    id: crypto.randomUUID(),
    templateId,
    title: "",
    participantText: "",
    date: isoDate,
    startTime: isoTime,
    endTime: isoTime,
    quickHighlights: "",
    detailLevel: 3,
    manualNotes: "",
    liveTranscript: "",
    uploadedTranscript: "",
    customFieldValues: {},
    excludedSectionIds: [],
    output: "",
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
