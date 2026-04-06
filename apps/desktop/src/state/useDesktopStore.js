import { create } from "zustand";
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_BY_CAPTURE_MODE, getTemplatesForCaptureMode } from "@notesmith/domain";
import { configureAITextCachePersistence, hydrateAITextCache } from "../lib/ai/cache";
import { configureAIRequestHistoryPersistence, hydrateAIRequestHistory } from "../lib/ai/history";
import { createAppRepository, createSessionRecord, upsertActivity, upsertCalendarItem, upsertSession, upsertTemplate, upsertTodo, } from "../lib/db/repository";
import { removePersistedAttachment } from "../lib/files/attachmentStore";
import { findSessionIdForActivity, upsertEntityLink } from "../lib/links/entityLinks";
import { loadLegacyBrowserSnapshot } from "../lib/storage/migrateLegacy";
const PERSIST_DEBOUNCE_MS = 300;
const TRASH_RETENTION_DAYS = 7;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const SLOTS_PER_HOUR = 12;
const MINUTES_PER_SLOT = 5;
const MAX_SLOT_INDEX = 24 * SLOTS_PER_HOUR - 1;
const DEFAULT_MEETING_DURATION_SLOTS = 12;
const clampSlotIndex = (slot) => Math.max(0, Math.min(MAX_SLOT_INDEX, Math.round(slot)));
const timeToSlot = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes))
        return 0;
    return clampSlotIndex(hours * SLOTS_PER_HOUR + Math.floor(minutes / MINUTES_PER_SLOT));
};
const slotToTime = (slot) => {
    const normalized = clampSlotIndex(slot);
    const totalMinutes = normalized * MINUTES_PER_SLOT;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
const durationFromTimes = (startTime, endTime) => {
    const startSlot = timeToSlot(startTime);
    const endSlot = timeToSlot(endTime);
    return Math.max(1, endSlot - startSlot || DEFAULT_MEETING_DURATION_SLOTS);
};
const parseScheduledText = (value) => {
    const trimmed = value.trim();
    const meetMatch = trimmed.match(/^meet\s+(.+)$/i);
    if (meetMatch?.[1]?.trim())
        return { kind: "meeting", description: meetMatch[1].trim() };
    const activityMatch = trimmed.match(/^act\s+(.+)$/i);
    if (activityMatch?.[1]?.trim())
        return { kind: "activity", description: activityMatch[1].trim() };
    const todoMatch = trimmed.match(/^td\s+(.+)$/i);
    if (todoMatch?.[1]?.trim())
        return { kind: "todo", description: todoMatch[1].trim() };
    return trimmed ? { kind: "todo", description: trimmed } : null;
};
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
        startTime: activity.startTime || session.startTime,
        endTime: activity.endTime || session.endTime,
        updatedAt: new Date().toISOString(),
    };
};
const syncLinkedSessionForMeeting = (snapshot, activity) => {
    const linkedSessionId = findSessionIdForActivity(snapshot.entityLinks, activity.id);
    if (!linkedSessionId) {
        return snapshot;
    }
    return {
        ...snapshot,
        sessions: snapshot.sessions.map((session) => session.id === linkedSessionId
            ? {
                ...session,
                title: activity.description || session.title,
                date: activity.doOn || session.date,
                startTime: activity.startTime || session.startTime,
                endTime: activity.endTime || session.endTime,
                updatedAt: new Date().toISOString(),
            }
            : session),
    };
};
const syncCalendarItemForMeeting = (snapshot, activity) => {
    if (activity.type !== "meeting" || !activity.doOn || !activity.startTime) {
        return snapshot;
    }
    const matchingItem = snapshot.calendarItems.find((item) => item.targetType === "activity" && item.targetId === activity.id);
    const startSlot = timeToSlot(activity.startTime);
    const durationSlots = durationFromTimes(activity.startTime, activity.endTime || slotToTime(startSlot + DEFAULT_MEETING_DURATION_SLOTS));
    const nextItem = {
        id: matchingItem?.id ?? crypto.randomUUID(),
        targetType: "activity",
        targetId: activity.id,
        date: activity.doOn,
        startSlot,
        durationSlots,
        createdAt: matchingItem?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    return {
        ...snapshot,
        calendarItems: upsertCalendarItem(snapshot.calendarItems, nextItem),
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
        const nextSnapshot = {
            ...snapshot,
            todos: snapshot.todos.filter((todo) => todo.id !== id),
            calendarItems: snapshot.calendarItems.filter((item) => !(item.targetType === "todo" && item.targetId === id)),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    saveActivity: async (activity) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        let nextSnapshot = {
            ...snapshot,
            activities: upsertActivity(snapshot.activities, activity),
        };
        if (activity.type === "meeting") {
            nextSnapshot = syncCalendarItemForMeeting(nextSnapshot, activity);
            nextSnapshot = syncLinkedSessionForMeeting(nextSnapshot, activity);
        }
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
            startTime: "",
            endTime: "",
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
        const nextSnapshot = {
            ...snapshot,
            activities: snapshot.activities.filter((activity) => activity.id !== id),
            calendarItems: snapshot.calendarItems.filter((item) => !(item.targetType === "activity" && item.targetId === id)),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createCalendarEntryFromText: async (date, startSlot, value) => {
        const snapshot = get().snapshot;
        const parsed = parseScheduledText(value);
        if (!snapshot || !parsed)
            return;
        const createdAt = new Date().toISOString();
        const normalizedSlot = clampSlotIndex(startSlot);
        let nextSnapshot = snapshot;
        if (parsed.kind === "todo") {
            const todo = {
                id: crypto.randomUUID(),
                description: parsed.description,
                isDone: false,
                isPrivate: false,
                comments: "",
                domain: "",
                project: "",
                activity: "",
                doOn: date,
                dueDate: "",
                detailsHtml: "",
                createdAt,
                sessionIds: get().activeSessionId ? [get().activeSessionId].filter((entry) => Boolean(entry)) : [],
            };
            nextSnapshot = {
                ...snapshot,
                todos: [todo, ...snapshot.todos],
                calendarItems: upsertCalendarItem(snapshot.calendarItems, {
                    id: crypto.randomUUID(),
                    targetType: "todo",
                    targetId: todo.id,
                    date,
                    startSlot: normalizedSlot,
                    durationSlots: 1,
                    createdAt,
                    updatedAt: createdAt,
                }),
            };
        }
        else {
            const isMeeting = parsed.kind === "meeting";
            const activity = {
                id: crypto.randomUUID(),
                type: isMeeting ? "meeting" : "task",
                description: parsed.description,
                isDone: false,
                isPrivate: false,
                comments: "",
                domain: "",
                project: "",
                activity: "",
                doOn: date,
                dueDate: "",
                startTime: isMeeting ? slotToTime(normalizedSlot) : "",
                endTime: isMeeting ? slotToTime(normalizedSlot + DEFAULT_MEETING_DURATION_SLOTS) : "",
                detailsHtml: "",
                timeRequiredMinutes: 0,
                actualTimeSpentMinutes: 0,
                createdAt,
                sessionIds: get().activeSessionId ? [get().activeSessionId].filter((entry) => Boolean(entry)) : [],
            };
            nextSnapshot = {
                ...snapshot,
                activities: [activity, ...snapshot.activities],
                calendarItems: upsertCalendarItem(snapshot.calendarItems, {
                    id: crypto.randomUUID(),
                    targetType: "activity",
                    targetId: activity.id,
                    date,
                    startSlot: normalizedSlot,
                    durationSlots: isMeeting ? DEFAULT_MEETING_DURATION_SLOTS : 1,
                    createdAt,
                    updatedAt: createdAt,
                }),
            };
        }
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    moveCalendarItem: async (id, date, startSlot) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const existing = snapshot.calendarItems.find((item) => item.id === id);
        if (!existing)
            return;
        const normalizedSlot = clampSlotIndex(startSlot);
        let nextSnapshot = {
            ...snapshot,
            calendarItems: upsertCalendarItem(snapshot.calendarItems, {
                ...existing,
                date,
                startSlot: normalizedSlot,
                updatedAt: new Date().toISOString(),
            }),
        };
        if (existing.targetType === "todo") {
            const todo = snapshot.todos.find((entry) => entry.id === existing.targetId);
            if (todo) {
                nextSnapshot = {
                    ...nextSnapshot,
                    todos: upsertTodo(nextSnapshot.todos, { ...todo, doOn: date }),
                };
            }
        }
        else {
            const activity = snapshot.activities.find((entry) => entry.id === existing.targetId);
            if (activity) {
                const durationSlots = Math.max(1, existing.durationSlots);
                const nextActivity = {
                    ...activity,
                    doOn: date,
                    startTime: activity.type === "meeting" ? slotToTime(normalizedSlot) : activity.startTime,
                    endTime: activity.type === "meeting"
                        ? slotToTime(normalizedSlot + durationSlots)
                        : activity.endTime,
                };
                nextSnapshot = {
                    ...nextSnapshot,
                    activities: upsertActivity(nextSnapshot.activities, nextActivity),
                };
                if (nextActivity.type === "meeting") {
                    nextSnapshot = syncLinkedSessionForMeeting(nextSnapshot, nextActivity);
                }
            }
        }
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    updateCalendarItem: async (id, updates) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const existing = snapshot.calendarItems.find((item) => item.id === id);
        if (!existing)
            return;
        const normalizedSlot = clampSlotIndex(updates.startSlot);
        const normalizedDuration = Math.max(1, Math.round(updates.durationSlots));
        let nextSnapshot = {
            ...snapshot,
            calendarItems: upsertCalendarItem(snapshot.calendarItems, {
                ...existing,
                date: updates.date,
                startSlot: normalizedSlot,
                durationSlots: normalizedDuration,
                updatedAt: new Date().toISOString(),
            }),
        };
        if (existing.targetType === "todo") {
            const todo = snapshot.todos.find((entry) => entry.id === existing.targetId);
            if (todo) {
                nextSnapshot = {
                    ...nextSnapshot,
                    todos: upsertTodo(nextSnapshot.todos, { ...todo, doOn: updates.date }),
                };
            }
        }
        else {
            const activity = snapshot.activities.find((entry) => entry.id === existing.targetId);
            if (activity) {
                const nextActivity = {
                    ...activity,
                    doOn: updates.date,
                    startTime: activity.type === "meeting" ? slotToTime(normalizedSlot) : activity.startTime,
                    endTime: activity.type === "meeting" ? slotToTime(normalizedSlot + normalizedDuration) : activity.endTime,
                };
                nextSnapshot = {
                    ...nextSnapshot,
                    activities: upsertActivity(nextSnapshot.activities, nextActivity),
                };
                if (nextActivity.type === "meeting") {
                    nextSnapshot = syncLinkedSessionForMeeting(nextSnapshot, nextActivity);
                }
            }
        }
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
            startTime: "",
            endTime: "",
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
            calendarItems: snapshot.calendarItems.map((item) => item.targetType === "todo" && item.targetId === todo.id
                ? {
                    ...item,
                    targetType: "activity",
                    targetId: nextActivity.id,
                    updatedAt: new Date().toISOString(),
                }
                : item),
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
