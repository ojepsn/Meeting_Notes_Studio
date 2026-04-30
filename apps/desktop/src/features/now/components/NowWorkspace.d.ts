import type { ActivityRecord, CalendarItemRecord, LocalAppSettings, TimeLogRecord, TodoRecord } from "@notesmith/domain";
type NowWorkspaceProps = {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    calendarItems: CalendarItemRecord[];
    settings: LocalAppSettings;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
    onOpenProject: (project: string) => void;
    onSaveSettings: (settings: LocalAppSettings) => void;
};
export declare const NowWorkspace: ({ todos, activities, timeLogs, calendarItems, settings, onStartTracking, onStopTracking, onOpenTodoDetail, onOpenActivityDetail, onOpenProject, onSaveSettings, }: NowWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
