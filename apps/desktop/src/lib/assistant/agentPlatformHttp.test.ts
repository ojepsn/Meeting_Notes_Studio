import { describe, expect, it, vi } from "vitest";
import {
  createAgentPlatformSession,
  parseSseBlocks,
  postAgentPlatformMessage,
  runAgentPlatformTurn,
} from "./agentPlatformHttp";

describe("agent platform HTTP client", () => {
  it("creates sessions and posts messages against the documented API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "session-1", title: "NoteSmith Assistant" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "message-1", session_id: "session-1" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createAgentPlatformSession("http://127.0.0.1:8088/", "NoteSmith Assistant")).resolves.toMatchObject({
      id: "session-1",
    });
    await expect(postAgentPlatformMessage("http://127.0.0.1:8088", "session-1", "Hello")).resolves.toMatchObject({
      id: "message-1",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8088/api/sessions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8088/api/sessions/session-1/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("parses server-sent events from agent_platform", () => {
    expect(
      parseSseBlocks('event: text_delta\ndata: {"type":"text_delta","text":"Hello"}\n\n'),
    ).toEqual([{ event: "text_delta", data: { type: "text_delta", text: "Hello" } }]);
  });

  it("streams text deltas and returns final text when present", async () => {
    const encoded = new TextEncoder().encode(
      [
        'event: text_delta\ndata: {"type":"text_delta","text":"Hel"}',
        "",
        'event: text_delta\ndata: {"type":"text_delta","text":"lo"}',
        "",
        'event: finished\ndata: {"type":"finished","final_text":"Hello final"}',
        "",
        "",
      ].join("\n"),
    );
    const deltas: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(encoded);
            controller.close();
          },
        }),
      }),
    );

    await expect(
      runAgentPlatformTurn({
        baseUrl: "http://127.0.0.1:8088",
        sessionId: "session-1",
        inputMessageId: "message-1",
        onTextDelta: (text) => deltas.push(text),
      }),
    ).resolves.toBe("Hello final");
    expect(deltas.join("")).toBe("Hello");
  });
});
