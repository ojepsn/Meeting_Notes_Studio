import type { ActivityRecord, ArchivedTaskRecord, LocalAppSettings, TimeLogRecord, TodoRecord } from "@notesmith/domain";
type AnalyticsWorkspaceProps = {
    todos: TodoRecord[];
    archivedTasks: ArchivedTaskRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    settings: LocalAppSettings;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onSaveTodo: (todo: TodoRecord) => void;
    onSaveActivity: (activity: ActivityRecord) => void;
};
export declare const AnalyticsWorkspace: ({ todos, archivedTasks, activities, timeLogs, settings, onOpenTodoDetail, onOpenActivityDetail, onSaveTimeLog, onSaveTodo, onSaveActivity, }: AnalyticsWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
