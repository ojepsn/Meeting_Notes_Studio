import { create } from "zustand";
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_BY_CAPTURE_MODE, getTemplatesForCaptureMode } from "@notesmith/domain";
import { configureAITextCachePersistence, hydrateAITextCache } from "../lib/ai/cache";
import { configureAIRequestHistoryPersistence, hydrateAIRequestHistory } from "../lib/ai/history";
import { createAppRepository, createSessionRecord, upsertActivity, upsertSession, upsertTemplate, upsertTodo, } from "../lib/db/repository";
import { removePersistedAttachment } from "../lib/files/attachmentStore";
import { findSessionIdForActivity, upsertEntityLink } from "../lib/links/entityLinks";
import { loadLegacyBrowserSnapshot } from "../lib/storage/migrateLegacy";
const PERSIST_DEBOUNCE_MS = 300;
const TRASH_RETENTION_DAYS = 7;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const isSessionExpired = (session, nowMs) => {
    if (!session.deletedAt) {
        return false;
    }
    const deletedMs = Date.parse(session.deletedAt);
    if (!Number.isFinite(deletedMs)) {
        return false;
    }
    return nowMs - deletedMs >= TRASH_RETENTION_MS;
};
const getFirstActiveSessionId = (sessions) => sessions.find((session) => !session.deletedAt)?.id ?? null;
const buildLinkedMeetingSession = (activity, preferredTemplateId) => {
    const session = createSessionRecord(preferredTemplateId || "meeting", "meeting-note");
    const meetingDate = activity.doOn || activity.dueDate || session.date;
    return {
        ...session,
        title: activity.description,
        isPrivate: activity.isPrivate,
        project: activity.project,
        domain: activity.domain,
        activity: activity.activity,
        date: meetingDate,
        updatedAt: new Date().toISOString(),
    };
};
let persistTimer = null;
let pendingSnapshot = null;
const logPersistError = (error) => {
    console.error("NoteSmith desktop persistence failed", error);
};
const scheduleSnapshotPersist = (repository, snapshot, setState) => {
    pendingSnapshot = snapshot;
    setState({ saveState: "saving" });
    if (persistTimer) {
        clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
        const snapshotToPersist = pendingSnapshot;
        pendingSnapshot = null;
        persistTimer = null;
        if (!snapshotToPersist)
            return;
        void repository
            .saveSnapshot(snapshotToPersist)
            .then(() => {
            setState({
                saveState: "saved",
                lastSavedAt: new Date().toISOString(),
            });
        })
            .catch((error) => {
            logPersistError(error);
            setState({ saveState: "error" });
        });
    }, PERSIST_DEBOUNCE_MS);
};
const flushSnapshotPersist = async (repository, snapshot, setState) => {
    pendingSnapshot = null;
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    setState({ saveState: "saving" });
    try {
        await repository.saveSnapshot(snapshot);
        setState({
            saveState: "saved",
            lastSavedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        logPersistError(error);
        setState({ saveState: "error" });
        throw error;
    }
};
export const useDesktopStore = create((set, get) => ({
    snapshot: null,
    activeSessionId: null,
    activeView: "capture",
    saveState: "saved",
    lastSavedAt: null,
    isLoaded: false,
    loadError: null,
    repository: createAppRepository(),
    load: async () => {
        try {
            const [loadedSnapshot, aiTextCache, aiRequestHistory] = await Promise.all([
                get().repository.loadSnapshot(),
                get().repository.loadAITextCache(),
                get().repository.loadAIRequestHistory(),
            ]);
            const nowMs = Date.now();
            const expiredSessionIds = new Set(loadedSnapshot.sessions.filter((session) => isSessionExpired(session, nowMs)).map((session) => session.id));
            const remainingSessions = loadedSnapshot.sessions.filter((session) => !expiredSessionIds.has(session.id));
            const removedAttachments = loadedSnapshot.attachments.filter((attachment) => expiredSessionIds.has(attachment.sessionId));
            if (removedAttachments.length) {
                await Promise.all(removedAttachments.map((attachment) => removePersistedAttachment(attachment.filePath)));
            }
            const nextAttachments = loadedSnapshot.attachments.filter((attachment) => !expiredSessionIds.has(attachment.sessionId));
            let snapshot = {
                ...loadedSnapshot,
                sessions: remainingSessions,
                attachments: nextAttachments,
            };
            const activeCandidate = getFirstActiveSessionId(snapshot.sessions);
            if (!snapshot.sessions.length || !activeCandidate) {
                const replacement = createSessionRecord(snapshot.settings.preferredDesktopTemplateId || "meeting", "meeting-note");
                snapshot = {
                    ...snapshot,
                    sessions: [replacement, ...snapshot.sessions],
                };
            }
            if (expiredSessionIds.size) {
                await get().repository.saveSnapshot(snapshot);
            }
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
                activeSessionId: getFirstActiveSessionId(snapshot.sessions),
                isLoaded: true,
                loadError: null,
                saveState: "saved",
                lastSavedAt: new Date().toISOString(),
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
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createNewSession: async (options) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const captureMode = options?.captureMode ?? "meeting-note";
        const matchingTemplates = getTemplatesForCaptureMode(snapshot.templates, captureMode);
        const preferredMeetingTemplateId = captureMode === "meeting-note" &&
            matchingTemplates.some((template) => template.id === snapshot.settings.preferredDesktopTemplateId)
            ? snapshot.settings.preferredDesktopTemplateId
            : null;
        const fallbackTemplateId = preferredMeetingTemplateId ??
            matchingTemplates.find((template) => template.id === DEFAULT_TEMPLATE_BY_CAPTURE_MODE[captureMode])?.id ??
            matchingTemplates[0]?.id ??
            DEFAULT_TEMPLATE_BY_CAPTURE_MODE[captureMode];
        const nextSession = createSessionRecord(options?.templateId ?? fallbackTemplateId, captureMode);
        const nextSnapshot = {
            ...snapshot,
            sessions: [nextSession, ...snapshot.sessions],
        };
        set({ snapshot: nextSnapshot, activeSessionId: nextSession.id, activeView: "capture" });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteSession: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const deletionTimestamp = new Date().toISOString();
        let nextSessions = snapshot.sessions.map((session) => session.id === id
            ? {
                ...session,
                deletedAt: deletionTimestamp,
                updatedAt: deletionTimestamp,
            }
            : session);
        let nextActiveId = get().activeSessionId;
        if (!nextActiveId || nextActiveId === id) {
            const firstActive = getFirstActiveSessionId(nextSessions);
            if (firstActive) {
                nextActiveId = firstActive;
            }
            else {
                const replacement = createSessionRecord(snapshot.settings.preferredDesktopTemplateId || "meeting", "meeting-note");
                nextSessions = [replacement, ...nextSessions];
                nextActiveId = replacement.id;
            }
        }
        const nextSnapshot = { ...snapshot, sessions: nextSessions };
        set({
            snapshot: nextSnapshot,
            activeSessionId: nextActiveId,
            activeView: get().activeView,
        });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    restoreSession: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const restoreTimestamp = new Date().toISOString();
        const nextSnapshot = {
            ...snapshot,
            sessions: snapshot.sessions.map((session) => session.id === id
                ? {
                    ...session,
                    deletedAt: null,
                    updatedAt: restoreTimestamp,
                }
                : session),
        };
        set({ snapshot: nextSnapshot, activeSessionId: id });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    permanentlyDeleteSession: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const removedAttachments = snapshot.attachments.filter((attachment) => attachment.sessionId === id);
        if (removedAttachments.length) {
            await Promise.all(removedAttachments.map((attachment) => removePersistedAttachment(attachment.filePath)));
        }
        let remainingSessions = snapshot.sessions.filter((session) => session.id !== id);
        let nextActiveId = get().activeSessionId;
        if (!remainingSessions.length || !getFirstActiveSessionId(remainingSessions)) {
            const replacement = createSessionRecord(snapshot.settings.preferredDesktopTemplateId || "meeting", "meeting-note");
            remainingSessions = [replacement, ...remainingSessions];
            nextActiveId = replacement.id;
        }
        else if (nextActiveId === id) {
            nextActiveId = getFirstActiveSessionId(remainingSessions);
        }
        const nextSnapshot = {
            ...snapshot,
            sessions: remainingSessions,
            attachments: snapshot.attachments.filter((attachment) => attachment.sessionId !== id),
        };
        set({
            snapshot: nextSnapshot,
            activeSessionId: nextActiveId,
            activeView: get().activeView,
        });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
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
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
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
                    isPrivate: false,
                    comments: "",
                    domain: "",
                    project: "",
                    activity: "",
                    doOn: "",
                    dueDate: "",
                    detailsHtml: "",
                    createdAt: new Date().toISOString(),
                    sessionIds: get().activeSessionId ? [get().activeSessionId].filter((value) => Boolean(value)) : [],
                },
                ...snapshot.todos,
            ],
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteTodo: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = { ...snapshot, todos: snapshot.todos.filter((todo) => todo.id !== id) };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    saveActivity: async (activity) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            activities: upsertActivity(snapshot.activities, activity),
        };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
    },
    addActivity: async (description, type = "task") => {
        const snapshot = get().snapshot;
        if (!snapshot || !description.trim())
            return;
        const nextActivity = {
            id: crypto.randomUUID(),
            type,
            description: description.trim(),
            isDone: false,
            isPrivate: false,
            comments: "",
            domain: "",
            project: "",
            activity: "",
            doOn: "",
            dueDate: "",
            detailsHtml: "",
            timeRequiredMinutes: 0,
            actualTimeSpentMinutes: 0,
            createdAt: new Date().toISOString(),
            sessionIds: get().activeSessionId ? [get().activeSessionId].filter((value) => Boolean(value)) : [],
        };
        const nextSnapshot = {
            ...snapshot,
            activities: [nextActivity, ...snapshot.activities],
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteActivity: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = { ...snapshot, activities: snapshot.activities.filter((activity) => activity.id !== id) };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    convertTodoToActivity: async (todo) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextActivity = {
            id: crypto.randomUUID(),
            type: "task",
            description: todo.description,
            isDone: false,
            isPrivate: todo.isPrivate,
            comments: todo.comments,
            domain: todo.domain,
            project: todo.project,
            activity: todo.activity,
            doOn: todo.doOn,
            dueDate: todo.dueDate,
            detailsHtml: todo.detailsHtml,
            timeRequiredMinutes: 0,
            actualTimeSpentMinutes: 0,
            createdAt: new Date().toISOString(),
            sessionIds: todo.sessionIds,
        };
        const nextSnapshot = {
            ...snapshot,
            todos: snapshot.todos.filter((entry) => entry.id !== todo.id),
            activities: [nextActivity, ...snapshot.activities],
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    ensureSessionForActivity: async (activityId) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return null;
        const activity = snapshot.activities.find((entry) => entry.id === activityId);
        if (!activity)
            return null;
        const existingSessionId = findSessionIdForActivity(snapshot.entityLinks, activityId);
        if (existingSessionId) {
            return existingSessionId;
        }
        const linkedSession = buildLinkedMeetingSession(activity, snapshot.settings.preferredDesktopTemplateId);
        const nextSnapshot = {
            ...snapshot,
            sessions: [linkedSession, ...snapshot.sessions],
            entityLinks: upsertEntityLink(snapshot.entityLinks, {
                id: crypto.randomUUID(),
                fromType: "activity",
                fromId: activity.id,
                toType: "session",
                toId: linkedSession.id,
                relation: "has_session",
                createdAt: new Date().toISOString(),
            }),
        };
        set({ snapshot: nextSnapshot, activeSessionId: linkedSession.id });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
        return linkedSession.id;
    },
    saveSettings: async (settings) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = { ...snapshot, settings };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
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
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
    },
    resetTemplates: async () => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            templates: BUILTIN_TEMPLATES,
            settings: {
                ...snapshot.settings,
                preferredDesktopTemplateId: "meeting",
            },
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    saveAttachments: async (attachments) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = { ...snapshot, attachments };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
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
        await flushSnapshotPersist(get().repository, migrated, set);
        return "imported";
    },
}));
