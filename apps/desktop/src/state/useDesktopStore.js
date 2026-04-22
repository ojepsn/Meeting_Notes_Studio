import { create } from "zustand";
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_BY_CAPTURE_MODE, getTemplatesForCaptureMode } from "@notesmith/domain";
import { configureAITextCachePersistence, hydrateAITextCache } from "../lib/ai/cache";
import { configureAIRequestHistoryPersistence, hydrateAIRequestHistory } from "../lib/ai/history";
import { createAppRepository, createSessionRecord, upsertActivity, upsertCalendarItem, upsertTimeLog, upsertSession, upsertTemplate, upsertTodo, } from "../lib/db/repository";
import { removePersistedAttachment } from "../lib/files/attachmentStore";
import { findSessionIdForActivity, upsertEntityLink } from "../lib/links/entityLinks";
import { loadLatestLocalSnapshotBackup } from "../lib/storage/desktopStorage";
import { loadLegacyBrowserSnapshot } from "../lib/storage/migrateLegacy";
const PERSIST_DEBOUNCE_MS = 300;
const TRASH_RETENTION_DAYS = 7;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const SLOTS_PER_HOUR = 12;
const MINUTES_PER_SLOT = 5;
const MAX_SLOT_INDEX = 24 * SLOTS_PER_HOUR - 1;
const DEFAULT_MEETING_DURATION_SLOTS = 12;
const OTHER_STRUCTURE_VALUE = "Other";
const formatLocalDate = (value = new Date()) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
};
const formatLocalTime = (value = new Date()) => `${`${value.getHours()}`.padStart(2, "0")}:${`${value.getMinutes()}`.padStart(2, "0")}`;
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
const calculateDurationMinutes = (date, startTime, endTime) => {
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
};
const computeTrackedMinutes = (timeLogs, targetType, targetId) => timeLogs
    .filter((entry) => entry.targetType === targetType && entry.targetId === targetId)
    .reduce((sum, entry) => sum + (Number.isFinite(entry.durationMinutes) ? entry.durationMinutes : 0), 0);
const richTextToPlainText = (value) => {
    if (!value)
        return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
    return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};
const hasMeaningfulSnapshotData = (snapshot) => snapshot.todos.length > 0 ||
    snapshot.activities.length > 0 ||
    snapshot.timelogs.length > 0 ||
    snapshot.calendarItems.length > 0 ||
    snapshot.entityLinks.length > 0 ||
    snapshot.attachments.length > 0 ||
    snapshot.sessions.some((session) => Boolean(session.title.trim()) ||
        Boolean(session.participantText.trim()) ||
        Boolean(session.project.trim()) ||
        Boolean(session.domain.trim()) ||
        Boolean(session.activity.trim()) ||
        Boolean(session.tagsText.trim()) ||
        Boolean(session.quickHighlights.trim()) ||
        Boolean(richTextToPlainText(session.manualNotes)) ||
        Boolean(session.liveTranscript.trim()) ||
        Boolean(session.uploadedTranscript.trim()) ||
        Boolean(session.output.trim()));
const buildTimeLog = (targetType, targetId, overrides) => {
    const now = new Date();
    const date = overrides?.date || formatLocalDate(now);
    const startTime = overrides?.startTime || formatLocalTime(now);
    const endTime = overrides?.endTime || startTime;
    const createdAt = overrides?.createdAt || now.toISOString();
    return {
        id: overrides?.id || crypto.randomUUID(),
        targetType,
        targetId,
        date,
        startTime,
        endTime,
        durationMinutes: overrides?.durationMinutes ?? calculateDurationMinutes(date, startTime, endTime),
        notes: overrides?.notes || "",
        createdAt,
        updatedAt: overrides?.updatedAt || createdAt,
    };
};
const getActivityById = (snapshot, activityId) => snapshot.activities.find((entry) => entry.id === activityId) || null;
const withFallbackValue = (value) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed || OTHER_STRUCTURE_VALUE;
};
const normalizeTodoStructure = (payload) => ({
    ...payload,
    domain: withFallbackValue(payload.domain),
    project: withFallbackValue(payload.project),
    activity: withFallbackValue(payload.activity),
});
const normalizeActivityStructure = (payload) => ({
    ...payload,
    domain: withFallbackValue(payload.domain),
    project: withFallbackValue(payload.project),
    activity: "activity" in payload ? withFallbackValue(payload.activity) : payload.activity,
});
const applyActivityInheritance = (snapshot, payload) => {
    const linkedActivity = payload.activityId ? getActivityById(snapshot, payload.activityId) : null;
    if (!linkedActivity) {
        return normalizeTodoStructure(payload);
    }
    return normalizeTodoStructure({
        ...payload,
        domain: payload.domain || linkedActivity.domain,
        project: payload.project || linkedActivity.project,
        activity: payload.activity || linkedActivity.description,
    });
};
const toSessionIds = (activeSessionId) => activeSessionId ? [activeSessionId].filter((value) => Boolean(value)) : [];
const collectActivityDescendants = (activities, rootActivityId) => {
    const collected = new Set();
    const queue = [rootActivityId];
    while (queue.length) {
        const currentId = queue.shift();
        if (!currentId || collected.has(currentId))
            continue;
        collected.add(currentId);
        activities
            .filter((entry) => entry.parentActivityId === currentId)
            .forEach((entry) => queue.push(entry.id));
    }
    return collected;
};
const recalculateActivitiesWithTimeLogs = (activities, timeLogs) => activities.map((activity) => ({
    ...activity,
    actualTimeSpentMinutes: computeTrackedMinutes(timeLogs, "activity", activity.id),
}));
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
            let [loadedSnapshot, aiTextCache, aiRequestHistory] = await Promise.all([
                get().repository.loadSnapshot(),
                get().repository.loadAITextCache(),
                get().repository.loadAIRequestHistory(),
            ]);
            if (!hasMeaningfulSnapshotData(loadedSnapshot)) {
                const latestBackupSnapshot = await loadLatestLocalSnapshotBackup();
                if (latestBackupSnapshot && hasMeaningfulSnapshotData(latestBackupSnapshot)) {
                    loadedSnapshot = latestBackupSnapshot;
                    await get().repository.saveSnapshot(latestBackupSnapshot);
                }
            }
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
                activities: recalculateActivitiesWithTimeLogs(loadedSnapshot.activities, loadedSnapshot.timelogs),
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
        const normalizedTodo = {
            ...todo,
            ...applyActivityInheritance(snapshot, {
                domain: todo.domain,
                project: todo.project,
                activity: todo.activity,
                activityId: todo.activityId,
            }),
        };
        const nextSnapshot = {
            ...snapshot,
            todos: upsertTodo(snapshot.todos, normalizedTodo),
        };
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
    },
    addTodo: async (description, options) => {
        const snapshot = get().snapshot;
        if (!snapshot || !description.trim())
            return;
        const inherited = applyActivityInheritance(snapshot, {
            activityId: options?.activityId || "",
            domain: options?.domain || "",
            project: options?.project || "",
            activity: options?.activityLabel || "",
        });
        const nextSnapshot = {
            ...snapshot,
            todos: [
                {
                    id: crypto.randomUUID(),
                    description: description.trim(),
                    isDone: false,
                    isPrivate: false,
                    comments: options?.comments || "",
                    activityId: inherited.activityId,
                    domain: inherited.domain,
                    project: inherited.project,
                    activity: inherited.activity,
                    doOn: options?.doOn || "",
                    dueDate: "",
                    detailsHtml: "",
                    createdAt: new Date().toISOString(),
                    sessionIds: toSessionIds(get().activeSessionId),
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
        const nextTimeLogs = snapshot.timelogs.filter((entry) => !(entry.targetType === "todo" && entry.targetId === id));
        const nextSnapshot = {
            ...snapshot,
            todos: snapshot.todos.filter((todo) => todo.id !== id),
            timelogs: nextTimeLogs,
            calendarItems: snapshot.calendarItems.filter((item) => !(item.targetType === "todo" && item.targetId === id)),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    saveActivity: async (activity) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextActivity = normalizeActivityStructure({
            ...activity,
            actualTimeSpentMinutes: computeTrackedMinutes(snapshot.timelogs, "activity", activity.id),
        });
        let nextSnapshot = {
            ...snapshot,
            activities: upsertActivity(snapshot.activities, nextActivity),
        };
        if (nextActivity.type === "meeting") {
            nextSnapshot = syncCalendarItemForMeeting(nextSnapshot, nextActivity);
            nextSnapshot = syncLinkedSessionForMeeting(nextSnapshot, nextActivity);
        }
        set({ snapshot: nextSnapshot });
        scheduleSnapshotPersist(get().repository, nextSnapshot, set);
    },
    addActivity: async (description, type = "task", options) => {
        const snapshot = get().snapshot;
        if (!snapshot || !description.trim())
            return;
        const parentActivity = options?.parentActivityId ? getActivityById(snapshot, options.parentActivityId) : null;
        const nextActivity = normalizeActivityStructure({
            id: crypto.randomUUID(),
            type,
            parentActivityId: options?.parentActivityId || "",
            description: description.trim(),
            isDone: false,
            isPrivate: false,
            comments: options?.comments || "",
            domain: options?.domain || parentActivity?.domain || "",
            project: options?.project || parentActivity?.project || "",
            activity: options?.activityLabel || parentActivity?.description || "",
            doOn: options?.doOn || "",
            dueDate: "",
            startTime: options?.startTime || "",
            endTime: options?.endTime || "",
            detailsHtml: "",
            timeRequiredMinutes: 0,
            actualTimeSpentMinutes: 0,
            createdAt: new Date().toISOString(),
            sessionIds: toSessionIds(get().activeSessionId),
        });
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
        const removedActivityIds = collectActivityDescendants(snapshot.activities, id);
        const removedSessionIds = new Set(snapshot.entityLinks
            .filter((entry) => entry.fromType === "activity" && removedActivityIds.has(entry.fromId))
            .map((entry) => entry.toId));
        const nextSnapshot = {
            ...snapshot,
            activities: snapshot.activities.filter((activity) => !removedActivityIds.has(activity.id)),
            todos: snapshot.todos.filter((todo) => !removedActivityIds.has(todo.activityId)),
            timelogs: snapshot.timelogs.filter((entry) => !((entry.targetType === "activity" && removedActivityIds.has(entry.targetId)) ||
                (entry.targetType === "todo" &&
                    snapshot.todos.some((todo) => todo.id === entry.targetId && removedActivityIds.has(todo.activityId))))),
            calendarItems: snapshot.calendarItems.filter((item) => !((item.targetType === "activity" && removedActivityIds.has(item.targetId)) ||
                (item.targetType === "todo" &&
                    snapshot.todos.some((todo) => todo.id === item.targetId && removedActivityIds.has(todo.activityId))))),
            entityLinks: snapshot.entityLinks.filter((entry) => !((entry.fromType === "activity" && removedActivityIds.has(entry.fromId)) ||
                (entry.toType === "activity" && removedActivityIds.has(entry.toId)) ||
                (entry.toType === "session" && removedSessionIds.has(entry.toId)))),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    saveTimeLog: async (timeLog) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextTimeLog = buildTimeLog(timeLog.targetType, timeLog.targetId, {
            ...timeLog,
            updatedAt: new Date().toISOString(),
        });
        const nextTimeLogs = upsertTimeLog(snapshot.timelogs, nextTimeLog);
        const nextSnapshot = {
            ...snapshot,
            timelogs: nextTimeLogs,
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities, nextTimeLogs),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteTimeLog: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextTimeLogs = snapshot.timelogs.filter((entry) => entry.id !== id);
        const nextSnapshot = {
            ...snapshot,
            timelogs: nextTimeLogs,
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities, nextTimeLogs),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    startTimeTracking: async (targetType, targetId) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const activeOpenLog = snapshot.timelogs.find((entry) => entry.targetType === targetType && entry.targetId === targetId && entry.startTime === entry.endTime);
        if (activeOpenLog) {
            return;
        }
        const nextTimeLog = buildTimeLog(targetType, targetId);
        const nextTimeLogs = [nextTimeLog, ...snapshot.timelogs];
        const nextSnapshot = {
            ...snapshot,
            timelogs: nextTimeLogs,
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities, nextTimeLogs),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    stopTimeTracking: async (targetType, targetId) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const activeOpenLog = snapshot.timelogs.find((entry) => entry.targetType === targetType && entry.targetId === targetId && entry.startTime === entry.endTime);
        if (!activeOpenLog) {
            return;
        }
        const now = new Date();
        const nextEndTime = formatLocalTime(now);
        const nextDate = activeOpenLog.date || formatLocalDate(now);
        const nextTimeLog = {
            ...activeOpenLog,
            endTime: nextEndTime,
            durationMinutes: calculateDurationMinutes(nextDate, activeOpenLog.startTime, nextEndTime),
            updatedAt: now.toISOString(),
        };
        const nextTimeLogs = upsertTimeLog(snapshot.timelogs, nextTimeLog);
        const nextSnapshot = {
            ...snapshot,
            timelogs: nextTimeLogs,
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities, nextTimeLogs),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createCalendarEntryFromText: async (date, startSlot, value, options) => {
        const snapshot = get().snapshot;
        const parsed = options?.kind
            ? { kind: options.kind, description: value.trim() || (options.kind === "meeting" ? "New meeting" : options.kind === "activity" ? "New activity" : "New todo") }
            : parseScheduledText(value);
        if (!snapshot || !parsed)
            return null;
        const createdAt = new Date().toISOString();
        const normalizedSlot = clampSlotIndex(startSlot);
        let nextSnapshot = snapshot;
        let createdCalendarItemId = null;
        if (parsed.kind === "todo") {
            const inherited = applyActivityInheritance(snapshot, {
                activityId: options?.activityId || "",
                domain: "",
                project: "",
                activity: "",
            });
            const todo = {
                id: crypto.randomUUID(),
                description: parsed.description,
                isDone: false,
                isPrivate: false,
                comments: "",
                activityId: options?.activityId || "",
                domain: inherited.domain,
                project: inherited.project,
                activity: inherited.activity,
                doOn: date,
                dueDate: "",
                detailsHtml: "",
                createdAt,
                sessionIds: toSessionIds(get().activeSessionId),
            };
            const normalizedTodo = {
                ...todo,
                ...applyActivityInheritance(snapshot, {
                    activityId: todo.activityId,
                    domain: todo.domain,
                    project: todo.project,
                    activity: todo.activity,
                }),
            };
            createdCalendarItemId = crypto.randomUUID();
            nextSnapshot = {
                ...snapshot,
                todos: [normalizedTodo, ...snapshot.todos],
                calendarItems: upsertCalendarItem(snapshot.calendarItems, {
                    id: createdCalendarItemId,
                    targetType: "todo",
                    targetId: normalizedTodo.id,
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
            const durationSlots = isMeeting
                ? Math.max(1, (typeof options?.endSlot === "number" ? clampSlotIndex(options.endSlot) : normalizedSlot + DEFAULT_MEETING_DURATION_SLOTS) - normalizedSlot)
                : 1;
            const activity = normalizeActivityStructure({
                id: crypto.randomUUID(),
                type: isMeeting ? "meeting" : "task",
                parentActivityId: options?.parentActivityId || options?.activityId || "",
                description: parsed.description,
                isDone: false,
                isPrivate: false,
                comments: "",
                domain: getActivityById(snapshot, options?.activityId || options?.parentActivityId || "")?.domain || "",
                project: getActivityById(snapshot, options?.activityId || options?.parentActivityId || "")?.project || "",
                activity: getActivityById(snapshot, options?.activityId || options?.parentActivityId || "")?.description || "",
                doOn: date,
                dueDate: "",
                startTime: isMeeting ? slotToTime(normalizedSlot) : "",
                endTime: isMeeting ? slotToTime(normalizedSlot + durationSlots) : "",
                detailsHtml: "",
                timeRequiredMinutes: 0,
                actualTimeSpentMinutes: 0,
                createdAt,
                sessionIds: toSessionIds(get().activeSessionId),
            });
            createdCalendarItemId = crypto.randomUUID();
            nextSnapshot = {
                ...snapshot,
                activities: [activity, ...snapshot.activities],
                calendarItems: upsertCalendarItem(snapshot.calendarItems, {
                    id: createdCalendarItemId,
                    targetType: "activity",
                    targetId: activity.id,
                    date,
                    startSlot: normalizedSlot,
                    durationSlots,
                    createdAt,
                    updatedAt: createdAt,
                }),
            };
        }
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
        return createdCalendarItemId;
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
                    startTime: slotToTime(normalizedSlot),
                    endTime: slotToTime(normalizedSlot + durationSlots),
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
                    startTime: slotToTime(normalizedSlot),
                    endTime: slotToTime(normalizedSlot + normalizedDuration),
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
    convertTodoToActivity: async (todo, options) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return null;
        const nextType = options?.type ?? "task";
        const nextDate = options?.date ?? todo.doOn;
        const hasScheduledTime = Boolean(options?.startTime || options?.endTime);
        const nextStartTime = nextType === "meeting" || hasScheduledTime ? options?.startTime || "09:00" : "";
        const nextEndTime = nextType === "meeting" || hasScheduledTime
            ? options?.endTime || slotToTime(timeToSlot(nextStartTime) + DEFAULT_MEETING_DURATION_SLOTS)
            : "";
        const nextStartSlot = nextStartTime ? clampSlotIndex(timeToSlot(nextStartTime)) : null;
        const nextDurationSlots = nextStartTime && nextEndTime ? Math.max(1, timeToSlot(nextEndTime) - timeToSlot(nextStartTime)) : null;
        const nextActivity = {
            id: crypto.randomUUID(),
            type: nextType,
            parentActivityId: "",
            description: todo.description,
            isDone: false,
            isPrivate: todo.isPrivate,
            comments: todo.comments,
            domain: todo.domain,
            project: todo.project,
            activity: todo.activity,
            doOn: nextDate,
            dueDate: todo.dueDate,
            startTime: nextStartTime,
            endTime: nextEndTime,
            detailsHtml: todo.detailsHtml,
            timeRequiredMinutes: 0,
            actualTimeSpentMinutes: computeTrackedMinutes(snapshot.timelogs, "todo", todo.id),
            createdAt: new Date().toISOString(),
            sessionIds: todo.sessionIds,
        };
        let nextSnapshot = {
            ...snapshot,
            todos: snapshot.todos.filter((entry) => entry.id !== todo.id),
            activities: [nextActivity, ...snapshot.activities],
            timelogs: snapshot.timelogs.map((entry) => entry.targetType === "todo" && entry.targetId === todo.id
                ? {
                    ...entry,
                    targetType: "activity",
                    targetId: nextActivity.id,
                    updatedAt: new Date().toISOString(),
                }
                : entry),
            calendarItems: snapshot.calendarItems.map((item) => item.targetType === "todo" && item.targetId === todo.id
                ? {
                    ...item,
                    targetType: "activity",
                    targetId: nextActivity.id,
                    date: nextDate || item.date,
                    startSlot: nextStartSlot ?? item.startSlot,
                    durationSlots: nextDurationSlots ?? item.durationSlots,
                    updatedAt: new Date().toISOString(),
                }
                : item),
        };
        if (nextType === "meeting") {
            nextSnapshot = syncCalendarItemForMeeting(nextSnapshot, nextActivity);
        }
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
        return nextActivity.id;
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
    renameDomainValue: async (previousValue, nextValue) => {
        const snapshot = get().snapshot;
        const previous = previousValue.trim();
        const next = nextValue.trim();
        if (!snapshot || !previous || !next || previous === next)
            return;
        const nextSnapshot = {
            ...snapshot,
            sessions: snapshot.sessions.map((session) => session.domain === previous ? { ...session, domain: next, updatedAt: new Date().toISOString() } : session),
            todos: snapshot.todos.map((todo) => (todo.domain === previous ? { ...todo, domain: next } : todo)),
            activities: snapshot.activities.map((activity) => activity.domain === previous ? { ...activity, domain: next } : activity),
            settings: {
                ...snapshot.settings,
                savedDomains: Array.from(new Set(snapshot.settings.savedDomains.map((entry) => (entry === previous ? next : entry)).concat(next))).sort((left, right) => left.localeCompare(right)),
                projectLinks: snapshot.settings.projectLinks.map((entry) => entry.domain === previous ? { ...entry, domain: next } : entry),
                timeReportPresets: snapshot.settings.timeReportPresets.map((entry) => entry.domain === previous ? { ...entry, domain: next } : entry),
            },
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    renameProjectValue: async (previousValue, nextValue) => {
        const snapshot = get().snapshot;
        const previous = previousValue.trim();
        const next = nextValue.trim();
        if (!snapshot || !previous || !next || previous === next)
            return;
        const nextSnapshot = {
            ...snapshot,
            sessions: snapshot.sessions.map((session) => session.project === previous ? { ...session, project: next, updatedAt: new Date().toISOString() } : session),
            todos: snapshot.todos.map((todo) => (todo.project === previous ? { ...todo, project: next } : todo)),
            activities: snapshot.activities.map((activity) => activity.project === previous ? { ...activity, project: next } : activity),
            settings: {
                ...snapshot.settings,
                savedProjects: Array.from(new Set(snapshot.settings.savedProjects.map((entry) => (entry === previous ? next : entry)).concat(next))).sort((left, right) => left.localeCompare(right)),
                projectLinks: snapshot.settings.projectLinks.map((entry) => entry.project === previous ? { ...entry, project: next } : entry),
                timeReportPresets: snapshot.settings.timeReportPresets.map((entry) => entry.project === previous ? { ...entry, project: next } : entry),
            },
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
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
    importBackupSnapshot: async (snapshot) => {
        const nextSnapshot = {
            ...snapshot,
            sessions: Array.isArray(snapshot.sessions) && snapshot.sessions.length
                ? snapshot.sessions
                : [createSessionRecord(snapshot.settings?.preferredDesktopTemplateId || "meeting", "meeting-note")],
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities ?? [], snapshot.timelogs ?? []),
        };
        set({
            snapshot: nextSnapshot,
            activeSessionId: getFirstActiveSessionId(nextSnapshot.sessions),
            activeView: "capture",
        });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
}));
