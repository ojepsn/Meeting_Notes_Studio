import type { ActivityRecord, CalendarItemRecord, TodoRecord } from "@notesmith/domain";
interface CalendarWorkspaceProps {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    calendarItems: CalendarItemRecord[];
    onCreateFromText: (date: string, startSlot: number, value: string) => void;
    onMoveItem: (id: string, date: string, startSlot: number) => void;
    onOpenTodoWorkspace: () => void;
    onOpenActivityWorkspace: (activityId: string) => void;
}
export declare const CalendarWorkspace: ({ todos, activities, calendarItems, onCreateFromText, onMoveItem, onOpenTodoWorkspace, onOpenActivityWorkspace, }: CalendarWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
