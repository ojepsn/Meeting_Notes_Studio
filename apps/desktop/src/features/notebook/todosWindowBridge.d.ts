import type { TimeLogRecord, TodoRecord } from "@notesmith/domain";
export declare const DETACHED_TODOS_WINDOW_LABEL = "notesmith-todos";
export declare const TODOS_COMMAND_EVENT = "notesmith:todos-command";
export declare const TODOS_SNAPSHOT_EVENT = "notesmith:todos-snapshot";
export type TodosWindowCommand = {
    type: "request-snapshot";
} | {
    type: "add";
    description: string;
} | {
    type: "save";
    todo: TodoRecord;
} | {
    type: "delete";
    todoId: string;
} | {
    type: "add-note";
    todoId: string;
} | {
    type: "toggle-time";
    todoId: string;
    isRunning: boolean;
};
export interface TodosWindowSnapshot {
    todos: TodoRecord[];
    theme: string;
    runningTodoIds: string[];
}
export declare const getRunningTodoIds: (timeLogs: TimeLogRecord[]) => string[];
export declare const openDetachedTodosWindow: () => Promise<import("@tauri-apps/api/webviewWindow").WebviewWindow>;
export declare const sendTodosCommand: (command: TodosWindowCommand) => Promise<void>;
export declare const sendTodosSnapshot: (todos: TodoRecord[], theme: string, runningTodoIds: string[]) => Promise<void>;
