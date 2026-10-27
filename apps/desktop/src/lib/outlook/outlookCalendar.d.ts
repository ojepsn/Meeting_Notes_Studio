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
        emailAddress?: {
            name?: string;
            address?: string;
        };
        status?: {
            response?: string;
        };
        type?: string;
    }>;
    organizer?: {
        emailAddress?: {
            name?: string;
            address?: string;
        };
    };
    location?: {
        displayName?: string;
    };
    onlineMeeting?: {
        joinUrl?: string;
    } | null;
    webLink?: string;
    seriesMasterId?: string;
    changeKey?: string;
    lastModifiedDateTime?: string;
    isAllDay?: boolean;
    isCancelled?: boolean;
    sensitivity?: string;
    "@removed"?: {
        reason?: string;
    };
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
type StructureAssignment = {
    domain: string;
    project: string;
    activity: string;
};
interface ReconcileOptions {
    inferStructure?: (title: string) => StructureAssignment;
    now?: string;
    idFactory?: () => string;
}
export declare const reconcileOutlookCalendar: (snapshot: DesktopAppSnapshot, batch: OutlookCalendarImportBatch, options?: ReconcileOptions) => {
    snapshot: DesktopAppSnapshot;
    summary: OutlookCalendarImportSummary;
};
export {};
