import type { ActivityRecord, ProjectLinkRecord, SessionRecord, TodoRecord } from "@notesmith/domain";
export type StructureOptions = {
    domains: string[];
    projects: string[];
    activities: string[];
    projectDomains: Record<string, string[]>;
    activityProjects: Record<string, string[]>;
    activityDomains: Record<string, string[]>;
};
type StructureOptionInputs = {
    savedDomains: string[];
    savedProjects: string[];
    savedActivities: string[];
    projectLinks: ProjectLinkRecord[];
    sessions: SessionRecord[];
    todos: TodoRecord[];
    activities: ActivityRecord[];
};
export declare const createEmptyStructureOptions: () => StructureOptions;
export declare const buildStructureOptions: ({ savedDomains, savedProjects, savedActivities, projectLinks, sessions, todos, activities, }: StructureOptionInputs) => StructureOptions;
export declare const getProjectsForDomain: (options: StructureOptions, domain: string) => string[];
export declare const getActivitiesForSelection: (options: StructureOptions, domain: string, project: string) => string[];
export {};
