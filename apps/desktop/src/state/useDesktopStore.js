import { create } from "zustand";
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_BY_CAPTURE_MODE, getTemplatesForCaptureMode } from "@notesmith/domain";
import { configureAITextCachePersistence, hydrateAITextCache } from "../lib/ai/cache";
import { configureAIRequestHistoryPersistence, hydrateAIRequestHistory } from "../lib/ai/history";
import { createAppRepository, createSessionRecord, upsertActivity, upsertCalendarItem, upsertTimeLog, upsertSession, upsertTemplate, upsertTodo, } from "../lib/db/repository";
import { normalizeTaskRecord, taskToTodoRecord, todoToTaskRecord } from "../lib/tasks/model";
import { removePersistedAttachment } from "../lib/files/attachmentStore";
import { findSessionIdForActivity, findSessionIdForTodo, upsertEntityLink } from "../lib/links/entityLinks";
import { loadRecentLocalSnapshotBackups } from "../lib/storage/desktopStorage";
import { loadLegacyBrowserSnapshot } from "../lib/storage/migrateLegacy";
import { formatStockholmDate as formatLocalDate, formatStockholmIsoWeek as formatLocalIsoWeek, formatStockholmMonth as formatLocalMonth, formatStockholmTime as formatLocalTime, } from "../lib/time/stockholm";
const PERSIST_DEBOUNCE_MS = 300;
const TRASH_RETENTION_DAYS = 7;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const SLOTS_PER_HOUR = 12;
const MINUTES_PER_SLOT = 5;
const MAX_SLOT_INDEX = 24 * SLOTS_PER_HOUR - 1;
const DEFAULT_MEETING_DURATION_SLOTS = 12;
const ROLLED_TODO_START_SLOT = 8 * SLOTS_PER_HOUR;
const ROLLED_TODO_EARLY_MORNING_ROWS = 24;
const ROLLED_TODO_MAX_PER_ROW = 2;
const OTHER_STRUCTURE_VALUE = "Other";
const BASELINE_WORK_ACTIVITY_LABEL = "Other";
const COMPLETED_TASK_PURGE_DAYS = 90;
const COMPLETED_TASK_PURGE_MS = COMPLETED_TASK_PURGE_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_CHECKLIST_TEMPLATE_CATEGORY = "General";
const DEFAULT_CHECKLIST_RECURRENCE_CADENCE = "monthly";
const stripChecklistDateSuffix = (value) => value.trim().replace(/\s*-\s*(?:\d{4}-\d{2}(?:-\d{2})?|\d{4}-W\d{2})$/, "").trim();
const buildRecurringChecklistPeriodKey = (cadence, value = new Date()) => cadence === "weekly" ? formatLocalIsoWeek(value) : formatLocalMonth(value);
const buildRecurringChecklistTitle = (title, cadence, value = new Date()) => {
    const baseTitle = stripChecklistDateSuffix(title);
    const period = buildRecurringChecklistPeriodKey(cadence, value);
    return baseTitle ? `${baseTitle} - ${period}` : period;
};
const normalizeCompletionState = (previousTodo, nextTodo, timestamp = new Date().toISOString()) => {
    if (nextTodo.isDone) {
        return {
            ...nextTodo,
            completedAt: typeof nextTodo.completedAt === "string" && nextTodo.completedAt
                ? nextTodo.completedAt
                : previousTodo?.completedAt || timestamp,
        };
    }
    return {
        ...nextTodo,
        completedAt: null,
    };
};
const archiveTodoRecord = (archivedTasks, todo, deletedAt = new Date().toISOString()) => {
    const archivedTask = {
        id: todo.id,
        title: todo.description,
        isPrivate: Boolean(todo.isPrivate),
        domain: todo.domain,
        project: todo.project,
        activity: todo.activity,
        activityId: todo.activityId,
        deletedAt,
        originalCreatedAt: todo.createdAt,
        originalCompletedAt: typeof todo.completedAt === "string" ? todo.completedAt : null,
    };
    return archivedTasks.some((entry) => entry.id === archivedTask.id)
        ? archivedTasks.map((entry) => (entry.id === archivedTask.id ? archivedTask : entry))
        : [archivedTask, ...archivedTasks];
};
const applyCompletedTaskCleanup = (snapshot, nowValue = new Date()) => {
    const purgeThreshold = nowValue.getTime() - COMPLETED_TASK_PURGE_MS;
    const purgeableTodos = snapshot.todos.filter((todo) => {
        if (!todo.isDone || !todo.completedAt)
            return false;
        const completedAtMs = Date.parse(todo.completedAt);
        return Number.isFinite(completedAtMs) && completedAtMs <= purgeThreshold;
    });
    if (!purgeableTodos.length)
        return snapshot;
    const purgeableIds = new Set(purgeableTodos.map((todo) => todo.id));
    const deletedAt = nowValue.toISOString();
    return {
        ...snapshot,
        archivedTasks: purgeableTodos.reduce((current, todo) => archiveTodoRecord(current, todo, deletedAt), snapshot.archivedTasks),
        todos: snapshot.todos.filter((todo) => !purgeableIds.has(todo.id)),
        checklists: snapshot.checklists.filter((checklist) => !(checklist.ownerType === "todo" && purgeableIds.has(checklist.ownerId))),
        checklistRecurrences: snapshot.checklistRecurrences.filter((rule) => !(rule.ownerType === "todo" && purgeableIds.has(rule.ownerId))),
        calendarItems: snapshot.calendarItems.filter((item) => !(item.targetType === "todo" && purgeableIds.has(item.targetId))),
        entityLinks: snapshot.entityLinks.filter((entry) => !((entry.fromType === "todo" && purgeableIds.has(entry.fromId)) ||
            (entry.toType === "todo" && purgeableIds.has(entry.toId)))),
    };
};
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
const getRolloverSlots = () => Array.from({ length: ROLLED_TODO_EARLY_MORNING_ROWS }, (_, index) => clampSlotIndex(ROLLED_TODO_START_SLOT + index));
const countOccupiedRolloverSlots = (calendarItems, today, movingItemIds) => {
    const occupancy = new Map();
    calendarItems.forEach((item) => {
        if (item.date !== today || movingItemIds.has(item.id))
            return;
        const duration = Math.max(1, item.durationSlots);
        for (let offset = 0; offset < duration; offset += 1) {
            const slot = clampSlotIndex(item.startSlot + offset);
            occupancy.set(slot, (occupancy.get(slot) ?? 0) + 1);
        }
    });
    return occupancy;
};
const findNextRolloverSlot = (occupancy, maxPerRow) => {
    const preferredSlots = getRolloverSlots();
    const candidate = preferredSlots.find((slot) => (occupancy.get(slot) ?? 0) < maxPerRow);
    if (candidate !== undefined)
        return candidate;
    for (let slot = ROLLED_TODO_START_SLOT + ROLLED_TODO_EARLY_MORNING_ROWS; slot <= MAX_SLOT_INDEX; slot += 1) {
        if ((occupancy.get(slot) ?? 0) < maxPerRow)
            return slot;
    }
    return MAX_SLOT_INDEX;
};
const isCalendarSlotFree = (calendarItems, date, slot) => !calendarItems.some((item) => {
    if (item.date !== date)
        return false;
    const start = clampSlotIndex(item.startSlot);
    const end = Math.min(MAX_SLOT_INDEX + 1, start + Math.max(1, item.durationSlots));
    return slot >= start && slot < end;
});
export const findNearestAvailableTodoSlot = (calendarItems, date, preferredSlot = timeToSlot(formatLocalTime())) => {
    const normalizedPreferredSlot = clampSlotIndex(preferredSlot);
    if (isCalendarSlotFree(calendarItems, date, normalizedPreferredSlot)) {
        return normalizedPreferredSlot;
    }
    for (let distance = 1; distance <= MAX_SLOT_INDEX; distance += 1) {
        const laterSlot = normalizedPreferredSlot + distance;
        if (laterSlot <= MAX_SLOT_INDEX && isCalendarSlotFree(calendarItems, date, laterSlot)) {
            return laterSlot;
        }
        const earlierSlot = normalizedPreferredSlot - distance;
        if (earlierSlot >= 0 && isCalendarSlotFree(calendarItems, date, earlierSlot)) {
            return earlierSlot;
        }
    }
    return normalizedPreferredSlot;
};
export const rollForwardOverdueCalendarTodos = (snapshot, today = formatLocalDate()) => {
    const todosById = new Map(snapshot.todos.map((todo) => [todo.id, todo]));
    const overdueTodoItems = snapshot.calendarItems
        .filter((item) => {
        if (item.targetType !== "todo" || item.date >= today)
            return false;
        const todo = todosById.get(item.targetId);
        return Boolean(todo && !todo.isDone);
    })
        .sort((left, right) => {
        const byDate = left.date.localeCompare(right.date);
        if (byDate !== 0)
            return byDate;
        const bySlot = left.startSlot - right.startSlot;
        if (bySlot !== 0)
            return bySlot;
        const leftTitle = todosById.get(left.targetId)?.description ?? "";
        const rightTitle = todosById.get(right.targetId)?.description ?? "";
        return leftTitle.localeCompare(rightTitle) || left.id.localeCompare(right.id);
    });
    if (!overdueTodoItems.length)
        return { snapshot, changed: false };
    const movingItemIds = new Set(overdueTodoItems.map((item) => item.id));
    const occupancy = countOccupiedRolloverSlots(snapshot.calendarItems, today, movingItemIds);
    const availableSingleRows = getRolloverSlots().filter((slot) => (occupancy.get(slot) ?? 0) === 0).length;
    const maxPerRow = overdueTodoItems.length <= availableSingleRows ? 1 : ROLLED_TODO_MAX_PER_ROW;
    const todayByItemId = new Map();
    overdueTodoItems.forEach((item) => {
        const startSlot = findNextRolloverSlot(occupancy, maxPerRow);
        occupancy.set(startSlot, (occupancy.get(startSlot) ?? 0) + 1);
        todayByItemId.set(item.id, { startSlot });
    });
    const rolloverTimestamp = new Date().toISOString();
    const movedTodoIds = new Set(overdueTodoItems.map((item) => item.targetId));
    const nextCalendarItems = snapshot.calendarItems.map((item) => {
        const movedItem = todayByItemId.get(item.id);
        if (!movedItem)
            return item;
        return {
            ...item,
            date: today,
            startSlot: movedItem.startSlot,
            durationSlots: 1,
            updatedAt: rolloverTimestamp,
        };
    });
    const nextTodos = snapshot.todos.map((todo) => (movedTodoIds.has(todo.id) ? { ...todo, doOn: today } : todo));
    return {
        snapshot: {
            ...snapshot,
            todos: nextTodos,
            calendarItems: nextCalendarItems,
        },
        changed: true,
    };
};
const parseScheduledText = (value) => {
    const trimmed = value.trim();
    const meetMatch = trimmed.match(/^meet\s+(.+)$/i);
    if (meetMatch?.[1]?.trim())
        return { kind: "meeting", description: meetMatch[1].trim() };
    const activityMatch = trimmed.match(/^act\s+(.+)$/i);
    if (activityMatch?.[1]?.trim())
        return { kind: "todo", description: activityMatch[1].trim() };
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
const getClosingTime = (date, startTime, now = new Date()) => {
    const nextEndTime = formatLocalTime(now);
    if (nextEndTime !== startTime)
        return nextEndTime;
    const start = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(start.getTime()))
        return nextEndTime;
    start.setMinutes(start.getMinutes() + 1);
    return formatLocalTime(start);
};
const computeTrackedMinutes = (timeLogs, targetType, targetId) => timeLogs
    .filter((entry) => entry.targetType === targetType && entry.targetId === targetId)
    .reduce((sum, entry) => sum + (Number.isFinite(entry.durationMinutes) ? entry.durationMinutes : 0), 0);
const closeOpenTimeLogs = (timeLogs, now = new Date()) => {
    const updatedAt = now.toISOString();
    let changed = false;
    const nextTimeLogs = timeLogs.map((entry) => {
        if (entry.startTime !== entry.endTime) {
            return entry;
        }
        const nextDate = entry.date || formatLocalDate(now);
        const nextEndTime = getClosingTime(nextDate, entry.startTime, now);
        changed = true;
        return {
            ...entry,
            endTime: nextEndTime,
            durationMinutes: calculateDurationMinutes(nextDate, entry.startTime, nextEndTime),
            updatedAt,
        };
    });
    return { nextTimeLogs, changed };
};
const isOpenTimeLog = (entry) => entry.startTime === entry.endTime;
const ensureBaselineWorkActivity = (snapshot) => {
    const configuredActivity = snapshot.settings.baselineWorkActivityId
        ? snapshot.activities.find((activity) => activity.id === snapshot.settings.baselineWorkActivityId)
        : null;
    if (configuredActivity) {
        return { snapshot, activity: configuredActivity };
    }
    const existingActivity = snapshot.activities.find((activity) => activity.type === "task"
        && activity.description === BASELINE_WORK_ACTIVITY_LABEL
        && activity.domain === OTHER_STRUCTURE_VALUE
        && activity.project === OTHER_STRUCTURE_VALUE
        && activity.activity === OTHER_STRUCTURE_VALUE);
    if (existingActivity) {
        return {
            snapshot: {
                ...snapshot,
                settings: {
                    ...snapshot.settings,
                    baselineWorkActivityId: existingActivity.id,
                },
            },
            activity: existingActivity,
        };
    }
    const createdAt = new Date().toISOString();
    const activity = normalizeActivityStructure({
        id: crypto.randomUUID(),
        type: "task",
        parentActivityId: "",
        description: BASELINE_WORK_ACTIVITY_LABEL,
        isDone: false,
        isPrivate: false,
        comments: "",
        domain: OTHER_STRUCTURE_VALUE,
        project: OTHER_STRUCTURE_VALUE,
        activity: OTHER_STRUCTURE_VALUE,
        doOn: "",
        dueDate: "",
        startTime: "",
        endTime: "",
        detailsHtml: "",
        timeRequiredMinutes: 0,
        actualTimeSpentMinutes: 0,
        createdAt,
        sessionIds: [],
    });
    return {
        snapshot: {
            ...snapshot,
            activities: [activity, ...snapshot.activities],
            settings: {
                ...snapshot.settings,
                baselineWorkActivityId: activity.id,
            },
        },
        activity,
    };
};
const ensureBaselineWorkRunningIfNeeded = (snapshot, now = new Date()) => {
    if (!snapshot.settings.baselineWorkEnabled) {
        return snapshot;
    }
    const { snapshot: snapshotWithActivity, activity } = ensureBaselineWorkActivity(snapshot);
    const openLogs = snapshotWithActivity.timelogs.filter(isOpenTimeLog);
    const baselineIsRunning = openLogs.some((entry) => entry.targetType === "activity" && entry.targetId === activity.id);
    const hasSpecificOpenLog = openLogs.some((entry) => !(entry.targetType === "activity" && entry.targetId === activity.id));
    if (baselineIsRunning || hasSpecificOpenLog) {
        return snapshotWithActivity;
    }
    const baselineLog = buildTimeLog("activity", activity.id, {
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        date: formatLocalDate(now),
    });
    return {
        ...snapshotWithActivity,
        timelogs: [baselineLog, ...snapshotWithActivity.timelogs],
        activities: recalculateActivitiesWithTimeLogs(snapshotWithActivity.activities, [baselineLog, ...snapshotWithActivity.timelogs]),
    };
};
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
const countMeaningfulSessions = (snapshot) => snapshot.sessions.filter((session) => !session.deletedAt &&
    (Boolean(session.title.trim()) ||
        Boolean(session.participantText.trim()) ||
        Boolean(session.project.trim()) ||
        Boolean(session.domain.trim()) ||
        Boolean(session.activity.trim()) ||
        Boolean(session.tagsText.trim()) ||
        Boolean(session.quickHighlights.trim()) ||
        Boolean(richTextToPlainText(session.manualNotes)) ||
        Boolean(session.liveTranscript.trim()) ||
        Boolean(session.uploadedTranscript.trim()) ||
        Boolean(session.output.trim()))).length;
const buildSnapshotRichnessScore = (snapshot) => snapshot.todos.length * 8 +
    snapshot.calendarItems.length * 8 +
    snapshot.sessions.length * 6 +
    snapshot.attachments.length * 5 +
    snapshot.entityLinks.length * 4 +
    snapshot.checklists.length * 4 +
    snapshot.checklistTemplates.length * 2 +
    snapshot.activities.length * 2 +
    snapshot.timelogs.length;
const isSuspiciouslyReducedSnapshot = (snapshot) => {
    const meaningfulSessionCount = countMeaningfulSessions(snapshot);
    return (snapshot.timelogs.length > 0 &&
        snapshot.activities.length > 0 &&
        snapshot.todos.length === 0 &&
        snapshot.calendarItems.length === 0 &&
        snapshot.attachments.length === 0 &&
        snapshot.entityLinks.length === 0 &&
        snapshot.checklists.length === 0 &&
        meaningfulSessionCount <= 1);
};
const selectRecoverySnapshot = async (snapshot) => {
    const currentScore = buildSnapshotRichnessScore(snapshot);
    const backups = await loadRecentLocalSnapshotBackups(12);
    return (backups
        .map((entry) => entry.snapshot)
        .filter((candidate) => hasMeaningfulSnapshotData(candidate))
        .filter((candidate) => !isSuspiciouslyReducedSnapshot(candidate))
        .find((candidate) => buildSnapshotRichnessScore(candidate) > currentScore) ?? null);
};
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
const applySessionStructure = (session, source) => ({
    ...session,
    isPrivate: typeof source.isPrivate === "boolean" ? source.isPrivate : session.isPrivate,
    project: typeof source.project === "string" ? source.project : session.project,
    domain: typeof source.domain === "string" ? source.domain : session.domain,
    activity: typeof source.activity === "string" ? source.activity : session.activity,
});
const buildLinkedMeetingSession = (activity, preferredTemplateId) => {
    const session = createSessionRecord(preferredTemplateId || "meeting", "meeting-note");
    const meetingDate = activity.doOn || activity.dueDate || session.date;
    return {
        ...applySessionStructure(session, activity),
        title: activity.description,
        date: meetingDate,
        startTime: activity.startTime || session.startTime,
        endTime: activity.endTime || session.endTime,
        updatedAt: new Date().toISOString(),
    };
};
const buildLinkedTaskSession = (todo) => {
    const session = createSessionRecord("personal-note", "quick-note");
    const taskDate = todo.doOn || todo.dueDate || session.date;
    return {
        ...applySessionStructure(session, todo),
        title: todo.description,
        date: taskDate,
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
            ? applySessionStructure({
                ...session,
                title: activity.description || session.title,
                date: activity.doOn || session.date,
                startTime: activity.startTime || session.startTime,
                endTime: activity.endTime || session.endTime,
                updatedAt: new Date().toISOString(),
            }, activity)
            : session),
    };
};
const syncLinkedSessionForTodo = (snapshot, todo) => {
    const linkedSessionId = findSessionIdForTodo(snapshot.entityLinks, todo.id);
    if (!linkedSessionId) {
        return snapshot;
    }
    return {
        ...snapshot,
        sessions: snapshot.sessions.map((session) => session.id === linkedSessionId
            ? applySessionStructure({
                ...session,
                title: todo.description || session.title,
                date: todo.doOn || todo.dueDate || session.date,
                updatedAt: new Date().toISOString(),
            }, todo)
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
const buildChecklistRecord = (ownerType, ownerId, title, options) => {
    const timestamp = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        ownerType,
        ownerId,
        title: title.trim(),
        description: "",
        archived: false,
        templateId: options?.templateId ?? null,
        recurrenceRuleId: options?.recurrenceRuleId ?? null,
        recurrenceKey: options?.recurrenceKey ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        items: [],
    };
};
const buildChecklistTemplateRecord = (title, category, items = []) => {
    const timestamp = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        title: stripChecklistDateSuffix(title),
        category: category.trim() || DEFAULT_CHECKLIST_TEMPLATE_CATEGORY,
        description: "",
        createdAt: timestamp,
        updatedAt: timestamp,
        items,
    };
};
const buildChecklistRecurrenceRecord = (ownerType, ownerId, templateId, cadence = DEFAULT_CHECKLIST_RECURRENCE_CADENCE) => {
    const timestamp = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        ownerType,
        ownerId,
        templateId,
        cadence,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastInstantiatedPeriodKey: null,
    };
};
const normalizeChecklist = (checklist) => ({
    ...checklist,
    ownerType: checklist.ownerType === "todo" ? "todo" : "project",
    ownerId: checklist.ownerId.trim(),
    title: checklist.title.trim(),
    description: checklist.description ?? "",
    archived: Boolean(checklist.archived),
    templateId: typeof checklist.templateId === "string" ? checklist.templateId.trim() || null : null,
    recurrenceRuleId: typeof checklist.recurrenceRuleId === "string" ? checklist.recurrenceRuleId.trim() || null : null,
    recurrenceKey: typeof checklist.recurrenceKey === "string" ? checklist.recurrenceKey.trim() || null : null,
    createdAt: checklist.createdAt,
    updatedAt: checklist.updatedAt || new Date().toISOString(),
    items: [...(checklist.items ?? [])]
        .map((item, index) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        label: item.label ?? "",
        notes: item.notes ?? "",
        isChecked: Boolean(item.isChecked),
        position: Number.isFinite(Number(item.position)) ? Number(item.position) : index + 1,
        checkedAt: typeof item.checkedAt === "string" ? item.checkedAt : null,
    }))
        .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label)),
});
const normalizeChecklistTemplate = (template) => ({
    ...template,
    title: template.title.trim(),
    category: template.category?.trim() || DEFAULT_CHECKLIST_TEMPLATE_CATEGORY,
    description: template.description ?? "",
    createdAt: template.createdAt,
    updatedAt: template.updatedAt || new Date().toISOString(),
    items: [...(template.items ?? [])]
        .map((item, index) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        label: item.label ?? "",
        notes: item.notes ?? "",
        isChecked: Boolean(item.isChecked),
        position: Number.isFinite(Number(item.position)) ? Number(item.position) : index + 1,
        checkedAt: typeof item.checkedAt === "string" ? item.checkedAt : null,
    }))
        .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label)),
});
const normalizeChecklistRecurrence = (rule) => ({
    ...rule,
    ownerType: rule.ownerType === "todo" ? "todo" : "project",
    ownerId: rule.ownerId.trim(),
    templateId: rule.templateId.trim(),
    cadence: rule.cadence === "weekly" ? "weekly" : "monthly",
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt || new Date().toISOString(),
    lastInstantiatedPeriodKey: typeof rule.lastInstantiatedPeriodKey === "string" ? rule.lastInstantiatedPeriodKey.trim() || null : null,
});
const upsertChecklist = (checklists, nextChecklist) => checklists.some((checklist) => checklist.id === nextChecklist.id)
    ? checklists.map((checklist) => (checklist.id === nextChecklist.id ? nextChecklist : checklist))
    : [nextChecklist, ...checklists];
const upsertChecklistTemplate = (templates, nextTemplate) => templates.some((template) => template.id === nextTemplate.id)
    ? templates.map((template) => (template.id === nextTemplate.id ? nextTemplate : template))
    : [nextTemplate, ...templates];
const upsertChecklistRecurrence = (rules, nextRule) => rules.some((rule) => rule.id === nextRule.id)
    ? rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
    : [nextRule, ...rules];
const instantiateChecklistFromTemplate = (ownerType, ownerId, template, options) => {
    const cadence = options?.cadence ?? "monthly";
    const recurrenceKey = buildRecurringChecklistPeriodKey(cadence, options?.date);
    const nextChecklist = buildChecklistRecord(ownerType, ownerId, buildRecurringChecklistTitle(template.title, cadence, options?.date), {
        templateId: template.id,
        recurrenceRuleId: options?.recurrenceRuleId ?? null,
        recurrenceKey,
    });
    return {
        ...nextChecklist,
        description: template.description,
        items: template.items.map((item, index) => ({
            ...item,
            id: crypto.randomUUID(),
            isChecked: false,
            checkedAt: null,
            position: index + 1,
        })),
    };
};
const applyRecurringChecklistInstantiation = (snapshot, value = new Date()) => {
    if (!snapshot.checklistRecurrences.length || !snapshot.checklistTemplates.length)
        return snapshot;
    const nextRules = [];
    const nextChecklists = [...snapshot.checklists];
    let changed = false;
    for (const rawRule of snapshot.checklistRecurrences) {
        const rule = normalizeChecklistRecurrence(rawRule);
        const template = snapshot.checklistTemplates.find((entry) => entry.id === rule.templateId);
        if (!template || !rule.ownerId) {
            nextRules.push(rule);
            continue;
        }
        const recurrenceKey = buildRecurringChecklistPeriodKey(rule.cadence, value);
        const alreadyExists = nextChecklists.some((checklist) => checklist.ownerType === rule.ownerType &&
            checklist.ownerId === rule.ownerId &&
            checklist.recurrenceRuleId === rule.id &&
            checklist.recurrenceKey === recurrenceKey);
        const nextRule = {
            ...rule,
            lastInstantiatedPeriodKey: alreadyExists ? recurrenceKey : rule.lastInstantiatedPeriodKey ?? null,
            updatedAt: alreadyExists || rule.lastInstantiatedPeriodKey === recurrenceKey
                ? rule.updatedAt
                : new Date().toISOString(),
        };
        if (nextRule.lastInstantiatedPeriodKey !== rule.lastInstantiatedPeriodKey ||
            nextRule.updatedAt !== rule.updatedAt) {
            changed = true;
        }
        nextRules.push(nextRule);
        if (alreadyExists) {
            continue;
        }
        nextChecklists.unshift(instantiateChecklistFromTemplate(rule.ownerType, rule.ownerId, template, {
            cadence: rule.cadence,
            date: value,
            recurrenceRuleId: rule.id,
        }));
        nextRule.lastInstantiatedPeriodKey = recurrenceKey;
        nextRule.updatedAt = new Date().toISOString();
        changed = true;
    }
    if (!changed) {
        return snapshot;
    }
    return {
        ...snapshot,
        checklists: nextChecklists,
        checklistRecurrences: nextRules,
    };
};
let persistTimer = null;
let pendingSnapshot = null;
const logPersistError = (error) => {
    console.error("NoteSmith desktop persistence failed", error);
};
const scheduleSnapshotPersist = (repository, snapshot, setState) => {
    const nextSnapshot = applyCompletedTaskCleanup(applyRecurringChecklistInstantiation(snapshot));
    pendingSnapshot = nextSnapshot;
    if (nextSnapshot !== snapshot) {
        setState({ snapshot: nextSnapshot });
    }
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
    const nextSnapshot = applyCompletedTaskCleanup(applyRecurringChecklistInstantiation(snapshot));
    if (nextSnapshot !== snapshot) {
        setState({ snapshot: nextSnapshot });
    }
    pendingSnapshot = null;
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    setState({ saveState: "saving" });
    try {
        await repository.saveSnapshot(nextSnapshot);
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
            if (!hasMeaningfulSnapshotData(loadedSnapshot) || isSuspiciouslyReducedSnapshot(loadedSnapshot)) {
                const recoverySnapshot = await selectRecoverySnapshot(loadedSnapshot);
                if (recoverySnapshot) {
                    loadedSnapshot = recoverySnapshot;
                    await get().repository.saveSnapshot(recoverySnapshot);
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
            snapshot = applyRecurringChecklistInstantiation(snapshot);
            snapshot = applyCompletedTaskCleanup(snapshot);
            const rolloverResult = rollForwardOverdueCalendarTodos(snapshot);
            snapshot = rolloverResult.snapshot;
            const activeCandidate = getFirstActiveSessionId(snapshot.sessions);
            if (!snapshot.sessions.length || !activeCandidate) {
                const replacement = createSessionRecord(snapshot.settings.preferredDesktopTemplateId || "meeting", "meeting-note");
                snapshot = {
                    ...snapshot,
                    sessions: [replacement, ...snapshot.sessions],
                };
            }
            if (expiredSessionIds.size || rolloverResult.changed) {
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
        const existingTodo = snapshot.todos.find((entry) => entry.id === todo.id);
        const normalizedTask = normalizeTaskRecord({
            ...todoToTaskRecord(todo),
            ...applyActivityInheritance(snapshot, {
                domain: todo.domain,
                project: todo.project,
                activity: todo.activity,
                activityId: todo.activityId,
            }),
        });
        const nextTodo = normalizeCompletionState(existingTodo, taskToTodoRecord(normalizedTask));
        const nextSnapshot = {
            ...snapshot,
            todos: upsertTodo(snapshot.todos, nextTodo),
        };
        const syncedSnapshot = syncLinkedSessionForTodo(nextSnapshot, nextTodo);
        set({ snapshot: syncedSnapshot });
        scheduleSnapshotPersist(get().repository, syncedSnapshot, set);
    },
    addTodo: async (description, options) => {
        const snapshot = get().snapshot;
        if (!snapshot || !description.trim())
            return;
        const createdAt = new Date().toISOString();
        const scheduledDate = options?.doOn || formatLocalDate();
        const todoId = crypto.randomUUID();
        const calendarItemId = crypto.randomUUID();
        const startSlot = findNearestAvailableTodoSlot(snapshot.calendarItems, scheduledDate);
        const inherited = applyActivityInheritance(snapshot, {
            activityId: options?.activityId || "",
            domain: options?.domain || "",
            project: options?.project || "",
            activity: options?.activityLabel || "",
        });
        const nextTask = normalizeTaskRecord({
            id: todoId,
            description: description.trim(),
            isDone: false,
            completedAt: null,
            isPrivate: false,
            isPriority: false,
            comments: options?.comments || "",
            activityId: inherited.activityId,
            domain: inherited.domain,
            project: inherited.project,
            activity: inherited.activity,
            doOn: scheduledDate,
            dueDate: "",
            detailsHtml: "",
            createdAt,
            sessionIds: toSessionIds(get().activeSessionId),
        });
        const nextSnapshot = {
            ...snapshot,
            todos: [taskToTodoRecord(nextTask), ...snapshot.todos],
            calendarItems: upsertCalendarItem(snapshot.calendarItems, {
                id: calendarItemId,
                targetType: "todo",
                targetId: todoId,
                date: scheduledDate,
                startSlot,
                durationSlots: 1,
                createdAt,
                updatedAt: createdAt,
            }),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteTodo: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const todoToArchive = snapshot.todos.find((todo) => todo.id === id);
        const nextArchivedTasks = todoToArchive
            ? archiveTodoRecord(snapshot.archivedTasks, todoToArchive)
            : snapshot.archivedTasks;
        const nextSnapshot = {
            ...snapshot,
            archivedTasks: nextArchivedTasks,
            todos: snapshot.todos.filter((todo) => todo.id !== id),
            checklists: snapshot.checklists.filter((checklist) => !(checklist.ownerType === "todo" && checklist.ownerId === id)),
            checklistRecurrences: snapshot.checklistRecurrences.filter((rule) => !(rule.ownerType === "todo" && rule.ownerId === id)),
            calendarItems: snapshot.calendarItems.filter((item) => !(item.targetType === "todo" && item.targetId === id)),
            entityLinks: snapshot.entityLinks.filter((entry) => !((entry.fromType === "todo" && entry.fromId === id) ||
                (entry.toType === "todo" && entry.toId === id))),
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
        const todosToArchive = snapshot.todos.filter((todo) => removedActivityIds.has(todo.activityId));
        const removedTodoIds = new Set(todosToArchive.map((todo) => todo.id));
        const removedSessionIds = new Set(snapshot.entityLinks
            .filter((entry) => entry.fromType === "activity" && removedActivityIds.has(entry.fromId))
            .map((entry) => entry.toId));
        const nextArchivedTasks = todosToArchive.reduce((current, todo) => archiveTodoRecord(current, todo), snapshot.archivedTasks);
        const nextSnapshot = {
            ...snapshot,
            archivedTasks: nextArchivedTasks,
            activities: snapshot.activities.filter((activity) => !removedActivityIds.has(activity.id)),
            todos: snapshot.todos.filter((todo) => !removedActivityIds.has(todo.activityId)),
            checklists: snapshot.checklists.filter((checklist) => !(checklist.ownerType === "todo" && removedTodoIds.has(checklist.ownerId))),
            checklistRecurrences: snapshot.checklistRecurrences.filter((rule) => !(rule.ownerType === "todo" && removedTodoIds.has(rule.ownerId))),
            calendarItems: snapshot.calendarItems.filter((item) => !((item.targetType === "activity" && removedActivityIds.has(item.targetId)) ||
                (item.targetType === "todo" &&
                    snapshot.todos.some((todo) => todo.id === item.targetId && removedActivityIds.has(todo.activityId))))),
            entityLinks: snapshot.entityLinks.filter((entry) => !((entry.fromType === "activity" && removedActivityIds.has(entry.fromId)) ||
                (entry.toType === "activity" && removedActivityIds.has(entry.toId)) ||
                (entry.fromType === "todo" && removedTodoIds.has(entry.fromId)) ||
                (entry.toType === "todo" && removedTodoIds.has(entry.toId)) ||
                (entry.toType === "session" && removedSessionIds.has(entry.toId)))),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    saveChecklist: async (checklist) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextChecklist = normalizeChecklist({
            ...checklist,
            updatedAt: new Date().toISOString(),
        });
        const nextSnapshot = {
            ...snapshot,
            checklists: upsertChecklist(snapshot.checklists, nextChecklist),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createChecklist: async (ownerType, ownerId, title) => {
        const snapshot = get().snapshot;
        const nextTitle = title.trim();
        const nextOwnerId = ownerId.trim();
        if (!snapshot || !nextTitle || !nextOwnerId)
            return;
        const nextChecklist = buildChecklistRecord(ownerType, nextOwnerId, nextTitle);
        const nextSnapshot = {
            ...snapshot,
            checklists: [nextChecklist, ...snapshot.checklists],
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteChecklist: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            checklists: snapshot.checklists.filter((checklist) => checklist.id !== id),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    saveChecklistTemplate: async (template) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextTemplate = normalizeChecklistTemplate({
            ...template,
            updatedAt: new Date().toISOString(),
        });
        const nextSnapshot = {
            ...snapshot,
            checklistTemplates: upsertChecklistTemplate(snapshot.checklistTemplates, nextTemplate),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createChecklistTemplate: async (title, category = DEFAULT_CHECKLIST_TEMPLATE_CATEGORY, items = []) => {
        const snapshot = get().snapshot;
        const nextTitle = stripChecklistDateSuffix(title);
        if (!snapshot || !nextTitle)
            return;
        const normalizedItems = items.map((item, index) => ({
            ...item,
            id: item.id || crypto.randomUUID(),
            isChecked: false,
            checkedAt: null,
            position: index + 1,
        }));
        const nextTemplate = buildChecklistTemplateRecord(nextTitle, category, normalizedItems);
        const nextSnapshot = {
            ...snapshot,
            checklistTemplates: [nextTemplate, ...snapshot.checklistTemplates],
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteChecklistTemplate: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            checklistTemplates: snapshot.checklistTemplates.filter((template) => template.id !== id),
            checklistRecurrences: snapshot.checklistRecurrences.filter((rule) => rule.templateId !== id),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createChecklistFromTemplate: async (ownerType, ownerId, templateId) => {
        const snapshot = get().snapshot;
        const nextOwnerId = ownerId.trim();
        if (!snapshot || !nextOwnerId)
            return;
        const template = snapshot.checklistTemplates.find((entry) => entry.id === templateId);
        if (!template)
            return;
        const nextChecklist = normalizeChecklist(instantiateChecklistFromTemplate(ownerType, nextOwnerId, template, {
            cadence: "monthly",
        }));
        const nextSnapshot = {
            ...snapshot,
            checklists: [nextChecklist, ...snapshot.checklists],
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createChecklistRecurrence: async (ownerType, ownerId, templateId, cadence) => {
        const snapshot = get().snapshot;
        const nextOwnerId = ownerId.trim();
        if (!snapshot || !nextOwnerId)
            return;
        const template = snapshot.checklistTemplates.find((entry) => entry.id === templateId);
        if (!template)
            return;
        const existingRule = snapshot.checklistRecurrences.find((rule) => rule.ownerType === ownerType &&
            rule.ownerId === nextOwnerId &&
            rule.templateId === templateId &&
            rule.cadence === cadence);
        const nextRule = existingRule
            ? normalizeChecklistRecurrence({
                ...existingRule,
                updatedAt: new Date().toISOString(),
            })
            : buildChecklistRecurrenceRecord(ownerType, nextOwnerId, templateId, cadence);
        const nextSnapshot = applyRecurringChecklistInstantiation({
            ...snapshot,
            checklistRecurrences: upsertChecklistRecurrence(snapshot.checklistRecurrences, nextRule),
        }, new Date());
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    deleteChecklistRecurrence: async (id) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const nextSnapshot = {
            ...snapshot,
            checklistRecurrences: snapshot.checklistRecurrences.filter((rule) => rule.id !== id),
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
        const now = new Date();
        const { nextTimeLogs: closedTimeLogs } = closeOpenTimeLogs(snapshot.timelogs, now);
        const nextTimeLog = buildTimeLog(targetType, targetId);
        const nextTimeLogs = [nextTimeLog, ...closedTimeLogs];
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
        const nextDate = activeOpenLog.date || formatLocalDate(now);
        const nextEndTime = getClosingTime(nextDate, activeOpenLog.startTime, now);
        const nextTimeLog = {
            ...activeOpenLog,
            endTime: nextEndTime,
            durationMinutes: calculateDurationMinutes(nextDate, activeOpenLog.startTime, nextEndTime),
            updatedAt: now.toISOString(),
        };
        const nextTimeLogs = upsertTimeLog(snapshot.timelogs, nextTimeLog);
        let nextSnapshot = {
            ...snapshot,
            timelogs: nextTimeLogs,
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities, nextTimeLogs),
        };
        const baselineActivityId = snapshot.settings.baselineWorkActivityId;
        const stoppedBaseline = targetType === "activity" &&
            Boolean(baselineActivityId) &&
            targetId === baselineActivityId;
        if (stoppedBaseline) {
            nextSnapshot = {
                ...nextSnapshot,
                settings: {
                    ...nextSnapshot.settings,
                    baselineWorkEnabled: false,
                },
            };
        }
        else {
            nextSnapshot = ensureBaselineWorkRunningIfNeeded(nextSnapshot, now);
        }
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    startWorkBaseline: async () => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const now = new Date();
        const enabledSnapshot = {
            ...snapshot,
            settings: {
                ...snapshot.settings,
                baselineWorkEnabled: true,
            },
        };
        const nextSnapshot = ensureBaselineWorkRunningIfNeeded(enabledSnapshot, now);
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    stopWorkBaseline: async () => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const now = new Date();
        const baselineActivityId = snapshot.settings.baselineWorkActivityId;
        const nextSettings = {
            ...snapshot.settings,
            baselineWorkEnabled: false,
        };
        const openBaselineLog = baselineActivityId
            ? snapshot.timelogs.find((entry) => entry.targetType === "activity" &&
                entry.targetId === baselineActivityId &&
                isOpenTimeLog(entry))
            : null;
        let nextTimeLogs = snapshot.timelogs;
        if (openBaselineLog) {
            const nextDate = openBaselineLog.date || formatLocalDate(now);
            const nextEndTime = getClosingTime(nextDate, openBaselineLog.startTime, now);
            nextTimeLogs = upsertTimeLog(snapshot.timelogs, {
                ...openBaselineLog,
                endTime: nextEndTime,
                durationMinutes: calculateDurationMinutes(nextDate, openBaselineLog.startTime, nextEndTime),
                updatedAt: now.toISOString(),
            });
        }
        const nextSnapshot = {
            ...snapshot,
            settings: nextSettings,
            timelogs: nextTimeLogs,
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities, nextTimeLogs),
        };
        set({ snapshot: nextSnapshot });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
    createCalendarEntryFromText: async (date, startSlot, value, options) => {
        const snapshot = get().snapshot;
        const parsed = options?.kind
            ? { kind: options.kind, description: value.trim() || (options.kind === "meeting" ? "New meeting" : "New task") }
            : parseScheduledText(value);
        if (!snapshot || !parsed)
            return null;
        const createdAt = new Date().toISOString();
        const normalizedSlot = clampSlotIndex(startSlot);
        let nextSnapshot = snapshot;
        let createdCalendarItemId = null;
        if (parsed.kind !== "meeting") {
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
                completedAt: null,
                isPrivate: false,
                isPriority: false,
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
            const normalizedTodo = taskToTodoRecord(normalizeTaskRecord({
                ...todoToTaskRecord(todo),
                ...applyActivityInheritance(snapshot, {
                    activityId: todo.activityId,
                    domain: todo.domain,
                    project: todo.project,
                    activity: todo.activity,
                }),
            }));
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
            const durationSlots = Math.max(1, (typeof options?.endSlot === "number" ? clampSlotIndex(options.endSlot) : normalizedSlot + DEFAULT_MEETING_DURATION_SLOTS) - normalizedSlot);
            const activity = normalizeActivityStructure({
                id: crypto.randomUUID(),
                type: "meeting",
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
                startTime: slotToTime(normalizedSlot),
                endTime: slotToTime(normalizedSlot + durationSlots),
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
    rollForwardOverdueTodos: async () => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return;
        const rolloverResult = rollForwardOverdueCalendarTodos(snapshot);
        if (!rolloverResult.changed)
            return;
        set({ snapshot: rolloverResult.snapshot });
        await flushSnapshotPersist(get().repository, rolloverResult.snapshot, set);
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
    ensureSessionForTodo: async (todoId) => {
        const snapshot = get().snapshot;
        if (!snapshot)
            return null;
        const todo = snapshot.todos.find((entry) => entry.id === todoId);
        if (!todo)
            return null;
        const existingSessionId = findSessionIdForTodo(snapshot.entityLinks, todoId);
        if (existingSessionId) {
            return existingSessionId;
        }
        const linkedSession = buildLinkedTaskSession(todo);
        const nextSnapshot = {
            ...snapshot,
            sessions: [linkedSession, ...snapshot.sessions],
            entityLinks: upsertEntityLink(snapshot.entityLinks, {
                id: crypto.randomUUID(),
                fromType: "todo",
                fromId: todo.id,
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
            checklists: snapshot.checklists.map((checklist) => checklist.ownerType === "project" && checklist.ownerId === previous
                ? { ...checklist, ownerId: next, updatedAt: new Date().toISOString() }
                : checklist),
            checklistRecurrences: snapshot.checklistRecurrences.map((rule) => rule.ownerType === "project" && rule.ownerId === previous
                ? { ...rule, ownerId: next, updatedAt: new Date().toISOString() }
                : rule),
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
        const nextSnapshot = applyCompletedTaskCleanup({
            ...snapshot,
            sessions: Array.isArray(snapshot.sessions) && snapshot.sessions.length
                ? snapshot.sessions
                : [createSessionRecord(snapshot.settings?.preferredDesktopTemplateId || "meeting", "meeting-note")],
            todos: Array.isArray(snapshot.todos) ? snapshot.todos.map((todo) => normalizeTaskRecord(todoToTaskRecord(todo))) : [],
            checklists: Array.isArray(snapshot.checklists) ? snapshot.checklists.map((checklist) => normalizeChecklist(checklist)) : [],
            checklistTemplates: Array.isArray(snapshot.checklistTemplates)
                ? snapshot.checklistTemplates.map((template) => normalizeChecklistTemplate(template))
                : [],
            checklistRecurrences: Array.isArray(snapshot.checklistRecurrences)
                ? snapshot.checklistRecurrences.map((rule) => normalizeChecklistRecurrence(rule))
                : [],
            archivedTasks: Array.isArray(snapshot.archivedTasks) ? snapshot.archivedTasks : [],
            activities: recalculateActivitiesWithTimeLogs(snapshot.activities ?? [], snapshot.timelogs ?? []),
        });
        set({
            snapshot: nextSnapshot,
            activeSessionId: getFirstActiveSessionId(nextSnapshot.sessions),
            activeView: "capture",
        });
        await flushSnapshotPersist(get().repository, nextSnapshot, set);
    },
}));
