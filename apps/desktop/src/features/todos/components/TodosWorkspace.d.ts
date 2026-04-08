import type { ActivityRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
interface TodosWorkspaceProps {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    requestedTodoId?: string | null;
    requestedDomain?: string | null;
    requestedProject?: string | null;
    onEditorClose?: () => void;
    onToggle: (todo: TodoRecord) => void;
    onAdd: (description: string, options?: {
        activityId?: string;
    }) => void;
    onSave: (todo: TodoRecord) => void;
    onDelete: (id: string) => void;
    onConvertToActivity: (todo: TodoRecord) => void;
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onDeleteTimeLog: (id: string) => void;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenActivityDetail?: (activityId: string) => void;
}
export declare const TodosWorkspace: ({ todos, activities, timeLogs, requestedTodoId, requestedDomain, requestedProject, onEditorClose, onToggle, onAdd, onSave, onDelete, onConvertToActivity, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onOpenActivityDetail, }: TodosWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
