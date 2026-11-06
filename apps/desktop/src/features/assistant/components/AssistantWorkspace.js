import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { summarizeNoteSmithWorkspace, } from "../../../lib/assistant/notesmithDataTools";
import { inferClarificationRoute, planAssistantQuery, } from "../../../lib/assistant/assistantQueryPlanner";
import { invokeNoteSmithMcpTool, listNoteSmithMcpTools } from "../../../lib/assistant/notesmithMcpBridge";
const createMessageId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
const routeLabel = (route) => route === "timelogs"
    ? "timelog"
    : route === "sessions"
        ? "session"
        : route === "calendar"
            ? "calendar"
            : route === "todos"
                ? "task"
                : route === "activities"
                    ? "structure"
                    : "workspace";
const summarizeTimelogGroups = (groups) => groups
    .slice(0, 8)
    .map((group) => `- ${group.title}: ${group.totalMinutes} minutes across ${group.entryCount} entr${group.entryCount === 1 ? "y" : "ies"}`)
    .join("\n");
const summarizeCalendarSources = (sources) => sources
    .slice(0, 10)
    .map((source) => `- ${source.title}${source.date ? ` (${source.date})` : ""}: ${source.snippet}`)
    .join("\n");
const dedupeSources = (sources) => {
    const seen = new Set();
    return sources.filter((source) => {
        const key = `${source.type}:${source.id}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
};
export const AssistantWorkspace = ({ snapshot, onOpenSettings, onSaveSettings }) => {
    const [draft, setDraft] = useState("");
    const [includePrivate, setIncludePrivate] = useState(false);
    const [messages, setMessages] = useState([]);
    const [pendingClarification, setPendingClarification] = useState(null);
    const assistantQueryMemories = snapshot.settings.assistantQueryMemories ?? [];
    const workspaceSummary = useMemo(() => summarizeNoteSmithWorkspace(snapshot, includePrivate), [snapshot, includePrivate]);
    const mcpTools = useMemo(() => listNoteSmithMcpTools(), []);
    const persistAssistantMemory = async (fingerprint, learnedFromQuestion, clarificationAnswer, route) => {
        const now = new Date().toISOString();
        const nextEntry = {
            id: crypto.randomUUID(),
            fingerprint,
            learnedFromQuestion,
            clarificationAnswer,
            route,
            createdAt: now,
            updatedAt: now,
        };
        await onSaveSettings({
            ...snapshot.settings,
            assistantQueryMemories: [
                nextEntry,
                ...assistantQueryMemories.filter((entry) => entry.fingerprint !== fingerprint),
            ].slice(0, 50),
        });
        return nextEntry;
    };
    const collectAssistantContext = (query, routeOverride) => {
        const plan = planAssistantQuery(query, assistantQueryMemories, new Date());
        const route = routeOverride ?? plan.route;
        const effectivePlan = routeOverride && routeOverride !== "unknown"
            ? { ...plan, route: routeOverride, shouldClarify: false, clarificationQuestion: null }
            : plan;
        const sections = [];
        const sources = [];
        if (route === "timelogs" && effectivePlan.dateRange) {
            const timelogResult = invokeNoteSmithMcpTool(snapshot, "notesmith_get_timelogs_by_date_range", {
                fromDate: effectivePlan.dateRange.fromDate,
                toDate: effectivePlan.dateRange.toDate,
                includePrivate,
                limit: 12,
            });
            if (timelogResult.summary) {
                const summary = timelogResult.summary;
                sections.push([
                    `Timelog summary for ${effectivePlan.dateRange.label}:`,
                    `- Absolute date range: ${summary.fromDate} to ${summary.toDate}`,
                    `- Total tracked time: ${summary.totalMinutes} minutes`,
                    `- Total timelog entries: ${summary.totalEntries}`,
                    summary.groups.length ? summarizeTimelogGroups(summary.groups) : "- No timelogs found in this range",
                ].join("\n"));
                sources.push(...summary.sources);
            }
        }
        if (route === "calendar" && effectivePlan.dateRange) {
            const calendarResult = invokeNoteSmithMcpTool(snapshot, "notesmith_get_calendar_by_date_range", {
                fromDate: effectivePlan.dateRange.fromDate,
                toDate: effectivePlan.dateRange.toDate,
                includePrivate,
                limit: 12,
            });
            if (calendarResult.summary) {
                const summary = calendarResult.summary;
                sections.push([
                    `Calendar summary for ${effectivePlan.dateRange.label}:`,
                    `- Absolute date range: ${summary.fromDate} to ${summary.toDate}`,
                    `- Total scheduled items: ${summary.totalItems}`,
                    `- Meetings: ${summary.meetingCount}`,
                    `- Tasks: ${summary.taskCount}`,
                    summary.sources.length ? summarizeCalendarSources(summary.sources) : "- No calendar items found in this range",
                ].join("\n"));
                sources.push(...summary.sources);
            }
        }
        const routeTools = {
            timelogs: ["notesmith_search_timelogs"],
            sessions: ["notesmith_search_sessions"],
            calendar: ["notesmith_search_calendar"],
            todos: ["notesmith_search_todos"],
            activities: ["notesmith_search_activities"],
            workspace: ["notesmith_summarize_workspace"],
        };
        const fallbackTools = route !== "unknown"
            ? routeTools[route]
            : [
                "notesmith_search_sessions",
                "notesmith_search_calendar",
                "notesmith_search_todos",
                "notesmith_search_activities",
                "notesmith_search_timelogs",
            ];
        fallbackTools.forEach((toolName) => {
            const result = invokeNoteSmithMcpTool(snapshot, toolName, {
                query,
                includePrivate,
                limit: 4,
            });
            if ("sources" in result) {
                sources.push(...result.sources);
            }
            if ("summary" in result && toolName === "notesmith_summarize_workspace") {
                sections.push(`Workspace summary:\n- ${result.summary.snippet}`);
            }
        });
        return {
            plan: effectivePlan,
            sources: dedupeSources(sources).sort((left, right) => right.score - left.score).slice(0, 10),
            contextText: sections.join("\n\n"),
        };
    };
    const submit = async () => {
        const incomingQuery = draft.trim();
        if (!incomingQuery)
            return;
        const createdAt = new Date().toISOString();
        const userMessage = { id: createMessageId(), role: "user", text: incomingQuery, sources: [], createdAt };
        const assistantMessageId = createMessageId();
        let effectiveQuery = incomingQuery;
        let learnedPrefix = "";
        let routeOverride;
        if (pendingClarification) {
            const learnedRoute = inferClarificationRoute(incomingQuery);
            if (learnedRoute === "unknown") {
                setMessages((current) => [
                    ...current,
                    userMessage,
                    {
                        id: assistantMessageId,
                        role: "assistant",
                        text: "I’m still not sure which NoteSmith area you mean. Please answer with one of: timelogs, sessions, calendar, tasks, or structure/activity data.",
                        sources: [],
                        createdAt,
                    },
                ]);
                setDraft("");
                return;
            }
            await persistAssistantMemory(pendingClarification.fingerprint, pendingClarification.originalQuestion, incomingQuery, learnedRoute);
            learnedPrefix = `Understood. I’ll treat questions like "${pendingClarification.originalQuestion}" as ${routeLabel(learnedRoute)} questions from now on.\n\n`;
            routeOverride = learnedRoute;
            effectiveQuery = pendingClarification.originalQuestion;
            setPendingClarification(null);
        }
        const context = collectAssistantContext(effectiveQuery, routeOverride);
        if (!pendingClarification && context.plan.shouldClarify && context.plan.clarificationQuestion) {
            setPendingClarification({ originalQuestion: effectiveQuery, fingerprint: context.plan.fingerprint });
            setMessages((current) => [
                ...current,
                userMessage,
                {
                    id: assistantMessageId,
                    role: "assistant",
                    text: context.plan.clarificationQuestion || "Please clarify which NoteSmith data area I should use.",
                    sources: [],
                    createdAt,
                },
            ]);
            setDraft("");
            return;
        }
        const fallbackAnswer = context.sources.length
            ? `${learnedPrefix}I found ${context.sources.length} relevant NoteSmith ${context.sources.length === 1 ? "record" : "records"} for "${effectiveQuery}".${context.contextText ? `\n\n${context.contextText}` : ""}\n\n${context.sources
                .map((source) => `- ${source.title}${source.date ? ` (${source.date})` : ""}: ${source.snippet}`)
                .join("\n")}`
            : `${learnedPrefix}I did not find matching NoteSmith records for "${effectiveQuery}".${context.contextText ? `\n\n${context.contextText}` : ""}`;
        setMessages((current) => [
            ...current,
            userMessage,
            {
                id: assistantMessageId,
                role: "assistant",
                text: fallbackAnswer,
                sources: context.sources,
                createdAt,
            },
        ]);
        setDraft("");
    };
    return (_jsxs("div", { className: "assistant-workspace", children: [_jsxs("section", { className: "card assistant-chat-card", children: [_jsxs("div", { className: "card-header assistant-workspace-header", children: [_jsxs("div", { children: [_jsx("p", { className: "section-label", children: "Assistant" }), _jsx("h2", { children: "Chat with your NoteSmith data" }), _jsx("p", { className: "muted", children: "Search NoteSmith locally using the same scoped, read-only data layer exposed to ChatGPT." })] }), _jsxs("div", { className: "assistant-status-stack", children: [_jsx("span", { className: "status-chip", children: "MCP bridge first" }), _jsx("span", { className: "status-chip status-chip-saved", children: "Read-only local search" })] })] }), _jsxs("div", { className: "assistant-option-row", children: [_jsxs("label", { className: "checkbox-label assistant-private-toggle", children: [_jsx("input", { type: "checkbox", checked: includePrivate, onChange: (event) => setIncludePrivate(event.target.checked) }), "Include private items in Assistant context"] }), _jsx("button", { className: "small-button", type: "button", onClick: onOpenSettings, children: "AI settings" })] }), _jsx("div", { className: "assistant-thread", "aria-live": "polite", children: messages.length ? (messages.map((message) => (_jsxs("article", { className: "assistant-message", "data-role": message.role, children: [_jsxs("div", { className: "assistant-message-meta", children: [_jsx("strong", { children: message.role === "user" ? "You" : "Assistant" }), _jsx("span", { className: "muted", children: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })] }), _jsx("p", { children: message.text }), message.sources.length ? (_jsx("div", { className: "assistant-source-list", "aria-label": "Sources", children: message.sources.map((source) => (_jsxs("span", { className: "assistant-source-chip", children: [source.type, ": ", source.title] }, `${source.type}-${source.id}`))) })) : null] }, message.id)))) : (_jsxs("div", { className: "assistant-empty-state", children: [_jsx("p", { className: "section-label", children: "Ready for local data questions" }), _jsx("h3", { children: "Ask about sessions, calendar items, todos, activities, timelogs, or linked meeting context." }), _jsx("p", { className: "muted", children: workspaceSummary.snippet })] })) }), _jsxs("div", { className: "assistant-composer", children: [_jsx("textarea", { value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                        event.preventDefault();
                                        void submit();
                                    }
                                }, placeholder: "Ask, for example: What did we decide about the ARE project?" }), _jsx("button", { className: "primary-button", type: "button", onClick: () => void submit(), disabled: !draft.trim(), children: "Search NoteSmith" })] })] }), _jsxs("aside", { className: "assistant-side-panel", children: [_jsxs("section", { className: "card sidebar-card", children: [_jsx("h3", { children: "Available MCP tools" }), _jsx("div", { className: "assistant-tool-list", children: mcpTools.map((tool) => (_jsx("span", { className: "assistant-source-chip", children: tool.name }, tool.name))) })] }), _jsxs("section", { className: "card sidebar-card", children: [_jsx("h3", { children: "ChatGPT access" }), _jsx("p", { className: "muted", children: "Enable the local connection in Settings to let ChatGPT use these tools while NoteSmith is open." }), _jsx("button", { className: "small-button", type: "button", onClick: onOpenSettings, children: "Open connection settings" })] })] })] }));
};
