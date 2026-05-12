import type { ActivityRecord, CalendarItemRecord, ChecklistRecord, LocalAppSettings, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { type StructureOptions } from "../../../lib/structure/options";
declare const DAYS: readonly [3, 5, 7, 14];
export declare const addDays: (date: string, days: number) => string;
export declare const daysBetween: (fromDate: string, toDate: string) => number;
export declare const clampSlot: (slot: number) => number;
export declare const clampPane: (width: number) => number;
export declare const durationFromTimes: (startTime: string, endTime: string) => number;
export declare const slotToTime: (slot: number) => string;
export declare const timeToSlot: (time: string) => number;
export declare const formatDay: (date: string) => string;
export declare const getLocalDateString: (date?: Date) => string;
export declare const initialCalendarScrollTop: (date: Date, slotHeight: number) => number;
export declare const durationLabel: (slots: number) => string;
export declare const dayColumnWidthForView: (daysInView: (typeof DAYS)[number]) => 118 | 156 | 220 | 280;
export declare const layoutCalendarItems: <T extends {
    date: string;
    startSlot: number;
    durationSlots: number;
    title: string;
    lane: number;
    laneCount: number;
}>(items: T[]) => T[];
interface CalendarWorkspaceProps {
    todos: TodoRecord[];
    checklists: ChecklistRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    calendarItems: CalendarItemRecord[];
    settings: LocalAppSettings;
    openRevision?: number;
    structureOptions: StructureOptions;
    linkedSessionStateByActivity: Record<string, {
        sessionId: string | null;
        hasOutput: boolean;
        sessionTitle: string;
    }>;
    linkedSessionStateByTodo: Record<string, {
        sessionId: string | null;
        hasOutput: boolean;
        sessionTitle: string;
    }>;
    savedPeople: string[];
    onSaveSettings: (settings: LocalAppSettings) => void;
    onCreateFromText: (date: string, startSlot: number, value: string, options?: {
        activityId?: string;
        parentActivityId?: string;
        kind?: "todo" | "meeting";
        endSlot?: number;
    }) => Promise<string | null> | string | null | void;
    onMoveItem: (id: string, date: string, startSlot: number) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onDeleteTodo: (id: string) => void;
    onCreateChecklist: (todoId: string, title: string) => void;
    onSaveChecklist: (checklist: ChecklistRecord) => void;
    onDeleteChecklist: (id: string) => void;
    onSaveActivity: (activity: ActivityRecord) => void;
    onDeleteActivity: (id: string) => void;
    onConvertTodoToMeeting: (todo: TodoRecord, options: {
        date: string;
        startTime: string;
        endTime: string;
    }) => void;
    onUpdateCalendarItem: (id: string, updates: {
        date: string;
        startSlot: number;
        durationSlots: number;
    }) => void;
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenTodoWorkspace: () => void;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityWorkspace: (activityId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
    onOpenSession: (sessionId: string, calendarItemId?: string) => void;
    highlightedItemId?: string | null;
    onCreateLinkedMeetingSession: (activityId: string) => void;
    onCreateLinkedTaskSession: (todoId: string) => void;
    onPreviewSessionOutput: (sessionId: string) => void;
    onFullScreenChange?: (isFullScreen: boolean) => void;
}
export declare const CalendarWorkspace: ({ todos, checklists, activities, timeLogs, calendarItems, settings, openRevision, structureOptions, linkedSessionStateByActivity, linkedSessionStateByTodo, savedPeople, onSaveSettings, onCreateFromText, onMoveItem, onSaveTodo, onDeleteTodo, onCreateChecklist, onSaveChecklist, onDeleteChecklist, onSaveActivity, onDeleteActivity, onConvertTodoToMeeting, onUpdateCalendarItem, onSaveTimeLog, onStartTracking, onStopTracking, onOpenTodoWorkspace, onOpenTodoDetail, onOpenActivityWorkspace, onOpenActivityDetail, onOpenSession, highlightedItemId, onCreateLinkedMeetingSession, onCreateLinkedTaskSession, onPreviewSessionOutput, onFullScreenChange, }: CalendarWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
