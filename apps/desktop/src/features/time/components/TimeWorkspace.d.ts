import type { ActivityRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
type TimeWorkspaceProps = {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onDeleteTimeLog: (id: string) => void;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
};
export declare const TimeWorkspace: ({ todos, activities, timeLogs, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onOpenTodoDetail, onOpenActivityDetail, }: TimeWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
