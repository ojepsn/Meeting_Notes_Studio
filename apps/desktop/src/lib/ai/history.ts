import type { AIErrorCode, AIOperation } from "./client/openaiClient";
import type { AIRuntimeEvent } from "./runtime";

interface ActiveRequestState {
  requestId: string;
  operation: AIOperation;
  promptVersion?: string;
  retryCount: number;
  cached: boolean;
}

export interface AIRequestHistoryEntry {
  requestId: string;
  operation: AIOperation;
  promptVersion?: string;
  status: "success" | "failure";
  cached: boolean;
  retryCount: number;
  durationMs: number;
  timestamp: number;
  errorCode?: AIErrorCode;
  errorMessage?: string;
}

export const AI_REQUEST_HISTORY_MAX_ENTRIES = 40;

const activeRequests = new Map<string, ActiveRequestState>();
let historyEntries: AIRequestHistoryEntry[] = [];
let persistHistoryWrite: ((records: AIRequestHistoryEntry[]) => Promise<void>) | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingHistorySnapshot: AIRequestHistoryEntry[] | null = null;

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

const recordHistoryEntry = (entry: AIRequestHistoryEntry) => {
  historyEntries = [entry, ...historyEntries.filter((item) => item.requestId !== entry.requestId)];
  trimHistory();
  schedulePersist();
};

export const resetAIRequestHistory = () => {
  activeRequests.clear();
  historyEntries = [];
};

export const hydrateAIRequestHistory = (entries: AIRequestHistoryEntry[]) => {
  historyEntries = [...entries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, AI_REQUEST_HISTORY_MAX_ENTRIES);
};

export const configureAIRequestHistoryPersistence = ({
  save,
}: {
  save: (records: AIRequestHistoryEntry[]) => Promise<void>;
}) => {
  persistHistoryWrite = save;
};

export const getAIRequestHistory = () => [...historyEntries];

export const recordAIRequestHistory = (event: AIRuntimeEvent) => {
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
        errorCode: event.error instanceof Error && "code" in event.error ? (event.error.code as AIErrorCode) : undefined,
        errorMessage: event.error instanceof Error ? event.error.message : undefined,
      });
      activeRequests.delete(event.requestId);
      break;
    }
    default:
      break;
  }
};