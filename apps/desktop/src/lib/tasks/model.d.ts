import type { TaskRecord, TodoPriority, TodoRecord } from "@notesmith/domain";
export declare const migrateTodoCommentsToDetails: (detailsHtml: string | undefined, comments: string | undefined) => string;
export declare const getTodoPriority: (task: Pick<TaskRecord, "priority" | "isPriority">) => TodoPriority;
export declare const normalizeTaskRecord: (task: TaskRecord) => TaskRecord;
export declare const todoToTaskRecord: (todo: TodoRecord) => TaskRecord;
export declare const taskToTodoRecord: (task: TaskRecord) => TodoRecord;
