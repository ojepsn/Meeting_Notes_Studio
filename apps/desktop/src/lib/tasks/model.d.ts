import type { TaskRecord, TodoRecord } from "@notesmith/domain";
export declare const normalizeTaskRecord: (task: TaskRecord) => TaskRecord;
export declare const todoToTaskRecord: (todo: TodoRecord) => TaskRecord;
export declare const taskToTodoRecord: (task: TaskRecord) => TodoRecord;
