const normalizeText = (value) => value?.trim?.() ?? "";
export const normalizeTaskRecord = (task) => ({
    id: task.id,
    description: normalizeText(task.description),
    isDone: Boolean(task.isDone),
    isPrivate: Boolean(task.isPrivate),
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
export const todoToTaskRecord = (todo) => normalizeTaskRecord({ ...todo });
export const taskToTodoRecord = (task) => ({ ...normalizeTaskRecord(task) });
