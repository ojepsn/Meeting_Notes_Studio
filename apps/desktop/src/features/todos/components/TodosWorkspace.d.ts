import type { ActivityRecord, TaskRecord, TimeLogRecord } from "@notesmith/domain";
import { type StructureOptions } from "../../../lib/structure/options";
interface TodosWorkspaceProps {
    todos: TaskRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    structureOptions: StructureOptions;
    requestedTodoId?: string | null;
    requestedDomain?: string | null;
    requestedProject?: string | null;
    onEditorClose?: () => void;
    onToggle: (todo: TaskRecord) => void;
    onAdd: (description: string, options?: {
        activityId?: string;
    }) => void;
    onSave: (todo: TaskRecord) => void;
    onDelete: (id: string) => void;
    onConvertToActivity: (todo: TaskRecord) => void;
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onDeleteTimeLog: (id: string) => void;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenActivityDetail?: (activityId: string) => void;
}
export declare const TodosWorkspace: ({ todos, activities, timeLogs, structureOptions, requestedTodoId, requestedDomain, requestedProject, onEditorClose, onToggle, onAdd, onSave, onDelete, onConvertToActivity, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onOpenActivityDetail, }: TodosWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
