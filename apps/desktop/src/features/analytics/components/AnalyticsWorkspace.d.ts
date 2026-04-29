import type { ActivityRecord, ArchivedTaskRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
type AnalyticsWorkspaceProps = {
    todos: TodoRecord[];
    archivedTasks: ArchivedTaskRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
};
export declare const AnalyticsWorkspace: ({ todos, archivedTasks, activities, timeLogs, onOpenTodoDetail, onOpenActivityDetail, }: AnalyticsWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
