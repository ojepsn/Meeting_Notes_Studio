import type { ActivityRecord, ArchivedTaskRecord, LocalAppSettings, TimeLogRecord, TodoRecord } from "@notesmith/domain";
type AnalyticsWorkspaceProps = {
    todos: TodoRecord[];
    archivedTasks: ArchivedTaskRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    settings: LocalAppSettings;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
};
export declare const AnalyticsWorkspace: ({ todos, archivedTasks, activities, timeLogs, settings, onOpenTodoDetail, onOpenActivityDetail, }: AnalyticsWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
