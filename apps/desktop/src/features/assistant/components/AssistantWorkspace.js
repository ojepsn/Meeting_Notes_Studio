import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { summarizeNoteSmithWorkspace, } from "../../../lib/assistant/notesmithDataTools";
import { buildAgentPlatformLaunchConfig, getAgentPlatformStoragePolicy } from "../../../lib/assistant/agentPlatform";
import { checkAgentSidecarHealth, getAgentSidecarStatus, startAgentSidecar, stopAgentSidecar, } from "../../../lib/assistant/agentSidecar";
import { createAgentPlatformSession, postAgentPlatformMessage, runAgentPlatformTurn, } from "../../../lib/assistant/agentPlatformHttp";
import { invokeNoteSmithMcpTool, listNoteSmithMcpTools } from "../../../lib/assistant/notesmithMcpBridge";
const createMessageId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
export const AssistantWorkspace = ({ snapshot, onOpenSettings }) => {
    const [draft, setDraft] = useState("");
    const [includePrivate, setIncludePrivate] = useState(false);
    const [messages, setMessages] = useState([]);
    const [sidecarReady, setSidecarReady] = useState(null);
    const [runtimeStatus, setRuntimeStatus] = useState("Not started");
    const [runtimeHealth, setRuntimeHealth] = useState(null);
    const [runtimeError, setRuntimeError] = useState(null);
    const [isStartingRuntime, setIsStartingRuntime] = useState(false);
    const [isAskingAgent, setIsAskingAgent] = useState(false);
    const [agentSessionId, setAgentSessionId] = useState(null);
    const workspaceSummary = useMemo(() => summarizeNoteSmithWorkspace(snapshot, includePrivate), [snapshot, includePrivate]);
    const mcpTools = useMemo(() => listNoteSmithMcpTools(), []);
    const launchConfig = useMemo(() => buildAgentPlatformLaunchConfig({
        settings: snapshot.settings,
        agentDataDir: "./notesmith-agent",
        notesmithMcpCommand: "notesmith-mcp",
    }), [snapshot.settings]);
    const storagePolicy = getAgentPlatformStoragePolicy();
    useEffect(() => {
        let isActive = true;
        getAgentSidecarStatus()
            .then((status) => {
            if (!isActive || !status)
                return;
            setSidecarReady(status);
            setRuntimeStatus("Running locally");
        })
            .catch(() => {
            if (isActive) {
                setRuntimeStatus("Not started");
            }
        });
        return () => {
            isActive = false;
        };
    }, []);
    const startRuntime = async () => {
        setIsStartingRuntime(true);
        setRuntimeHealth(null);
        setRuntimeError(null);
        setRuntimeStatus("Starting agent-sidecar...");
        try {
            const ready = await startAgentSidecar(launchConfig.env);
            setSidecarReady(ready);
            setRuntimeStatus("Running locally");
            const health = await checkAgentSidecarHealth(ready.baseUrl);
            setRuntimeHealth(health.ok ? "Health check passed" : "Runtime started; health endpoint not confirmed yet.");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setSidecarReady(null);
            setRuntimeError(message);
            setRuntimeStatus("Runtime not available");
        }
        finally {
            setIsStartingRuntime(false);
        }
    };
    const stopRuntime = async () => {
        await stopAgentSidecar();
        setSidecarReady(null);
        setRuntimeHealth(null);
        setRuntimeError(null);
        setRuntimeStatus("Stopped");
    };
    const collectMcpSources = (query) => [
        "notesmith_search_sessions",
        "notesmith_search_calendar",
        "notesmith_search_todos",
        "notesmith_search_activities",
        "notesmith_search_timelogs",
    ]
        .flatMap((toolName) => {
        const result = invokeNoteSmithMcpTool(snapshot, toolName, {
            query,
            includePrivate,
            limit: 4,
        });
        return "sources" in result ? result.sources : [];
    })
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);
    const buildAgentPrompt = (query, sources) => {
        const sourceContext = sources.length
            ? sources
                .map((source, index) => `[${index + 1}] ${source.type}: ${source.title}${source.date ? ` (${source.date})` : ""}\n${source.snippet}`)
                .join("\n\n")
            : "No matching NoteSmith records were found through the MCP bridge.";
        return [
            "You are the NoteSmith Assistant inside the desktop app.",
            "Answer the user's question using the NoteSmith context below. The context was retrieved through the NoteSmith MCP bridge, which is the only allowed app-data boundary.",
            "If the context is insufficient, say what is missing instead of inventing facts.",
            "",
            `User question: ${query}`,
            "",
            "NoteSmith MCP context:",
            sourceContext,
        ].join("\n");
    };
    const submit = async () => {
        const query = draft.trim();
        if (!query || isAskingAgent)
            return;
        const createdAt = new Date().toISOString();
        const sources = collectMcpSources(query);
        const userMessage = { id: createMessageId(), role: "user", text: query, sources: [], createdAt };
        const assistantMessageId = createMessageId();
        const fallbackAnswer = sources.length
            ? `MCP preview found ${sources.length} matching NoteSmith ${sources.length === 1 ? "record" : "records"} for "${query}". The local agent runtime is not running, so this is source preview only.\n\n${sources
                .map((source) => `- ${source.title}${source.date ? ` (${source.date})` : ""}: ${source.snippet}`)
                .join("\n")}`
            : `MCP preview did not find matching NoteSmith records for "${query}". The local agent runtime is not running, so no model answer was generated.`;
        setMessages((current) => [
            ...current,
            userMessage,
            {
                id: assistantMessageId,
                role: "assistant",
                text: sidecarReady ? "Thinking with agent_platform..." : fallbackAnswer,
                sources,
                createdAt,
            },
        ]);
        setDraft("");
        if (!sidecarReady) {
            return;
        }
        setIsAskingAgent(true);
        try {
            const sessionId = agentSessionId ??
                (await createAgentPlatformSession(sidecarReady.baseUrl, "NoteSmith Assistant")).id;
            if (!agentSessionId) {
                setAgentSessionId(sessionId);
            }
            const platformMessage = await postAgentPlatformMessage(sidecarReady.baseUrl, sessionId, buildAgentPrompt(query, sources));
            let streamedText = "";
            const finalText = await runAgentPlatformTurn({
                baseUrl: sidecarReady.baseUrl,
                sessionId,
                inputMessageId: platformMessage.id,
                goal: "Answer NoteSmith data questions using the provided MCP-scoped context.",
                onTextDelta: (delta) => {
                    streamedText += delta;
                    setMessages((current) => current.map((message) => (message.id === assistantMessageId ? { ...message, text: streamedText } : message)));
                },
            });
            setMessages((current) => current.map((message) => message.id === assistantMessageId
                ? { ...message, text: finalText || streamedText || "The agent completed without returning text." }
                : message));
        }
        catch (error) {
            setMessages((current) => current.map((message) => message.id === assistantMessageId
                ? {
                    ...message,
                    text: `The local agent runtime could not complete this answer: ${error instanceof Error ? error.message : String(error)}`,
                }
                : message));
        }
        finally {
            setIsAskingAgent(false);
        }
    };
    const hasApiKey = Boolean(snapshot.settings.apiKey.trim());
    return (_jsxs("div", { className: "assistant-workspace", children: [_jsxs("section", { className: "card assistant-chat-card", children: [_jsxs("div", { className: "card-header assistant-workspace-header", children: [_jsxs("div", { children: [_jsx("p", { className: "section-label", children: "Assistant" }), _jsx("h2", { children: "Chat with your NoteSmith data" }), _jsx("p", { className: "muted", children: "First release foundation: the read-only NoteSmith data tools are ready for the MCP bridge. The local preview below uses the same scoped data layer the agent will call." })] }), _jsxs("div", { className: "assistant-status-stack", children: [_jsx("span", { className: "status-chip", children: "MCP bridge first" }), _jsx("span", { className: `status-chip ${sidecarReady ? "status-chip-saved" : ""}`, children: sidecarReady ? "Runtime running" : "Runtime idle" }), _jsx("span", { className: `status-chip ${hasApiKey ? "status-chip-saved" : "status-chip-error"}`, children: hasApiKey ? "OpenAI key ready" : "OpenAI key missing" })] })] }), _jsxs("div", { className: "assistant-option-row", children: [_jsxs("label", { className: "checkbox-label assistant-private-toggle", children: [_jsx("input", { type: "checkbox", checked: includePrivate, onChange: (event) => setIncludePrivate(event.target.checked) }), "Include private items in Assistant context"] }), _jsx("button", { className: "small-button", type: "button", onClick: onOpenSettings, children: "AI settings" })] }), _jsx("div", { className: "assistant-thread", "aria-live": "polite", children: messages.length ? (messages.map((message) => (_jsxs("article", { className: "assistant-message", "data-role": message.role, children: [_jsxs("div", { className: "assistant-message-meta", children: [_jsx("strong", { children: message.role === "user" ? "You" : "Assistant" }), _jsx("span", { className: "muted", children: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })] }), _jsx("p", { children: message.text }), message.sources.length ? (_jsx("div", { className: "assistant-source-list", "aria-label": "Sources", children: message.sources.map((source) => (_jsxs("span", { className: "assistant-source-chip", children: [source.type, ": ", source.title] }, `${source.type}-${source.id}`))) })) : null] }, message.id)))) : (_jsxs("div", { className: "assistant-empty-state", children: [_jsx("p", { className: "section-label", children: "Ready for local data questions" }), _jsx("h3", { children: "Ask about sessions, calendar items, todos, activities, timelogs, or linked meeting context." }), _jsx("p", { className: "muted", children: workspaceSummary.snippet })] })) }), _jsxs("div", { className: "assistant-composer", children: [_jsx("textarea", { value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                        event.preventDefault();
                                        void submit();
                                    }
                                }, placeholder: "Ask, for example: What did we decide about the ARE project?" }), _jsx("button", { className: "primary-button", type: "button", onClick: () => void submit(), disabled: !draft.trim() || isAskingAgent, children: isAskingAgent ? "Asking..." : sidecarReady ? "Ask Agent" : "Preview Sources" })] })] }), _jsxs("aside", { className: "assistant-side-panel", children: [_jsxs("section", { className: "card sidebar-card", children: [_jsx("h3", { children: "Agent runtime" }), _jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Integration" }), _jsx("span", { className: "muted", children: "agent_platform sidecar over local HTTP/SSE" })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Tool boundary" }), _jsx("span", { className: "muted", children: "NoteSmith data is exposed through MCP tools only." })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Ready event" }), _jsx("span", { className: "muted", children: launchConfig.expectedReadyEvent })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Status" }), _jsx("span", { className: "muted", children: runtimeStatus })] }), sidecarReady ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Endpoint" }), _jsx("span", { className: "muted", children: sidecarReady.baseUrl })] })) : null, runtimeHealth ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Health" }), _jsx("span", { className: "muted", children: runtimeHealth })] })) : null] }), runtimeError ? (_jsxs("div", { className: "assistant-runtime-error", role: "status", children: [_jsx("strong", { children: "Runtime could not start" }), _jsx("span", { children: runtimeError }), _jsx("span", { children: "Release builds include the agent sidecar. In development builds, run `npm run desktop:sidecar:prepare` or install `agent-sidecar` on PATH." })] })) : null, _jsxs("div", { className: "assistant-runtime-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: startRuntime, disabled: isStartingRuntime || Boolean(sidecarReady), children: isStartingRuntime ? "Starting..." : sidecarReady ? "Runtime running" : "Start local agent runtime" }), _jsx("button", { className: "small-button", type: "button", onClick: stopRuntime, disabled: !sidecarReady && !isStartingRuntime, children: "Stop runtime" })] }), _jsx("p", { className: "muted assistant-runtime-note", children: "Release builds include the local `agent_platform` sidecar. Development builds fall back to `agent-sidecar` on PATH if the bundled binary has not been prepared." })] }), _jsxs("section", { className: "card sidebar-card", children: [_jsx("h3", { children: "Available MCP tools" }), _jsx("div", { className: "assistant-tool-list", children: mcpTools.map((tool) => (_jsx("span", { className: "assistant-source-chip", children: tool.name }, tool.name))) })] }), _jsxs("section", { className: "card sidebar-card", children: [_jsx("h3", { children: "API key handling" }), _jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Owner" }), _jsx("span", { className: "muted", children: storagePolicy.owner })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Runtime" }), _jsx("span", { className: "muted", children: storagePolicy.runtime })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Persistence" }), _jsx("span", { className: "muted", children: storagePolicy.persistence })] })] })] }), _jsxs("details", { className: "card sidebar-card workspace-disclosure", children: [_jsx("summary", { children: "Sidecar environment preview" }), _jsx("div", { className: "workspace-disclosure-body", children: _jsx("pre", { className: "assistant-env-preview", children: JSON.stringify(launchConfig.redactedEnv, null, 2) }) })] })] })] }));
};
