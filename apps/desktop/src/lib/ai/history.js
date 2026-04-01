export const AI_REQUEST_HISTORY_MAX_ENTRIES = 40;
const activeRequests = new Map();
let historyEntries = [];
let persistHistoryWrite = null;
let persistTimer = null;
let pendingHistorySnapshot = null;
const trimHistory = () => {
    if (historyEntries.length > AI_REQUEST_HISTORY_MAX_ENTRIES) {
        historyEntries = historyEntries.slice(0, AI_REQUEST_HISTORY_MAX_ENTRIES);
    }
};
const schedulePersist = () => {
    if (!persistHistoryWrite) {
        return;
    }
    pendingHistorySnapshot = [...historyEntries];
    if (persistTimer) {
        clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
        const persistWrite = persistHistoryWrite;
        const nextSnapshot = pendingHistorySnapshot;
        persistTimer = null;
        pendingHistorySnapshot = null;
        if (!persistWrite || !nextSnapshot) {
            return;
        }
        void persistWrite(nextSnapshot).catch((error) => {
            console.error("NoteSmith AI history persistence failed", error);
        });
    }, 250);
};
const recordHistoryEntry = (entry) => {
    historyEntries = [entry, ...historyEntries.filter((item) => item.requestId !== entry.requestId)];
    trimHistory();
    schedulePersist();
};
export const resetAIRequestHistory = () => {
    activeRequests.clear();
    historyEntries = [];
};
export const hydrateAIRequestHistory = (entries) => {
    historyEntries = [...entries]
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, AI_REQUEST_HISTORY_MAX_ENTRIES);
};
export const configureAIRequestHistoryPersistence = ({ save, }) => {
    persistHistoryWrite = save;
};
export const getAIRequestHistory = () => [...historyEntries];
export const recordAIRequestHistory = (event) => {
    switch (event.type) {
        case "request-start":
            activeRequests.set(event.requestId, {
                requestId: event.requestId,
                operation: event.operation,
                promptVersion: event.promptVersion,
                retryCount: 0,
                cached: false,
            });
            break;
        case "request-retry": {
            const activeRequest = activeRequests.get(event.requestId);
            if (activeRequest) {
                activeRequest.retryCount += 1;
            }
            break;
        }
        case "cache-hit": {
            const activeRequest = activeRequests.get(event.requestId);
            if (activeRequest) {
                activeRequest.cached = true;
            }
            break;
        }
        case "request-success": {
            const activeRequest = activeRequests.get(event.requestId);
            recordHistoryEntry({
                requestId: event.requestId,
                operation: event.operation,
                promptVersion: event.promptVersion,
                status: "success",
                cached: activeRequest?.cached ?? false,
                retryCount: activeRequest?.retryCount ?? 0,
                durationMs: event.durationMs,
                timestamp: Date.now(),
            });
            activeRequests.delete(event.requestId);
            break;
        }
        case "request-failure": {
            const activeRequest = activeRequests.get(event.requestId);
            recordHistoryEntry({
                requestId: event.requestId,
                operation: event.operation,
                promptVersion: event.promptVersion,
                status: "failure",
                cached: activeRequest?.cached ?? false,
                retryCount: activeRequest?.retryCount ?? 0,
                durationMs: event.durationMs,
                timestamp: Date.now(),
                errorCode: event.error instanceof Error && "code" in event.error ? event.error.code : undefined,
                errorMessage: event.error instanceof Error ? event.error.message : undefined,
            });
            activeRequests.delete(event.requestId);
            break;
        }
        default:
            break;
    }
};
