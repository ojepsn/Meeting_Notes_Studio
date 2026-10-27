import type { DesktopAppSnapshot } from "@notesmith/domain";
export interface OutlookConnectionConfig {
    tenantId: string;
    clientId: string;
}
export interface OutlookDeviceLoginChallenge {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
    message: string;
}
export interface OutlookDeviceLoginResult {
    status: "pending" | "connected" | "expired" | "declined";
    message: string;
}
export interface OutlookConnectionStatus {
    connected: boolean;
}
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
export declare const beginOutlookDeviceLogin: (config: OutlookConnectionConfig) => Promise<OutlookDeviceLoginChallenge>;
export declare const pollOutlookDeviceLogin: (config: OutlookConnectionConfig, deviceCode: string) => Promise<OutlookDeviceLoginResult>;
export declare const getOutlookConnectionStatus: (config: OutlookConnectionConfig) => Promise<OutlookConnectionStatus>;
export declare const disconnectOutlookCalendar: (config: OutlookConnectionConfig) => Promise<void>;
export declare const syncOutlookCalendar: (config: OutlookConnectionConfig, startDateTime: string, endDateTime: string, rangeKey: string) => Promise<OutlookCalendarSyncResult>;
export declare const reconcileOutlookCalendar: (snapshot: DesktopAppSnapshot, batch: OutlookCalendarImportBatch, options?: ReconcileOptions) => {
    snapshot: DesktopAppSnapshot;
    summary: OutlookCalendarImportSummary;
};
export declare const buildOutlookSyncWindow: (today: Date, pastDays: number, futureDays: number) => {
    fromDate: string;
    toDate: string;
    startDateTime: string;
    endDateTime: string;
    rangeKey: string;
};
export declare const buildOutlookAccountKey: (config: OutlookConnectionConfig) => string;
export {};
