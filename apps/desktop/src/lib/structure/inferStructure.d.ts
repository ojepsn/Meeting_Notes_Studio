import type { ActivityRecord, LocalAppSettings, SessionRecord, StructureInferenceRuleKind, StructureInferenceRuleRecord, TodoRecord } from "@notesmith/domain";
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
    settings?: Pick<LocalAppSettings, "structureInferenceRules">;
};
export type StructureInferenceResult = {
    domain: string;
    project: string;
    activity: string;
};
export declare const normalizeStructureInferenceRuleTitle: (value: string) => string;
export declare const normalizeStructureInferenceRules: (rules: Array<Partial<StructureInferenceRuleRecord>> | undefined | null) => StructureInferenceRuleRecord[];
export declare const upsertStructureInferenceRule: (rules: Array<Partial<StructureInferenceRuleRecord>> | undefined, title: string, kind: StructureInferenceRuleKind, structure: Partial<StructureInferenceResult>, updatedAt?: string) => StructureInferenceRuleRecord[];
export declare const inferStructureFromTitle: (snapshot: StructureInferenceSnapshot, title: string, kind: Exclude<StructureInferenceKind, "session">, seed?: StructureInferenceSeed) => StructureInferenceResult;
export {};
