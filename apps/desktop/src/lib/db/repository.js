import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_BY_CAPTURE_MODE, getPrimaryCaptureMode, } from "@notesmith/domain";
import { DEFAULT_MEETING_MINUTES_RULES, DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT, DEFAULT_PERSONAL_NOTES_RULES, DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT, DEFAULT_REVISION_RULES, DEFAULT_TRANSLATION_RULES, } from "@notesmith/prompts";
import { normalizeAIModelPricingSnapshot, normalizeTextModelId, normalizeTranscriptionModelId, } from "../ai/modelPricing";
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
const normalizeDetailLevel = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return 3;
    return Math.min(5, Math.max(1, Math.round(parsed)));
};
const normalizeSessionRecord = (session) => ({
    ...session,
    captureMode: session.captureMode === "quick-note" || session.captureMode === "voice-note" ? session.captureMode : "meeting-note",
    isPrivate: Boolean(session.isPrivate),
    deletedAt: typeof session.deletedAt === "string" ? session.deletedAt : null,
    project: typeof session.project === "string" ? session.project : "",
    domain: typeof session.domain === "string" ? session.domain : "",
    activity: typeof session.activity === "string" ? session.activity : "",
    tagsText: typeof session.tagsText === "string" ? session.tagsText : "",
    detailLevel: normalizeDetailLevel(session.detailLevel),
    customFieldValues: session.customFieldValues && typeof session.customFieldValues === "object" ? session.customFieldValues : {},
    excludedSectionIds: Array.isArray(session.excludedSectionIds) ? session.excludedSectionIds : [],
});
const normalizeAttachmentRecord = (attachment) => ({
    ...attachment,
    caption: typeof attachment.caption === "string" ? attachment.caption : "",
    includeInOutput: Boolean(attachment.includeInOutput),
    outputPosition: Number.isFinite(Number(attachment.outputPosition)) ? Number(attachment.outputPosition) : 0,
});
const normalizeTemplateRecord = (template) => ({
    ...(BUILTIN_TEMPLATES.find((entry) => entry.id === template.id) ?? {}),
    ...template,
    kind: (BUILTIN_TEMPLATES.find((entry) => entry.id === template.id)?.kind ?? template.kind),
    captureModes: [getPrimaryCaptureMode(BUILTIN_TEMPLATES.find((entry) => entry.id === template.id) ?? template)],
});
export const createDefaultSettings = () => ({
    theme: "fluent-slate-light",
    outputLanguage: "same",
    preferredDesktopTemplateId: "meeting",
    captureWorkspaceDensity: "full",
    apiKey: "",
    textModel: "gpt-5.4-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    savedParticipants: [],
    savedProjects: [],
    savedDomains: [],
    savedActivities: [],
    savedTags: [],
    abbreviations: [],
    promptProfile: {
        meetingMinutesSystem: DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
        meetingMinutesRules: DEFAULT_MEETING_MINUTES_RULES,
        personalNotesSystem: DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
        personalNotesRules: DEFAULT_PERSONAL_NOTES_RULES,
        revisionRules: DEFAULT_REVISION_RULES,
        translationRules: DEFAULT_TRANSLATION_RULES,
        extraBlocks: [],
    },
});
const normalizePromptProfile = (promptProfile) => {
    const defaults = createDefaultSettings().promptProfile;
    const legacyPromptProfile = promptProfile;
    return {
        ...defaults,
        ...(promptProfile || {}),
        meetingMinutesSystem: promptProfile?.meetingMinutesSystem?.trim() ||
            legacyPromptProfile?.generationSystem?.trim() ||
            defaults.meetingMinutesSystem,
        meetingMinutesRules: promptProfile?.meetingMinutesRules?.trim() ||
            legacyPromptProfile?.generationRules?.trim() ||
            defaults.meetingMinutesRules,
        personalNotesSystem: promptProfile?.personalNotesSystem?.trim() || defaults.personalNotesSystem,
        personalNotesRules: promptProfile?.personalNotesRules?.trim() || defaults.personalNotesRules,
        revisionRules: promptProfile?.revisionRules?.trim() || defaults.revisionRules,
        translationRules: promptProfile?.translationRules?.trim() || defaults.translationRules,
        extraBlocks: Array.isArray(promptProfile?.extraBlocks) ? promptProfile.extraBlocks : [],
    };
};
export const createDefaultSnapshot = () => ({
    sessions: [
        {
            id: crypto.randomUUID(),
            captureMode: "meeting-note",
            templateId: "meeting",
            title: "2026-03-30 Weekly team sync",
            isPrivate: false,
            deletedAt: null,
            participantText: "Anna, Marcus, Ola",
            project: "Alpha",
            domain: "Product",
            activity: "Release planning",
            tagsText: "release, weekly-sync",
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
const normalizeSettings = (settings) => ({
    ...createDefaultSettings(),
    ...settings,
    captureWorkspaceDensity: settings.captureWorkspaceDensity === "minimal" ? "minimal" : "full",
    textModel: normalizeTextModelId(settings.textModel),
    transcriptionModel: normalizeTranscriptionModelId(settings.transcriptionModel),
    promptProfile: normalizePromptProfile(settings.promptProfile),
});
class BrowserEntityRepository {
    async loadSessions() {
        return readLocalJson(STORAGE_KEYS.sessions, createDefaultSnapshot().sessions).map(normalizeSessionRecord);
    }
    async saveSessions(records) {
        writeLocalJson(STORAGE_KEYS.sessions, records);
    }
    async loadTemplates() {
        return readLocalJson(STORAGE_KEYS.templates, BUILTIN_TEMPLATES).map(normalizeTemplateRecord);
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
        return readLocalJson(STORAGE_KEYS.attachments, []).map(normalizeAttachmentRecord);
    }
    async saveAttachments(records) {
        writeLocalJson(STORAGE_KEYS.attachments, records);
    }
    async loadSettings() {
        return normalizeSettings(readLocalJson(STORAGE_KEYS.settings, createDefaultSettings()));
    }
    async saveSettings(record) {
        writeLocalJson(STORAGE_KEYS.settings, record);
    }
    async loadAITextCache() {
        return readLocalJson(STORAGE_KEYS.aiTextCache, []);
    }
    async saveAITextCache(records) {
        writeLocalJson(STORAGE_KEYS.aiTextCache, records);
    }
    async loadAIRequestHistory() {
        return readLocalJson(STORAGE_KEYS.aiRequestHistory, []);
    }
    async saveAIRequestHistory(records) {
        writeLocalJson(STORAGE_KEYS.aiRequestHistory, records);
    }
    async loadAIModelPricing() {
        return normalizeAIModelPricingSnapshot(readLocalJson(STORAGE_KEYS.aiModelPricing, null));
    }
    async saveAIModelPricing(snapshot) {
        writeLocalJson(STORAGE_KEYS.aiModelPricing, snapshot);
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
            templates: templates.length ? templates : BUILTIN_TEMPLATES.map(normalizeTemplateRecord),
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
                await db.execute("ALTER TABLE sessions ADD COLUMN detail_level INTEGER NOT NULL DEFAULT 3").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN custom_field_values TEXT NOT NULL DEFAULT '{}'").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN excluded_section_ids TEXT NOT NULL DEFAULT '[]'").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN capture_mode TEXT NOT NULL DEFAULT 'meeting-note'").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN project TEXT NOT NULL DEFAULT ''").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN domain TEXT NOT NULL DEFAULT ''").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN activity TEXT NOT NULL DEFAULT ''").catch(() => { });
                await db.execute("ALTER TABLE sessions ADD COLUMN tags_text TEXT NOT NULL DEFAULT ''").catch(() => { });
                await db.execute("ALTER TABLE attachments ADD COLUMN caption TEXT NOT NULL DEFAULT ''").catch(() => { });
                await db.execute("ALTER TABLE attachments ADD COLUMN include_in_output INTEGER NOT NULL DEFAULT 0").catch(() => { });
                await db.execute("ALTER TABLE attachments ADD COLUMN output_position INTEGER NOT NULL DEFAULT 0").catch(() => { });
                return db;
            })();
        }
        return this.dbPromise;
    }
    async loadSessions() {
        const db = await this.getDb();
        const rows = await db.select("SELECT * FROM sessions ORDER BY updated_at DESC");
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
            date: row.session_date,
            startTime: row.start_time,
            endTime: row.end_time,
            quickHighlights: row.quick_highlights,
            detailLevel: row.detail_level,
            manualNotes: row.manual_notes,
            liveTranscript: row.live_transcript,
            uploadedTranscript: row.uploaded_transcript,
            customFieldValues: row.custom_field_values ? JSON.parse(row.custom_field_values) : {},
            excludedSectionIds: row.excluded_section_ids ? JSON.parse(row.excluded_section_ids) : [],
            output: row.output_text,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    async saveSessions(records) {
        const db = await this.getDb();
        await db.execute("DELETE FROM sessions");
        await Promise.all(records.map((record) => db.execute(`INSERT INTO sessions (
            id, template_id, title, deleted_at, is_private, participant_text, project, domain, activity, tags_text, session_date, start_time, end_time,
            quick_highlights, detail_level, capture_mode, manual_notes, live_transcript, uploaded_transcript, custom_field_values, excluded_section_ids, output_text,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            record.date,
            record.startTime,
            record.endTime,
            record.quickHighlights,
            normalizeDetailLevel(record.detailLevel),
            record.captureMode,
            record.manualNotes,
            record.liveTranscript,
            record.uploadedTranscript,
            JSON.stringify(record.customFieldValues),
            JSON.stringify(record.excludedSectionIds),
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
        return rows.map((row) => normalizeTemplateRecord(JSON.parse(row.payload_json)));
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
        const rows = await db.select("SELECT id, session_id as sessionId, kind, filename, mime_type as mimeType, file_path as filePath, size_bytes as sizeBytes, caption, include_in_output as includeInOutput, output_position as outputPosition, created_at as createdAt FROM attachments ORDER BY created_at DESC");
        return rows.map(normalizeAttachmentRecord);
    }
    async saveAttachments(records) {
        const db = await this.getDb();
        await db.execute("DELETE FROM attachments");
        await Promise.all(records.map((record) => db.execute("INSERT INTO attachments (id, session_id, kind, filename, mime_type, file_path, size_bytes, caption, include_in_output, output_position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
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
        ])));
    }
    async loadSettings() {
        const db = await this.getDb();
        const rows = await db.select("SELECT value_json FROM settings_local WHERE key = ?", ["settings"]);
        return rows[0]?.value_json
            ? normalizeSettings(JSON.parse(rows[0].value_json))
            : createDefaultSettings();
    }
    async saveSettings(record) {
        const db = await this.getDb();
        await db.execute("INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)", ["settings", JSON.stringify(record)]);
    }
    async loadAITextCache() {
        const db = await this.getDb();
        const rows = await db.select("SELECT value_json FROM settings_local WHERE key = ?", ["ai-text-cache"]);
        return rows[0]?.value_json
            ? JSON.parse(rows[0].value_json)
            : [];
    }
    async saveAITextCache(records) {
        const db = await this.getDb();
        await db.execute("INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)", ["ai-text-cache", JSON.stringify(records)]);
    }
    async loadAIRequestHistory() {
        const db = await this.getDb();
        const rows = await db.select("SELECT value_json FROM settings_local WHERE key = ?", ["ai-request-history"]);
        return rows[0]?.value_json
            ? JSON.parse(rows[0].value_json)
            : [];
    }
    async saveAIRequestHistory(records) {
        const db = await this.getDb();
        await db.execute("INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)", ["ai-request-history", JSON.stringify(records)]);
    }
    async loadAIModelPricing() {
        const db = await this.getDb();
        const rows = await db.select("SELECT value_json FROM settings_local WHERE key = ?", ["ai-model-pricing"]);
        return rows[0]?.value_json
            ? normalizeAIModelPricingSnapshot(JSON.parse(rows[0].value_json))
            : null;
    }
    async saveAIModelPricing(snapshot) {
        const db = await this.getDb();
        await db.execute("INSERT OR REPLACE INTO settings_local (key, value_json) VALUES (?, ?)", ["ai-model-pricing", JSON.stringify(snapshot)]);
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
            templates: templates.length ? templates : BUILTIN_TEMPLATES.map(normalizeTemplateRecord),
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
export const createSessionRecord = (templateId, captureMode = "meeting-note") => {
    const timestamp = new Date();
    const isoDate = timestamp.toISOString().slice(0, 10);
    const isoTime = timestamp.toTimeString().slice(0, 5);
    const defaultTitle = captureMode === "meeting-note"
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
export const upsertSession = (sessions, nextSession) => sessions.some((session) => session.id === nextSession.id)
    ? sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
    : [nextSession, ...sessions];
export const upsertTemplate = (templates, nextTemplate) => templates.some((template) => template.id === nextTemplate.id)
    ? templates.map((template) => (template.id === nextTemplate.id ? nextTemplate : template))
    : [...templates, nextTemplate];
export const upsertTodo = (todos, nextTodo) => todos.some((todo) => todo.id === nextTodo.id)
    ? todos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo))
    : [nextTodo, ...todos];
