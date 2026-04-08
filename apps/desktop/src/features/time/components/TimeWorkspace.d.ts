import type { ActivityRecord, TimeLogRecord, TimeReportPreset, TodoRecord } from "@notesmith/domain";
type TimeWorkspaceProps = {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    requestedDomain?: string | null;
    requestedProject?: string | null;
    reportPresets: TimeReportPreset[];
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onDeleteTimeLog: (id: string) => void;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenTodoDetail: (todoId: string) => void;
    onOpenActivityDetail: (activityId: string) => void;
    onSaveReportPreset: (preset: Omit<TimeReportPreset, "id">) => void;
    onDeleteReportPreset: (presetId: string) => void;
};
export declare const TimeWorkspace: ({ todos, activities, timeLogs, requestedDomain, requestedProject, reportPresets, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onOpenTodoDetail, onOpenActivityDetail, onSaveReportPreset, onDeleteReportPreset, }: TimeWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
