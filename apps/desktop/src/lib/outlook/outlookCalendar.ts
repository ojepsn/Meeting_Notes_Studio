import type { DesktopAppSnapshot } from "@notesmith/domain";

export interface OutlookCalendarDateTime {
  dateTime: string;
  timeZone?: string;
}

export interface OutlookCalendarEvent {
  id: string;
  iCalUId?: string;
  subject?: string;
  bodyPreview?: string;
  start?: OutlookCalendarDateTime;
  end?: OutlookCalendarDateTime;
  attendees?: Array<{
    emailAddress?: { name?: string; address?: string };
    status?: { response?: string };
    type?: string;
  }>;
  organizer?: { emailAddress?: { name?: string; address?: string } };
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string } | null;
  webLink?: string;
  seriesMasterId?: string;
  changeKey?: string;
  lastModifiedDateTime?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  sensitivity?: string;
  "@removed"?: { reason?: string };
}

export interface OutlookCalendarSyncResult {
  events: OutlookCalendarEvent[];
  fullSync: boolean;
  rangeKey: string;
  syncedAt: string;
}

export interface OutlookCalendarImportSummary {
  created: number;
  updated: number;
  removed: number;
  unchanged: number;
  skipped: number;
}

export interface OutlookCalendarImportBatch extends OutlookCalendarSyncResult {
  accountKey: string;
  fromDate: string;
  toDate: string;
}

type StructureAssignment = { domain: string; project: string; activity: string };

interface ReconcileOptions {
  inferStructure?: (title: string) => StructureAssignment;
  now?: string;
  idFactory?: () => string;
}

const parseGraphDateTime = (value?: string) => {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return {
    date: match[1],
    time: `${match[2]}:${match[3]}`,
    minutes: hours * 60 + minutes,
  };
};

const toSlot = (minutes: number) => Math.max(0, Math.min(287, Math.round(minutes / 5)));

const getDurationSlots = (
  start: ReturnType<typeof parseGraphDateTime>,
  end: ReturnType<typeof parseGraphDateTime>,
) => {
  if (!start || !end) return 12;
  const endMinutes = end.date === start.date ? end.minutes : 1440;
  return Math.max(1, Math.min(288 - toSlot(start.minutes), Math.ceil((endMinutes - start.minutes) / 5)));
};

const getParticipantText = (event: OutlookCalendarEvent) =>
  (event.attendees ?? [])
    .map((attendee) => attendee.emailAddress?.name?.trim() || attendee.emailAddress?.address?.trim() || "")
    .filter(Boolean)
    .join(", ");

const isEventInRange = (date: string, fromDate: string, toDate: string) =>
  Boolean(date) && date >= fromDate && date <= toDate;

const calendarItemForActivity = (snapshot: DesktopAppSnapshot, activityId: string) =>
  snapshot.calendarItems.find((item) => item.targetType === "activity" && item.targetId === activityId) ?? null;

const findExistingActivity = (
  snapshot: DesktopAppSnapshot,
  event: OutlookCalendarEvent,
  accountKey: string,
  date: string,
  startTime: string,
) =>
  snapshot.activities.find(
    (activity) =>
      activity.externalSource === "outlook" &&
      ((activity.externalAccountKey === accountKey && activity.externalEventId === event.id) ||
        (Boolean(event.iCalUId) &&
          activity.externalICalUId === event.iCalUId &&
          activity.doOn === date &&
          activity.startTime === startTime)),
  ) ?? null;

const sourceFingerprint = (activity: DesktopAppSnapshot["activities"][number]) =>
  JSON.stringify({
    description: activity.description,
    participantText: activity.participantText,
    isPrivate: activity.isPrivate,
    doOn: activity.doOn,
    startTime: activity.startTime,
    endTime: activity.endTime,
    externalEventId: activity.externalEventId,
    externalICalUId: activity.externalICalUId,
    externalSeriesMasterId: activity.externalSeriesMasterId,
    externalChangeKey: activity.externalChangeKey,
    externalLastModifiedAt: activity.externalLastModifiedAt,
    externalLocation: activity.externalLocation,
    externalWebLink: activity.externalWebLink,
    externalOnlineMeetingUrl: activity.externalOnlineMeetingUrl,
    externalBodyPreview: activity.externalBodyPreview,
    externalDeletedAt: activity.externalDeletedAt,
  });

export const reconcileOutlookCalendar = (
  snapshot: DesktopAppSnapshot,
  batch: OutlookCalendarImportBatch,
  options: ReconcileOptions = {},
): { snapshot: DesktopAppSnapshot; summary: OutlookCalendarImportSummary } => {
  const timestamp = options.now ?? new Date().toISOString();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  let activities = [...snapshot.activities];
  let calendarItems = [...snapshot.calendarItems];
  const seenExternalIds = new Set<string>();
  const summary: OutlookCalendarImportSummary = { created: 0, updated: 0, removed: 0, unchanged: 0, skipped: 0 };

  const removeImportedActivity = (activityId: string) => {
    const activityIndex = activities.findIndex((activity) => activity.id === activityId);
    if (activityIndex < 0) return;
    const activity = activities[activityIndex];
    if (activity.externalDeletedAt) return;
    activities[activityIndex] = {
      ...activity,
      isDone: true,
      externalDeletedAt: timestamp,
      updatedAt: timestamp,
    };
    calendarItems = calendarItems.filter((item) => !(item.targetType === "activity" && item.targetId === activityId));
    summary.removed += 1;
  };

  batch.events.forEach((event) => {
    if (!event.id) {
      summary.skipped += 1;
      return;
    }
    seenExternalIds.add(event.id);

    const removedActivity = activities.find(
      (activity) =>
        activity.externalSource === "outlook" &&
        activity.externalAccountKey === batch.accountKey &&
        activity.externalEventId === event.id,
    );
    if (event["@removed"] || event.isCancelled) {
      if (removedActivity) removeImportedActivity(removedActivity.id);
      else summary.skipped += 1;
      return;
    }

    const start = parseGraphDateTime(event.start?.dateTime);
    const end = parseGraphDateTime(event.end?.dateTime);
    if (!start) {
      summary.skipped += 1;
      return;
    }
    const title = event.subject?.trim() || "Outlook meeting";
    const existing = findExistingActivity(snapshot, event, batch.accountKey, start.date, start.time);
    const inferred = existing
      ? { domain: existing.domain, project: existing.project, activity: existing.activity }
      : options.inferStructure?.(title) ?? { domain: "Other", project: "Other", activity: "Other" };
    const nextActivity: DesktopAppSnapshot["activities"][number] = {
      id: existing?.id ?? idFactory(),
      type: "meeting",
      parentActivityId: existing?.parentActivityId ?? "",
      description: title,
      participantText: getParticipantText(event),
      isDone: existing?.externalDeletedAt ? false : existing?.isDone ?? false,
      isPrivate: event.sensitivity === "private",
      comments: existing?.comments ?? "",
      domain: inferred.domain || "Other",
      project: inferred.project || "Other",
      activity: inferred.activity || "Other",
      doOn: start.date,
      dueDate: existing?.dueDate ?? "",
      startTime: start.time,
      endTime: end?.time ?? start.time,
      detailsHtml: existing?.detailsHtml ?? "",
      timeRequiredMinutes: existing?.timeRequiredMinutes ?? 0,
      actualTimeSpentMinutes: existing?.actualTimeSpentMinutes ?? 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      sessionIds: existing?.sessionIds ?? [],
      externalSource: "outlook",
      externalAccountKey: batch.accountKey,
      externalEventId: event.id,
      externalICalUId: event.iCalUId ?? existing?.externalICalUId,
      externalSeriesMasterId: event.seriesMasterId ?? "",
      externalChangeKey: event.changeKey ?? "",
      externalLastModifiedAt: event.lastModifiedDateTime ?? "",
      externalLocation: event.location?.displayName?.trim() ?? "",
      externalWebLink: event.webLink ?? "",
      externalOnlineMeetingUrl: event.onlineMeeting?.joinUrl ?? "",
      externalBodyPreview: event.bodyPreview ?? "",
      externalDeletedAt: null,
    };

    const existingIndex = existing ? activities.findIndex((activity) => activity.id === existing.id) : -1;
    if (existingIndex >= 0) {
      if (sourceFingerprint(existing!) === sourceFingerprint(nextActivity)) summary.unchanged += 1;
      else summary.updated += 1;
      activities[existingIndex] = nextActivity;
    } else {
      activities = [nextActivity, ...activities];
      summary.created += 1;
    }

    const existingCalendarItem = calendarItemForActivity({ ...snapshot, calendarItems }, nextActivity.id);
    const nextCalendarItem = {
      id: existingCalendarItem?.id ?? idFactory(),
      targetType: "activity" as const,
      targetId: nextActivity.id,
      date: start.date,
      startSlot: toSlot(start.minutes),
      durationSlots: getDurationSlots(start, end),
      createdAt: existingCalendarItem?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    calendarItems = [nextCalendarItem, ...calendarItems.filter((item) => item.id !== nextCalendarItem.id)];
  });

  if (batch.fullSync) {
    activities
      .filter(
        (activity) =>
          activity.externalSource === "outlook" &&
          !activity.externalDeletedAt &&
          isEventInRange(activity.doOn, batch.fromDate, batch.toDate) &&
          Boolean(activity.externalEventId) &&
          !seenExternalIds.has(activity.externalEventId!),
      )
      .forEach((activity) => removeImportedActivity(activity.id));
  }

  return {
    snapshot: { ...snapshot, activities, calendarItems },
    summary,
  };
};
