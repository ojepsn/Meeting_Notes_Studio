const DEFAULT_LIMIT = 8;
const MAX_SNIPPET_CHARS = 420;
const stripHtml = (value) => {
    if (!value)
        return "";
    if (typeof document === "undefined") {
        return value.replace(/<[^>]+>/g, " ");
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
    return text;
};
const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();
const toSearchText = (...parts) => normalizeWhitespace(parts.filter((part) => Boolean(part)).join(" "));
const tokenize = (value) => normalizeWhitespace(value)
    .toLocaleLowerCase()
    .split(/[^a-z0-9åäöæøéü_-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
const scoreText = (query, text) => {
    const normalizedQuery = normalizeWhitespace(query).toLocaleLowerCase();
    const normalizedText = normalizeWhitespace(text).toLocaleLowerCase();
    if (!normalizedQuery)
        return 1;
    if (!normalizedText)
        return 0;
    if (normalizedText.includes(normalizedQuery))
        return 100 + normalizedQuery.length;
    const tokens = tokenize(normalizedQuery);
    if (!tokens.length)
        return 0;
    const matched = tokens.filter((token) => normalizedText.includes(token));
    if (!matched.length)
        return 0;
    return matched.length * 12 + matched.join("").length;
};
const createSnippet = (query, text) => {
    const cleaned = normalizeWhitespace(text);
    if (cleaned.length <= MAX_SNIPPET_CHARS)
        return cleaned;
    const tokens = tokenize(query);
    const lowerText = cleaned.toLocaleLowerCase();
    const firstMatch = tokens
        .map((token) => lowerText.indexOf(token))
        .filter((index) => index >= 0)
        .sort((left, right) => left - right)[0];
    const start = Math.max(0, (firstMatch ?? 0) - 120);
    const snippet = cleaned.slice(start, start + MAX_SNIPPET_CHARS).trim();
    return `${start > 0 ? "... " : ""}${snippet}${start + MAX_SNIPPET_CHARS < cleaned.length ? " ..." : ""}`;
};
const sortSources = (sources, limit = DEFAULT_LIMIT) => sources
    .filter((source) => source.score > 0)
    .sort((left, right) => right.score - left.score || (right.date || "").localeCompare(left.date || ""))
    .slice(0, Math.max(1, Math.min(30, limit)));
const sessionToSource = (session, query) => {
    const text = toSearchText(session.title, session.participantText, session.project, session.domain, session.activity, session.tagsText, session.quickHighlights, stripHtml(session.manualNotes), session.liveTranscript, session.uploadedTranscript, session.output, ...session.outputVersions.map((version) => version.output));
    return {
        id: session.id,
        type: "session",
        title: session.title || "Untitled session",
        date: session.date,
        snippet: createSnippet(query, text),
        score: scoreText(query, text),
        metadata: {
            participants: session.participantText,
            project: session.project,
            domain: session.domain,
            private: session.isPrivate,
        },
    };
};
const todoToSource = (todo, query) => {
    const text = toSearchText(todo.description, todo.comments, stripHtml(todo.detailsHtml), todo.domain, todo.project, todo.activity, todo.dueDate, todo.doOn);
    return {
        id: todo.id,
        type: "todo",
        title: todo.description || "Untitled todo",
        date: todo.doOn || todo.dueDate || todo.createdAt.slice(0, 10),
        snippet: createSnippet(query, text),
        score: scoreText(query, text),
        metadata: {
            done: todo.isDone,
            project: todo.project,
            domain: todo.domain,
            private: todo.isPrivate,
        },
    };
};
const activityToSource = (activity, query) => {
    const text = toSearchText(activity.description, activity.comments, stripHtml(activity.detailsHtml), activity.domain, activity.project, activity.activity, activity.doOn, activity.dueDate, activity.startTime, activity.endTime);
    return {
        id: activity.id,
        type: "activity",
        title: activity.description || "Untitled activity",
        date: activity.doOn || activity.dueDate || activity.createdAt.slice(0, 10),
        snippet: createSnippet(query, text),
        score: scoreText(query, text),
        metadata: {
            kind: activity.type,
            done: activity.isDone,
            project: activity.project,
            domain: activity.domain,
            private: activity.isPrivate,
        },
    };
};
const calendarItemToSource = (item, query, snapshot) => {
    const target = item.targetType === "todo"
        ? snapshot.todos.find((todo) => todo.id === item.targetId)
        : snapshot.activities.find((activity) => activity.id === item.targetId);
    const targetTitle = target && "description" in target ? target.description : "Calendar item";
    const targetText = target && "detailsHtml" in target ? stripHtml(target.detailsHtml) : "";
    const text = toSearchText(targetTitle, targetText, item.date, item.targetType);
    return {
        id: item.id,
        type: "calendar",
        title: targetTitle || "Calendar item",
        date: item.date,
        snippet: createSnippet(query, text),
        score: scoreText(query, text),
        metadata: {
            targetType: item.targetType,
            targetId: item.targetId,
            startSlot: item.startSlot,
            durationSlots: item.durationSlots,
        },
    };
};
const timelogToSource = (entry, query, snapshot) => {
    const target = entry.targetType === "todo"
        ? snapshot.todos.find((todo) => todo.id === entry.targetId)
        : snapshot.activities.find((activity) => activity.id === entry.targetId);
    const targetTitle = target && "description" in target ? target.description : "Time log";
    const text = toSearchText(targetTitle, entry.notes, entry.date, entry.startTime, entry.endTime);
    return {
        id: entry.id,
        type: "timelog",
        title: targetTitle || "Time log",
        date: entry.date,
        snippet: createSnippet(query, text),
        score: scoreText(query, text),
        metadata: {
            targetType: entry.targetType,
            targetId: entry.targetId,
            durationMinutes: entry.durationMinutes,
        },
    };
};
const isPrivateTimelogTarget = (entry, snapshot) => {
    if (entry.targetType === "todo") {
        return Boolean(snapshot.todos.find((todo) => todo.id === entry.targetId)?.isPrivate);
    }
    return Boolean(snapshot.activities.find((activity) => activity.id === entry.targetId)?.isPrivate);
};
const compareDates = (left, right) => left.localeCompare(right);
const formatDurationLabel = (minutes) => {
    const normalized = Math.max(0, Math.round(minutes));
    const hours = Math.floor(normalized / 60);
    const remaining = normalized % 60;
    if (!hours)
        return `${remaining}m`;
    if (!remaining)
        return `${hours}h`;
    return `${hours}h ${remaining}m`;
};
const sourceTypeAllowed = (type, sourceTypes) => !sourceTypes?.length || sourceTypes.includes(type);
export const searchNoteSmithData = (snapshot, { query, includePrivate = false, limit = DEFAULT_LIMIT, sourceTypes }) => {
    const sources = [];
    if (sourceTypeAllowed("session", sourceTypes)) {
        sources.push(...snapshot.sessions
            .filter((session) => !session.deletedAt)
            .filter((session) => includePrivate || !session.isPrivate)
            .map((session) => sessionToSource(session, query)));
    }
    if (sourceTypeAllowed("todo", sourceTypes)) {
        sources.push(...snapshot.todos
            .filter((todo) => includePrivate || !todo.isPrivate)
            .map((todo) => todoToSource(todo, query)));
    }
    if (sourceTypeAllowed("activity", sourceTypes)) {
        sources.push(...snapshot.activities
            .filter((activity) => includePrivate || !activity.isPrivate)
            .map((activity) => activityToSource(activity, query)));
    }
    if (sourceTypeAllowed("calendar", sourceTypes)) {
        sources.push(...snapshot.calendarItems.map((item) => calendarItemToSource(item, query, snapshot)));
    }
    if (sourceTypeAllowed("timelog", sourceTypes)) {
        sources.push(...snapshot.timelogs.map((entry) => timelogToSource(entry, query, snapshot)));
    }
    return sortSources(sources, limit);
};
export const getNoteSmithTimelogsByDateRange = (snapshot, { fromDate, toDate, includePrivate = false, limit = 12, }) => {
    const filteredEntries = snapshot.timelogs
        .filter((entry) => compareDates(entry.date, fromDate) >= 0 && compareDates(entry.date, toDate) <= 0)
        .filter((entry) => includePrivate || !isPrivateTimelogTarget(entry, snapshot));
    const groupsMap = new Map();
    filteredEntries.forEach((entry) => {
        const source = timelogToSource(entry, `${entry.date} ${entry.startTime} ${entry.endTime}`, snapshot);
        const key = `${entry.targetType}:${entry.targetId}`;
        const current = groupsMap.get(key);
        if (current) {
            current.totalMinutes += entry.durationMinutes;
            current.entryCount += 1;
            return;
        }
        groupsMap.set(key, {
            targetType: entry.targetType,
            targetId: entry.targetId,
            title: source.title,
            totalMinutes: entry.durationMinutes,
            entryCount: 1,
        });
    });
    const groups = Array.from(groupsMap.values()).sort((left, right) => right.totalMinutes - left.totalMinutes || left.title.localeCompare(right.title));
    const sources = filteredEntries
        .map((entry) => {
        const source = timelogToSource(entry, `${entry.date} ${entry.startTime} ${entry.endTime}`, snapshot);
        return {
            ...source,
            snippet: `${entry.date} ${entry.startTime}-${entry.endTime} (${formatDurationLabel(entry.durationMinutes)})${entry.notes ? ` • ${entry.notes}` : ""}`,
            score: 1000 - compareDates(entry.date, fromDate),
        };
    })
        .sort((left, right) => (right.date || "").localeCompare(left.date || ""))
        .slice(0, Math.max(1, Math.min(30, limit)));
    return {
        fromDate,
        toDate,
        totalMinutes: filteredEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
        totalEntries: filteredEntries.length,
        groups,
        sources,
    };
};
export const summarizeNoteSmithWorkspace = (snapshot, includePrivate = false) => {
    const sessions = snapshot.sessions.filter((session) => !session.deletedAt && (includePrivate || !session.isPrivate));
    const todos = snapshot.todos.filter((todo) => includePrivate || !todo.isPrivate);
    const activities = snapshot.activities.filter((activity) => includePrivate || !activity.isPrivate);
    const openTodos = todos.filter((todo) => !todo.isDone).length;
    const meetings = activities.filter((activity) => activity.type === "meeting").length;
    const text = [
        `${sessions.length} active sessions`,
        `${todos.length} todos (${openTodos} open)`,
        `${activities.length} activities (${meetings} meetings)`,
        `${snapshot.calendarItems.length} calendar items`,
        `${snapshot.timelogs.length} timelogs`,
        `${snapshot.templates.length} templates`,
    ].join(", ");
    return {
        id: "workspace-summary",
        type: "workspace",
        title: "NoteSmith workspace summary",
        snippet: text,
        score: 1,
    };
};
export const getNoteSmithLinkedContext = (snapshot, id, includePrivate = false) => {
    const directSession = snapshot.sessions.find((session) => session.id === id && !session.deletedAt) ?? null;
    const directActivity = snapshot.activities.find((activity) => activity.id === id) ?? null;
    const linkedActivityId = directSession
        ? snapshot.entityLinks.find((link) => link.fromType === "activity" && link.toType === "session" && link.toId === directSession.id)?.fromId ?? null
        : null;
    const linkedSessionId = directActivity
        ? snapshot.entityLinks.find((link) => link.fromType === "activity" && link.toType === "session" && link.fromId === directActivity.id)?.toId ?? null
        : null;
    const activity = directActivity ?? (linkedActivityId ? snapshot.activities.find((entry) => entry.id === linkedActivityId) ?? null : null);
    const session = directSession ?? (linkedSessionId ? snapshot.sessions.find((entry) => entry.id === linkedSessionId && !entry.deletedAt) ?? null : null);
    const allowSession = session && (includePrivate || !session.isPrivate) ? session : null;
    const allowActivity = activity && (includePrivate || !activity.isPrivate) ? activity : null;
    const activityId = allowActivity?.id ?? "";
    const sessionId = allowSession?.id ?? "";
    return {
        session: allowSession ? sessionToSource(allowSession, allowSession.title) : null,
        activity: allowActivity ? activityToSource(allowActivity, allowActivity.description) : null,
        calendarItems: snapshot.calendarItems
            .filter((item) => item.targetId === activityId)
            .map((item) => calendarItemToSource(item, allowActivity?.description || "", snapshot)),
        todos: snapshot.todos
            .filter((todo) => (includePrivate || !todo.isPrivate) && (todo.activityId === activityId || todo.sessionIds.includes(sessionId)))
            .map((todo) => todoToSource(todo, allowActivity?.description || allowSession?.title || "")),
        timelogs: snapshot.timelogs
            .filter((entry) => entry.targetId === activityId || snapshot.todos.some((todo) => todo.id === entry.targetId && todo.activityId === activityId))
            .map((entry) => timelogToSource(entry, allowActivity?.description || allowSession?.title || "", snapshot)),
    };
};
export const buildAssistantPreviewAnswer = (snapshot, query, includePrivate = false) => {
    const sources = searchNoteSmithData(snapshot, { query, includePrivate, limit: 6 });
    const summary = summarizeNoteSmithWorkspace(snapshot, includePrivate);
    if (!sources.length) {
        return {
            answer: `I did not find matching NoteSmith records for "${query}". ${summary.snippet}.`,
            sources: [summary],
        };
    }
    const lead = `I found ${sources.length} relevant NoteSmith ${sources.length === 1 ? "record" : "records"} for "${query}".`;
    const bullets = sources.map((source) => `- ${source.title}${source.date ? ` (${source.date})` : ""}: ${source.snippet}`).join("\n");
    return {
        answer: `${lead}\n\n${bullets}`,
        sources,
    };
};
