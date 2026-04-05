import type { ActivityRecord } from "@notesmith/domain";
interface ActivitiesWorkspaceProps {
    activities: ActivityRecord[];
    linkedSessionIdsByActivity: Record<string, string | null>;
    requestedActivityId?: string | null;
    onToggle: (activity: ActivityRecord) => void;
    onAdd: (description: string, type: ActivityRecord["type"]) => void;
    onSave: (activity: ActivityRecord) => void;
    onDelete: (id: string) => void;
    onCreateLinkedMeetingSession: (activityId: string) => void;
    onOpenSession: (sessionId: string) => void;
}
export declare const ActivitiesWorkspace: ({ activities, linkedSessionIdsByActivity, requestedActivityId, onToggle, onAdd, onSave, onDelete, onCreateLinkedMeetingSession, onOpenSession, }: ActivitiesWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
