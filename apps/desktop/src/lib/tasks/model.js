export const DEFAULT_TODO_STRUCTURE = {
    domain: "Other",
    project: "Other",
    activity: "Other",
};
const normalizeText = (value) => value?.trim?.() ?? "";
const escapeHtml = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const htmlToComparableText = (value) => value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    "#39": "'",
})[entity] || "")
    .replace(/\s+/g, " ")
    .trim();
export const migrateTodoCommentsToDetails = (detailsHtml, comments) => {
    const details = detailsHtml?.trim() ?? "";
    const legacyComments = comments?.trim() ?? "";
    if (!legacyComments)
        return details;
    if (htmlToComparableText(details) === legacyComments.replace(/\s+/g, " ").trim())
        return details || escapeHtml(legacyComments);
    const commentsHtml = legacyComments
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("");
    return details ? `${details}<p><br></p>${commentsHtml}` : commentsHtml;
};
export const getTodoPriority = (task) => task.priority === "low" || task.priority === "high" || task.priority === "normal"
    ? task.priority
    : task.isPriority
        ? "high"
        : "normal";
export const normalizeTaskRecord = (task) => {
    const priority = getTodoPriority(task);
    const detailsHtml = migrateTodoCommentsToDetails(task.detailsHtml, task.comments);
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
        comments: "",
        activityId: task.activityId ?? "",
        domain: task.domain ?? "",
        project: task.project ?? "",
        activity: task.activity ?? "",
        doOn: task.doOn ?? "",
        dueDate: task.dueDate ?? "",
        detailsHtml,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt ?? task.createdAt,
        sessionIds: Array.isArray(task.sessionIds) ? task.sessionIds : [],
    };
};
export const todoToTaskRecord = (todo) => normalizeTaskRecord({ ...todo });
export const taskToTodoRecord = (task) => ({ ...normalizeTaskRecord(task) });
