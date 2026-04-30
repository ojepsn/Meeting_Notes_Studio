import type { ActivityRecord, CalendarItemRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
type NowWorkspaceProps = {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    calendarItems: CalendarItemRecord[];
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
    onOpenProject: (project: string) => void;
};
export declare const NowWorkspace: ({ todos, activities, timeLogs, calendarItems, onStartTracking, onStopTracking, onOpenTodoDetail, onOpenActivityDetail, onOpenProject, }: NowWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
