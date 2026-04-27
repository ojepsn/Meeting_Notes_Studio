import type { DesktopAppSnapshot } from "@notesmith/domain";
export type NoteSmithAssistantSourceType = "session" | "todo" | "activity" | "calendar" | "timelog" | "workspace";
export interface NoteSmithAssistantSource {
    id: string;
    type: NoteSmithAssistantSourceType;
    title: string;
    date?: string;
    snippet: string;
    score: number;
    metadata?: Record<string, string | number | boolean>;
}
export interface NoteSmithAssistantSearchOptions {
    query: string;
    includePrivate?: boolean;
    limit?: number;
    sourceTypes?: NoteSmithAssistantSourceType[];
}
export interface NoteSmithAssistantLinkedContext {
    session: NoteSmithAssistantSource | null;
    activity: NoteSmithAssistantSource | null;
    calendarItems: NoteSmithAssistantSource[];
    todos: NoteSmithAssistantSource[];
    timelogs: NoteSmithAssistantSource[];
}
export interface NoteSmithTimelogRangeSummary {
    fromDate: string;
    toDate: string;
    totalMinutes: number;
    totalEntries: number;
    groups: Array<{
        targetType: "todo" | "activity";
        targetId: string;
        title: string;
        totalMinutes: number;
        entryCount: number;
    }>;
    sources: NoteSmithAssistantSource[];
}
export interface NoteSmithCalendarRangeSummary {
    fromDate: string;
    toDate: string;
    totalItems: number;
    meetingCount: number;
    taskCount: number;
    sources: NoteSmithAssistantSource[];
}
export declare const searchNoteSmithData: (snapshot: DesktopAppSnapshot, { query, includePrivate, limit, sourceTypes }: NoteSmithAssistantSearchOptions) => NoteSmithAssistantSource[];
export declare const getNoteSmithTimelogsByDateRange: (snapshot: DesktopAppSnapshot, { fromDate, toDate, includePrivate, limit, }: {
    fromDate: string;
    toDate: string;
    includePrivate?: boolean;
    limit?: number;
}) => NoteSmithTimelogRangeSummary;
export declare const getNoteSmithCalendarItemsByDateRange: (snapshot: DesktopAppSnapshot, { fromDate, toDate, includePrivate, limit, }: {
    fromDate: string;
    toDate: string;
    includePrivate?: boolean;
    limit?: number;
}) => NoteSmithCalendarRangeSummary;
export declare const summarizeNoteSmithWorkspace: (snapshot: DesktopAppSnapshot, includePrivate?: boolean) => NoteSmithAssistantSource;
export declare const getNoteSmithLinkedContext: (snapshot: DesktopAppSnapshot, id: string, includePrivate?: boolean) => NoteSmithAssistantLinkedContext;
export declare const buildAssistantPreviewAnswer: (snapshot: DesktopAppSnapshot, query: string, includePrivate?: boolean) => {
    answer: string;
    sources: NoteSmithAssistantSource[];
};
