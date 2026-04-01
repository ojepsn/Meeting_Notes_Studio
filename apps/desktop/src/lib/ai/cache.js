export const AI_TEXT_CACHE_TTL_MS = 10 * 60_000;
export const AI_TEXT_CACHE_MAX_ENTRIES = 100;
const CACHEABLE_OPERATIONS = new Set(["revise-output", "translate-output"]);
const aiTextCache = new Map();
const CACHE_PERSIST_DEBOUNCE_MS = 250;
let persistTimer = null;
let persistCacheSnapshot = null;
let persistCacheWrite = null;
const normalizeText = (value) => value.trim();
const evictExpiredEntries = (now) => {
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
export const hydrateAITextCache = ({ records, now = Date.now(), }) => {
    aiTextCache.clear();
    records.forEach((record) => {
        if (record.expiresAt > now && record.value.trim()) {
            aiTextCache.set(record.key, record);
        }
    });
    evictOverflowEntries();
};
export const configureAITextCachePersistence = ({ save, }) => {
    persistCacheWrite = save;
};
export const snapshotAITextCache = ({ now = Date.now() } = {}) => snapshotEntries(now);
export const isAITextCacheableOperation = (operation) => CACHEABLE_OPERATIONS.has(operation);
export const createAITextCacheKey = ({ operation, model, promptVersion, systemTexts, userText, }) => JSON.stringify({
    operation,
    model,
    promptVersion: promptVersion || "unversioned",
    systemTexts: systemTexts.map(normalizeText).filter(Boolean),
    userText: normalizeText(userText),
});
export const getCachedAITextResponse = ({ key, now = Date.now(), }) => {
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
export const storeCachedAITextResponse = ({ key, value, now = Date.now(), }) => {
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
