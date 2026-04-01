import { create } from "zustand";
import { configureAITextCachePersistence, hydrateAITextCache } from "../lib/ai/cache";
import { configureAIRequestHistoryPersistence, hydrateAIRequestHistory } from "../lib/ai/history";
import { createAppRepository, createSessionRecord, upsertSession, upsertTemplate, upsertTodo, } from "../lib/db/repository";
import { loadLegacyBrowserSnapshot } from "../lib/storage/migrateLegacy";
const PERSIST_DEBOUNCE_MS = 300;
let persistTimer = null;
let pendingSnapshot = null;
const logPersistError = (error) => {
    console.error("NoteSmith desktop persistence failed", error);
};
const scheduleSnapshotPersist = (repository, snapshot) => {
    pendingSnapshot = snapshot;
    if (persistTimer) {
        clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
        const snapshotToPersist = pendingSnapshot;
        pendingSnapshot = null;
        persistTimer = null;
        if (!snapshotToPersist)
            return;
        void repository.saveSnapshot(snapshotToPersist).catch(logPersistError);
    }, PERSIST_DEBOUNCE_MS);
};
const flushSnapshotPersist = async (repository, snapshot) => {
    pendingSnapshot = null;
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    await repository.saveSnapshot(snapshot);
};
export const useDesktopStore = create((set, get) => ({
    snapshot: null,
    activeSessionId: null,
    activeView: "capture",
    isLoaded: false,
    loadError: null,
    repository: createAppRepository(),
    load: async () => {
        try {
            const [snapshot, aiTextCache, aiRequestHistory] = await Promise.all([
                get().repository.loadSnapshot(),
                get().repository.loadAITextCache(),
                get().repository.loadAIRequestHistory(),
            ]);
            configureAITextCachePersistence({
                save: (records) => get().repository.saveAITextCache(records),
            });
            configureAIRequestHistoryPersistence({
                save: (records) => get().repository.saveAIRequestHistory(records),
            });
            hydrateAITextCache({ records: aiTextCache });
            hydrateAIRequestHistory(aiRequestHistory);
            set({
                snapshot,
                activeSessionId: snapshot.sessions[0]?.id ?? null,
                isLoaded: true,
                loadError: null,
            });
        }
        catch (error) {
            set({
                snapshot: null,
                activeSessionId: null,
                isLoaded: true,
                loadError: error instanceof Error ? error.message : "Desktop startup failed.",
            });
        }
    },
    setActiveView: (activeView) => set({ activeView }),
    setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
    saveSession: async (payload) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            sessions: upsertSession(snapshot.sessions, {
                ...payload,
                updatedAt: new Date().toISOString(),
            }),
        };
        set({ snapshot: nextSnapshot, activeSessionId: payload.id });
        scheduleSnapshotPersist(get().repository, nextSnapshot);
    },
    createNewSession: async (templateId = get().snapshot?.settings.preferredDesktopTemplateId ?? "meeting") => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSession = createSessionRecord(templateId);
        const nextSnapshot = {
            ...snapshot,
            sessions: [nextSession, ...snapshot.sessions],
        };
        set({ snapshot: nextSnapshot, activeSessionId: nextSession.id, activeView: "capture" });
        await flushSnapshotPersist(get().repository, nextSnapshot);
    },
    deleteSession: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const remainingSessions = snapshot.sessions.filter((session) => session.id !== id);
        if (!remainingSessions.length) {
            const replacement = createSessionRecord(snapshot.settings.preferredDesktopTemplateId || "meeting");
            remainingSessions.push(replacement);
        }
        const nextSnapshot = { ...snapshot, sessions: remainingSessions };
        set({
            snapshot: nextSnapshot,
            activeSessionId: remainingSessions[0]?.id ?? null,
            activeView: get().activeView,
        });
        await flushSnapshotPersist(get().repository, nextSnapshot);
    },
    saveTodo: async (todo) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            todos: upsertTodo(snapshot.todos, todo),
        };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot);
    },
    addTodo: async (description) => {
        const snapshot = get().snapshot;
        if (!snapshot || !description.trim())
            return;
        const nextSnapshot = {
            ...snapshot,
            todos: [
                {
                    id: crypto.randomUUID(),
                    description: description.trim(),
                    isDone: false,
                    comments: "",
                    createdAt: new Date().toISOString(),
                    sessionIds: get().activeSessionId ? [get().activeSessionId].filter((value) => Boolean(value)) : [],
                },
                ...snapshot.todos,
            ],
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot);
    },
    deleteTodo: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = { ...snapshot, todos: snapshot.todos.filter((todo) => todo.id !== id) };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot);
    },
    saveSettings: async (settings) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = { ...snapshot, settings };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot);
    },
    saveTemplate: async (template) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            templates: upsertTemplate(snapshot.templates, template),
        };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot);
    },
    saveAttachments: async (attachments) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = { ...snapshot, attachments };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot);
    },
    importLegacyBrowserData: async () => {
        const migrated = loadLegacyBrowserSnapshot();
        if (!migrated) {
            return "missing";
        }
        set({
            snapshot: migrated,
            activeSessionId: migrated.sessions[0]?.id ?? null,
            activeView: "capture",
        });
        await flushSnapshotPersist(get().repository, migrated);
        return "imported";
    },
}));
