import { BUILTIN_TEMPLATES, } from "@notesmith/domain";
import { DEFAULT_GENERATION_RULES, DEFAULT_GENERATION_SYSTEM_PROMPT, DEFAULT_REVISION_RULES, DEFAULT_TRANSLATION_RULES, } from "@notesmith/prompts";
import { isTauriRuntime } from "../storage/environment";
import { sqliteBootstrapStatements } from "./schema";
const STORAGE_KEYS = {
    sessions: "notesmith-desktop-sessions",
    templates: "notesmith-desktop-templates",
    todos: "notesmith-desktop-todos",
    attachments: "notesmith-desktop-attachments",
    settings: "notesmith-desktop-settings",
};
const now = () => new Date().toISOString();
export const createDefaultSettings = () => ({
    theme: "modern-olive",
    outputLanguage: "same",
    preferredDesktopTemplateId: "meeting",
    apiKey: "",
    textModel: "gpt-5-mini",
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
export const createDefaultSnapshot = () => ({
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
            manualNotes: "Talked through current blockers and the April release cut.",
            liveTranscript: "",
            uploadedTranscript: "",
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
const readLocalJson = (key, fallback) => {
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
};
const writeLocalJson = (key, value) => {
    window.localStorage.setItem(key, JSON.stringify(value));
};
class BrowserEntityRepository {
    async loadSessions() {
        return readLocalJson(STORAGE_KEYS.sessions, createDefaultSnapshot().sessions);
    }
    async saveSessions(records) {
        writeLocalJson(STORAGE_KEYS.sessions, records);
    }
    async loadTemplates() {
        return readLocalJson(STORAGE_KEYS.templates, BUILTIN_TEMPLATES);
    }
    async saveTemplates(records) {
        writeLocalJson(STORAGE_KEYS.templates, records);
    }
    async loadTodos() {
        return readLocalJson(STORAGE_KEYS.todos, []);
    }
    async saveTodos(records) {
        writeLocalJson(STORAGE_KEYS.todos, records);
    }
    async loadAttachments() {
        return readLocalJson(STORAGE_KEYS.attachments, []);
    }
    async saveAttachments(records) {
        writeLocalJson(STORAGE_KEYS.attachments, records);
    }
    async loadSettings() {
        return {
            ...createDefaultSettings(),
            ...readLocalJson(STORAGE_KEYS.settings, createDefaultSettings()),
        };
    }
    async saveSettings(record) {
        writeLocalJson(STORAGE_KEYS.settings, record);
    }
    async loadSnapshot() {
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
    async saveSnapshot(snapshot) {
        await Promise.all([
            this.saveSessions(snapshot.sessions),
            this.saveTemplates(snapshot.templates),
            this.saveTodos(snapshot.todos),
            this.saveAttachments(snapshot.attachments),
            this.saveSettings(snapshot.settings),
        ]);
    }
}
class TauriSqliteRepository {
    dbPromise = null;
    async getDb() {
        if (!this.dbPromise) {
            this.dbPromise = (async () => {
                const DatabaseModule = await import("@tauri-apps/plugin-sql");
                const db = await DatabaseModule.default.load("sqlite:notesmith.db");
                await Promise.all(sqliteBootstrapStatements.map((statement) => db.execute(statement)));
                return db;
            })();
        }
        return this.dbPromise;
    }
    async loadSessions() {
        const db = await this.getDb();
        const rows = await db.select("SELECT * FROM sessions ORDER BY updated_at DESC");
        return rows.map((row) => ({
            id: row.id,
            templateId: row.template_id,
            title: row.title,
            participantText: row.participant_text,
            date: row.session_date,
            startTime: row.start_time,
            endTime: row.end_time,
            quickHighlights: row.quick_highlights,
            manualNotes: row.manual_notes,
            liveTranscript: row.live_transcript,
            uploadedTranscript: row.uploaded_transcript,
            output: row.output_text,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    async saveSessions(records) {
        const db = await this.getDb();
        await db.execute("DELETE FROM sessions");
        await Promise.all(records.map((record) => db.execute(`INSERT INTO sessions (
            id, template_id, title, participant_text, session_date, start_time, end_time,
            quick_highlights, manual_notes, live_transcript, uploaded_transcript, output_text,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            record.id,
            record.templateId,
            record.title,
            record.participantText,
            record.date,
            record.startTime,
            record.endTime,
            record.quickHighlights,
            record.manualNotes,
            record.liveTranscript,
            record.uploadedTranscript,
            record.output,
            record.createdAt,
            record.updatedAt,
        ])));
    }
    async loadTemplates() {
        const db = await this.getDb();
        const rows = await db.select("SELECT payload_json FROM templates ORDER BY name ASC");
        if (!rows.length)
            return BUILTIN_TEMPLATES;
        return rows.map((row) => JSON.parse(row.payload_json));
    }
    async saveTemplates(records) {
        const db = await this.getDb();
        await db.execute("DELETE FROM templates");
        await Promise.all(records.map((record) => db.execute("INSERT INTO templates (id, name, kind, payload_json) VALUES (?, ?, ?, ?)", [
            record.id,
            record.name,
            record.kind,
            JSON.stringify(record),
        ])));
    }
    async loadTodos() {
        const db = await this.getDb();
        const rows = await db.select("SELECT payload_json FROM todos ORDER BY created_at DESC");
        return rows.map((row) => JSON.parse(row.payload_json));
    }
    async saveTodos(records) {
        const db = await this.getDb();
        await db.execute("DELETE FROM todos");
        await Promise.all(records.map((record) => db.execute("INSERT INTO todos (id, description, is_done, comments, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)", [record.id, record.description, record.isDone ? 1 : 0, record.comments, record.createdAt, JSON.stringify(record)])));
    }
    async loadAttachments() {
        const db = await this.getDb();
        return db.select("SELECT id, session_id as sessionId, kind, filename, mime_type as mimeType, file_path as filePath, size_bytes as sizeBytes, created_at as createdAt FROM attachments ORDER BY created_at DESC");
    }
    async saveAttachments(records) {
        const db = await this.getDb();
        await db.execute("DELETE FROM attachments");
        await Promise.all(records.map((record) => db.execute("INSERT INTO attachments (id, session_id, kind, filename, mime_type, file_path, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            record.id,
            record.sessionId,
            record.kind,
            record.filename,
            record.mimeType,
            record.filePath,
            record.sizeBytes,
            record.createdAt,
        ])));
    }
    async loadSettings() {
        const db = await this.getDb();
        const rows = await db.select("SELECT value_json FROM settings_local WHERE key = ?", ["settings"]);
        return rows[0]?.value_json
            ? { ...createDefaultSettings(), ...JSON.parse(rows[0].value_json) }
            : createDefaultSettings();
    }
    async saveSettings(record) {
        const db = await this.getDb();
        await db.execute("INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)", ["settings", JSON.stringify(record)]);
    }
    async loadSnapshot() {
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
    async saveSnapshot(snapshot) {
        await Promise.all([
            this.saveSessions(snapshot.sessions),
            this.saveTemplates(snapshot.templates),
            this.saveTodos(snapshot.todos),
            this.saveAttachments(snapshot.attachments),
            this.saveSettings(snapshot.settings),
        ]);
    }
}
export const createAppRepository = () => isTauriRuntime() ? new TauriSqliteRepository() : new BrowserEntityRepository();
export const createSessionRecord = (templateId) => {
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
        manualNotes: "",
        liveTranscript: "",
        uploadedTranscript: "",
        output: "",
        createdAt: now(),
        updatedAt: now(),
    };
};
export const upsertSession = (sessions, nextSession) => sessions.some((session) => session.id === nextSession.id)
    ? sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
    : [nextSession, ...sessions];
export const upsertTemplate = (templates, nextTemplate) => templates.some((template) => template.id === nextTemplate.id)
    ? templates.map((template) => (template.id === nextTemplate.id ? nextTemplate : template))
    : [...templates, nextTemplate];
export const upsertTodo = (todos, nextTodo) => todos.some((todo) => todo.id === nextTodo.id)
    ? todos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo))
    : [nextTodo, ...todos];
