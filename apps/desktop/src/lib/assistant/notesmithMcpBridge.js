import { getNoteSmithCalendarItemsByDateRange, getNoteSmithLinkedContext, getNoteSmithTimelogsByDateRange, searchNoteSmithData, summarizeNoteSmithWorkspace, } from "./notesmithDataTools";
const searchInputSchema = (description) => ({
    type: "object",
    properties: {
        query: { type: "string", description },
        includePrivate: {
            type: "boolean",
            default: false,
            description: "Include private NoteSmith records. Defaults to false.",
        },
        limit: {
            type: "integer",
            minimum: 1,
            maximum: 30,
            default: 8,
        },
    },
    required: ["query"],
    additionalProperties: false,
});
const idInputSchema = (description) => ({
    type: "object",
    properties: {
        id: { type: "string", description },
        includePrivate: {
            type: "boolean",
            default: false,
            description: "Include private NoteSmith records. Defaults to false.",
        },
    },
    required: ["id"],
    additionalProperties: false,
});
const dateRangeInputSchema = (description) => ({
    type: "object",
    properties: {
        fromDate: { type: "string", description: `${description} Start date in YYYY-MM-DD format.` },
        toDate: { type: "string", description: `${description} End date in YYYY-MM-DD format.` },
        includePrivate: {
            type: "boolean",
            default: false,
            description: "Include private NoteSmith records. Defaults to false.",
        },
        limit: {
            type: "integer",
            minimum: 1,
            maximum: 30,
            default: 12,
        },
    },
    required: ["fromDate", "toDate"],
    additionalProperties: false,
});
export const NOTESMITH_MCP_TOOLS = [
    {
        name: "notesmith_search_sessions",
        description: "Search NoteSmith meeting sessions, notes, transcripts, outputs, participants, tags, domains, and projects.",
        inputSchema: searchInputSchema("Search text for sessions and meeting notes."),
        riskLevel: "low",
    },
    {
        name: "notesmith_get_session",
        description: "Get one sanitized NoteSmith session by id, including linked context when available.",
        inputSchema: idInputSchema("The NoteSmith session id."),
        riskLevel: "low",
    },
    {
        name: "notesmith_search_calendar",
        description: "Search NoteSmith calendar items and their linked todo or activity titles.",
        inputSchema: searchInputSchema("Search text for calendar items."),
        riskLevel: "low",
    },
    {
        name: "notesmith_search_todos",
        description: "Search NoteSmith todos, including comments, details, domain, project, activity, due date, and do-on date.",
        inputSchema: searchInputSchema("Search text for todos."),
        riskLevel: "low",
    },
    {
        name: "notesmith_search_activities",
        description: "Search NoteSmith activities and meetings, including details, domain, project, schedule, and status.",
        inputSchema: searchInputSchema("Search text for activities and meetings."),
        riskLevel: "low",
    },
    {
        name: "notesmith_search_timelogs",
        description: "Search NoteSmith timelogs and their linked todo or activity titles.",
        inputSchema: searchInputSchema("Search text for timelogs."),
        riskLevel: "low",
    },
    {
        name: "notesmith_get_calendar_by_date_range",
        description: "Get NoteSmith calendar items for a specific date range, including meeting and task counts.",
        inputSchema: dateRangeInputSchema("Date range for calendar lookup."),
        riskLevel: "low",
    },
    {
        name: "notesmith_get_timelogs_by_date_range",
        description: "Get NoteSmith timelogs for a specific date range, including grouped time totals.",
        inputSchema: dateRangeInputSchema("Date range for timelog lookup."),
        riskLevel: "low",
    },
    {
        name: "notesmith_get_linked_context",
        description: "Get sanitized linked context for a NoteSmith session or activity id.",
        inputSchema: idInputSchema("A NoteSmith session id or activity id."),
        riskLevel: "low",
    },
    {
        name: "notesmith_summarize_workspace",
        description: "Summarize the visible NoteSmith workspace data counts.",
        inputSchema: {
            type: "object",
            properties: {
                includePrivate: {
                    type: "boolean",
                    default: false,
                    description: "Include private NoteSmith records. Defaults to false.",
                },
            },
            additionalProperties: false,
        },
        riskLevel: "low",
    },
];
const parseSearchArgs = (args) => ({
    query: typeof args.query === "string" ? args.query : "",
    includePrivate: Boolean(args.includePrivate),
    limit: Number.isFinite(Number(args.limit)) ? Math.max(1, Math.min(30, Math.round(Number(args.limit)))) : 8,
});
const parseIdArgs = (args) => ({
    id: typeof args.id === "string" ? args.id : "",
    includePrivate: Boolean(args.includePrivate),
});
const parseDateRangeArgs = (args) => ({
    fromDate: typeof args.fromDate === "string" ? args.fromDate : "",
    toDate: typeof args.toDate === "string" ? args.toDate : "",
    includePrivate: Boolean(args.includePrivate),
    limit: Number.isFinite(Number(args.limit)) ? Math.max(1, Math.min(30, Math.round(Number(args.limit)))) : 12,
});
const searchByType = (snapshot, args, sourceTypes) => {
    const parsed = parseSearchArgs(args);
    return {
        sources: searchNoteSmithData(snapshot, {
            query: parsed.query,
            includePrivate: parsed.includePrivate,
            limit: parsed.limit,
            sourceTypes,
        }),
    };
};
export const invokeNoteSmithMcpTool = (snapshot, toolName, args = {}) => {
    switch (toolName) {
        case "notesmith_search_sessions":
            return searchByType(snapshot, args, ["session"]);
        case "notesmith_search_calendar":
            return searchByType(snapshot, args, ["calendar"]);
        case "notesmith_search_todos":
            return searchByType(snapshot, args, ["todo"]);
        case "notesmith_search_activities":
            return searchByType(snapshot, args, ["activity"]);
        case "notesmith_search_timelogs":
            return searchByType(snapshot, args, ["timelog"]);
        case "notesmith_get_calendar_by_date_range": {
            const parsed = parseDateRangeArgs(args);
            return {
                summary: getNoteSmithCalendarItemsByDateRange(snapshot, {
                    fromDate: parsed.fromDate,
                    toDate: parsed.toDate,
                    includePrivate: parsed.includePrivate,
                    limit: parsed.limit,
                }),
            };
        }
        case "notesmith_get_timelogs_by_date_range": {
            const parsed = parseDateRangeArgs(args);
            return {
                summary: getNoteSmithTimelogsByDateRange(snapshot, {
                    fromDate: parsed.fromDate,
                    toDate: parsed.toDate,
                    includePrivate: parsed.includePrivate,
                    limit: parsed.limit,
                }),
            };
        }
        case "notesmith_get_linked_context": {
            const parsed = parseIdArgs(args);
            return getNoteSmithLinkedContext(snapshot, parsed.id, parsed.includePrivate);
        }
        case "notesmith_get_session": {
            const parsed = parseIdArgs(args);
            const session = snapshot.sessions.find((entry) => entry.id === parsed.id && !entry.deletedAt);
            if (!session || (!parsed.includePrivate && session.isPrivate)) {
                return { session: null, linkedContext: getNoteSmithLinkedContext(snapshot, parsed.id, parsed.includePrivate) };
            }
            return {
                session: searchNoteSmithData(snapshot, {
                    query: [
                        session.id,
                        session.title,
                        session.participantText,
                        session.project,
                        session.domain,
                        session.activity,
                        session.tagsText,
                        session.quickHighlights,
                        session.manualNotes,
                        session.liveTranscript,
                        session.uploadedTranscript,
                        session.output,
                    ].join(" "),
                    includePrivate: parsed.includePrivate,
                    limit: 30,
                    sourceTypes: ["session"],
                }).find((source) => source.id === session.id) ?? null,
                linkedContext: getNoteSmithLinkedContext(snapshot, parsed.id, parsed.includePrivate),
            };
        }
        case "notesmith_summarize_workspace":
            return { summary: summarizeNoteSmithWorkspace(snapshot, Boolean(args.includePrivate)) };
        default: {
            const exhaustive = toolName;
            throw new Error(`Unsupported NoteSmith MCP tool: ${exhaustive}`);
        }
    }
};
export const listNoteSmithMcpTools = () => NOTESMITH_MCP_TOOLS;
