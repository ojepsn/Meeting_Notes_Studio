import type { TaskRecord, TodoRecord } from "@notesmith/domain";

const normalizeText = (value: string | undefined) => value?.trim?.() ?? "";

export const normalizeTaskRecord = (task: TaskRecord): TaskRecord => ({
  id: task.id,
  description: normalizeText(task.description),
  isDone: Boolean(task.isDone),
  completedAt: typeof task.completedAt === "string" ? task.completedAt : null,
  isPrivate: Boolean(task.isPrivate),
  isPriority: Boolean(task.isPriority),
  comments: task.comments ?? "",
  activityId: task.activityId ?? "",
  domain: task.domain ?? "",
  project: task.project ?? "",
  activity: task.activity ?? "",
  doOn: task.doOn ?? "",
  dueDate: task.dueDate ?? "",
  detailsHtml: task.detailsHtml ?? "",
  createdAt: task.createdAt,
  sessionIds: Array.isArray(task.sessionIds) ? task.sessionIds : [],
});

export const todoToTaskRecord = (todo: TodoRecord): TaskRecord => normalizeTaskRecord({ ...todo });

export const taskToTodoRecord = (task: TaskRecord): TodoRecord => ({ ...normalizeTaskRecord(task) });
