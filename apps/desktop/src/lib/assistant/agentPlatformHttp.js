const trimBaseUrl = (baseUrl) => baseUrl.replace(/\/+$/, "");
const postJson = async (baseUrl, path, body) => {
    const response = await fetch(`${trimBaseUrl(baseUrl)}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`agent_platform request failed (${response.status}): ${detail || response.statusText}`);
    }
    return response.json();
};
export const createAgentPlatformSession = (baseUrl, title) => postJson(baseUrl, "/api/sessions", {
    app_id: "notesmith-desktop-assistant",
    title,
});
export const postAgentPlatformMessage = (baseUrl, sessionId, text) => postJson(baseUrl, `/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    text,
    attachments: [],
});
export const parseSseBlocks = (raw) => raw
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
        return { event, data: JSON.parse(dataText) };
    }
    catch {
        return null;
    }
})
    .filter((event) => Boolean(event));
const extractTextDelta = (event) => {
    if (event.event === "text_delta" && typeof event.data.text === "string") {
        return event.data.text;
    }
    return "";
};
const extractFinishedText = (event) => {
    if (event.event === "finished" && typeof event.data.final_text === "string") {
        return event.data.final_text;
    }
    return "";
};
export const runAgentPlatformTurn = async ({ baseUrl, sessionId, inputMessageId, goal = "Answer the user's question using the provided NoteSmith context.", onTextDelta, onEvent, }) => {
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
        if (done)
            break;
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
