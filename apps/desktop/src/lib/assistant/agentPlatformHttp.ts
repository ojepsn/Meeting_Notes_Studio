export interface AgentPlatformSession {
  id: string;
  title?: string;
}

export interface AgentPlatformMessage {
  id: string;
  session_id: string;
}

export interface AgentPlatformSseEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface RunAgentPlatformTurnOptions {
  baseUrl: string;
  sessionId: string;
  inputMessageId: string;
  goal?: string;
  onTextDelta?: (text: string) => void;
  onEvent?: (event: AgentPlatformSseEvent) => void;
}

const trimBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

const postJson = async <T>(baseUrl: string, path: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(`${trimBaseUrl(baseUrl)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`agent_platform request failed (${response.status}): ${detail || response.statusText}`);
  }
  return response.json() as Promise<T>;
};

export const createAgentPlatformSession = (baseUrl: string, title: string) =>
  postJson<AgentPlatformSession>(baseUrl, "/api/sessions", {
    app_id: "notesmith-desktop-assistant",
    title,
  });

export const postAgentPlatformMessage = (baseUrl: string, sessionId: string, text: string) =>
  postJson<AgentPlatformMessage>(baseUrl, `/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    text,
    attachments: [],
  });

export const parseSseBlocks = (raw: string): AgentPlatformSseEvent[] =>
  raw
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const lines = block.split(/\r?\n/).filter(Boolean);
      const event = lines
        .find((line) => line.startsWith("event:"))
        ?.slice("event:".length)
        .trim();
      const dataText = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");
      if (!event || !dataText) {
        return null;
      }
      try {
        return { event, data: JSON.parse(dataText) as Record<string, unknown> };
      } catch {
        return null;
      }
    })
    .filter((event): event is AgentPlatformSseEvent => Boolean(event));

const extractTextDelta = (event: AgentPlatformSseEvent) => {
  if (event.event === "text_delta" && typeof event.data.text === "string") {
    return event.data.text;
  }
  return "";
};

const extractFinishedText = (event: AgentPlatformSseEvent) => {
  if (event.event === "finished" && typeof event.data.final_text === "string") {
    return event.data.final_text;
  }
  return "";
};

export const runAgentPlatformTurn = async ({
  baseUrl,
  sessionId,
  inputMessageId,
  goal = "Answer the user's question using the provided NoteSmith context.",
  onTextDelta,
  onEvent,
}: RunAgentPlatformTurnOptions) => {
  const response = await fetch(`${trimBaseUrl(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}/runs/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input_message_id: inputMessageId,
      workflow_name: "default_chat",
      goal,
      max_turns: 20,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`agent_platform run failed (${response.status}): ${detail || response.statusText}`);
  }
  if (!response.body) {
    throw new Error("agent_platform did not return a readable run stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamedText = "";
  let finalText = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const boundary = buffer.match(/\r?\n\r?\n/);
    if (boundary) {
      const lastBoundaryIndex = Math.max(buffer.lastIndexOf("\n\n"), buffer.lastIndexOf("\r\n\r\n"));
      const complete = buffer.slice(0, lastBoundaryIndex + boundary[0].length);
      buffer = buffer.slice(lastBoundaryIndex + boundary[0].length);
      for (const event of parseSseBlocks(complete)) {
        onEvent?.(event);
        if (event.event === "error" && typeof event.data.message === "string") {
          throw new Error(event.data.message);
        }
        const delta = extractTextDelta(event);
        if (delta) {
          streamedText += delta;
          onTextDelta?.(delta);
        }
        const finishedText = extractFinishedText(event);
        if (finishedText) {
          finalText = finishedText;
        }
      }
    }
    if (done) break;
  }

  for (const event of parseSseBlocks(buffer)) {
    onEvent?.(event);
    const delta = extractTextDelta(event);
    if (delta) {
      streamedText += delta;
      onTextDelta?.(delta);
    }
    const finishedText = extractFinishedText(event);
    if (finishedText) {
      finalText = finishedText;
    }
  }

  return finalText || streamedText;
};
