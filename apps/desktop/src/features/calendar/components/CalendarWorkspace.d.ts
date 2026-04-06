interface CalendarWorkspaceProps {
    todos: unknown[];
    activities: unknown[];
    calendarItems: unknown[];
    onCreateFromText: (date: string, startSlot: number, value: string) => void;
    onMoveItem: (id: string, date: string, startSlot: number) => void;
    onOpenTodoWorkspace: () => void;
    onOpenActivityWorkspace: (activityId: string) => void;
}
export declare const CalendarWorkspace: ({ todos, activities, calendarItems, onOpenTodoWorkspace, }: CalendarWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
