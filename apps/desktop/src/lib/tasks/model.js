const normalizeText = (value) => value?.trim?.() ?? "";
export const getTodoPriority = (task) => task.priority === "low" || task.priority === "high" || task.priority === "normal"
    ? task.priority
    : task.isPriority
        ? "high"
        : "normal";
export const normalizeTaskRecord = (task) => {
    const priority = getTodoPriority(task);
    return {
        id: task.id,
        description: normalizeText(task.description),
        participantText: task.participantText ?? "",
        isDone: Boolean(task.isDone),
        completedAt: typeof task.completedAt === "string" ? task.completedAt : null,
        isPrivate: Boolean(task.isPrivate),
        isPriority: priority === "high",
        priority,
        isUrgent: Boolean(task.isUrgent),
        comments: task.comments ?? "",
        activityId: task.activityId ?? "",
        domain: task.domain ?? "",
        project: task.project ?? "",
        activity: task.activity ?? "",
        doOn: task.doOn ?? "",
        dueDate: task.dueDate ?? "",
        detailsHtml: task.detailsHtml ?? "",
        createdAt: task.createdAt,
        updatedAt: task.updatedAt ?? task.createdAt,
        sessionIds: Array.isArray(task.sessionIds) ? task.sessionIds : [],
    };
};
export const todoToTaskRecord = (todo) => normalizeTaskRecord({ ...todo });
export const taskToTodoRecord = (task) => ({ ...normalizeTaskRecord(task) });
