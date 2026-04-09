import type { ActivityRecord, CalendarItemRecord, LocalAppSettings, TodoRecord } from "@notesmith/domain";
declare const DAYS: readonly [3, 5, 7, 14];
export declare const addDays: (date: string, days: number) => string;
export declare const clampSlot: (slot: number) => number;
export declare const clampPane: (width: number) => number;
export declare const durationFromTimes: (startTime: string, endTime: string) => number;
export declare const slotToTime: (slot: number) => string;
export declare const timeToSlot: (time: string) => number;
export declare const formatDay: (date: string) => string;
export declare const durationLabel: (slots: number) => string;
export declare const dayColumnWidthForView: (daysInView: (typeof DAYS)[number]) => 118 | 156 | 220 | 280;
interface CalendarWorkspaceProps {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    calendarItems: CalendarItemRecord[];
    settings: LocalAppSettings;
    linkedSessionStateByActivity: Record<string, {
        sessionId: string | null;
        hasOutput: boolean;
        sessionTitle: string;
    }>;
    onSaveSettings: (settings: LocalAppSettings) => void;
    onCreateFromText: (date: string, startSlot: number, value: string, options?: {
        activityId?: string;
        parentActivityId?: string;
    }) => void;
    onMoveItem: (id: string, date: string, startSlot: number) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onDeleteTodo: (id: string) => void;
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
    onOpenTodoWorkspace: () => void;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityWorkspace: (activityId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
    onOpenSession: (sessionId: string) => void;
    onCreateLinkedMeetingSession: (activityId: string) => void;
    onPreviewSessionOutput: (sessionId: string) => void;
    onFullScreenChange?: (isFullScreen: boolean) => void;
}
export declare const CalendarWorkspace: ({ todos, activities, calendarItems, settings, linkedSessionStateByActivity, onSaveSettings, onCreateFromText, onMoveItem, onSaveTodo, onDeleteTodo, onSaveActivity, onDeleteActivity, onConvertTodoToMeeting, onUpdateCalendarItem, onOpenTodoWorkspace, onOpenTodoDetail, onOpenActivityWorkspace, onOpenActivityDetail, onOpenSession, onCreateLinkedMeetingSession, onPreviewSessionOutput, onFullScreenChange, }: CalendarWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
