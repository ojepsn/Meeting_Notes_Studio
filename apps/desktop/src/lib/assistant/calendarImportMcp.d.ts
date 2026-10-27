import type { OutlookCalendarImportBatch, OutlookCalendarImportSummary } from "../outlook/outlookCalendar";
export declare const CALENDAR_IMPORT_MCP_EVENT = "notesmith-calendar-import-request";
export declare const CHATGPT_OUTLOOK_ACCOUNT_KEY = "chatgpt-outlook-calendar";
export declare const CHATGPT_CALENDAR_WINDOW_DAYS = 7;
export interface CalendarImportMcpReady {
    endpointUrl: string;
    host: string;
    port: number;
    toolName: "notesmith_reconcile_outlook_calendar";
}
export interface ChatGptCalendarEvent {
    externalId: string;
    iCalUId?: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
    attendeeNames?: string[];
    location?: string;
    isPrivate?: boolean;
    isCancelled?: boolean;
    lastModifiedDateTime?: string;
    webLink?: string;
    onlineMeetingUrl?: string;
}
export interface CalendarImportMcpRequest {
    requestId: string;
    events: ChatGptCalendarEvent[];
    completeSnapshot: true;
}
export declare const startCalendarImportMcp: () => Promise<CalendarImportMcpReady>;
export declare const stopCalendarImportMcp: () => Promise<void>;
export declare const getCalendarImportMcpStatus: () => Promise<CalendarImportMcpReady | null>;
export declare const completeCalendarImportMcp: (requestId: string, result: OutlookCalendarImportSummary | null, error?: string) => Promise<void>;
export declare const getChatGptCalendarImportWindow: (now?: Date) => {
    fromDate: string;
    toDate: string;
};
export declare const buildChatGptOutlookImportBatch: (request: CalendarImportMcpRequest, now?: Date) => {
    batch: OutlookCalendarImportBatch;
    rejectedOutsideWindow: number;
};
