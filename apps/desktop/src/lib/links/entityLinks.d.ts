import type { EntityLinkRecord } from "@notesmith/domain";
export declare const findSessionIdForActivity: (links: EntityLinkRecord[], activityId: string) => string | null;
export declare const findSessionIdForTodo: (links: EntityLinkRecord[], todoId: string) => string | null;
export declare const findActivityIdForSession: (links: EntityLinkRecord[], sessionId: string) => string | null;
export declare const findTodoIdForSession: (links: EntityLinkRecord[], sessionId: string) => string | null;
export declare const upsertEntityLink: (links: EntityLinkRecord[], nextLink: EntityLinkRecord) => EntityLinkRecord[];
