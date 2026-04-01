import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_TEXT_CACHE_TTL_MS,
  clearAITextCache,
  configureAITextCachePersistence,
  createAITextCacheKey,
  getCachedAITextResponse,
  hydrateAITextCache,
  snapshotAITextCache,
  storeCachedAITextResponse,
} from "./cache";

describe("ai cache", () => {
  beforeEach(() => {
    clearAITextCache();
    configureAITextCachePersistence({
      save: async () => {},
    });
  });

  it("creates identical keys for equivalent trimmed text input", () => {
    const left = createAITextCacheKey({
      operation: "translate-output",
      model: "gpt-5-mini",
      promptVersion: "2026-04-01",
      systemTexts: [" Rule one ", "Rule two"],
      userText: " Hello world ",
    });
    const right = createAITextCacheKey({
      operation: "translate-output",
      model: "gpt-5-mini",
      promptVersion: "2026-04-01",
      systemTexts: ["Rule one", "Rule two"],
      userText: "Hello world",
    });

    expect(left).toBe(right);
  });

  it("returns cached values until the ttl expires", () => {
    const key = createAITextCacheKey({
      operation: "revise-output",
      model: "gpt-5-mini",
      promptVersion: "2026-04-01",
      systemTexts: ["Revise"],
      userText: "Current output",
    });

    storeCachedAITextResponse({ key, value: "Cached result", now: 1_000 });

    expect(getCachedAITextResponse({ key, now: 1_000 + AI_TEXT_CACHE_TTL_MS - 1 })).toBe("Cached result");
    expect(getCachedAITextResponse({ key, now: 1_000 + AI_TEXT_CACHE_TTL_MS })).toBeNull();
  });

  it("hydrates and snapshots persisted cache entries", () => {
    hydrateAITextCache({
      now: 5_000,
      records: [
        { key: "fresh", value: "Keep", createdAt: 4_000, expiresAt: 6_000 },
        { key: "expired", value: "Drop", createdAt: 1_000, expiresAt: 4_000 },
      ],
    });

    expect(getCachedAITextResponse({ key: "fresh", now: 5_000 })).toBe("Keep");
    expect(getCachedAITextResponse({ key: "expired", now: 5_000 })).toBeNull();
    expect(snapshotAITextCache({ now: 5_000 })).toEqual([
      { key: "fresh", value: "Keep", createdAt: 4_000, expiresAt: 6_000 },
    ]);
  });
});