import type { ActivityRecord, SessionRecord, TodoRecord } from "@notesmith/domain";
type StructureInferenceKind = "todo" | "meeting" | "activity" | "session";
type StructureInferenceSeed = {
    domain?: string;
    project?: string;
    activity?: string;
};
type StructureInferenceSnapshot = {
    todos: TodoRecord[];
    activities: ActivityRecord[];
    sessions: SessionRecord[];
};
type StructureInferenceResult = {
    domain: string;
    project: string;
    activity: string;
};
export declare const inferStructureFromTitle: (snapshot: StructureInferenceSnapshot, title: string, kind: Exclude<StructureInferenceKind, "session">, seed?: StructureInferenceSeed) => StructureInferenceResult;
export {};
