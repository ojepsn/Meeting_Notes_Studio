import type { ActivityRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";
import { type StructureOptions } from "../../../lib/structure/options";
interface ActivitiesWorkspaceProps {
    activities: ActivityRecord[];
    todos: TodoRecord[];
    timeLogs: TimeLogRecord[];
    structureOptions: StructureOptions;
    linkedSessionStateByActivity: Record<string, {
        sessionId: string | null;
        hasOutput: boolean;
        sessionTitle: string;
    }>;
    requestedActivityId?: string | null;
    requestedDomain?: string | null;
    requestedProject?: string | null;
    onEditorClose?: () => void;
    savedPeople: string[];
    suggestedPeople: string[];
    onToggle: (activity: ActivityRecord) => void;
    onAdd: (description: string, type: ActivityRecord["type"]) => void;
    onAddChildTodo: (description: string, activityId: string) => void;
    onAddChildMeeting: (description: string, activityId: string) => void;
    onSave: (activity: ActivityRecord) => void;
    onDelete: (id: string) => void;
    onCreateLinkedMeetingSession: (activityId: string) => void;
    onOpenSession: (sessionId: string) => void;
    onPreviewSessionOutput?: (sessionId: string) => void;
    onOpenTodoDetail: (todoId: string) => void;
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onDeleteTimeLog: (id: string) => void;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
}
export declare const ActivitiesWorkspace: ({ activities, todos, timeLogs, structureOptions, linkedSessionStateByActivity, requestedActivityId, requestedDomain, requestedProject, onEditorClose, savedPeople, suggestedPeople, onToggle, onAdd, onAddChildTodo, onAddChildMeeting, onSave, onDelete, onCreateLinkedMeetingSession, onOpenSession, onPreviewSessionOutput, onOpenTodoDetail, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, }: ActivitiesWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
