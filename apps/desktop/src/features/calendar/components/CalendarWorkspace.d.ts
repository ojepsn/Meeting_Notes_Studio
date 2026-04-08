import type { ActivityRecord, CalendarItemRecord, LocalAppSettings, TodoRecord } from "@notesmith/domain";
interface CalendarWorkspaceProps {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    calendarItems: CalendarItemRecord[];
    settings: LocalAppSettings;
    linkedSessionIdsByActivity: Record<string, string | null>;
    onSaveSettings: (settings: LocalAppSettings) => void;
    onCreateFromText: (date: string, startSlot: number, value: string) => void;
    onMoveItem: (id: string, date: string, startSlot: number) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onSaveActivity: (activity: ActivityRecord) => void;
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
    onOpenActivityWorkspace: (activityId: string) => void;
    onOpenSession: (sessionId: string) => void;
    onFullScreenChange?: (isFullScreen: boolean) => void;
}
export declare const CalendarWorkspace: ({ todos, activities, calendarItems, settings, linkedSessionIdsByActivity, onSaveSettings, onCreateFromText, onMoveItem, onSaveTodo, onSaveActivity, onConvertTodoToMeeting, onUpdateCalendarItem, onOpenTodoWorkspace, onOpenActivityWorkspace, onOpenSession, onFullScreenChange, }: CalendarWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
