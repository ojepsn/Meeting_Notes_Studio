import type { ActivityRecord, CalendarItemRecord, LocalAppSettings, TodoRecord } from "@notesmith/domain";
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
interface CalendarWorkspaceProps {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    timeLogs: import("@notesmith/domain").TimeLogRecord[];
    calendarItems: CalendarItemRecord[];
    settings: LocalAppSettings;
    structureOptions: StructureOptions;
    linkedSessionStateByActivity: Record<string, {
        sessionId: string | null;
        hasOutput: boolean;
        sessionTitle: string;
    }>;
    onSaveSettings: (settings: LocalAppSettings) => void;
    onCreateFromText: (date: string, startSlot: number, value: string, options?: {
        activityId?: string;
        parentActivityId?: string;
        kind?: "todo" | "activity" | "meeting";
        endSlot?: number;
    }) => Promise<string | null> | string | null | void;
    onMoveItem: (id: string, date: string, startSlot: number) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onDeleteTodo: (id: string) => void;
    onSaveActivity: (activity: ActivityRecord) => void;
    onDeleteActivity: (id: string) => void;
    onConvertTodoToActivity: (todo: TodoRecord, options: {
        date: string;
        startTime: string;
        endTime: string;
    }) => void;
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
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenTodoWorkspace: () => void;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityWorkspace: (activityId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
    onOpenSession: (sessionId: string, calendarItemId?: string) => void;
    highlightedItemId?: string | null;
    onCreateLinkedMeetingSession: (activityId: string) => void;
    onPreviewSessionOutput: (sessionId: string) => void;
    onFullScreenChange?: (isFullScreen: boolean) => void;
}
export declare const CalendarWorkspace: ({ todos, activities, timeLogs, calendarItems, settings, structureOptions, linkedSessionStateByActivity, onSaveSettings, onCreateFromText, onMoveItem, onSaveTodo, onDeleteTodo, onSaveActivity, onDeleteActivity, onConvertTodoToActivity, onConvertTodoToMeeting, onUpdateCalendarItem, onStartTracking, onStopTracking, onOpenTodoWorkspace, onOpenTodoDetail, onOpenActivityWorkspace, onOpenActivityDetail, onOpenSession, highlightedItemId, onCreateLinkedMeetingSession, onPreviewSessionOutput, onFullScreenChange, }: CalendarWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
