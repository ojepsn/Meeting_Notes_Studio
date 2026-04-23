import { useEffect, useMemo, useState } from "react";
import type { DesktopAppSnapshot } from "@notesmith/domain";
import {
  summarizeNoteSmithWorkspace,
  type NoteSmithAssistantSource,
} from "../../../lib/assistant/notesmithDataTools";
import { buildAgentPlatformLaunchConfig, getAgentPlatformStoragePolicy } from "../../../lib/assistant/agentPlatform";
import {
  checkAgentSidecarHealth,
  getAgentSidecarStatus,
  startAgentSidecar,
  stopAgentSidecar,
  type AgentSidecarReady,
} from "../../../lib/assistant/agentSidecar";
import {
  createAgentPlatformSession,
  postAgentPlatformMessage,
  runAgentPlatformTurn,
} from "../../../lib/assistant/agentPlatformHttp";
import { invokeNoteSmithMcpTool, listNoteSmithMcpTools } from "../../../lib/assistant/notesmithMcpBridge";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources: NoteSmithAssistantSource[];
  createdAt: string;
}

interface AssistantWorkspaceProps {
  snapshot: DesktopAppSnapshot;
  onOpenSettings: () => void;
}

const createMessageId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const AssistantWorkspace = ({ snapshot, onOpenSettings }: AssistantWorkspaceProps) => {
  const [draft, setDraft] = useState("");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sidecarReady, setSidecarReady] = useState<AgentSidecarReady | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState("Not started");
  const [runtimeHealth, setRuntimeHealth] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [isStartingRuntime, setIsStartingRuntime] = useState(false);
  const [isAskingAgent, setIsAskingAgent] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const workspaceSummary = useMemo(() => summarizeNoteSmithWorkspace(snapshot, includePrivate), [snapshot, includePrivate]);
  const mcpTools = useMemo(() => listNoteSmithMcpTools(), []);
  const launchConfig = useMemo(
    () =>
      buildAgentPlatformLaunchConfig({
        settings: snapshot.settings,
        agentDataDir: "./notesmith-agent",
        notesmithMcpCommand: "notesmith-mcp",
      }),
    [snapshot.settings],
  );
  const storagePolicy = getAgentPlatformStoragePolicy();

  useEffect(() => {
    let isActive = true;
    getAgentSidecarStatus()
      .then((status) => {
        if (!isActive || !status) return;
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSidecarReady(null);
      setRuntimeError(message);
      setRuntimeStatus("Runtime not available");
    } finally {
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

  const collectMcpSources = (query: string) =>
    [
      "notesmith_search_sessions",
      "notesmith_search_calendar",
      "notesmith_search_todos",
      "notesmith_search_activities",
      "notesmith_search_timelogs",
    ]
      .flatMap((toolName) => {
        const result = invokeNoteSmithMcpTool(snapshot, toolName as Parameters<typeof invokeNoteSmithMcpTool>[1], {
          query,
          includePrivate,
          limit: 4,
        });
        return "sources" in result ? result.sources : [];
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

  const buildAgentPrompt = (query: string, sources: NoteSmithAssistantSource[]) => {
    const sourceContext = sources.length
      ? sources
          .map(
            (source, index) =>
              `[${index + 1}] ${source.type}: ${source.title}${source.date ? ` (${source.date})` : ""}\n${source.snippet}`,
          )
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
    if (!query || isAskingAgent) return;
    const createdAt = new Date().toISOString();
    const sources = collectMcpSources(query);
    const userMessage: AssistantMessage = { id: createMessageId(), role: "user", text: query, sources: [], createdAt };
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
      const sessionId =
        agentSessionId ??
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
          setMessages((current) =>
            current.map((message) => (message.id === assistantMessageId ? { ...message, text: streamedText } : message)),
          );
        },
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, text: finalText || streamedText || "The agent completed without returning text." }
            : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: `The local agent runtime could not complete this answer: ${error instanceof Error ? error.message : String(error)}`,
              }
            : message,
        ),
      );
    } finally {
      setIsAskingAgent(false);
    }
  };

  const hasApiKey = Boolean(snapshot.settings.apiKey.trim());

  return (
    <div className="assistant-workspace">
      <section className="card assistant-chat-card">
        <div className="card-header assistant-workspace-header">
          <div>
            <p className="section-label">Assistant</p>
            <h2>Chat with your NoteSmith data</h2>
            <p className="muted">
              First release foundation: the read-only NoteSmith data tools are ready for the MCP bridge. The local preview below uses the same scoped data layer the agent will call.
            </p>
          </div>
          <div className="assistant-status-stack">
            <span className="status-chip">MCP bridge first</span>
            <span className={`status-chip ${sidecarReady ? "status-chip-saved" : ""}`}>
              {sidecarReady ? "Runtime running" : "Runtime idle"}
            </span>
            <span className={`status-chip ${hasApiKey ? "status-chip-saved" : "status-chip-error"}`}>
              {hasApiKey ? "OpenAI key ready" : "OpenAI key missing"}
            </span>
          </div>
        </div>

        <div className="assistant-option-row">
          <label className="checkbox-label assistant-private-toggle">
            <input type="checkbox" checked={includePrivate} onChange={(event) => setIncludePrivate(event.target.checked)} />
            Include private items in Assistant context
          </label>
          <button className="small-button" type="button" onClick={onOpenSettings}>
            AI settings
          </button>
        </div>

        <div className="assistant-thread" aria-live="polite">
          {messages.length ? (
            messages.map((message) => (
              <article key={message.id} className="assistant-message" data-role={message.role}>
                <div className="assistant-message-meta">
                  <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                  <span className="muted">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p>{message.text}</p>
                {message.sources.length ? (
                  <div className="assistant-source-list" aria-label="Sources">
                    {message.sources.map((source) => (
                      <span key={`${source.type}-${source.id}`} className="assistant-source-chip">
                        {source.type}: {source.title}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="assistant-empty-state">
              <p className="section-label">Ready for local data questions</p>
              <h3>Ask about sessions, calendar items, todos, activities, timelogs, or linked meeting context.</h3>
              <p className="muted">{workspaceSummary.snippet}</p>
            </div>
          )}
        </div>

        <div className="assistant-composer">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Ask, for example: What did we decide about the ARE project?"
          />
          <button className="primary-button" type="button" onClick={() => void submit()} disabled={!draft.trim() || isAskingAgent}>
            {isAskingAgent ? "Asking..." : sidecarReady ? "Ask Agent" : "Preview Sources"}
          </button>
        </div>
      </section>

      <aside className="assistant-side-panel">
        <section className="card sidebar-card">
          <h3>Agent runtime</h3>
          <div className="section-list">
            <div className="list-item">
              <strong>Integration</strong>
              <span className="muted">agent_platform sidecar over local HTTP/SSE</span>
            </div>
            <div className="list-item">
              <strong>Tool boundary</strong>
              <span className="muted">NoteSmith data is exposed through MCP tools only.</span>
            </div>
            <div className="list-item">
              <strong>Ready event</strong>
              <span className="muted">{launchConfig.expectedReadyEvent}</span>
            </div>
            <div className="list-item">
              <strong>Status</strong>
              <span className="muted">{runtimeStatus}</span>
            </div>
            {sidecarReady ? (
              <div className="list-item">
                <strong>Endpoint</strong>
                <span className="muted">{sidecarReady.baseUrl}</span>
              </div>
            ) : null}
            {runtimeHealth ? (
              <div className="list-item">
                <strong>Health</strong>
                <span className="muted">{runtimeHealth}</span>
              </div>
            ) : null}
          </div>
          {runtimeError ? (
            <div className="assistant-runtime-error" role="status">
              <strong>Runtime could not start</strong>
              <span>{runtimeError}</span>
              <span>
                Release builds include the agent sidecar. In development builds, run `npm run desktop:sidecar:prepare` or install `agent-sidecar` on PATH.
              </span>
            </div>
          ) : null}
          <div className="assistant-runtime-actions">
            <button className="primary-button" type="button" onClick={startRuntime} disabled={isStartingRuntime || Boolean(sidecarReady)}>
              {isStartingRuntime ? "Starting..." : sidecarReady ? "Runtime running" : "Start local agent runtime"}
            </button>
            <button className="small-button" type="button" onClick={stopRuntime} disabled={!sidecarReady && !isStartingRuntime}>
              Stop runtime
            </button>
          </div>
          <p className="muted assistant-runtime-note">
            Release builds include the local `agent_platform` sidecar. Development builds fall back to `agent-sidecar` on PATH if the bundled binary has not been prepared.
          </p>
        </section>

        <section className="card sidebar-card">
          <h3>Available MCP tools</h3>
          <div className="assistant-tool-list">
            {mcpTools.map((tool) => (
              <span key={tool.name} className="assistant-source-chip">
                {tool.name}
              </span>
            ))}
          </div>
        </section>

        <section className="card sidebar-card">
          <h3>API key handling</h3>
          <div className="section-list">
            <div className="list-item">
              <strong>Owner</strong>
              <span className="muted">{storagePolicy.owner}</span>
            </div>
            <div className="list-item">
              <strong>Runtime</strong>
              <span className="muted">{storagePolicy.runtime}</span>
            </div>
            <div className="list-item">
              <strong>Persistence</strong>
              <span className="muted">{storagePolicy.persistence}</span>
            </div>
          </div>
        </section>

        <details className="card sidebar-card workspace-disclosure">
          <summary>Sidecar environment preview</summary>
          <div className="workspace-disclosure-body">
            <pre className="assistant-env-preview">{JSON.stringify(launchConfig.redactedEnv, null, 2)}</pre>
          </div>
        </details>
      </aside>
    </div>
  );
};
