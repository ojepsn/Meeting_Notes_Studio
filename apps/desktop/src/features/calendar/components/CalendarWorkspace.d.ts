import type { ActivityRecord, CalendarItemRecord, TodoRecord } from "@notesmith/domain";
interface CalendarWorkspaceProps {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    calendarItems: CalendarItemRecord[];
    linkedSessionIdsByActivity: Record<string, string | null>;
    onCreateFromText: (date: string, startSlot: number, value: string) => void;
    onMoveItem: (id: string, date: string, startSlot: number) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onSaveActivity: (activity: ActivityRecord) => void;
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
export declare const CalendarWorkspace: ({ todos, activities, calendarItems, linkedSessionIdsByActivity, onCreateFromText, onMoveItem, onSaveTodo, onSaveActivity, onUpdateCalendarItem, onOpenTodoWorkspace, onOpenActivityWorkspace, onOpenSession, onFullScreenChange, }: CalendarWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
