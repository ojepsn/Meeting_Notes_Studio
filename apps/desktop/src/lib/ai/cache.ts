import type { AIOperation } from "./client/openaiClient";

type AICacheableOperation = Extract<AIOperation, "revise-output" | "translate-output">;

export interface AITextCacheEntry {
  key: string;
  value: string;
  createdAt: number;
  expiresAt: number;
}

export const AI_TEXT_CACHE_TTL_MS = 10 * 60_000;
export const AI_TEXT_CACHE_MAX_ENTRIES = 100;

const CACHEABLE_OPERATIONS = new Set<AICacheableOperation>(["revise-output", "translate-output"]);
const aiTextCache = new Map<string, AITextCacheEntry>();
const CACHE_PERSIST_DEBOUNCE_MS = 250;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistCacheSnapshot: AITextCacheEntry[] | null = null;
let persistCacheWrite: ((records: AITextCacheEntry[]) => Promise<void>) | null = null;

const normalizeText = (value: string) => value.trim();

const evictExpiredEntries = (now: number) => {
  for (const [key, entry] of aiTextCache.entries()) {
    if (entry.expiresAt <= now) {
      aiTextCache.delete(key);
    }
  }
};

const evictOverflowEntries = () => {
  if (aiTextCache.size <= AI_TEXT_CACHE_MAX_ENTRIES) {
    return;
  }

  const oldestEntries = [...aiTextCache.values()].sort((left, right) => left.createdAt - right.createdAt);
  while (aiTextCache.size > AI_TEXT_CACHE_MAX_ENTRIES && oldestEntries.length) {
    const nextEntry = oldestEntries.shift();
    if (!nextEntry) {
      break;
    }
    aiTextCache.delete(nextEntry.key);
  }
};

const snapshotEntries = (now = Date.now()) => {
  evictExpiredEntries(now);
  return [...aiTextCache.values()].sort((left, right) => right.createdAt - left.createdAt);
};

const schedulePersist = (now = Date.now()) => {
  if (!persistCacheWrite) {
    return;
  }

  persistCacheSnapshot = snapshotEntries(now);
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    const nextSnapshot = persistCacheSnapshot;
    const persistWrite = persistCacheWrite;
    persistCacheSnapshot = null;
    persistTimer = null;
    if (!nextSnapshot || !persistWrite) {
      return;
    }
    void persistWrite(nextSnapshot).catch((error) => {
      console.error("NoteSmith AI cache persistence failed", error);
    });
  }, CACHE_PERSIST_DEBOUNCE_MS);
};

export const clearAITextCache = () => {
  aiTextCache.clear();
};

export const hydrateAITextCache = ({
  records,
  now = Date.now(),
}: {
  records: AITextCacheEntry[];
  now?: number;
}) => {
  aiTextCache.clear();
  records.forEach((record) => {
    if (record.expiresAt > now && record.value.trim()) {
      aiTextCache.set(record.key, record);
    }
  });
  evictOverflowEntries();
};

export const configureAITextCachePersistence = ({
  save,
}: {
  save: (records: AITextCacheEntry[]) => Promise<void>;
}) => {
  persistCacheWrite = save;
};

export const snapshotAITextCache = ({ now = Date.now() }: { now?: number } = {}) => snapshotEntries(now);

export const isAITextCacheableOperation = (operation: AIOperation): operation is AICacheableOperation =>
  CACHEABLE_OPERATIONS.has(operation as AICacheableOperation);

export const createAITextCacheKey = ({
  operation,
  model,
  promptVersion,
  systemTexts,
  userText,
}: {
  operation: AIOperation;
  model: string;
  promptVersion?: string;
  systemTexts: string[];
  userText: string;
}) =>
  JSON.stringify({
    operation,
    model,
    promptVersion: promptVersion || "unversioned",
    systemTexts: systemTexts.map(normalizeText).filter(Boolean),
    userText: normalizeText(userText),
  });

export const getCachedAITextResponse = ({
  key,
  now = Date.now(),
}: {
  key: string;
  now?: number;
}) => {
  evictExpiredEntries(now);
  const entry = aiTextCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    aiTextCache.delete(key);
    return null;
  }

  return entry.value;
};

export const storeCachedAITextResponse = ({
  key,
  value,
  now = Date.now(),
}: {
  key: string;
  value: string;
  now?: number;
}) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return;
  }

  evictExpiredEntries(now);
  aiTextCache.set(key, {
    key,
    value: trimmedValue,
    createdAt: now,
    expiresAt: now + AI_TEXT_CACHE_TTL_MS,
  });
  evictOverflowEntries();
  schedulePersist(now);
};