import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { getPrimaryCaptureMode, getTemplatesForCaptureMode, type CaptureMode, type RuleSuggestionRecord, type SessionRecord, type TemplateDefinition } from "@notesmith/domain";
import { DateInput } from "../components/DateInput";
import { DeferredTimeInput } from "../components/DeferredTimeInput";
import { PeoplePicker } from "../components/PeoplePicker";
import { TokenPicker } from "../components/TokenPicker";
import { useDesktopStore } from "../state/useDesktopStore";
import { SessionEditor } from "../features/sessions/components/SessionEditor";
import { SessionsSidebar } from "../features/sessions/components/SessionsSidebar";
import { OutputWorkspace } from "../features/output/components/OutputWorkspace";
import { CalendarWorkspace } from "../features/calendar/components/CalendarWorkspace";
import { TodosRailCard } from "../features/todos/components/TodosRailCard";
import { TodosWorkspace } from "../features/todos/components/TodosWorkspace";
import { TimeWorkspace } from "../features/time/components/TimeWorkspace";
import { AnalyticsWorkspace } from "../features/analytics/components/AnalyticsWorkspace";
import { NowWorkspace } from "../features/now/components/NowWorkspace";
import { StructureWorkspace } from "../features/structure/components/StructureWorkspace";
import { AssistantWorkspace } from "../features/assistant/components/AssistantWorkspace";
import { NotebookWorkspace } from "../features/notebook/components/NotebookWorkspace";
import {
  getRunningTodoIds,
  TODOS_COMMAND_EVENT,
  sendTodosSnapshot,
  type TodosWindowCommand,
} from "../features/notebook/todosWindowBridge";
import { RichTextCommandProvider } from "../features/richTextCommands/RichTextCommandMenu";
import { SettingsCard } from "../features/settings/components/SettingsCard";
import type { SettingsSection } from "../features/settings/components/SettingsCard";
import { hydrateAITextCache, snapshotAITextCache } from "../lib/ai/cache";
import { generateNotes } from "../lib/ai/services/generateNotes";
import { getAIRequestHistory, hydrateAIRequestHistory, recordAIRequestHistory } from "../lib/ai/history";
import { formatAIErrorMessage } from "../lib/ai/messages";
import { AIRequestError } from "../lib/ai/client/openaiClient";
import { getAIDiagnosticsItems, getAIMetricsSnapshot } from "../lib/ai/metrics";
import {
  buildModelPricingStatus,
  buildTextModelOption,
  buildTranscriptionModelOption,
  createDefaultModelPricingSnapshot,
  fetchLatestModelPricingSnapshot,
  isPricingRefreshDue,
  msUntilNextPricingCheck,
  resolveAvailableTextModelId,
  resolveAvailableTranscriptionModelId,
  type AIModelPricingSnapshot,
} from "../lib/ai/modelPricing";
import { reviseOutput } from "../lib/ai/services/reviseOutput";
import { createAIRuntimeStatusHandler } from "../lib/ai/status";
import { transcribeAudio } from "../lib/ai/services/transcribeAudio";
import { translateOutput } from "../lib/ai/services/translateOutput";
import type { AIRuntimeEvent } from "../lib/ai/runtime";
import { checkForDesktopUpdates } from "../lib/ai/updater";
import { stopAgentSidecar } from "../lib/assistant/agentSidecar";
import { exportOutputAsDocx, exportOutputAsHtml, exportOutputAsMarkdown, exportOutputAsPdf, exportOutputAsText } from "../lib/export/exportService";
import {
  fileToAttachmentRecord,
  loadPersistedAttachmentFile,
  pickAudioFile,
  pickImageFile,
  pickTranscriptFile,
  persistGeneratedAttachment,
  persistSelectedAttachment,
  readTranscriptFile,
  removePersistedAttachment,
  restoreImportedAttachmentFiles,
} from "../lib/files/attachmentStore";
import {
  buildRecordingFilename,
  getSupportedRecordingMimeType,
  getSystemAudioDisplayOptions,
  RECORDING_MODE_LABELS,
  type RecordingMode,
} from "../lib/files/recording";
import {
  type DesktopBackupBundle,
  createLocalSnapshotBackup,
  downloadInstallerToDownloads,
  downloadInstallerToDownloadsAndOpen,
  exportSnapshotBackup,
  exportSnapshotBackupToDownloads,
  getDesktopBundleType,
  getDesktopAppVersion,
  getDesktopStorageInfo,
  getLatestLocalBackupInfo,
  importSnapshotBackup,
  mergeDesktopSnapshot,
  mergeImportedPwaSnapshot,
  openDesktopPath,
  openDesktopUrl,
  revealDesktopPath,
  withDesktopBackupAttachmentFiles,
  type LocalBackupInfo,
  type DesktopStorageInfo,
} from "../lib/storage/desktopStorage";
import { buildMetadataReview, EMPTY_METADATA_REVIEW, type MetadataReviewState } from "../lib/metadata/review";
import { isTauriRuntime } from "../lib/storage/environment";
import { findActivityIdForSession, findSessionIdForActivity, findSessionIdForTodo, findTodoIdForSession } from "../lib/links/entityLinks";
import { ensureMeetingOutputHeader } from "../lib/output/meetingOutput";
import { polishNonAiNotesText } from "../lib/output/manualPolish";
import { acceptRuleSuggestion, collectRuleSuggestionObservations, ignoreRuleSuggestion, mergeRuleSuggestionObservations } from "../lib/output/ruleSuggestions";
import { buildStructureOptions, createEmptyStructureOptions, getActivitiesForSelection, getProjectsForDomain } from "../lib/structure/options";
import { parseActivityShortcut, parseMeetingShortcut, parseTodoShortcut } from "../lib/todos/shortcut";
import { parseTokenList } from "../components/peoplePickerUtils";
import { formatStockholmDate as getStockholmDateKey } from "../lib/time/stockholm";
import { createSessionRecord } from "../lib/db/repository";

type AppWorkspace = "notebook" | "notes" | "now" | "todos" | "calendar" | "time" | "analytics" | "structure" | "assistant" | "files";
type OverlayPanel = "new-note" | "metadata-review" | "sessions" | "backup" | "settings" | "more" | "capture-details" | "output-details" | "calendar-output-preview" | "instructions" | null;
type CalendarSessionOverlayTab = "capture" | "output" | "details";
type NotesWorkspaceTab = "capture" | "output" | "details";
type CommandAction = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  shortcut?: string;
  action: () => void;
};

type OutputVersionRecord = {
  id: string;
  output: string;
  generatedAt: string;
};

type GenerationLogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  details?: string;
};

const richTextToPlainText = (value: string) => {
  if (!value) return "";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const splitStructuredOutput = (output: string) =>
  output
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => block.split("\n").map((line) => line.trim()).filter(Boolean));

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const describeFileForLog = (file: File) =>
  [
    `file: ${file.name}`,
    `mime: ${file.type || "(empty)"}`,
    `size: ${file.size} bytes (${formatFileSize(file.size)})`,
    `last modified: ${new Date(file.lastModified).toISOString()}`,
  ].join("\n");

const describeAIErrorForLog = (error: unknown) => {
  if (error instanceof AIRequestError) {
    return [
      `error: ${error.message}`,
      `code: ${error.code}`,
      `retryable: ${String(error.retryable)}`,
      typeof error.status === "number" ? `status: ${error.status}` : "",
      error.cause instanceof Error ? `cause: ${error.cause.message}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (error instanceof Error) {
    return `error: ${error.message}`;
  }

  return `error: ${String(error)}`;
};

const isStructuredHeading = (line: string) => {
  if (!line || line.length > 80) return false;
  if (/^[-*•]/.test(line)) return false;
  if (/^\d+[.)]\s/.test(line)) return false;
  if (line.includes(":") && !/:\s*$/.test(line)) return false;
  if (/[.!?]$/.test(line)) return false;
  return /^[\p{L}\p{N}&/(),:'" -]+:?$/u.test(line);
};

const WORKSPACE_ITEMS: Array<{ id: AppWorkspace; label: string; description: string; available: boolean }> = [
  { id: "notebook", label: "Notebook", description: "Fast dated pages with optional recording and output", available: true },
  { id: "calendar", label: "Calendar", description: "Schedule and meeting context", available: true },
  { id: "notes", label: "Notes", description: "Capture and shape structured notes", available: true },
  { id: "now", label: "Now", description: "Quick access to recent work, meetings, and active context", available: true },
  { id: "todos", label: "Tasks", description: "Focused follow-up management", available: true },
  { id: "time", label: "Time", description: "Active timers, dense logs, and reporting", available: true },
  { id: "analytics", label: "Analytics", description: "Summaries and trends across your tracked work", available: true },
  { id: "structure", label: "Structure", description: "Domains and projects as operational views", available: true },
  { id: "assistant", label: "Assistant", description: "Agentic chat with NoteSmith data", available: true },
  { id: "files", label: "Files", description: "Documents, audio, and references", available: false },
];

const PRIMARY_WORKSPACE_ITEMS = WORKSPACE_ITEMS.filter((item) => ["notebook", "calendar", "notes"].includes(item.id));
const DAILY_WORKSPACE_ITEMS = WORKSPACE_ITEMS.filter((item) => item.id === "now");
const SECONDARY_WORKSPACE_ITEMS = WORKSPACE_ITEMS.filter(
  (item) => !["notebook", "calendar", "notes", "now", "todos"].includes(item.id),
);
const SINGLE_PANE_WORKSPACES: AppWorkspace[] = ["notebook", "todos", "time", "now", "analytics", "structure"];
const HIDE_SHARED_INSPECTOR_WORKSPACES: AppWorkspace[] = ["notebook", "notes", "todos", "time", "analytics", "now", "structure"];
const WORKSPACE_RAIL_COLLAPSED_KEY = "notesmith.workspaceRailCollapsed";

const logAIRuntimeEvent = (event: AIRuntimeEvent) => {
  recordAIRequestHistory(event);
  if (event.type === "request-failure") {
    console.error("NoteSmith AI request failed", event);
    console.info("NoteSmith AI metrics", getAIMetricsSnapshot());
    return;
  }
  if (event.type === "request-retry") {
    console.warn("NoteSmith AI request retry", event);
    return;
  }
  console.info("NoteSmith AI runtime event", event);
  if (event.type === "request-success" || event.type === "cache-hit") {
    console.info("NoteSmith AI metrics", getAIMetricsSnapshot());
  }
};

const NOTES_PANEL_MIN_WIDTH = 300;
const NOTES_PANEL_MAX_WIDTH = 980;
const STANDARD_TEMPLATE_FIELD_KEYS = ["title", "participants", "date", "startTime", "endTime", "agenda"] as const;
const clampNotesCapturePaneWidth = (value: number, maxWidth = NOTES_PANEL_MAX_WIDTH) =>
  Math.min(maxWidth, Math.max(NOTES_PANEL_MIN_WIDTH, Math.round(value)));

const normalizeOutputVersionHistory = (
  outputVersions: OutputVersionRecord[] | undefined,
  currentOutput: string,
  updatedAt: string,
) => {
  const normalized = Array.isArray(outputVersions)
    ? outputVersions
        .filter(
          (version): version is OutputVersionRecord =>
            Boolean(version) &&
            typeof version.id === "string" &&
            typeof version.output === "string" &&
            typeof version.generatedAt === "string" &&
            version.output.trim().length > 0,
        )
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    : [];

  if (currentOutput.trim() && !normalized.some((version) => version.output === currentOutput)) {
    normalized.unshift({
      id: crypto.randomUUID(),
      output: currentOutput,
      generatedAt: updatedAt,
    });
  }

  return normalized;
};

const buildOutputVersionPatch = (
  session: Pick<
    SessionRecord,
    "captureMode" | "title" | "date" | "startTime" | "endTime" | "participantText" | "output" | "updatedAt"
  > & { outputVersions?: OutputVersionRecord[] },
  nextOutput: string,
): Pick<{ output: string; outputVersions: OutputVersionRecord[] }, "output" | "outputVersions"> => {
  const generatedAt = new Date().toISOString();
  const normalizedCurrentOutput = ensureMeetingOutputHeader(session, session.output).trim();
  const normalizedNextOutput = ensureMeetingOutputHeader(session, nextOutput).trim();
  const previousHistory = normalizeOutputVersionHistory(
    session.outputVersions,
    normalizedCurrentOutput,
    session.updatedAt,
  );
  return {
    output: normalizedNextOutput,
    outputVersions: [
      {
        id: crypto.randomUUID(),
        output: normalizedNextOutput,
        generatedAt,
      },
      ...previousHistory,
    ],
  };
};

export const App = () => {
  const {
    snapshot,
    activeSessionId,
    saveState,
    lastSavedAt,
    isLoaded,
    loadError,
    load,
    setActiveSessionId,
    activeView,
    setActiveView,
    repository,
    saveSession,
    createNewSession,
    deleteSession,
    restoreSession,
    permanentlyDeleteSession,
    saveTodo,
    addTodo,
    deleteTodo,
    saveActivity,
    addActivity,
    deleteActivity,
    saveChecklist,
    createChecklist,
    deleteChecklist,
    saveChecklistTemplate,
    createChecklistTemplate,
    deleteChecklistTemplate,
    createChecklistFromTemplate,
    createChecklistRecurrence,
    deleteChecklistRecurrence,
    saveTimeLog,
    deleteTimeLog,
    startTimeTracking,
    stopTimeTracking,
    startWorkBaseline,
    stopWorkBaseline,
    startAdhocTimeLog,
    createCalendarEntryFromText,
    rollForwardOverdueTodos,
    moveCalendarItem,
    updateCalendarItem,
    convertTodoToActivity,
    ensureSessionForActivity,
    ensureSessionForTodo,
    ensureTimeTargetForSession,
    saveSettings,
    renameDomainValue,
    renameProjectValue,
    saveTemplate,
    resetTemplates,
    importLegacyBrowserData,
    importBackupSnapshot: restoreBackupSnapshot,
    saveAttachments,
  } = useDesktopStore();

  const [activeWorkspace, setActiveWorkspace] = useState<AppWorkspace>("notebook");
  const [openPanel, setOpenPanel] = useState<OverlayPanel>(null);
  const [isNotesSessionsOpen, setIsNotesSessionsOpen] = useState(false);
  const [selectedOutputVersionId, setSelectedOutputVersionId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("ai");
  const [notesCapturePaneWidth, setNotesCapturePaneWidth] = useState(640);
  const [notesWorkspaceTab, setNotesWorkspaceTab] = useState<NotesWorkspaceTab>("capture");
  const [requestedTodoId, setRequestedTodoId] = useState<string | null>(null);
  const [requestedTodoDomain, setRequestedTodoDomain] = useState<string | null>(null);
  const [requestedTodoProject, setRequestedTodoProject] = useState<string | null>(null);
  const [requestedTimeDomain, setRequestedTimeDomain] = useState<string | null>(null);
  const [requestedTimeProject, setRequestedTimeProject] = useState<string | null>(null);
  const [linkedDetailReturnWorkspace, setLinkedDetailReturnWorkspace] = useState<AppWorkspace | null>(null);
  const [linkedCalendarReturnItemId, setLinkedCalendarReturnItemId] = useState<string | null>(null);
  const [calendarSessionOverlay, setCalendarSessionOverlay] = useState<{
    sessionId: string;
    calendarItemId: string | null;
  } | null>(null);
  const [calendarSessionOverlayTab, setCalendarSessionOverlayTab] = useState<CalendarSessionOverlayTab>("capture");
  const [isCalendarWorkspaceFullScreen, setIsCalendarWorkspaceFullScreen] = useState(false);
  const [calendarOpenRevision, setCalendarOpenRevision] = useState(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [statusNote, setStatusNote] = useState("Ready.");
  const [generationLog, setGenerationLog] = useState<GenerationLogEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [pendingAudioBySession, setPendingAudioBySession] = useState<Record<string, File | undefined>>({});
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("microphone");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingStatusNote, setRecordingStatusNote] = useState<string | null>(null);
  const [availableUpdateVersion, setAvailableUpdateVersion] = useState<string | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateStatusNote, setUpdateStatusNote] = useState<string | null>(null);
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);
  const [desktopBundleType, setDesktopBundleType] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<DesktopStorageInfo | null>(null);
  const [latestLocalBackupInfo, setLatestLocalBackupInfo] = useState<LocalBackupInfo | null>(null);
  const [manualUpdateUrl, setManualUpdateUrl] = useState<string | null>(null);
  const [calendarOutputPreviewSessionId, setCalendarOutputPreviewSessionId] = useState<string | null>(null);
  const [aiDiagnostics, setAIDiagnostics] = useState(() => getAIDiagnosticsItems());
  const [aiRequestHistory, setAIRequestHistory] = useState(() => getAIRequestHistory());
  const [modelPricingSnapshot, setModelPricingSnapshot] = useState<AIModelPricingSnapshot>(createDefaultModelPricingSnapshot);
  const [modelPricingStatus, setModelPricingStatus] = useState(buildModelPricingStatus(createDefaultModelPricingSnapshot()));
  const [isRefreshingModelPricing, setIsRefreshingModelPricing] = useState(false);
  const [isWorkspaceRailCollapsed, setIsWorkspaceRailCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(WORKSPACE_RAIL_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [metadataSuggestions, setMetadataSuggestions] = useState<MetadataReviewState>(EMPTY_METADATA_REVIEW);
  const [selectedMetadataSuggestions, setSelectedMetadataSuggestions] = useState<MetadataReviewState>(EMPTY_METADATA_REVIEW);
  const [visibleRuleSuggestions, setVisibleRuleSuggestions] = useState<RuleSuggestionRecord[]>([]);
  const [dismissedRuleSuggestionIds, setDismissedRuleSuggestionIds] = useState<string[]>([]);
  const notesLayoutRef = useRef<HTMLDivElement | null>(null);
  const activeSessionDraftRef = useRef<SessionRecord | null>(null);
  const notesSplitterDraggingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureSourceStreamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingSessionIdRef = useRef<string | null>(null);
  const todoRolloverDateRef = useRef(getStockholmDateKey());
  const localSafetyBackupDateRef = useRef<string | null>(null);
  const notebookStartupCreatedRef = useRef(false);
  const todosSnapshotRef = useRef(snapshot?.todos ?? []);
  const themeSnapshotRef = useRef(snapshot?.settings.theme ?? "fluent-slate-light");
  const runningTodoIdsSnapshotRef = useRef(getRunningTodoIds(snapshot?.timelogs ?? []));

  const buildDesktopBackupBundle = (): DesktopBackupBundle | null => {
    if (!snapshot) {
      return null;
    }

    return {
      kind: "notesmith-desktop-backup",
      version: 3,
      exportedAt: new Date().toISOString(),
      snapshot,
      aiTextCache: snapshotAITextCache(),
      aiRequestHistory: getAIRequestHistory(),
      aiModelPricing: modelPricingSnapshot,
    };
  };

  const buildDesktopTransferBackupBundle = async (): Promise<DesktopBackupBundle | null> => {
    const baseBundle = buildDesktopBackupBundle();
    if (!baseBundle) {
      return null;
    }
    return withDesktopBackupAttachmentFiles(baseBundle);
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    todosSnapshotRef.current = snapshot?.todos ?? [];
    themeSnapshotRef.current = snapshot?.settings.theme ?? "fluent-slate-light";
    runningTodoIdsSnapshotRef.current = getRunningTodoIds(snapshot?.timelogs ?? []);
  }, [snapshot?.settings.theme, snapshot?.timelogs, snapshot?.todos]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<TodosWindowCommand>(TODOS_COMMAND_EVENT, (event) => {
        const command = event.payload;
        if (command.type === "request-snapshot") {
          void sendTodosSnapshot(todosSnapshotRef.current, themeSnapshotRef.current, runningTodoIdsSnapshotRef.current);
        } else if (command.type === "add") {
          void addTodo(command.description);
        } else if (command.type === "save") {
          void saveTodo(command.todo);
        } else if (command.type === "delete") {
          void deleteTodo(command.todoId);
        } else if (command.type === "add-note") {
          void ensureSessionForTodo(command.todoId).then((sessionId) => {
            if (!sessionId) return;
            setSelectedOutputVersionId(null);
            setActiveSessionId(sessionId);
            setActiveWorkspace("notebook");
          });
        } else if (command.type === "toggle-time") {
          void (command.isRunning
            ? stopTimeTracking("todo", command.todoId)
            : startTimeTracking("todo", command.todoId));
        }
      }),
    ).then((disposeListener) => {
      if (disposed) disposeListener();
      else unlisten = disposeListener;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [addTodo, deleteTodo, ensureSessionForTodo, saveTodo, setActiveSessionId, startTimeTracking, stopTimeTracking]);

  useEffect(() => {
    if (!isLoaded || !snapshot || !isTauriRuntime()) return;
    void sendTodosSnapshot(snapshot.todos, snapshot.settings.theme, getRunningTodoIds(snapshot.timelogs)).catch(() => {
      // The detached window is optional and may not be open.
    });
  }, [isLoaded, snapshot?.settings.theme, snapshot?.timelogs, snapshot?.todos]);

  useEffect(() => {
    if (!isLoaded || loadError || !snapshot || notebookStartupCreatedRef.current) {
      return;
    }
    notebookStartupCreatedRef.current = true;
    const session = createSessionRecord("personal-note", "quick-note");
    session.title = session.date;
    void saveSession(session);
  }, [isLoaded, loadError, saveSession, snapshot]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_RAIL_COLLAPSED_KEY, String(isWorkspaceRailCollapsed));
    } catch {
      // The rail still works for this session when browser storage is unavailable.
    }
  }, [isWorkspaceRailCollapsed]);

  useEffect(() => {
    if (!isLoaded || loadError) return;
    const checkTodoRolloverDate = () => {
      const currentDate = getStockholmDateKey();
      if (todoRolloverDateRef.current === currentDate) return;
      todoRolloverDateRef.current = currentDate;
      void rollForwardOverdueTodos();
    };

    checkTodoRolloverDate();
    const intervalId = setInterval(checkTodoRolloverDate, 60000);
    return () => clearInterval(intervalId);
  }, [isLoaded, loadError, rollForwardOverdueTodos]);

  const refreshLatestLocalBackupInfo = async () => {
    try {
      setLatestLocalBackupInfo(await getLatestLocalBackupInfo());
    } catch {
      setLatestLocalBackupInfo(null);
    }
  };

  useEffect(() => {
    if (!isLoaded || loadError) return;
    void refreshLatestLocalBackupInfo();
  }, [isLoaded, loadError]);

  useEffect(() => {
    if (!isLoaded || loadError || !snapshot || !storageInfo) return;
    const latestBackupDate = latestLocalBackupInfo
      ? getStockholmDateKey(new Date(latestLocalBackupInfo.modifiedMs))
      : null;
    const today = getStockholmDateKey();
    if (localSafetyBackupDateRef.current === today || latestBackupDate === today) {
      localSafetyBackupDateRef.current = today;
      return;
    }

    localSafetyBackupDateRef.current = today;
    const createAutomaticLocalBackup = async () => {
      const backupBundle = buildDesktopBackupBundle();
      if (!backupBundle) return;
      const backupPath = await createLocalSnapshotBackup(backupBundle);
      if (!backupPath) return;
      await refreshLatestLocalBackupInfo();
      setStatusNote(`Automatic local safety backup created at ${backupPath}.`);
    };

    void createAutomaticLocalBackup().catch((error) => {
      setStatusNote(error instanceof Error ? error.message : "Could not create the automatic local safety backup.");
    });
  }, [isLoaded, loadError, snapshot, storageInfo, latestLocalBackupInfo?.modifiedMs]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      captureSourceStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (activeWorkspace !== "calendar" && isCalendarWorkspaceFullScreen) {
      setIsCalendarWorkspaceFullScreen(false);
    }
  }, [activeWorkspace, isCalendarWorkspaceFullScreen]);

  useEffect(() => {
    if (activeWorkspace === "calendar") {
      setCalendarOpenRevision((current) => current + 1);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace !== "calendar" || !snapshot) {
      return;
    }

    setIsCalendarWorkspaceFullScreen(
      snapshot.settings.calendarFullScreenPreferenceInitialized ? snapshot.settings.calendarIsFullScreen : true,
    );
  }, [
    activeWorkspace,
    snapshot,
  ]);

  useEffect(() => {
    if (!snapshot) return;
    setNotesCapturePaneWidth(snapshot.settings.notesCapturePaneWidth);
  }, [snapshot?.settings.notesCapturePaneWidth]);

  useEffect(() => {
    setSelectedOutputVersionId(null);
  }, [activeSessionId]);

  useEffect(() => {
    if (activeView === "capture" || activeView === "output") {
      setNotesWorkspaceTab(activeView);
    }
  }, [activeView]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!notesSplitterDraggingRef.current || !notesLayoutRef.current) return;
      const rect = notesLayoutRef.current.getBoundingClientRect();
      const computedStyles = window.getComputedStyle(notesLayoutRef.current);
      const columnGap = parseFloat(computedStyles.columnGap || computedStyles.gap || "0") || 0;
      const splitterWidth = notesLayoutRef.current.querySelector(".notes-pwa-splitter")?.getBoundingClientRect().width ?? 12;
      const maxCaptureWidth = rect.width - splitterWidth - columnGap * 2 - NOTES_PANEL_MIN_WIDTH;
      setNotesCapturePaneWidth(clampNotesCapturePaneWidth(event.clientX - rect.left, maxCaptureWidth));
    };

    const handleMouseUp = () => {
      if (!notesSplitterDraggingRef.current) return;
      notesSplitterDraggingRef.current = false;
      document.body.style.cursor = "";
      if (snapshot && snapshot.settings.notesCapturePaneWidth !== notesCapturePaneWidth) {
        void saveSettings({
          ...snapshot.settings,
          notesCapturePaneWidth,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [notesCapturePaneWidth, saveSettings, snapshot]);

  useEffect(() => {
    if (!isLoaded || loadError) {
      return;
    }

    setAIDiagnostics(getAIDiagnosticsItems());
    setAIRequestHistory(getAIRequestHistory());

    let cancelled = false;

    const runUpdateCheck = async () => {
      setIsCheckingForUpdates(true);
      try {
        const result = await checkForDesktopUpdates();
        if (cancelled) return;
        if (result.available) {
          setAvailableUpdateVersion(result.version);
          setManualUpdateUrl(result.downloadUrl ?? null);
          setUpdateStatusNote(`Version ${result.version} is available to install.`);
          setStatusNote(`Update available: ${result.version}`);
        } else {
          setAvailableUpdateVersion(null);
          setManualUpdateUrl("downloadUrl" in result && result.downloadUrl ? result.downloadUrl : null);
          setUpdateStatusNote(result.note ?? "Desktop app is up to date.");
        }
      } catch (error) {
        if (cancelled) return;
        setUpdateStatusNote(error instanceof Error ? error.message : "Could not check for updates.");
      } finally {
        if (!cancelled) {
          setIsCheckingForUpdates(false);
        }
      }
    };

    void runUpdateCheck();

    const intervalId = setInterval(() => {
      void runUpdateCheck();
    }, 15 * 60 * 1000);

    const handleWindowFocus = () => {
      void runUpdateCheck();
    };
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isLoaded, loadError]);

  useEffect(() => {
    if (!isLoaded || loadError) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const version = await getDesktopAppVersion();
      if (!cancelled) {
        setDesktopVersion(version);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, loadError]);

  useEffect(() => {
    if (!isLoaded || loadError) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const bundleType = await getDesktopBundleType();
      if (!cancelled) {
        setDesktopBundleType(bundleType);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, loadError]);

  useEffect(() => {
    if (!isLoaded || loadError) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const info = await getDesktopStorageInfo();
      if (!cancelled) {
        setStorageInfo(info);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, loadError]);

  useEffect(() => {
    if (!isLoaded || loadError) {
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const refreshPricing = async (currentSnapshot: AIModelPricingSnapshot | null, forceRefresh: boolean) => {
      const baseSnapshot = currentSnapshot || createDefaultModelPricingSnapshot();

      if (!forceRefresh && !isPricingRefreshDue({ snapshot: baseSnapshot })) {
        if (!cancelled) {
          setModelPricingSnapshot(baseSnapshot);
          setModelPricingStatus(buildModelPricingStatus(baseSnapshot));
        }
        return baseSnapshot;
      }

      try {
        const refreshedSnapshot = await fetchLatestModelPricingSnapshot({ currentSnapshot: baseSnapshot });
        await repository.saveAIModelPricing(refreshedSnapshot);
        if (!cancelled) {
          setModelPricingSnapshot(refreshedSnapshot);
          setModelPricingStatus(buildModelPricingStatus(refreshedSnapshot));
        }
        return refreshedSnapshot;
      } catch (error) {
        if (!cancelled) {
          setModelPricingSnapshot(baseSnapshot);
          setModelPricingStatus(
            `${buildModelPricingStatus(baseSnapshot)} Live refresh from OpenAI could not be completed${error instanceof Error ? `: ${error.message}` : "."}`,
          );
        }
        return baseSnapshot;
      }
    };

    const scheduleNextRefresh = () => {
      if (timerId) {
        clearTimeout(timerId);
      }

      timerId = setTimeout(async () => {
        const nextSnapshot = await refreshPricing(modelPricingSnapshot, true);
        if (!cancelled) {
          setModelPricingSnapshot(nextSnapshot);
          scheduleNextRefresh();
        }
      }, msUntilNextPricingCheck());
    };

    void (async () => {
      const savedSnapshot = (await repository.loadAIModelPricing()) || createDefaultModelPricingSnapshot();
      const nextSnapshot = await refreshPricing(savedSnapshot, true);
      if (!cancelled) {
        setModelPricingSnapshot(nextSnapshot);
        scheduleNextRefresh();
      }
    })();

    return () => {
      cancelled = true;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [isLoaded, loadError, repository]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const textModel = resolveAvailableTextModelId(snapshot.settings.textModel, modelPricingSnapshot);
    const transcriptionModel = resolveAvailableTranscriptionModelId(
      snapshot.settings.transcriptionModel,
      modelPricingSnapshot,
    );
    if (textModel !== snapshot.settings.textModel || transcriptionModel !== snapshot.settings.transcriptionModel) {
      void saveSettings({ ...snapshot.settings, textModel, transcriptionModel });
    }
  }, [modelPricingSnapshot, saveSettings, snapshot]);

  const handleRefreshModelPricing = async () => {
    setIsRefreshingModelPricing(true);
    setModelPricingStatus("Refreshing pricing from OpenAI...");

    try {
      const refreshedSnapshot = await fetchLatestModelPricingSnapshot({ currentSnapshot: modelPricingSnapshot });
      await repository.saveAIModelPricing(refreshedSnapshot);
      setModelPricingSnapshot(refreshedSnapshot);
      setModelPricingStatus(buildModelPricingStatus(refreshedSnapshot));
    } catch (error) {
      setModelPricingStatus(
        `${buildModelPricingStatus(modelPricingSnapshot)} Live refresh from OpenAI could not be completed${error instanceof Error ? `: ${error.message}` : "."}`,
      );
    } finally {
      setIsRefreshingModelPricing(false);
    }
  };

  const parsePeopleFromSession = (participantText: string) => parseTokenList(participantText);
  const sortParticipantText = (participantText: string) =>
    parsePeopleFromSession(participantText)
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .join(", ");

  const rankSavedValues = <T extends { updatedAt?: string; createdAt: string }>(
    items: T[],
    savedValues: string[],
    collectEntries: (item: T) => string[],
  ) => {
    const savedLookup = new Map(
      savedValues
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => [entry.toLocaleLowerCase(), entry] as const),
    );
    const stats = new Map<string, { name: string; count: number; lastSeen: number }>();

    items.forEach((item) => {
      const lastSeen = Date.parse(item.updatedAt || item.createdAt || "") || 0;
      collectEntries(item).forEach((entry) => {
        const key = entry.toLocaleLowerCase();
        const existing = stats.get(key);
        const canonicalName = savedLookup.get(key) ?? entry;
        if (existing) {
          existing.count += 1;
          existing.lastSeen = Math.max(existing.lastSeen, lastSeen);
          existing.name = canonicalName;
        } else {
          stats.set(key, {
            name: canonicalName,
            count: 1,
            lastSeen,
          });
        }
      });
    });

    const rankedSaved = savedValues
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const key = entry.toLocaleLowerCase();
        const entryStats = stats.get(key);
        return {
          name: entry,
          count: entryStats?.count ?? 0,
          lastSeen: entryStats?.lastSeen ?? 0,
        };
      })
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        if (right.lastSeen !== left.lastSeen) {
          return right.lastSeen - left.lastSeen;
        }
        return left.name.localeCompare(right.name);
      });

    const prioritized = rankedSaved.filter((entry) => entry.count > 0).map((entry) => entry.name);
    const fallback = rankedSaved.map((entry) => entry.name);

    return Array.from(new Set([...prioritized, ...fallback])).slice(0, 6);
  };

  const activeSessions = useMemo(
    () => (snapshot ? snapshot.sessions.filter((session) => !session.deletedAt) : []),
    [snapshot],
  );

  const participantSuggestionSources = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      ...activeSessions,
      ...snapshot.todos,
      ...snapshot.activities,
    ];
  }, [activeSessions, snapshot]);

  const suggestedPeople = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return rankSavedValues(
      participantSuggestionSources,
      snapshot.settings.savedParticipants,
      (item) => parsePeopleFromSession(item.participantText ?? ""),
    );
  }, [participantSuggestionSources, snapshot]);

  const suggestedProjects = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return rankSavedValues(activeSessions, snapshot.settings.savedProjects, (session) => (session.project ? [session.project] : []));
  }, [activeSessions, snapshot]);

  const suggestedDomains = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return rankSavedValues(activeSessions, snapshot.settings.savedDomains, (session) => (session.domain ? [session.domain] : []));
  }, [activeSessions, snapshot]);

  const suggestedActivities = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return rankSavedValues(activeSessions, snapshot.settings.savedActivities, (session) => (session.activity ? [session.activity] : []));
  }, [activeSessions, snapshot]);

  const structureOptions = useMemo(
    () =>
      snapshot
        ? buildStructureOptions({
            savedDomains: snapshot.settings.savedDomains,
            savedProjects: snapshot.settings.savedProjects,
            savedActivities: snapshot.settings.savedActivities,
            projectLinks: snapshot.settings.projectLinks,
            sessions: snapshot.sessions,
            todos: snapshot.todos,
            activities: snapshot.activities,
          })
        : createEmptyStructureOptions(),
    [snapshot],
  );

  const suggestedTags = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return rankSavedValues(activeSessions, snapshot.settings.savedTags, (session) => parseTokenList(session.tagsText));
  }, [activeSessions, snapshot]);

  const activeSession = useMemo(() => {
    if (!snapshot) {
      return null;
    }
    const directMatch = snapshot.sessions.find((session) => session.id === activeSessionId && !session.deletedAt);
    return directMatch ?? snapshot.sessions.find((session) => !session.deletedAt) ?? null;
  }, [activeSessionId, snapshot]);

  useEffect(() => {
    activeSessionDraftRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    if (activeWorkspace !== "calendar" && calendarSessionOverlay) {
      setCalendarSessionOverlay(null);
    }
  }, [activeWorkspace, calendarSessionOverlay]);

  useEffect(() => {
    if (!calendarSessionOverlay) {
      return;
    }
    if (!activeSession || activeSession.id !== calendarSessionOverlay.sessionId) {
      setCalendarSessionOverlay(null);
    }
  }, [activeSession, calendarSessionOverlay]);

  const activeTemplate = useMemo(
    () =>
      activeSession && snapshot
        ? getTemplatesForCaptureMode(snapshot.templates, activeSession.captureMode).find(
            (template) => template.id === activeSession.templateId,
          ) ??
          getTemplatesForCaptureMode(snapshot.templates, activeSession.captureMode)[0] ??
          null
        : null,
    [activeSession, snapshot],
  );
  const quickStartTemplates = useMemo(() => {
    const templates = snapshot?.templates ?? [];
    const preferredOrder = ["meeting", "personal-note", "one-on-one"];
    const builtIns = preferredOrder
      .map((templateId) => templates.find((template) => template.id === templateId))
      .filter((template): template is NonNullable<typeof snapshot>["templates"][number] => Boolean(template));
    const customs = templates.filter((template) => template.kind === "custom" && !preferredOrder.includes(template.id));
    return [...builtIns, ...customs];
  }, [snapshot]);
  const activeCaptureMode: CaptureMode = activeSession?.captureMode ?? "meeting-note";

  const activeAttachments = useMemo(
    () => snapshot?.attachments.filter((attachment) => attachment.sessionId === activeSession?.id) ?? [],
    [activeSession, snapshot],
  );
  const activeLinkedActivity = useMemo(() => {
    if (!snapshot || !activeSession) {
      return null;
    }
    const activityId = findActivityIdForSession(snapshot.entityLinks, activeSession.id);
    return snapshot.activities.find((entry) => entry.id === activityId) ?? null;
  }, [activeSession, snapshot]);
  const activeLinkedTodo = useMemo(() => {
    if (!snapshot || !activeSession) {
      return null;
    }
    const todoId = findTodoIdForSession(snapshot.entityLinks, activeSession.id);
    return snapshot.todos.find((entry) => entry.id === todoId) ?? null;
  }, [activeSession, snapshot]);
  const activeSessionTimeTarget = activeLinkedTodo
    ? { targetType: "todo" as const, targetId: activeLinkedTodo.id }
    : activeLinkedActivity
      ? { targetType: "activity" as const, targetId: activeLinkedActivity.id }
      : null;
  const isActiveSessionTimeTracking = Boolean(
    activeSessionTimeTarget && snapshot?.timelogs.some(
      (log) =>
        log.targetType === activeSessionTimeTarget.targetType
        && log.targetId === activeSessionTimeTarget.targetId
        && log.startTime === log.endTime,
    ),
  );

  const toggleActiveSessionTimeTracking = async () => {
    if (!activeSession) return;
    const target = await ensureTimeTargetForSession(activeSession.id);
    if (!target) return;
    const latestSnapshot = useDesktopStore.getState().snapshot;
    const isRunning = Boolean(latestSnapshot?.timelogs.some(
      (log) => log.targetType === target.targetType && log.targetId === target.targetId && log.startTime === log.endTime,
    ));
    if (isRunning) {
      await stopTimeTracking(target.targetType, target.targetId);
    } else {
      await startTimeTracking(target.targetType, target.targetId);
    }
  };
  const getMeetingTodoDefaults = () => {
    if (!activeSession) {
      return {
        activityId: undefined,
        domain: "Other",
        project: "Other",
        activityLabel: "Other",
      };
    }

    return {
      activityId: activeLinkedActivity?.id || undefined,
      domain: activeSession.domain.trim() || activeLinkedActivity?.domain.trim() || "Other",
      project: activeSession.project.trim() || activeLinkedActivity?.project.trim() || "Other",
      activityLabel:
        activeLinkedActivity?.description.trim() || activeSession.activity.trim() || "Other",
    };
  };
  const linkedSessionStateByActivity = useMemo(
    () =>
      Object.fromEntries(
        (snapshot?.activities ?? []).map((activity) => {
          const sessionId = snapshot ? findSessionIdForActivity(snapshot.entityLinks, activity.id) : null;
          const session = sessionId ? snapshot?.sessions.find((entry) => entry.id === sessionId) ?? null : null;
          return [
            activity.id,
            {
              sessionId,
              hasOutput: Boolean(session?.output.trim()),
              sessionTitle: session?.title ?? "",
            },
          ];
        }),
      ) as Record<string, { sessionId: string | null; hasOutput: boolean; sessionTitle: string }>,
    [snapshot],
  );
  const linkedSessionStateByTodo = useMemo(
    () =>
      Object.fromEntries(
        (snapshot?.todos ?? []).map((todo) => {
          const sessionId = snapshot ? findSessionIdForTodo(snapshot.entityLinks, todo.id) : null;
          const session = sessionId ? snapshot?.sessions.find((entry) => entry.id === sessionId) ?? null : null;
          return [
            todo.id,
            {
              sessionId,
              hasOutput: Boolean(session?.output.trim()),
              sessionTitle: session?.title ?? "",
            },
          ];
        }),
      ) as Record<string, { sessionId: string | null; hasOutput: boolean; sessionTitle: string }>,
    [snapshot],
  );
  const calendarPreviewSession = useMemo(
    () =>
      calendarOutputPreviewSessionId
        ? snapshot?.sessions.find((session) => session.id === calendarOutputPreviewSessionId) ?? null
        : null,
    [calendarOutputPreviewSessionId, snapshot],
  );
  const openTimeLogs = useMemo(
    () => snapshot?.timelogs.filter((entry) => entry.startTime === entry.endTime) ?? [],
    [snapshot],
  );
  const baselineWorkActivityId = snapshot?.settings.baselineWorkActivityId ?? "";
  const isBaselineWorkEnabled = Boolean(snapshot?.settings.baselineWorkEnabled);
  const isBaselineWorkRunning = openTimeLogs.some(
    (entry) => entry.targetType === "activity" && entry.targetId === baselineWorkActivityId,
  );
  const hasSpecificRunningTimeLog = openTimeLogs.some(
    (entry) => !(entry.targetType === "activity" && entry.targetId === baselineWorkActivityId),
  );
  const baselineWorkStatusLabel = !isBaselineWorkEnabled
    ? "Work mode off"
    : isBaselineWorkRunning
      ? "Work mode running"
      : hasSpecificRunningTimeLog
        ? "Work mode paused"
        : "Work mode ready";
  const activeAudioAttachment = useMemo(
    () => activeAttachments.find((attachment) => attachment.kind === "audio") ?? null,
    [activeAttachments],
  );
  const activeOutputVersions = useMemo(
    () => normalizeOutputVersionHistory(activeSession?.outputVersions, activeSession?.output ?? "", activeSession?.updatedAt ?? new Date().toISOString()),
    [activeSession],
  );
  const selectedOutputVersion = useMemo(
    () => activeOutputVersions.find((version) => version.id === selectedOutputVersionId) ?? null,
    [activeOutputVersions, selectedOutputVersionId],
  );
  const rawDisplayedOutput = selectedOutputVersion?.output ?? activeSession?.output ?? "";
  const displayedOutput = activeSession ? ensureMeetingOutputHeader(activeSession, rawDisplayedOutput) : rawDisplayedOutput;

  const selectedTextModelOption = modelPricingSnapshot.textModels
    .map(buildTextModelOption)
    .find((option) => option.id === snapshot?.settings.textModel);
  const selectedTranscriptionModelOption = modelPricingSnapshot.transcriptionModels
    .map(buildTranscriptionModelOption)
    .find((option) => option.id === snapshot?.settings.transcriptionModel);
  const aiActivityLabel = isGenerating
    ? "Generating notes"
    : isRevising
      ? "Revising output"
      : isTranscribingAudio
        ? "Transcribing audio"
        : "AI idle";
  const saveStatusLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save issue"
        : lastSavedAt
          ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Saved locally";

  const appendGenerationLog = (
    message: string,
    level: GenerationLogEntry["level"] = "info",
    details?: string,
  ) => {
    setGenerationLog((current) => [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        message,
        details,
      },
      ...current,
    ].slice(0, 160));
  };

  const createAIRuntimeHandler = ({
    onCacheHit,
  }: {
    onCacheHit?: () => void;
  } = {}) =>
    createAIRuntimeStatusHandler({
      setStatus: setStatusNote,
      logEvent: (event) => {
        logAIRuntimeEvent(event);
        if (event.type === "request-start") {
          appendGenerationLog(
            `OpenAI request started: ${event.operation}`,
            "info",
            `request id: ${event.requestId}\nprompt: ${event.promptVersion ?? "default"}`,
          );
        } else if (event.type === "request-retry") {
          appendGenerationLog(
            `OpenAI request retry: ${event.operation}`,
            "warning",
            `attempt: ${event.attempt} of ${event.maxRetries}\ndelay: ${event.delayMs} ms\nerror: ${event.error.message}`,
          );
        } else if (event.type === "request-success") {
          appendGenerationLog(
            `OpenAI request succeeded: ${event.operation}`,
            "success",
            `request id: ${event.requestId}\nduration: ${event.durationMs} ms\nprompt: ${event.promptVersion ?? "default"}`,
          );
        } else if (event.type === "request-failure") {
          appendGenerationLog(
            `OpenAI request failed: ${event.operation}`,
            "error",
            `request id: ${event.requestId}\nduration: ${event.durationMs} ms\nprompt: ${event.promptVersion ?? "default"}\n${describeAIErrorForLog(event.error)}`,
          );
        } else if (event.type === "cache-hit") {
          appendGenerationLog(
            `AI cache hit: ${event.operation}`,
            "success",
            `request id: ${event.requestId}\nprompt: ${event.promptVersion ?? "default"}`,
          );
        }
        setAIDiagnostics(getAIDiagnosticsItems());
        setAIRequestHistory(getAIRequestHistory());
      },
      onCacheHit,
    });

  const openMetadataReviewIfNeeded = async (session: typeof activeSession) => {
    const nextReview = buildMetadataReview(session, snapshot?.settings ?? null);
    const sourceText = [
      richTextToPlainText(session?.manualNotes || ""),
      session?.liveTranscript || "",
      session?.uploadedTranscript || "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const ruleObservations = session && snapshot
      ? collectRuleSuggestionObservations(session, snapshot.settings, sourceText)
      : [];
    const { nextSettings, visibleSuggestions: nextVisibleSuggestions } = snapshot
      ? mergeRuleSuggestionObservations(snapshot.settings, session?.id || "", ruleObservations)
      : { nextSettings: null, visibleSuggestions: [] as RuleSuggestionRecord[] };
    const hasMetadataSuggestions = Object.values(nextReview).some((values) => values.length);
    const hasRuleSuggestions = nextVisibleSuggestions.length > 0;

    if (snapshot && nextSettings && JSON.stringify(nextSettings) !== JSON.stringify(snapshot.settings)) {
      await saveSettings(nextSettings);
    }

    setVisibleRuleSuggestions(nextVisibleSuggestions);
    setDismissedRuleSuggestionIds([]);

    if (!hasMetadataSuggestions && !hasRuleSuggestions) {
      return;
    }
    setMetadataSuggestions(nextReview);
    setSelectedMetadataSuggestions(nextReview);
    setOpenPanel("metadata-review");
  };

  const handleGlobalTodoShortcut = async (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!activeSession) {
      return;
    }
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (
      target instanceof HTMLInputElement &&
      !["text", "search", "email", "url", "tel", "password"].includes(target.type)
    ) {
      return;
    }

    const todoDescription = parseTodoShortcut(target.value);
    if (todoDescription) {
      event.preventDefault();
      event.stopPropagation();

      const meetingTodoDefaults = getMeetingTodoDefaults();
      await addTodo(todoDescription, {
        activityId: meetingTodoDefaults.activityId,
        domain: meetingTodoDefaults.domain,
        project: meetingTodoDefaults.project,
        activityLabel: meetingTodoDefaults.activityLabel,
        doOn: activeSession.date || undefined,
      });
      target.value = "";
      target.dispatchEvent(new Event("input", { bubbles: true }));
      setStatusNote(`Added task: ${todoDescription}`);
      return;
    }

    const activityDescription = parseActivityShortcut(target.value);
    if (activityDescription) {
      event.preventDefault();
      event.stopPropagation();

      await addActivity(activityDescription, "task", {
        parentActivityId: activeLinkedActivity?.id || undefined,
        domain: activeSession.domain || undefined,
        project: activeSession.project || undefined,
        activityLabel: activeLinkedActivity?.description || activeSession.activity || undefined,
        doOn: activeSession.date || undefined,
      });
      target.value = "";
      target.dispatchEvent(new Event("input", { bubbles: true }));
      setStatusNote(`Added activity: ${activityDescription}`);
      return;
    }

    const meetingDescription = parseMeetingShortcut(target.value);
    if (meetingDescription) {
      event.preventDefault();
      event.stopPropagation();

      await addActivity(meetingDescription, "meeting", {
        parentActivityId: activeLinkedActivity?.id || undefined,
        domain: activeSession.domain || undefined,
        project: activeSession.project || undefined,
        activityLabel: activeLinkedActivity?.description || activeSession.activity || undefined,
        doOn: activeSession.date || undefined,
        startTime: activeSession.startTime || undefined,
        endTime: activeSession.endTime || undefined,
      });
      target.value = "";
      target.dispatchEvent(new Event("input", { bubbles: true }));
      setStatusNote(`Added meeting activity: ${meetingDescription}`);
      return;
    }

    return;

  };

  const resolveSessionOutputLanguage = (session = activeSession) =>
    session?.outputLanguage === "sv" || session?.outputLanguage === "en"
      ? session.outputLanguage
      : snapshot?.settings.outputLanguage ?? "same";

  const getAgendaText = (session = activeSession, template = activeTemplate) => {
    if (!session || !template) {
      return "";
    }
    const agendaField = template.fields.find((field) => field.enabled && field.key === "agenda");
    if (!agendaField) {
      return "";
    }
    return polishNonAiNotesText(richTextToPlainText(session.customFieldValues[agendaField.id] ?? ""), {
      abbreviations: snapshot?.settings.abbreviations ?? [],
      sessionParticipants: sortParticipantText(session.participantText),
      savedParticipants: snapshot?.settings.savedParticipants ?? [],
      preferredParticipantNames: snapshot?.settings.preferredParticipantNames ?? [],
    });
  };

  const buildOutputMetaBlock = (session = activeSession) => {
    if (!session) {
      return "";
    }
    const time =
      session.captureMode === "meeting-note"
        ? [session.startTime.trim(), session.endTime.trim()].filter(Boolean).join(" - ")
        : session.startTime.trim();
    return [
      session.date.trim(),
      time,
      sortParticipantText(session.participantText) ? `People: ${sortParticipantText(session.participantText)}` : "",
      session.domain.trim() ? `Domain: ${session.domain.trim()}` : "",
      session.project.trim() ? `Project: ${session.project.trim()}` : "",
      session.activity.trim() ? `Activity: ${session.activity.trim()}` : "",
      session.tagsText.trim() ? `Tags: ${session.tagsText.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const buildGenerationSourceText = (session = activeSession, template = activeTemplate) => {
    if (!session || !template) {
      return "";
    }

    return [
      getAgendaText(session, template),
      session.quickHighlights.trim(),
      richTextToPlainText(session.manualNotes),
      session.liveTranscript.trim(),
      session.uploadedTranscript.trim(),
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  };

  const normalizeForCopyCheck = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isLikelyCopiedSourceOutput = (output: string, sourceText: string) => {
    const normalizedOutput = normalizeForCopyCheck(output);
    const normalizedSource = normalizeForCopyCheck(sourceText);

    if (normalizedOutput.length < 700 || normalizedSource.length < 700) {
      return false;
    }

    const outputToSourceRatio = normalizedOutput.length / normalizedSource.length;
    const prefixLength = Math.min(260, normalizedOutput.length);
    const outputPrefix = normalizedOutput.slice(0, prefixLength);
    const sourcePrefix = normalizedSource.slice(0, prefixLength);

    return outputToSourceRatio > 0.72 && (normalizedSource.includes(outputPrefix) || normalizedOutput.includes(sourcePrefix));
  };

  const buildManualNotesOnlyOutput = (session = activeSession, template = activeTemplate) => {
    if (!session || !template) {
      return "";
    }

    const manualPolishOptions = {
      abbreviations: snapshot?.settings.abbreviations ?? [],
      sessionParticipants: sortParticipantText(session.participantText),
      savedParticipants: snapshot?.settings.savedParticipants ?? [],
      preferredParticipantNames: snapshot?.settings.preferredParticipantNames ?? [],
    };
    const agenda = getAgendaText(session, template);
    const manualNotes = polishNonAiNotesText(richTextToPlainText(session.manualNotes), manualPolishOptions);
    const transcript = polishNonAiNotesText(
      [session.liveTranscript.trim(), session.uploadedTranscript.trim()].filter(Boolean).join("\n\n"),
      manualPolishOptions,
    );
    const notesBody = [manualNotes, transcript].filter(Boolean).join("\n\n").trim();

    if (session.captureMode === "meeting-note") {
      return [
        agenda ? `Agenda\n${agenda}` : "",
        notesBody ? `Notes\n${notesBody}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();
    }

    return [
      session.title.trim(),
      buildOutputMetaBlock(session),
      agenda ? `Agenda\n${agenda}` : "",
      notesBody ? `Notes\n${notesBody}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  };

  const buildDirectManualNotesOutput = (session = activeSession) => {
    if (!session) {
      return "";
    }
    return richTextToPlainText(session.manualNotes).trim();
  };

  const hasTranscriptText = Boolean(activeSession?.liveTranscript.trim() || activeSession?.uploadedTranscript.trim());
  const hasWrittenCapture = Boolean((activeSession ? richTextToPlainText(activeSession.manualNotes) : "") || activeSession?.quickHighlights.trim());
  const hasAnyTextCapture = hasTranscriptText || hasWrittenCapture;
  const hasAudioOnlyVoiceCapture =
    activeCaptureMode === "voice-note" &&
    !hasAnyTextCapture &&
    Boolean(activeAudioAttachment || (activeSession ? pendingAudioBySession[activeSession.id] : undefined));

  const getAudioFileForActiveSession = async () => {
    if (!activeSession) {
      return null;
    }

    const pendingAudio = pendingAudioBySession[activeSession.id];
    if (pendingAudio) {
      return pendingAudio;
    }
    if (activeAudioAttachment) {
      return loadPersistedAttachmentFile(activeAudioAttachment);
    }
    return null;
  };

  const cleanupRecordingResources = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    captureSourceStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    captureSourceStreamsRef.current = [];
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  };

  const createMixedRecorderStream = async (streams: MediaStream[]) => {
    const streamsWithAudio = streams.filter((stream) => stream.getAudioTracks().length > 0);
    if (!streamsWithAudio.length) {
      throw new Error("No audio tracks were available to record.");
    }

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    streamsWithAudio.forEach((stream) => {
      const audioOnlyStream = new MediaStream(stream.getAudioTracks());
      const source = audioContext.createMediaStreamSource(audioOnlyStream);
      source.connect(destination);
    });

    audioContextRef.current = audioContext;
    return destination.stream;
  };

  const persistAudioAttachmentForSession = async ({
    sessionId,
    file,
    persistedPath,
  }: {
    sessionId: string;
    file: File;
    persistedPath: string;
  }) => {
    const latestSnapshot = await repository.loadSnapshot();
    const existingAudioAttachments = latestSnapshot.attachments.filter(
      (entry) => entry.sessionId === sessionId && entry.kind === "audio",
    );

    await saveAttachments([
      ...latestSnapshot.attachments.filter((entry) => !(entry.sessionId === sessionId && entry.kind === "audio")),
      fileToAttachmentRecord({
        file,
        sessionId,
        kind: "audio",
        filePath: persistedPath,
      }),
    ]);

    await Promise.all(
      existingAudioAttachments
        .map((attachment) => attachment.filePath)
        .filter(Boolean)
        .map((filePath) => removePersistedAttachment(filePath)),
    );
  };

  const loadPersistedAudioFileForSession = async (sessionId: string) => {
    const latestSnapshot = await repository.loadSnapshot();
    const persistedAudioAttachment =
      latestSnapshot.attachments.find((entry) => entry.sessionId === sessionId && entry.kind === "audio") ?? null;
    if (!persistedAudioAttachment) {
      return null;
    }
    return loadPersistedAttachmentFile(persistedAudioAttachment);
  };

  const outputActionConfig = (() => {
    const isManualPolishMode = activeSession?.transcribeOnly === true;
    return {
      primaryLabel: isManualPolishMode ? "Polish Manual notes" : "Generate with AI",
      secondaryLabel: "Copy Manual notes directly",
      onPrimary: () => void handleGenerate(),
      onSecondary: () => void handleCopyManualNotesDirect(),
      isPrimaryRunning: isGenerating || (activeSession?.transcribeOnly ? false : isTranscribingAudio && hasAudioOnlyVoiceCapture),
      isSecondaryRunning: false,
      emptyStatePrimaryLabel: isManualPolishMode ? "Polish Manual notes" : "Generate with AI",
      emptyStateSecondaryLabel: "Copy Manual notes directly",
    };
  })();

  if (!isLoaded || !snapshot || !activeSession) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div>
            <h1>NoteSmith Desktop</h1>
            <p>{loadError || "Preparing the new local-first desktop foundation..."}</p>
          </div>
        </div>
        {isLoaded && loadError ? (
          <main className="workspace">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Desktop startup failed</h2>
                  <p>The app could not finish loading its local services.</p>
                </div>
              </div>
              <div className="stack">
                <p className="muted">{loadError}</p>
                <p className="tiny-text">
                  This is usually caused by a missing Tauri capability or a blocked plugin/database permission.
                </p>
              </div>
            </div>
          </main>
        ) : null}
      </div>
    );
  }

  const handleImportLegacy = async () => {
    const result = await importLegacyBrowserData();
    setStatusNote(
      result === "imported"
        ? "Imported current browser app data into the new desktop foundation."
        : "No current browser app data was found to import.",
    );
  };

  const handleExportSnapshot = async () => {
    try {
      const backupBundle = await buildDesktopTransferBackupBundle();
      if (!backupBundle) {
        setStatusNote("Nothing is loaded yet to export.");
        return;
      }
      setStatusNote("Exporting backup to Downloads...");
      const result = await exportSnapshotBackupToDownloads(backupBundle);
      setStatusNote(`Exported a desktop backup file to ${result.path}.`);
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not export the desktop backup file.");
    }
  };

  const handleSaveSnapshotAs = async () => {
    try {
      const backupBundle = await buildDesktopTransferBackupBundle();
      if (!backupBundle) {
        setStatusNote("Nothing is loaded yet to export.");
        return;
      }
      setStatusNote("Preparing backup file...");
      const result = await exportSnapshotBackup(backupBundle);
      if (!result) {
        setStatusNote("Backup export was cancelled.");
        return;
      }
      setStatusNote(`Saved a desktop backup file to ${result.path}.`);
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not save the desktop backup file.");
    }
  };

  const handleImportBackup = async (mode: "replace" | "merge" = "replace") => {
    try {
      const imported = await importSnapshotBackup();
      if (!imported) {
        setStatusNote("Backup import was cancelled.");
        return;
      }
      if (imported.kind === "pwa-export") {
        const mergedSnapshot = snapshot ? mergeImportedPwaSnapshot(snapshot, imported.snapshot) : imported.snapshot;
        await restoreBackupSnapshot(mergedSnapshot);
        setStatusNote("Imported PWA sessions into the desktop database.");
      } else {
        const importedSnapshotWithFiles = imported.attachmentFiles?.length
          ? {
              ...imported.snapshot,
              attachments: await restoreImportedAttachmentFiles({
                attachments: imported.snapshot.attachments,
                attachmentFiles: imported.attachmentFiles,
              }),
            }
          : imported.snapshot;
        const nextSnapshot =
          mode === "merge" && snapshot
            ? mergeDesktopSnapshot(snapshot, importedSnapshotWithFiles)
            : importedSnapshotWithFiles;
        await restoreBackupSnapshot(nextSnapshot);
        if (mode === "replace" && imported.aiTextCache) {
          hydrateAITextCache({ records: imported.aiTextCache });
          await repository.saveAITextCache(imported.aiTextCache);
        }
        if (mode === "replace" && imported.aiRequestHistory) {
          hydrateAIRequestHistory(imported.aiRequestHistory);
          setAIRequestHistory(getAIRequestHistory());
          await repository.saveAIRequestHistory(imported.aiRequestHistory);
        }
        if (mode === "replace" && imported.aiModelPricing) {
          setModelPricingSnapshot(imported.aiModelPricing);
          setModelPricingStatus(buildModelPricingStatus(imported.aiModelPricing));
          await repository.saveAIModelPricing(imported.aiModelPricing);
        }
        setStatusNote(mode === "merge" ? "Merged the selected desktop backup file into the current desktop data." : "Imported the selected desktop backup file.");
      }
      setOpenPanel(null);
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not import the selected desktop backup or PWA session file.");
    }
  };

  const handleOpenDataFolder = async () => {
    if (!storageInfo) {
      setStatusNote("The desktop data folder is only available in the installed app.");
      return;
    }
    try {
      await openDesktopPath(storageInfo.appDataDir);
      setStatusNote("Opened the desktop data folder.");
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not open the desktop data folder.");
    }
  };

  const handleOpenDatabaseFolder = async () => {
    if (!storageInfo) {
      setStatusNote("The desktop database folder is only available in the installed app.");
      return;
    }
    try {
      await openDesktopPath(storageInfo.appConfigDir);
      setStatusNote("Opened the desktop database folder.");
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not open the desktop database folder.");
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingForUpdates(true);
    setUpdateStatusNote("Checking GitHub Releases for a newer desktop version...");
    try {
      const result = await checkForDesktopUpdates();
      if (result.available) {
        setAvailableUpdateVersion(result.version);
        setManualUpdateUrl(result.downloadUrl ?? null);
        setUpdateStatusNote(`Version ${result.version} is available to install.`);
        setStatusNote(`Update available: ${result.version}`);
      } else {
        setAvailableUpdateVersion(null);
        setManualUpdateUrl("downloadUrl" in result && result.downloadUrl ? result.downloadUrl : null);
        setUpdateStatusNote(result.note ?? "Desktop app is already up to date.");
        setStatusNote(result.note ?? "Desktop app is already up to date.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check for updates.";
      setUpdateStatusNote(message);
      setStatusNote(message);
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!availableUpdateVersion || !manualUpdateUrl) {
      return;
    }

    setIsInstallingUpdate(true);
    setUpdateStatusNote(`Preparing installer for version ${availableUpdateVersion}...`);
    setStatusNote(`Preparing update ${availableUpdateVersion}...`);
    try {
      const localBackupBundle = buildDesktopBackupBundle();
      const downloadBackupBundle = await buildDesktopTransferBackupBundle();
      const backupPath = localBackupBundle ? await createLocalSnapshotBackup(localBackupBundle) : null;
      const downloadsBackupPath = downloadBackupBundle ? await exportSnapshotBackupToDownloads(downloadBackupBundle) : null;
      if (backupPath) {
        await refreshLatestLocalBackupInfo();
        setStatusNote(`Created a local safety backup at ${backupPath} before installing ${availableUpdateVersion}.`);
      }
      if (downloadsBackupPath) {
        setStatusNote(`Created a Downloads backup at ${downloadsBackupPath.path} before installing ${availableUpdateVersion}.`);
      }
      if (!manualUpdateUrl.toLocaleLowerCase().includes(".exe")) {
        await openDesktopUrl(manualUpdateUrl);
        setUpdateStatusNote(`Opened the GitHub release page for ${availableUpdateVersion}. Download and run the installer from there.`);
        setStatusNote(`Opened GitHub Releases for update ${availableUpdateVersion}.`);
        setAvailableUpdateVersion(null);
        return;
      }
      await stopAgentSidecar().catch(() => {});
      setUpdateStatusNote(`Downloading the signed ${availableUpdateVersion} installer to Downloads...`);
      const installer = await downloadInstallerToDownloadsAndOpen(manualUpdateUrl, availableUpdateVersion);
      setUpdateStatusNote(
        `Downloaded and opened the ${availableUpdateVersion} installer from ${installer.path}. Close NoteSmith if Windows asks before continuing.`,
      );
      setStatusNote(`Opened installer for update ${availableUpdateVersion}.`);
      setAvailableUpdateVersion(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not install the update.";
      setUpdateStatusNote(message);
      setStatusNote(message);
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  const handleOpenManualUpdate = async () => {
    if (!manualUpdateUrl) {
      return;
    }
    try {
      const backupBundle = await buildDesktopTransferBackupBundle();
      if (backupBundle) {
        const backupPath = await exportSnapshotBackupToDownloads(backupBundle);
        setStatusNote(`Created a Downloads backup at ${backupPath.path} before opening the installer download.`);
      }
      await stopAgentSidecar().catch(() => {});
      setUpdateStatusNote(`Downloading installer for ${availableUpdateVersion ?? "the latest version"} to Downloads...`);
      if (manualUpdateUrl.toLocaleLowerCase().includes(".exe")) {
        const installer = await downloadInstallerToDownloads(manualUpdateUrl, availableUpdateVersion ?? "latest");
        await revealDesktopPath(installer.path);
        setStatusNote(`Downloaded installer to ${installer.path}.`);
        setUpdateStatusNote(`Downloaded installer to ${installer.path}. Run it when you are ready to update.`);
        return;
      }

      await openDesktopUrl(manualUpdateUrl);
      setStatusNote("Opened the GitHub release page for manual update download.");
      setUpdateStatusNote("Opened the GitHub release page for manual update download.");
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not open the GitHub release page.");
    }
  };

  const handleResetTemplates = async () => {
    await resetTemplates();
    setStatusNote("Restored the default built-in templates.");
  };

  const readVisibleCaptureDraft = (session: SessionRecord, template: TemplateDefinition) => {
    const manualNotesElement = document.getElementById("manual-notes");
    const agendaElement = document.getElementById("session-agenda");
    const liveTranscriptElement = document.getElementById("session-transcript");
    const uploadedTranscriptElement = document.getElementById("session-uploaded-transcript");
    const agendaField = template.fields.find((field) => field.enabled && field.key === "agenda");
    const nextCustomFieldValues =
      agendaField && agendaElement instanceof HTMLDivElement
        ? {
            ...session.customFieldValues,
            [agendaField.id]: agendaElement.innerHTML,
          }
        : session.customFieldValues;

    return {
      ...session,
      manualNotes: manualNotesElement instanceof HTMLDivElement ? manualNotesElement.innerHTML : session.manualNotes,
      liveTranscript: liveTranscriptElement instanceof HTMLTextAreaElement ? liveTranscriptElement.value : session.liveTranscript,
      uploadedTranscript:
        uploadedTranscriptElement instanceof HTMLTextAreaElement
          ? uploadedTranscriptElement.value
          : session.uploadedTranscript,
      customFieldValues: nextCustomFieldValues,
    };
  };

  const handleCaptureSessionChange = (session: SessionRecord) => {
    activeSessionDraftRef.current = session;
    void saveSession(session);
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      return;
    }

    const latestState = useDesktopStore.getState();
    const latestSnapshot = latestState.snapshot ?? snapshot;
    const currentSessionId = activeSession?.id ?? latestState.activeSessionId;
    const currentSession =
      (activeSessionDraftRef.current?.id === currentSessionId ? activeSessionDraftRef.current : null) ??
      latestSnapshot?.sessions.find((session) => session.id === currentSessionId && !session.deletedAt) ??
      activeSession;
    const template =
      currentSession && latestSnapshot
        ? getTemplatesForCaptureMode(latestSnapshot.templates, currentSession.captureMode).find(
            (entry) => entry.id === currentSession.templateId,
          ) ??
          getTemplatesForCaptureMode(latestSnapshot.templates, currentSession.captureMode)[0] ??
          activeTemplate
        : activeTemplate;

    if (!currentSession) {
      setStatusNote("Open or create a session before generating output.");
      return;
    }

    if (!template) {
      setStatusNote("The selected template could not be found.");
      return;
    }

    const visibleSession = readVisibleCaptureDraft(currentSession, template);

    setStatusNote(visibleSession.transcribeOnly ? "Polishing manual notes..." : "Generating output...");
    setGenerationLog([]);
    appendGenerationLog(
      visibleSession.transcribeOnly ? "Manual polish started." : "AI generation started.",
      "info",
      `session: ${visibleSession.title || "Untitled session"}\ntemplate: ${template.name}`,
    );
    setIsGenerating(true);
    let usedCache = false;
    try {
      let sessionForGeneration = visibleSession;
      activeSessionDraftRef.current = visibleSession;
      await saveSession(visibleSession);
      const shouldUseManualMode = sessionForGeneration.transcribeOnly === true;
      const sessionAttachments = (latestSnapshot?.attachments ?? activeAttachments).filter(
        (attachment) => attachment.sessionId === sessionForGeneration.id,
      );
      const sessionAudioAttachment = sessionAttachments.find((attachment) => attachment.kind === "audio") ?? null;
      const sessionHasTranscriptText = Boolean(
        sessionForGeneration.liveTranscript.trim() || sessionForGeneration.uploadedTranscript.trim(),
      );

      const hasManualOrTranscriptText = Boolean(
        richTextToPlainText(sessionForGeneration.manualNotes).trim() ||
          sessionForGeneration.liveTranscript.trim() ||
          sessionForGeneration.uploadedTranscript.trim(),
      );
      const sourceTextForLog = buildGenerationSourceText(sessionForGeneration, template);
      appendGenerationLog(
        "Captured source text checked.",
        "info",
        [
          `total source characters: ${sourceTextForLog.length}`,
          `manual notes characters: ${richTextToPlainText(sessionForGeneration.manualNotes).trim().length}`,
          `live transcript characters: ${sessionForGeneration.liveTranscript.trim().length}`,
          `uploaded transcript characters: ${sessionForGeneration.uploadedTranscript.trim().length}`,
          `has text: ${hasManualOrTranscriptText ? "yes" : "no"}`,
        ].join("\n"),
      );

      if (shouldUseManualMode && !hasManualOrTranscriptText) {
        appendGenerationLog("Manual polish stopped because no source text was found.", "warning");
        setStatusNote("Add text to Manual notes or Transcript first. This mode transfers captured text directly into Output without AI generation.");
        return;
      }

      if (
        !shouldUseManualMode &&
        sessionForGeneration.captureMode === "voice-note" &&
        !sessionHasTranscriptText &&
        (sessionAudioAttachment || pendingAudioBySession[sessionForGeneration.id])
      ) {
        const audioFile = await getAudioFileForActiveSession();
        if (!audioFile) {
          appendGenerationLog("Generation stopped because no audio file was available for transcription.", "error");
          setStatusNote("No audio file was available to transcribe for this voice note.");
          return;
        }

        setIsTranscribingAudio(true);
        try {
          const transcriptText = await transcribeAudio({
            file: audioFile,
            settings: snapshot.settings,
            onEvent: createAIRuntimeHandler(),
          });
          sessionForGeneration = {
            ...sessionForGeneration,
            liveTranscript: [sessionForGeneration.liveTranscript.trim(), transcriptText.trim()].filter(Boolean).join("\n\n"),
          };
          await saveSession(sessionForGeneration);
        } finally {
          setIsTranscribingAudio(false);
        }
      }

      if (!shouldUseManualMode && !latestSnapshot.settings.apiKey.trim()) {
        appendGenerationLog("AI generation stopped because no OpenAI API key is configured.", "error");
        setStatusNote("Generate with AI requires an OpenAI API key in Settings. Use Polish Manual notes if you want non-AI output.");
        return;
      }

      const output = shouldUseManualMode
        ? buildManualNotesOnlyOutput(sessionForGeneration, template)
        : await generateNotes({
            session: sessionForGeneration,
            settings: latestSnapshot.settings,
            template,
            attachments: sessionAttachments,
            onDiagnostic: (message, details, level = "info") => appendGenerationLog(message, level, details),
            onEvent: createAIRuntimeHandler({
              onCacheHit: () => {
                usedCache = true;
              },
            }),
          });

      setSelectedOutputVersionId(null);
      if (!output.trim()) {
        appendGenerationLog("Generation completed but returned empty output.", "error");
        throw new Error("Generation completed but produced no output. Add notes, transcript, agenda, or highlights and try again.");
      }

      if (!shouldUseManualMode && isLikelyCopiedSourceOutput(output, buildGenerationSourceText(sessionForGeneration, template))) {
        appendGenerationLog("AI output rejected because it looked too similar to the source text.", "error", `output characters: ${output.length}`);
        throw new Error(
          "AI generation returned output that was too similar to the source transcript. No output was saved. Try again, or add an instruction such as 'summarize into concise meeting minutes and do not reproduce the transcript'.",
        );
      }

      await saveSession({ ...sessionForGeneration, ...buildOutputVersionPatch(sessionForGeneration, output) });
      appendGenerationLog(
        "Output saved to the session.",
        "success",
        `output characters: ${output.trim().length}`,
      );
      setStatusNote(
        shouldUseManualMode
          ? "Manual notes were transferred to Output without AI generation."
          : usedCache
            ? "Loaded structured output from a matching local AI cache entry."
            : "Generated structured output with the desktop AI service.",
      );
      await openMetadataReviewIfNeeded(sessionForGeneration);
      openNotesTarget({ sessionId: sessionForGeneration.id, view: "output" });
    } catch (error) {
      appendGenerationLog(
        visibleSession.transcribeOnly ? "Manual polish failed." : "Generation failed.",
        "error",
        error instanceof Error ? error.message : String(error),
      );
      setStatusNote(
        visibleSession.transcribeOnly
          ? `Manual-notes transfer failed: ${error instanceof Error ? error.message : "Unknown error."}`
          : formatAIErrorMessage(error, "Generation failed."),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyManualNotesDirect = async () => {
    if (isGenerating) {
      return;
    }

    const latestState = useDesktopStore.getState();
    const latestSnapshot = latestState.snapshot ?? snapshot;
    const currentSessionId = activeSession?.id ?? latestState.activeSessionId;
    const currentSession =
      (activeSessionDraftRef.current?.id === currentSessionId ? activeSessionDraftRef.current : null) ??
      latestSnapshot?.sessions.find((session) => session.id === currentSessionId && !session.deletedAt) ??
      activeSession;
    const template =
      currentSession && latestSnapshot
        ? getTemplatesForCaptureMode(latestSnapshot.templates, currentSession.captureMode).find(
            (entry) => entry.id === currentSession.templateId,
          ) ??
          getTemplatesForCaptureMode(latestSnapshot.templates, currentSession.captureMode)[0] ??
          activeTemplate
        : activeTemplate;

    if (!currentSession) {
      setStatusNote("Open or create a session before copying notes to Output.");
      return;
    }

    if (!template) {
      setStatusNote("The selected template could not be found.");
      return;
    }

    const visibleSession = readVisibleCaptureDraft(currentSession, template);
    const directOutput = buildDirectManualNotesOutput(visibleSession);
    if (!directOutput) {
      setStatusNote("Add text to Manual notes first. This option copies Manual notes directly into Output.");
      return;
    }

    setIsGenerating(true);
    setGenerationLog([]);
    appendGenerationLog(
      "Direct Manual-notes copy started.",
      "info",
      `session: ${visibleSession.title || "Untitled session"}\nsource: Manual notes only`,
    );

    try {
      setSelectedOutputVersionId(null);
      await saveSession({ ...visibleSession, ...buildOutputVersionPatch(visibleSession, directOutput) });
      appendGenerationLog(
        "Manual notes copied directly to Output.",
        "success",
        `output characters: ${directOutput.length}`,
      );
      setStatusNote("Manual notes copied directly to Output without AI or non-AI polishing.");
      openNotesTarget({ sessionId: visibleSession.id, view: "output" });
    } catch (error) {
      appendGenerationLog(
        "Direct Manual-notes copy failed.",
        "error",
        error instanceof Error ? error.message : String(error),
      );
      setStatusNote(
        error instanceof Error ? error.message : "Manual notes could not be copied directly to Output.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslate = async () => {
    let usedCache = false;
    try {
      const targetLanguage =
        resolveSessionOutputLanguage(activeSession) === "sv"
          ? "Swedish"
          : resolveSessionOutputLanguage(activeSession) === "en"
            ? "English"
            : activeSession.output.match(/[\u00E5\u00E4\u00F6\u00C5\u00C4\u00D6]/u)
              ? "English"
              : "Swedish";
      const translated = await translateOutput({
        currentOutput: ensureMeetingOutputHeader(activeSession, activeSession.output),
        settings: snapshot.settings,
        targetLanguage,
        onEvent: createAIRuntimeHandler({
          onCacheHit: () => {
            usedCache = true;
          },
        }),
      });
      setSelectedOutputVersionId(null);
      await saveSession({ ...activeSession, ...buildOutputVersionPatch(activeSession, translated) });
      setStatusNote(
        usedCache
          ? `Loaded a cached translation to ${targetLanguage}.`
          : `Translated the current output to ${targetLanguage}.`,
      );
    } catch (error) {
      setStatusNote(formatAIErrorMessage(error, "Translation failed."));
    }
  };

  const handleRevise = async (instructions: string) => {
    setIsRevising(true);
    let usedCache = false;
    try {
      const revised = await reviseOutput({
        currentOutput: ensureMeetingOutputHeader(activeSession, activeSession.output),
        instructions,
        detailLevel: activeSession.detailLevel,
        outputLanguage: resolveSessionOutputLanguage(activeSession),
        additionalInstructions: activeSession.additionalInstructions,
        settings: snapshot.settings,
        onEvent: createAIRuntimeHandler({
          onCacheHit: () => {
            usedCache = true;
          },
        }),
      });
      setSelectedOutputVersionId(null);
      await saveSession({ ...activeSession, ...buildOutputVersionPatch(activeSession, revised) });
      setStatusNote(
        usedCache
          ? "Loaded a cached revision for the current output."
          : "Revised the current output with the desktop AI service.",
      );
    } catch (error) {
      setStatusNote(formatAIErrorMessage(error, "Revision failed."));
    } finally {
      setIsRevising(false);
    }
  };

  const handleImportTranscript = async () => {
    const selection = await pickTranscriptFile();
    if (!selection) return;
    try {
      const text = await readTranscriptFile(selection.file);
      const persistedPath = await persistSelectedAttachment({
        sessionId: activeSession.id,
        selection,
      });
      await saveSession({ ...activeSession, uploadedTranscript: text });
      await saveAttachments([
        ...snapshot.attachments.filter((entry) => !(entry.sessionId === activeSession.id && entry.kind === "transcript")),
        fileToAttachmentRecord({
          file: selection.file,
          sessionId: activeSession.id,
          kind: "transcript",
          filePath: persistedPath,
        }),
      ]);
      setStatusNote("Imported transcript into the desktop session.");
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Transcript import failed.");
    }
  };

  const handleOpenOutputVersion = (versionId: string) => {
    if (!activeSession) {
      return;
    }
    setSelectedOutputVersionId(versionId);
    openNotesTarget({ sessionId: activeSession.id, view: "output" });
  };

  const handleOpenLatestOutputVersion = () => {
    setSelectedOutputVersionId(null);
  };

  const handleRevertOutputVersion = () => {
    if (selectedOutputVersionId) {
      setSelectedOutputVersionId(null);
      setStatusNote("Back on the latest generated version.");
      return;
    }

    const previousVersion = activeOutputVersions[1];
    if (!previousVersion) {
      setStatusNote("There is no previous generated version to open yet.");
      return;
    }

    setSelectedOutputVersionId(previousVersion.id);
    setStatusNote("Opened the previous generated version. Open the latest version to continue editing.");
  };

  const handleCopyOutput = async () => {
    if (!displayedOutput.trim()) {
      setStatusNote("Generate output first, then copy it from here.");
      return;
    }

    try {
      await navigator.clipboard.writeText(displayedOutput);
      setStatusNote("Output copied to your clipboard.");
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Clipboard access was blocked. You can still copy the output manually.");
    }
  };

  const handleAcceptVisibleRuleSuggestion = async (suggestionId: string) => {
    const nextSettings = acceptRuleSuggestion(snapshot.settings, suggestionId);
    await saveSettings(nextSettings);
    setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
  };

  const handleDismissVisibleRuleSuggestion = (suggestionId: string) => {
    setDismissedRuleSuggestionIds((current) => Array.from(new Set([...current, suggestionId])));
  };

  const handleIgnoreVisibleRuleSuggestion = async (suggestionId: string) => {
    const nextSettings = ignoreRuleSuggestion(snapshot.settings, suggestionId, { forever: true });
    await saveSettings(nextSettings);
    setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
  };

  const handleOutputWorkspaceChange = async (nextSession: typeof activeSession) => {
    if (!nextSession) {
      return;
    }

    const normalizedNextSession = {
      ...nextSession,
      output: ensureMeetingOutputHeader(nextSession, nextSession.output),
    };
    activeSessionDraftRef.current = normalizedNextSession;

    if (!activeSession) {
      await saveSession(normalizedNextSession);
      return;
    }

    const normalizedActiveOutput = ensureMeetingOutputHeader(activeSession, activeSession.output);
    if (normalizedNextSession.output !== normalizedActiveOutput) {
      const nextVersions = normalizeOutputVersionHistory(
        normalizedNextSession.outputVersions,
        normalizedActiveOutput,
        activeSession.updatedAt,
      );
      if (nextVersions[0]) {
        nextVersions[0] = {
          ...nextVersions[0],
          output: normalizedNextSession.output,
        };
      } else if (normalizedNextSession.output.trim()) {
        nextVersions.unshift({
          id: crypto.randomUUID(),
          output: normalizedNextSession.output,
          generatedAt: new Date().toISOString(),
        });
      }

      await saveSession({
        ...normalizedNextSession,
        outputVersions: nextVersions,
      });
      return;
    }

    await saveSession(normalizedNextSession);
  };

  const handleImportAudio = async () => {
    const selection = await pickAudioFile();
    if (!selection) return;
    const persistedPath = await persistSelectedAttachment({
      sessionId: activeSession.id,
      selection,
    });

    setPendingAudioBySession((current) => ({ ...current, [activeSession.id]: selection.file }));
    await persistAudioAttachmentForSession({
      sessionId: activeSession.id,
      file: selection.file,
      persistedPath,
    });
    setStatusNote("Uploaded audio into the desktop session. Transcribing it into the transcript field now...");
    setRecordingStatusNote("Audio file attached to the current session. Transcribing now...");
    await transcribeAudioIntoSession({
      sessionId: activeSession.id,
      file: selection.file,
      transcriptTarget: "uploadedTranscript",
      statusPrefix: "Uploaded audio into the desktop session.",
    });
  };

  const handleStartRecording = async (modeOverride?: RecordingMode) => {
    if (!activeSession) {
      return;
    }
    const recordingSession = activeSession;
    const recordingModeForRun = modeOverride ?? recordingMode;
    setRecordingMode(recordingModeForRun);

    if (
      (recordingModeForRun === "microphone" && !navigator.mediaDevices?.getUserMedia) ||
      ((recordingModeForRun === "system-audio" || recordingModeForRun === "hybrid") && !navigator.mediaDevices?.getDisplayMedia) ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingStatusNote(`${RECORDING_MODE_LABELS[recordingModeForRun]} recording is not supported in this runtime yet.`);
      return;
    }

    try {
      cleanupRecordingResources();

      let recorderStream: MediaStream;
      const captureStreams: MediaStream[] = [];

      if (recordingModeForRun === "microphone") {
        const microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        captureStreams.push(microphoneStream);
        recorderStream = microphoneStream;
      } else if (recordingModeForRun === "system-audio") {
        setRecordingStatusNote("Next, choose the Zoom/Teams window or screen and make sure audio sharing is enabled.");
        const displayStream = await navigator.mediaDevices.getDisplayMedia(getSystemAudioDisplayOptions());
        if (!displayStream.getAudioTracks().length) {
          displayStream.getTracks().forEach((track) => track.stop());
          throw new Error("No computer audio was shared. Start again and enable audio sharing in the capture picker.");
        }
        captureStreams.push(displayStream);
        recorderStream = await createMixedRecorderStream([displayStream]);
      } else {
        setRecordingStatusNote("Next, choose the Zoom/Teams window or screen and make sure audio sharing is enabled. Your microphone will be captured too.");
        const [microphoneStream, displayStream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          }),
          navigator.mediaDevices.getDisplayMedia(getSystemAudioDisplayOptions()),
        ]);

        if (!displayStream.getAudioTracks().length) {
          microphoneStream.getTracks().forEach((track) => track.stop());
          displayStream.getTracks().forEach((track) => track.stop());
          throw new Error("No computer audio was shared. Start again and enable audio sharing in the capture picker.");
        }

        captureStreams.push(microphoneStream, displayStream);
        recorderStream = await createMixedRecorderStream([microphoneStream, displayStream]);
      }

      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(recorderStream, { mimeType }) : new MediaRecorder(recorderStream);
      recordingChunksRef.current = [];
      recordingSessionIdRef.current = recordingSession.id;
      mediaStreamRef.current = recorderStream;
      captureSourceStreamsRef.current = captureStreams;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const sessionId = recordingSessionIdRef.current;
        const chunks = [...recordingChunksRef.current];
        recordingChunksRef.current = [];
        recordingSessionIdRef.current = null;

        cleanupRecordingResources();
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);

        if (!sessionId || !chunks.length) {
          setRecordingStatusNote("Recording stopped, but no audio was captured.");
          return;
        }

        try {
          const file = new File(chunks, buildRecordingFilename({ sessionTitle: recordingSession.title, captureMode: recordingSession.captureMode }), {
            type: mimeType || "audio/webm",
          });
          const persistedPath = await persistGeneratedAttachment({ sessionId, file });
          setPendingAudioBySession((current) => ({ ...current, [sessionId]: file }));
          await persistAudioAttachmentForSession({
            sessionId,
            file,
            persistedPath,
          });
          const recordingLabel = RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase();
          setRecordingStatusNote(`Recorded ${recordingLabel} into the current session. Transcribing now...`);
          setStatusNote(`Recorded ${recordingLabel} into the current session. Transcribing now...`);
          await transcribeAudioIntoSession({
            sessionId,
            file,
            statusPrefix: `Recorded ${recordingLabel} into the current session.`,
          });
        } catch (error) {
          setRecordingStatusNote(
            error instanceof Error ? error.message : "Recording finished, but saving the audio failed.",
          );
        }
      };

      recorder.onerror = () => {
        setRecordingStatusNote(`${RECORDING_MODE_LABELS[recordingModeForRun]} recording hit an error and could not continue.`);
      };

      mediaRecorderRef.current = recorder;

      captureStreams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          track.addEventListener(
            "ended",
            () => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
                setRecordingStatusNote(`${RECORDING_MODE_LABELS[recordingModeForRun]} capture ended.`);
              }
            },
            { once: true },
          );
        });
      });

      recorder.start();
      setIsRecordingAudio(true);
      setRecordingStatusNote(`Recording from ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()}...`);
      setStatusNote(`Recording from ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()}...`);
    } catch (error) {
      setRecordingStatusNote(
        error instanceof Error
          ? `Could not start ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()} recording: ${error.message}`
          : `Could not start ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()} recording.`,
      );
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecordingStatusNote("No active recording is currently running.");
      return;
    }

    recorder.stop();
    setRecordingStatusNote("Finishing recording and saving the audio...");
  };

  const handleImportImage = async () => {
    const selection = await pickImageFile();
    if (!selection) return;
    const persistedPath = await persistSelectedAttachment({
      sessionId: activeSession.id,
      selection,
    });

    const nextOutputPosition =
      activeAttachments.filter((attachment) => attachment.kind === "image").length + 1;

    await saveAttachments([
      ...snapshot.attachments,
      {
        ...fileToAttachmentRecord({
          file: selection.file,
          sessionId: activeSession.id,
          kind: "image",
          filePath: persistedPath,
        }),
        outputPosition: nextOutputPosition,
      },
    ]);
    setStatusNote("Added image to the session. You can caption it and choose whether it should appear in the polished output.");
  };

  const handleCreateInlineImageAttachment = async (file: File) => {
    const persistedPath = await persistGeneratedAttachment({
      sessionId: activeSession.id,
      file,
    });

    const nextOutputPosition =
      activeAttachments.filter((attachment) => attachment.kind === "image").length + 1;

    const attachmentRecord = {
      ...fileToAttachmentRecord({
        file,
        sessionId: activeSession.id,
        kind: "image",
        filePath: persistedPath,
      }),
      outputPosition: nextOutputPosition,
    };

    await saveAttachments([
      ...snapshot.attachments,
      attachmentRecord,
    ]);
    setStatusNote("Pasted image added to Manual notes and saved as a session attachment.");
    return attachmentRecord;
  };

  const transcribeAudioIntoSession = async ({
    sessionId,
    file,
    statusPrefix,
    transcriptTarget = "liveTranscript",
  }: {
    sessionId: string;
    file: File;
    statusPrefix?: string;
    transcriptTarget?: "liveTranscript" | "uploadedTranscript";
  }) => {
    setIsTranscribingAudio(true);
    try {
      appendGenerationLog(
        `Audio transcription preparing: ${transcriptTarget === "uploadedTranscript" ? "transcript field" : "live transcript"}`,
        "info",
        describeFileForLog(file),
      );
      let transcriptText: string;
      try {
        transcriptText = await transcribeAudio({
          file,
          settings: snapshot.settings,
          onEvent: createAIRuntimeHandler(),
        });
      } catch (initialError) {
        const persistedAudioFile = await loadPersistedAudioFileForSession(sessionId);
        if (!persistedAudioFile) {
          appendGenerationLog(
            "Audio transcription failed before fallback file reload.",
            "error",
            `${describeFileForLog(file)}\n${describeAIErrorForLog(initialError)}`,
          );
          throw initialError;
        }
        appendGenerationLog(
          "Audio transcription retrying from the saved desktop attachment.",
          "warning",
          `${describeAIErrorForLog(initialError)}\n\nReloaded attachment:\n${describeFileForLog(persistedAudioFile)}`,
        );
        transcriptText = await transcribeAudio({
          file: persistedAudioFile,
          settings: snapshot.settings,
          onEvent: createAIRuntimeHandler(),
        });
      }
      const latestSnapshot = await repository.loadSnapshot();
      const targetSession = latestSnapshot.sessions.find((session) => session.id === sessionId);
      if (!targetSession) {
        throw new Error("The session could not be found after recording.");
      }
      const currentTranscript = transcriptTarget === "uploadedTranscript" ? targetSession.uploadedTranscript : targetSession.liveTranscript;
      const nextTranscript = [currentTranscript.trim(), transcriptText.trim()].filter(Boolean).join("\n\n");
      await saveSession({
        ...targetSession,
        ...(transcriptTarget === "uploadedTranscript"
          ? { uploadedTranscript: nextTranscript }
          : { liveTranscript: nextTranscript }),
      });
      appendGenerationLog(
        "Audio transcription saved to the session.",
        "success",
        `target: ${transcriptTarget}\ntranscript characters added: ${transcriptText.trim().length}\ncombined field characters: ${nextTranscript.length}`,
      );
      setStatusNote(
        statusPrefix
          ? `${statusPrefix} The transcript was added to the ${transcriptTarget === "uploadedTranscript" ? "transcript" : "live transcript"} field.`
          : `Audio transcription complete and added to the ${transcriptTarget === "uploadedTranscript" ? "transcript" : "live transcript"} field.`,
      );
      setRecordingStatusNote("Transcript added to the session.");
    } catch (error) {
      appendGenerationLog(
        "Audio transcription could not be completed.",
        "error",
        `${describeFileForLog(file)}\ntarget: ${transcriptTarget}\n${describeAIErrorForLog(error)}`,
      );
      const message = formatAIErrorMessage(error, "Audio transcription failed.");
      setStatusNote(statusPrefix ? `${statusPrefix} ${message}` : message);
      setRecordingStatusNote("Audio was saved, but transcription needs another try.");
    } finally {
      setIsTranscribingAudio(false);
    }
  };

  const handleTranscribeAudio = async () => {
    const file = await getAudioFileForActiveSession();
    if (!file) {
      setStatusNote("Record or upload audio for this session first, then transcribe it.");
      return;
    }
    await transcribeAudioIntoSession({
      sessionId: activeSession.id,
      file,
      transcriptTarget: activeSession.captureMode === "voice-note" ? "liveTranscript" : "uploadedTranscript",
    });
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    const attachment = snapshot.attachments.find((entry) => entry.id === attachmentId);
    if (!attachment) {
      return;
    }

    await saveAttachments(snapshot.attachments.filter((entry) => entry.id !== attachmentId));
    await removePersistedAttachment(attachment.filePath);

    if (attachment.kind === "audio") {
      setPendingAudioBySession((current) => {
        const next = { ...current };
        delete next[attachment.sessionId];
        return next;
      });
    }

    if (attachment.kind === "transcript" && attachment.sessionId === activeSession.id) {
      await saveSession({ ...activeSession, uploadedTranscript: "" });
    }

    if (attachment.kind === "image" && attachment.sessionId === activeSession.id) {
      const cleanedManualNotes = activeSession.manualNotes.replace(
        new RegExp(`<figure[^>]*data-notesmith-attachment-id="${attachment.id}"[^>]*>.*?<\\/figure>(?:<p><br><\\/p>)?`, "gis"),
        "",
      );
      if (cleanedManualNotes !== activeSession.manualNotes) {
        await saveSession({ ...activeSession, manualNotes: cleanedManualNotes });
      }
    }

    setStatusNote(`Removed ${attachment.filename} from the session attachments.`);
  };

  const handleUpdateAttachment = async (attachmentUpdates: typeof activeAttachments[number]) => {
    await saveAttachments(
      snapshot.attachments.map((entry) => (entry.id === attachmentUpdates.id ? attachmentUpdates : entry)),
    );
  };

  const handleCreateNotebookPage = async () => {
    const session = createSessionRecord("personal-note", "quick-note");
    session.title = session.date;
    await saveSession(session);
    setSelectedOutputVersionId(null);
    setActiveView("capture");
    setActiveWorkspace("notebook");
    setStatusNote("Created a new Notebook page.");
  };

  const openSettingsSection = (section: SettingsSection) => {
    setSettingsSection(section);
    setOpenPanel("settings");
  };

  const handleWorkspaceSelection = (workspaceId: AppWorkspace, available: boolean) => {
    setRequestedTodoId(null);
    setRequestedTodoDomain(null);
    setRequestedTodoProject(null);
    setRequestedTimeDomain(null);
    setRequestedTimeProject(null);
    setLinkedDetailReturnWorkspace(null);
    setActiveWorkspace(workspaceId);
    if (!available) {
      setStatusNote(`${WORKSPACE_ITEMS.find((item) => item.id === workspaceId)?.label ?? "Workspace"} is planned next. The shell already keeps its place so the app can grow without changing navigation patterns.`);
    }
  };
  const clearRequestedFilters = () => {
    setRequestedTodoId(null);
    setRequestedTodoDomain(null);
    setRequestedTodoProject(null);
    setRequestedTimeDomain(null);
    setRequestedTimeProject(null);
  };
  const openLinkedDestination = ({
    workspace,
    todoId = null,
    todoDomain = null,
    todoProject = null,
    timeDomain = null,
    timeProject = null,
    returnWorkspace = null,
    status,
  }: {
    workspace: AppWorkspace;
    todoId?: string | null;
    todoDomain?: string | null;
    todoProject?: string | null;
    timeDomain?: string | null;
    timeProject?: string | null;
    returnWorkspace?: AppWorkspace | null;
    status?: string;
  }) => {
    clearRequestedFilters();
    setRequestedTodoId(todoId);
    setRequestedTodoDomain(todoDomain);
    setRequestedTodoProject(todoProject);
    setRequestedTimeDomain(timeDomain);
    setRequestedTimeProject(timeProject);
    setLinkedDetailReturnWorkspace(returnWorkspace);
    setActiveWorkspace(workspace);
    if (status) {
      setStatusNote(status);
    }
  };
  const openNotesTarget = ({
    sessionId,
    view = "capture",
    returnWorkspace = null,
    calendarItemId = null,
    status,
  }: {
    sessionId: string;
    view?: "capture" | "output";
    returnWorkspace?: AppWorkspace | null;
    calendarItemId?: string | null;
    status?: string;
  }) => {
    clearRequestedFilters();
    setLinkedDetailReturnWorkspace(returnWorkspace);
    setLinkedCalendarReturnItemId(returnWorkspace === "calendar" ? calendarItemId : null);
    setActiveSessionId(sessionId);
    setActiveWorkspace("notes");
    setActiveView(view);
    if (status) {
      setStatusNote(status);
    }
  };
  const openCalendarSessionTarget = ({
    sessionId,
    calendarItemId = null,
    tab = "capture",
    status,
  }: {
    sessionId: string;
    calendarItemId?: string | null;
    tab?: CalendarSessionOverlayTab;
    status?: string;
  }) => {
    clearRequestedFilters();
    setOpenPanel(null);
    setCalendarOutputPreviewSessionId(null);
    setLinkedDetailReturnWorkspace(null);
    setLinkedCalendarReturnItemId(calendarItemId);
    setSelectedOutputVersionId(null);
    setActiveSessionId(sessionId);
    setActiveWorkspace("calendar");
    setCalendarSessionOverlay({ sessionId, calendarItemId });
    setCalendarSessionOverlayTab(tab);
    if (status) {
      setStatusNote(status);
    }
  };
  const findCalendarItemIdForSession = (sessionId: string) =>
    snapshot?.calendarItems.find((item) => {
      if (item.targetType === "activity") {
        return linkedSessionStateByActivity[item.targetId]?.sessionId === sessionId;
      }
      return linkedSessionStateByTodo[item.targetId]?.sessionId === sessionId;
    })?.id ?? null;
  const findCalendarItemIdForSource = (targetType: "activity" | "todo", targetId: string) =>
    snapshot?.calendarItems.find((item) => item.targetType === targetType && item.targetId === targetId)?.id ?? null;
  const openSessionFromCalendar = (sessionId: string, calendarItemId: string | null = null) =>
    openCalendarSessionTarget({
      sessionId,
      calendarItemId,
      tab: "capture",
      status: "Opened linked session in Calendar.",
    });
  const openActivityFromLink = (activityId: string, returnWorkspace: AppWorkspace | null = null) =>
    (() => {
      const linkedActivity = snapshot?.activities.find((entry) => entry.id === activityId) ?? null;
      clearRequestedFilters();
      setLinkedDetailReturnWorkspace(returnWorkspace);
      setActiveWorkspace("structure");
      setStatusNote(linkedActivity ? `Opened ${linkedActivity.description} in Structure.` : "Opened linked activity in Structure.");
    })();
  const openTodoDetailFromLink = (todoId: string, returnWorkspace: AppWorkspace | null = null) =>
    openLinkedDestination({
      workspace: "todos",
      todoId,
      returnWorkspace,
      status: "Opened linked task.",
    });
  const returnFromLinkedDetail = () => {
    if (!requestedTodoId && !linkedDetailReturnWorkspace) {
      return;
    }
    const nextWorkspace = linkedDetailReturnWorkspace ?? "calendar";
    setRequestedTodoId(null);
    setRequestedTodoDomain(null);
    setRequestedTodoProject(null);
    setRequestedTimeDomain(null);
    setRequestedTimeProject(null);
    setLinkedDetailReturnWorkspace(null);
    if (nextWorkspace !== "calendar") {
      setLinkedCalendarReturnItemId(null);
    }
    setActiveWorkspace(nextWorkspace);
    setStatusNote(`Returned to ${nextWorkspace === "notebook" ? "Notebook" : nextWorkspace === "time" ? "Time" : nextWorkspace === "calendar" ? "Calendar" : nextWorkspace === "now" ? "Now" : "the previous workspace"}.`);
  };
  const openCalendarOutputPreview = (sessionId: string) => {
    openCalendarSessionTarget({
      sessionId,
      calendarItemId: findCalendarItemIdForSession(sessionId),
      tab: "output",
      status: "Opened linked session output in Calendar.",
    });
  };

  const openOverlay = (panel: OverlayPanel) => setOpenPanel(panel);
  const closeOverlay = () => {
    setOpenPanel(null);
    setCalendarOutputPreviewSessionId(null);
  };
  const handleCreateSessionFromTemplate = async (templateId?: string) => {
    const template =
      snapshot?.templates.find((entry) => entry.id === templateId) ??
      quickStartTemplates.find((entry) => entry.id === templateId) ??
      quickStartTemplates[0] ??
      null;
    if (!template) {
      return;
    }
    const captureMode = getPrimaryCaptureMode(template);
    await createNewSession({
      captureMode,
      templateId: template.id,
    });
    setActiveWorkspace("notes");
    setActiveView("capture");
    setStatusNote(`Started a new ${template.name.toLowerCase()} session.`);
    closeOverlay();
  };
  const openCommandPalette = () => {
    setCommandQuery("");
    setIsCommandPaletteOpen(true);
  };
  const closeCommandPalette = () => setIsCommandPaletteOpen(false);

  const commandActions: CommandAction[] = [
      {
        id: "notebook",
        label: "Open Notebook",
        description: "Write, record, and revisit dated pages and meetings.",
        keywords: ["notebook pages daily notes meetings"],
        action: () => setActiveWorkspace("notebook"),
      },
      {
        id: "new-session",
        label: "New note",
        description: "Choose the kind of session you want to start.",
        keywords: ["create session note capture meeting quick 1:1 template"],
        shortcut: "Ctrl/Cmd+N",
        action: () => openOverlay("new-note"),
      },
      {
        id: "capture-view",
        label: "Go to Capture view",
        description: "Focus the note-taking workspace.",
        keywords: ["capture notes input"],
        shortcut: "Alt+1",
        action: () => setActiveView("capture"),
      },
      {
        id: "output-view",
        label: "Go to Output view",
        description: "Focus the polished notes workspace.",
        keywords: ["output polished generate"],
        shortcut: "Alt+2",
        action: () => setActiveView("output"),
      },
      {
        id: "all-sessions",
        label: "Open All Sessions",
        description: "Browse and reopen previous sessions.",
        keywords: ["sessions history recent"],
        shortcut: "Ctrl/Cmd+Shift+S",
        action: () => openOverlay("sessions"),
      },
      {
        id: "todos",
        label: "Open Tasks",
        description: "See personal work items and follow-ups captured from notes.",
        keywords: ["todo tasks follow up"],
        action: () => setActiveWorkspace("todos"),
      },
      {
        id: "calendar",
        label: "Open Calendar",
        description: "Schedule tasks and meetings across time.",
        keywords: ["calendar schedule plan meeting"],
        action: () => setActiveWorkspace("calendar"),
      },
      {
        id: "now",
        label: "Open Now",
        description: "Jump into recent tasks, upcoming meetings, and common work context.",
        keywords: ["now quick access recent tasks launchpad meetings"],
        action: () => setActiveWorkspace("now"),
      },
      {
        id: "time",
        label: "Open Time",
        description: "Review timers, logs, and time summaries.",
        keywords: ["time logs timer reporting"],
        action: () => setActiveWorkspace("time"),
      },
      {
        id: "analytics",
        label: "Open Analytics",
        description: "Review trends, summaries, and rollups from your timelogs.",
        keywords: ["analytics dashboard trends summaries reports"],
        action: () => setActiveWorkspace("analytics"),
      },
      {
        id: "structure",
        label: "Open Structure",
        description: "Inspect domains and projects as work views.",
        keywords: ["domain project structure work"],
        action: () => setActiveWorkspace("structure"),
      },
      {
        id: "backup",
        label: "Open Back-up",
        description: "Import or export desktop data snapshots.",
        keywords: ["backup export import snapshot"],
        action: () => openOverlay("backup"),
      },
      {
        id: "settings-ai",
        label: "Open AI Settings",
        description: "Review API key, models, prompts, and AI visibility.",
        keywords: ["settings ai models prompts"],
        shortcut: "Ctrl/Cmd+,",
        action: () => openSettingsSection("ai"),
      },
      {
        id: "settings-themes",
        label: "Open Theme Settings",
        description: "Switch theme family and light/dark mode.",
        keywords: ["theme appearance dark light"],
        action: () => openSettingsSection("themes"),
      },
      {
        id: "settings-people",
        label: "Open People Settings",
        description: "Manage saved people and abbreviations.",
        keywords: ["people participants abbreviations"],
        action: () => openSettingsSection("people"),
      },
      {
        id: "settings-templates",
        label: "Open Template Settings",
        description: "Edit built-in and custom note structures.",
        keywords: ["templates sections note structures"],
        action: () => openSettingsSection("templates"),
      },
      {
        id: "generate-output",
        label: outputActionConfig.primaryLabel,
        description: "Run the primary Output action for the current session.",
        keywords: ["generate polish ai"],
        shortcut: "Ctrl/Cmd+Enter",
        action: outputActionConfig.onPrimary,
      },
      {
        id: "translate-output",
        label: "Translate output",
        description: "Translate the current polished output.",
        keywords: ["translate swedish english"],
        action: () => void handleTranslate(),
      },
      {
        id: "upload-transcript",
        label: "Upload transcript",
        description: "Import a transcript file into the current session.",
        keywords: ["transcript import upload"],
        action: () => void handleImportTranscript(),
      },
        {
          id: "upload-audio",
          label: "Upload audio",
          description: "Attach audio to the current session.",
          keywords: ["audio upload recording"],
          action: () => void handleImportAudio(),
        },
        {
          id: "record-audio",
          label: isRecordingAudio ? "Stop recording" : "Start microphone recording",
          description: isRecordingAudio
            ? "Stop the current recording and attach it to this session."
            : "Record audio directly into the current session using the selected capture mode.",
          keywords: ["record microphone system audio hybrid dictation audio meeting"],
          action: () => void (isRecordingAudio ? handleStopRecording() : handleStartRecording()),
          shortcut: "Capture",
        },
      {
        id: "upload-image",
        label: "Upload image",
        description: "Attach an image and optionally include it in output.",
        keywords: ["image attachment picture"],
        action: () => void handleImportImage(),
      },
      ...activeSessions.slice(0, 8).map((session) => ({
        id: `session-${session.id}`,
        label: `Open session: ${session.title || "Untitled session"}`,
        description: session.date || "Recent session",
        keywords: [session.title, session.participantText, session.domain, session.project, session.activity, session.tagsText, session.date].filter(Boolean) as string[],
        action: () => {
          setActiveSessionId(session.id);
          setActiveView("capture");
        },
      })),
    ];

  const filteredCommandActions = (() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return commandActions;
    return commandActions.filter((command) =>
      [command.label, command.description, ...command.keywords].join(" ").toLowerCase().includes(query),
    );
  })();

  const closeCalendarSessionOverlay = () => {
    setCalendarSessionOverlay(null);
    setCalendarSessionOverlayTab("capture");
    setSelectedOutputVersionId(null);
    setStatusNote("Closed calendar session overlay.");
  };

  const openCalendarOverlaySessionInNotes = () => {
    if (!calendarSessionOverlay || !activeSession) {
      return;
    }
    const nextView = calendarSessionOverlayTab === "output" ? "output" : "capture";
    setCalendarSessionOverlay(null);
    openNotesTarget({
      sessionId: activeSession.id,
      view: nextView,
      returnWorkspace: "calendar",
      calendarItemId: calendarSessionOverlay.calendarItemId,
      status: "Opened linked session in Notes.",
    });
  };

  const handleCalendarOverlayDomainChange = (domain: string) => {
    if (!activeSession) {
      return;
    }
    const nextProjects = getProjectsForDomain(structureOptions, domain);
    const nextProject = nextProjects.includes(activeSession.project) ? activeSession.project : "";
    const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
    const nextActivity = nextActivities.includes(activeSession.activity) ? activeSession.activity : "";
    handleCaptureSessionChange({
      ...activeSession,
      domain,
      project: nextProject,
      activity: nextActivity,
    });
  };

  const handleCalendarOverlayProjectChange = (project: string) => {
    if (!activeSession) {
      return;
    }
    const nextActivities = getActivitiesForSelection(structureOptions, activeSession.domain, project);
    const nextActivity = nextActivities.includes(activeSession.activity) ? activeSession.activity : "";
    handleCaptureSessionChange({
      ...activeSession,
      project,
      activity: nextActivity,
    });
  };

  const handleCalendarOverlayTemplateChange = (templateId: string) => {
    if (!activeSession || !snapshot) {
      return;
    }
    const nextTemplate = snapshot.templates.find((template) => template.id === templateId);
    const nextCaptureMode = nextTemplate ? getPrimaryCaptureMode(nextTemplate) : activeSession.captureMode;
    const nextFieldValues = Object.fromEntries(
      (nextTemplate?.fields ?? [])
        .filter(
          (field) =>
            field.enabled &&
            !STANDARD_TEMPLATE_FIELD_KEYS.includes(field.key as (typeof STANDARD_TEMPLATE_FIELD_KEYS)[number]),
        )
        .map((field) => [field.id, activeSession.customFieldValues[field.id] ?? ""]),
    );
    handleCaptureSessionChange({
      ...activeSession,
      captureMode: nextCaptureMode,
      templateId,
      customFieldValues: nextFieldValues,
      excludedSectionIds: [],
    });
  };

  const renderCalendarSessionOverlay = () => {
    if (!calendarSessionOverlay || !activeSession || !snapshot) {
      return null;
    }

    const linkedSourceType = activeLinkedActivity
      ? activeLinkedActivity.type === "meeting"
        ? "Meeting"
        : "Activity"
      : activeLinkedTodo
        ? "Task"
        : "Session";
    const linkedSourceTitle = activeLinkedActivity?.description || activeLinkedTodo?.description || "";
    const linkedSourceKey = activeLinkedActivity
      ? { targetType: "activity" as const, targetId: activeLinkedActivity.id }
      : activeLinkedTodo
        ? { targetType: "todo" as const, targetId: activeLinkedTodo.id }
        : null;
    const linkedSourceRunning = linkedSourceKey
      ? openTimeLogs.some(
          (entry) => entry.targetType === linkedSourceKey.targetType && entry.targetId === linkedSourceKey.targetId,
        )
      : false;
    const detailTemplateOptions = getTemplatesForCaptureMode(snapshot.templates, activeSession.captureMode);
    const detailProjectOptions = getProjectsForDomain(structureOptions, activeSession.domain);
    const detailActivityOptions = getActivitiesForSelection(
      structureOptions,
      activeSession.domain,
      activeSession.project,
    );
    const detailProjectPickerOptions = detailProjectOptions.length
      ? detailProjectOptions
      : snapshot.settings.savedProjects;
    const detailActivityPickerOptions = detailActivityOptions.length
      ? detailActivityOptions
      : snapshot.settings.savedActivities;
    const detailProjectSet = new Set(detailProjectPickerOptions);
    const detailActivitySet = new Set(detailActivityPickerOptions);
    const detailSuggestedProjects = suggestedProjects.filter((project) => detailProjectSet.has(project));
    const detailSuggestedActivities = suggestedActivities.filter((activity) => detailActivitySet.has(activity));
    const detailCustomFields =
      activeTemplate?.fields.filter(
        (field) =>
          field.enabled &&
          !STANDARD_TEMPLATE_FIELD_KEYS.includes(field.key as (typeof STANDARD_TEMPLATE_FIELD_KEYS)[number]),
      ) ?? [];

    return (
      <div className="calendar-session-overlay-backdrop" role="presentation" onClick={closeCalendarSessionOverlay}>
        <div
          className="calendar-session-overlay-surface"
          role="dialog"
          aria-modal="true"
          aria-label="Session overlay"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="calendar-session-overlay-header">
            <div className="calendar-session-overlay-header-copy">
              <div className="calendar-session-overlay-header-eyebrow">
                <span className="status-chip">{linkedSourceType}</span>
                {linkedSourceTitle ? <span className="tiny-text">{linkedSourceTitle}</span> : null}
              </div>
              <h2>{activeSession.title || "Untitled session"}</h2>
              <div className="calendar-session-overlay-header-meta">
                {activeSession.domain ? <span className="status-chip">{activeSession.domain}</span> : null}
                {activeSession.project ? <span className="status-chip">{activeSession.project}</span> : null}
                {activeSession.activity ? <span className="status-chip">{activeSession.activity}</span> : null}
                {linkedSourceRunning ? <span className="status-chip">Running</span> : null}
              </div>
            </div>
            <div className="calendar-session-overlay-header-actions">
              {linkedSourceKey ? (
                <button
                  className={linkedSourceRunning ? "primary-button" : "shell-button"}
                  type="button"
                  onClick={() => {
                    if (linkedSourceRunning) {
                      void stopTimeTracking(linkedSourceKey.targetType, linkedSourceKey.targetId);
                      return;
                    }
                    void startTimeTracking(linkedSourceKey.targetType, linkedSourceKey.targetId);
                  }}
                >
                  {linkedSourceRunning ? "Stop" : "Start"}
                </button>
              ) : null}
              <button className="shell-button" type="button" onClick={openCalendarOverlaySessionInNotes}>
                Open in Notes
              </button>
              <button className="small-button" type="button" onClick={closeCalendarSessionOverlay}>
                Close
              </button>
            </div>
          </div>

          <div className="calendar-session-overlay-tabs" role="tablist" aria-label="Session workspace tabs">
            {(["capture", "output", "details"] as const).map((tab) => (
              <button
                key={tab}
                className="calendar-session-overlay-tab"
                type="button"
                role="tab"
                data-active={calendarSessionOverlayTab === tab}
                aria-selected={calendarSessionOverlayTab === tab}
                onClick={() => setCalendarSessionOverlayTab(tab)}
              >
                {tab === "capture" ? "Capture" : tab === "output" ? "Output" : "Details"}
              </button>
            ))}
          </div>

          <div className="calendar-session-overlay-body">
            {calendarSessionOverlayTab === "capture" ? (
              <SessionEditor
                session={activeSession}
                templates={snapshot.templates}
                attachments={activeAttachments}
                presentation="minimal"
                showPresentationActions={false}
                showPanelHeading={false}
                showQuickStartTemplates={false}
                savedPeople={snapshot.settings.savedParticipants}
                suggestedPeople={suggestedPeople}
                savedProjects={snapshot.settings.savedProjects}
                suggestedProjects={suggestedProjects}
                savedDomains={snapshot.settings.savedDomains}
                suggestedDomains={suggestedDomains}
                savedActivities={snapshot.settings.savedActivities}
                suggestedActivities={suggestedActivities}
                structureOptions={structureOptions}
                savedTags={snapshot.settings.savedTags}
                suggestedTags={suggestedTags}
                isTranscribingAudio={isTranscribingAudio}
                recordingMode={recordingMode}
                isRecordingAudio={isRecordingAudio}
                recordingStatusNote={recordingStatusNote}
                generationLog={generationLog}
                onClearGenerationLog={() => setGenerationLog([])}
                onChange={handleCaptureSessionChange}
                onImportImage={() => void handleImportImage()}
                onCreateInlineImageAttachment={(file) => handleCreateInlineImageAttachment(file)}
                onImportAudio={() => void handleImportAudio()}
                onTranscribeAudio={() => void handleTranscribeAudio()}
                onChangeRecordingMode={setRecordingMode}
                onStartRecording={(mode) => void handleStartRecording(mode)}
                onStopRecording={() => void handleStopRecording()}
                onImportTranscript={() => void handleImportTranscript()}
                onRemoveAttachment={(attachmentId) => void handleRemoveAttachment(attachmentId)}
                onUpdateAttachment={(attachment) => void handleUpdateAttachment(attachment)}
                onCreateSessionFromTemplate={(templateId) => void handleCreateSessionFromTemplate(templateId)}
                onOpenInstructions={() => openOverlay("instructions")}
              />
            ) : null}

            {calendarSessionOverlayTab === "output" ? (
              <OutputWorkspace
                session={activeSession}
                template={activeTemplate}
                displayedOutput={displayedOutput}
                layoutPresetId={snapshot.settings.outputLayoutPresetId}
                outputVersions={activeOutputVersions}
                selectedOutputVersionId={selectedOutputVersionId}
                attachments={activeAttachments}
                presentation="minimal"
                showPresentationActions={false}
                showPanelHeading={false}
                showDetailsSection={false}
                onChange={(session) => void handleOutputWorkspaceChange(session)}
                savedPeople={snapshot.settings.savedParticipants}
                suggestedPeople={suggestedPeople}
                savedProjects={snapshot.settings.savedProjects}
                suggestedProjects={suggestedProjects}
                savedDomains={snapshot.settings.savedDomains}
                suggestedDomains={suggestedDomains}
                savedActivities={snapshot.settings.savedActivities}
                suggestedActivities={suggestedActivities}
                structureOptions={structureOptions}
                savedTags={snapshot.settings.savedTags}
                suggestedTags={suggestedTags}
                isPrimaryActionRunning={outputActionConfig.isPrimaryRunning}
                isSecondaryActionRunning={outputActionConfig.isSecondaryRunning}
                isRevising={isRevising}
                onPrimaryAction={outputActionConfig.onPrimary}
                onSecondaryAction={outputActionConfig.onSecondary}
                onCopyOutput={() => void handleCopyOutput()}
                onTranslate={() => void handleTranslate()}
                onRevise={(instructions) => void handleRevise(instructions)}
                onRevertOutputVersion={handleRevertOutputVersion}
                onOpenOutputVersion={handleOpenOutputVersion}
                onOpenLatestOutputVersion={handleOpenLatestOutputVersion}
                onExportText={() => exportOutputAsText({ title: activeSession.title, output: displayedOutput })}
                onExportMarkdown={() => exportOutputAsMarkdown({ title: activeSession.title, output: displayedOutput })}
                onExportHtml={() =>
                  exportOutputAsHtml({
                    title: activeSession.title,
                    output: displayedOutput,
                    attachments: activeAttachments,
                    layoutPresetId: snapshot.settings.outputLayoutPresetId,
                  })}
                onExportDocx={() =>
                  void exportOutputAsDocx({
                    title: activeSession.title,
                    output: displayedOutput,
                    attachments: activeAttachments,
                    layoutPresetId: snapshot.settings.outputLayoutPresetId,
                  })}
                onExportPdf={() =>
                  void exportOutputAsPdf({
                    title: activeSession.title,
                    output: displayedOutput,
                    attachments: activeAttachments,
                    layoutPresetId: snapshot.settings.outputLayoutPresetId,
                  })}
                ruleSuggestions={visibleRuleSuggestions.filter((entry) => !dismissedRuleSuggestionIds.includes(entry.id))}
                onAcceptRuleSuggestion={(suggestionId) => void handleAcceptVisibleRuleSuggestion(suggestionId)}
                onDismissRuleSuggestion={handleDismissVisibleRuleSuggestion}
                onIgnoreRuleSuggestion={(suggestionId) => void handleIgnoreVisibleRuleSuggestion(suggestionId)}
                primaryActionLabel={outputActionConfig.primaryLabel}
                secondaryActionLabel={outputActionConfig.secondaryLabel}
                emptyStatePrimaryLabel={outputActionConfig.emptyStatePrimaryLabel}
                emptyStateSecondaryLabel={outputActionConfig.emptyStateSecondaryLabel}
                linkedActivity={activeLinkedActivity}
                onOpenLinkedActivity={(activityId) => openActivityFromLink(activityId, "calendar")}
                onAddFollowUpTodo={(description, options) =>
                  void addTodo(description, {
                    ...getMeetingTodoDefaults(),
                    ...options,
                  })}
                onAddFollowUpMeeting={(description, options) => void addActivity(description, "meeting", options)}
              />
            ) : null}

            {calendarSessionOverlayTab === "details" ? (
              <div className="card calendar-session-details-card">
                <div className="calendar-session-details-grid">
                  <div className="field field-wide">
                    <label htmlFor="calendar-overlay-session-title">Title</label>
                    <input
                      id="calendar-overlay-session-title"
                      value={activeSession.title}
                      onChange={(event) => handleCaptureSessionChange({ ...activeSession, title: event.target.value })}
                      placeholder="Session title"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="calendar-overlay-template">Template</label>
                    <select
                      id="calendar-overlay-template"
                      value={activeTemplate?.id ?? ""}
                      onChange={(event) => handleCalendarOverlayTemplateChange(event.target.value)}
                    >
                      {detailTemplateOptions.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="calendar-overlay-date">Date</label>
                    <DateInput
                      id="calendar-overlay-date"
                      value={activeSession.date}
                      onChange={(event) => handleCaptureSessionChange({ ...activeSession, date: event.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="calendar-overlay-start">Start</label>
                    <DeferredTimeInput
                      id="calendar-overlay-start"
                      value={activeSession.startTime}
                      onCommit={(value) => handleCaptureSessionChange({ ...activeSession, startTime: value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="calendar-overlay-end">End</label>
                    <DeferredTimeInput
                      id="calendar-overlay-end"
                      value={activeSession.endTime}
                      onCommit={(value) => handleCaptureSessionChange({ ...activeSession, endTime: value })}
                    />
                  </div>
                  <div className="field field-wide">
                    <label htmlFor="calendar-overlay-people">People</label>
                    <PeoplePicker
                      value={activeSession.participantText}
                      savedPeople={snapshot.settings.savedParticipants}
                      suggestedPeople={suggestedPeople}
                      onChange={(value) => handleCaptureSessionChange({ ...activeSession, participantText: value })}
                      placeholder="Search or add people"
                    />
                  </div>
                  <div className="field field-wide metadata-triplet">
                    <div className="metadata-triplet-grid">
                      <div className="field metadata-subfield">
                        <label htmlFor="calendar-overlay-domain">Domain</label>
                        <TokenPicker
                          value={activeSession.domain}
                          savedOptions={
                            structureOptions.domains.length
                              ? structureOptions.domains
                              : snapshot.settings.savedDomains
                          }
                          suggestedOptions={suggestedDomains}
                          placeholder="Search or add domain"
                          suggestionSummary="Recent domains"
                          suggestionBadgeText="From saved Domains"
                          mode="single"
                          onChange={handleCalendarOverlayDomainChange}
                        />
                      </div>
                      <div className="field metadata-subfield">
                        <label htmlFor="calendar-overlay-project">Project</label>
                        <TokenPicker
                          value={activeSession.project}
                          savedOptions={detailProjectPickerOptions}
                          suggestedOptions={detailSuggestedProjects}
                          placeholder="Search or add project"
                          suggestionSummary="Recent projects"
                          suggestionBadgeText="From saved Projects"
                          mode="single"
                          onChange={handleCalendarOverlayProjectChange}
                        />
                      </div>
                      <div className="field metadata-subfield">
                        <label htmlFor="calendar-overlay-activity">Activity</label>
                        <TokenPicker
                          value={activeSession.activity}
                          savedOptions={detailActivityPickerOptions}
                          suggestedOptions={detailSuggestedActivities}
                          placeholder="Search or add activity"
                          suggestionSummary="Recent activities"
                          suggestionBadgeText="From saved Activities"
                          mode="single"
                          onChange={(value) => handleCaptureSessionChange({ ...activeSession, activity: value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="field field-wide">
                    <label htmlFor="calendar-overlay-tags">Tags</label>
                    <TokenPicker
                      value={activeSession.tagsText}
                      savedOptions={snapshot.settings.savedTags}
                      suggestedOptions={suggestedTags}
                      placeholder="Add tags"
                      suggestionSummary="Recent tags"
                      suggestionBadgeText="From saved Tags"
                      onChange={(value) => handleCaptureSessionChange({ ...activeSession, tagsText: value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="calendar-overlay-output-language">Output language</label>
                    <select
                      id="calendar-overlay-output-language"
                      value={activeSession.outputLanguage}
                      onChange={(event) =>
                        handleCaptureSessionChange({
                          ...activeSession,
                          outputLanguage: event.target.value as SessionRecord["outputLanguage"],
                        })
                      }
                    >
                      <option value="same">Same as notes</option>
                      <option value="sv">Swedish</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="calendar-overlay-detail-level">Detail level</label>
                    <select
                      id="calendar-overlay-detail-level"
                      value={String(activeSession.detailLevel)}
                      onChange={(event) =>
                        handleCaptureSessionChange({
                          ...activeSession,
                          detailLevel: Number(event.target.value),
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5].map((level) => (
                        <option key={level} value={String(level)}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field calendar-session-details-toggle">
                    <span>Privacy</span>
                    <label className="compact-private-toggle">
                      <input
                        type="checkbox"
                        checked={activeSession.isPrivate}
                        onChange={(event) =>
                          handleCaptureSessionChange({
                            ...activeSession,
                            isPrivate: event.target.checked,
                          })
                        }
                      />
                      <span>Private</span>
                    </label>
                  </div>
                  <div className="field field-wide">
                    <label htmlFor="calendar-overlay-instructions">Additional LLM instructions</label>
                    <textarea
                      id="calendar-overlay-instructions"
                      rows={4}
                      value={activeSession.additionalInstructions}
                      onChange={(event) =>
                        handleCaptureSessionChange({
                          ...activeSession,
                          additionalInstructions: event.target.value,
                        })
                      }
                      placeholder="Example: Focus more on risks and decisions."
                    />
                  </div>
                  {detailCustomFields.map((field) => (
                    <div
                      key={field.id}
                      className={field.type === "textarea" ? "field field-wide" : "field"}
                    >
                      <label htmlFor={`calendar-overlay-custom-${field.id}`}>{field.label}</label>
                      {field.type === "textarea" ? (
                        <textarea
                          id={`calendar-overlay-custom-${field.id}`}
                          rows={4}
                          value={activeSession.customFieldValues[field.id] ?? ""}
                          onChange={(event) =>
                            handleCaptureSessionChange({
                              ...activeSession,
                              customFieldValues: {
                                ...activeSession.customFieldValues,
                                [field.id]: event.target.value,
                              },
                            })
                          }
                        />
                      ) : (
                        <input
                          id={`calendar-overlay-custom-${field.id}`}
                          type={field.type === "number" ? "number" : field.type}
                          value={activeSession.customFieldValues[field.id] ?? ""}
                          onChange={(event) =>
                            handleCaptureSessionChange({
                              ...activeSession,
                              customFieldValues: {
                                ...activeSession.customFieldValues,
                                [field.id]: event.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderOverlayContent = () => {
    switch (openPanel) {
      case "capture-details":
        return (
          <SessionEditor
            session={activeSession}
            templates={snapshot.templates}
            attachments={activeAttachments}
            presentation="full"
            showPresentationActions={false}
            savedPeople={snapshot.settings.savedParticipants}
            suggestedPeople={suggestedPeople}
            savedProjects={snapshot.settings.savedProjects}
            suggestedProjects={suggestedProjects}
            savedDomains={snapshot.settings.savedDomains}
            suggestedDomains={suggestedDomains}
            savedActivities={snapshot.settings.savedActivities}
            suggestedActivities={suggestedActivities}
            structureOptions={structureOptions}
            savedTags={snapshot.settings.savedTags}
            suggestedTags={suggestedTags}
            isTranscribingAudio={isTranscribingAudio}
            recordingMode={recordingMode}
            isRecordingAudio={isRecordingAudio}
            recordingStatusNote={recordingStatusNote}
            generationLog={generationLog}
            onClearGenerationLog={() => setGenerationLog([])}
            onChange={handleCaptureSessionChange}
            onImportImage={() => void handleImportImage()}
            onCreateInlineImageAttachment={(file) => handleCreateInlineImageAttachment(file)}
            onImportAudio={() => void handleImportAudio()}
            onTranscribeAudio={() => void handleTranscribeAudio()}
            onChangeRecordingMode={setRecordingMode}
            onStartRecording={(mode) => void handleStartRecording(mode)}
            onStopRecording={() => void handleStopRecording()}
            onImportTranscript={() => void handleImportTranscript()}
            onRemoveAttachment={(attachmentId) => void handleRemoveAttachment(attachmentId)}
            onUpdateAttachment={(attachment) => void handleUpdateAttachment(attachment)}
          />
        );
      case "output-details":
        return (
          <OutputWorkspace
            session={activeSession}
            template={activeTemplate}
            displayedOutput={displayedOutput}
            layoutPresetId={snapshot.settings.outputLayoutPresetId}
            outputVersions={activeOutputVersions}
            selectedOutputVersionId={selectedOutputVersionId}
            attachments={activeAttachments}
            presentation="full"
            showPresentationActions={false}
            onChange={(session) => void handleOutputWorkspaceChange(session)}
            savedPeople={snapshot.settings.savedParticipants}
            suggestedPeople={suggestedPeople}
            savedProjects={snapshot.settings.savedProjects}
            suggestedProjects={suggestedProjects}
            savedDomains={snapshot.settings.savedDomains}
            suggestedDomains={suggestedDomains}
            savedActivities={snapshot.settings.savedActivities}
            suggestedActivities={suggestedActivities}
            structureOptions={structureOptions}
            savedTags={snapshot.settings.savedTags}
            suggestedTags={suggestedTags}
            isPrimaryActionRunning={outputActionConfig.isPrimaryRunning}
            isSecondaryActionRunning={outputActionConfig.isSecondaryRunning}
            isRevising={isRevising}
            onPrimaryAction={outputActionConfig.onPrimary}
            onSecondaryAction={outputActionConfig.onSecondary}
            onCopyOutput={() => void handleCopyOutput()}
            onTranslate={() => void handleTranslate()}
            onRevise={(instructions) => void handleRevise(instructions)}
            onRevertOutputVersion={handleRevertOutputVersion}
            onOpenOutputVersion={handleOpenOutputVersion}
            onOpenLatestOutputVersion={handleOpenLatestOutputVersion}
            onExportText={() => exportOutputAsText({ title: activeSession.title, output: displayedOutput })}
            onExportMarkdown={() => exportOutputAsMarkdown({ title: activeSession.title, output: displayedOutput })}
            onExportHtml={() => exportOutputAsHtml({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
            onExportDocx={() => void exportOutputAsDocx({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
            onExportPdf={() => void exportOutputAsPdf({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
            ruleSuggestions={visibleRuleSuggestions.filter((entry) => !dismissedRuleSuggestionIds.includes(entry.id))}
            onAcceptRuleSuggestion={(suggestionId) => void handleAcceptVisibleRuleSuggestion(suggestionId)}
            onDismissRuleSuggestion={handleDismissVisibleRuleSuggestion}
            onIgnoreRuleSuggestion={(suggestionId) => void handleIgnoreVisibleRuleSuggestion(suggestionId)}
            primaryActionLabel={outputActionConfig.primaryLabel}
            secondaryActionLabel={outputActionConfig.secondaryLabel}
            emptyStatePrimaryLabel={outputActionConfig.emptyStatePrimaryLabel}
            emptyStateSecondaryLabel={outputActionConfig.emptyStateSecondaryLabel}
            linkedActivity={activeLinkedActivity}
            onOpenLinkedActivity={(activityId) => openActivityFromLink(activityId, "notes")}
            onAddFollowUpTodo={(description, options) =>
              void addTodo(description, {
                ...getMeetingTodoDefaults(),
                ...options,
              })
            }
            onAddFollowUpMeeting={(description, options) => void addActivity(description, "meeting", options)}
          />
        );
      case "calendar-output-preview": {
        const previewOutput = calendarPreviewSession
          ? ensureMeetingOutputHeader(calendarPreviewSession, calendarPreviewSession.output)
          : "";
        const previewLines = previewOutput ? splitStructuredOutput(previewOutput) : [];
        return (
          <div className="sidebar-card overlay-card calendar-output-preview-card">
            <div className="overlay-header calendar-output-preview-header">
              <div>
                <h3>{calendarPreviewSession?.title || "Session output"}</h3>
                <p className="tiny-text">
                  {calendarPreviewSession
                    ? `${calendarPreviewSession.date} • ${calendarPreviewSession.startTime} to ${calendarPreviewSession.endTime}`
                    : "Linked session preview"}
                </p>
              </div>
            </div>
            {calendarPreviewSession && previewOutput.trim() ? (
              <div className="calendar-output-preview-body">
                {previewLines.map((line, index) =>
                  isStructuredHeading(line) ? (
                    <h4 key={`${line}-${index}`}>{line.replace(/:$/, "")}</h4>
                  ) : (
                    <p key={`${line}-${index}`}>{line}</p>
                  ),
                )}
              </div>
            ) : (
              <div className="card">
                <h4>No output yet</h4>
                <p className="muted">Generate output in the linked session first, then return here to preview it.</p>
              </div>
            )}
          </div>
        );
      }
      case "sessions":
        return (
          <SessionsSidebar
            sessions={snapshot.sessions}
            activeSessionId={activeSession.id}
            onSelect={(id) => {
              setActiveSessionId(id);
              closeOverlay();
            }}
            onCreate={() => openOverlay("new-note")}
            onDelete={(id) => void deleteSession(id)}
            onRestore={(id) => void restoreSession(id)}
            onDeleteForever={(id) => void permanentlyDeleteSession(id)}
          />
        );
      case "new-note":
        return (
          <div className="sidebar-card overlay-card">
            <div>
              <h3>New session</h3>
              <p>Choose the type of session you want to start.</p>
            </div>
            <div className="session-quick-start-row">
              <div className="session-template-pill-row">
                {quickStartTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="segment-button session-template-pill"
                    onClick={() => void handleCreateSessionFromTemplate(template.id)}
                  >
                    {`New ${template.name}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case "instructions":
        return (
          <div className="sidebar-card overlay-card">
            <div>
              <h3>Notes instructions</h3>
              <p>Desktop Notes now follows the same calmer session workflow as the PWA, while keeping the stronger native desktop capture options.</p>
            </div>
            <div className="section-list">
              <div className="list-item">
                <strong>Starting sessions</strong>
                <span className="muted">Start directly with the session type you want. Use New Meeting, New Quick note, or New 1:1 / Phone call to jump straight into capture.</span>
              </div>
              <div className="list-item">
                <strong>Capture</strong>
                <span className="muted">Keep Details, People, transcript, and context folded away until needed. Manual notes stay central so the main writing surface is always easy to reach.</span>
              </div>
              <div className="list-item">
                <strong>Recording</strong>
                <span className="muted">Use room or hybrid capture when the space hears everything through microphones and speakers. Use direct computer audio when you need native in-computer sound from this device.</span>
              </div>
              <div className="list-item">
                <strong>Output</strong>
                <span className="muted">Generate, translate, export, and revise from the action row first. The Output document stays below, with follow-up work and details folded into calmer sections.</span>
              </div>
              <div className="list-item">
                <strong>Technical design</strong>
                <span className="muted">The desktop app runs in Tauri with React, TypeScript, local SQLite-backed storage, OpenAI text generation, and desktop-native recording, file, and export flows.</span>
              </div>
            </div>
          </div>
        );
      case "metadata-review":
        const hasPeopleSuggestions = metadataSuggestions.people.length > 0;
        const hasNonPeopleSuggestions =
          metadataSuggestions.domains.length > 0 ||
          metadataSuggestions.projects.length > 0 ||
          metadataSuggestions.activities.length > 0;
        const activeRuleSuggestions = visibleRuleSuggestions.filter((entry) => !dismissedRuleSuggestionIds.includes(entry.id));
        const hasRuleSuggestions = activeRuleSuggestions.length > 0;
        const reviewTitle = hasRuleSuggestions && !hasPeopleSuggestions && !hasNonPeopleSuggestions
          ? "Suggested rules"
          : hasPeopleSuggestions
          ? hasNonPeopleSuggestions
            ? "Update saved participants and reusable values?"
            : "Update saved participants?"
          : "Save new reusable values?";
        const reviewDescription = hasRuleSuggestions && !hasPeopleSuggestions && !hasNonPeopleSuggestions
          ? "We noticed repeated shorthand or preferred-name patterns in recent sessions. Add the ones you want the app to remember."
          : hasPeopleSuggestions
          ? hasNonPeopleSuggestions
            ? "These participant names and other values were used in this note but are not yet saved in the app's reusable lists. Save the ones you want available for future quick selection."
            : "These names appear in the meeting Participants field but are not yet saved in the app's saved Participants list. Save the ones you want available for future quick selection."
          : "These values were used in this note but are not yet saved in the app's reusable lists. Save the ones you want available for future search and quick selection.";
        return (
          <div className="sidebar-card overlay-card">
            <div>
              <h3>{reviewTitle}</h3>
              <p>{reviewDescription}</p>
            </div>
            {([
              { key: "people", label: "People", helper: "Save these names to reuse in future notes and participant pickers." },
              { key: "domains", label: "Domains", helper: "Save these top-level business areas for future notes." },
              { key: "projects", label: "Projects", helper: "Save these projects to reuse in future notes." },
              { key: "activities", label: "Activities", helper: "Save these activities to reuse in future notes." },
            ] as const).map((section) =>
              metadataSuggestions[section.key].length ? (
                <div key={section.key} className="section-divider">
                  <strong>{section.label}</strong>
                  <div className="section-list">
                    {metadataSuggestions[section.key].map((value) => (
                      <label key={`${section.key}-${value}`} className="list-item checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedMetadataSuggestions[section.key].includes(value)}
                          onChange={(event) =>
                            setSelectedMetadataSuggestions((current) => ({
                              ...current,
                              [section.key]: event.target.checked
                                ? Array.from(new Set([...current[section.key], value]))
                                : current[section.key].filter((entry) => entry !== value),
                            }))
                          }
                        />
                        <span>
                          <strong>{value}</strong>
                          <span className="muted">{section.helper}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
            {activeRuleSuggestions.length ? (
              <div className="section-divider">
                <strong>Suggested rules</strong>
                <div className="section-list">
                  {activeRuleSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="list-item">
                      <span>
                        <strong>{suggestion.type === "abbreviation" ? "Suggested abbreviation" : "Preferred participant name"}</strong>
                        <span className="muted">{`${suggestion.sourceValue} -> ${suggestion.suggestedValue} · Seen ${suggestion.evidenceCount} times`}</span>
                      </span>
                      <div className="list-item-actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => {
                            const nextSettings = acceptRuleSuggestion(snapshot.settings, suggestion.id);
                            void saveSettings(nextSettings);
                            setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestion.id));
                          }}
                        >
                          Add
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          onClick={() =>
                            setDismissedRuleSuggestionIds((current) => Array.from(new Set([...current, suggestion.id])))
                          }
                        >
                          Not now
                        </button>
                        <button
                          className="small-button danger-button"
                          type="button"
                          onClick={() => {
                            const nextSettings = ignoreRuleSuggestion(snapshot.settings, suggestion.id, { forever: true });
                            void saveSettings(nextSettings);
                            setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestion.id));
                          }}
                        >
                          Never suggest
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="sidebar-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  const nextSettings = { ...snapshot.settings };
                  if (selectedMetadataSuggestions.people.length) {
                    nextSettings.savedParticipants = Array.from(
                      new Set([...nextSettings.savedParticipants, ...selectedMetadataSuggestions.people]),
                    ).sort();
                  }
                  if (selectedMetadataSuggestions.domains.length) {
                    nextSettings.savedDomains = Array.from(
                      new Set([...nextSettings.savedDomains, ...selectedMetadataSuggestions.domains]),
                    ).sort();
                  }
                  if (selectedMetadataSuggestions.projects.length) {
                    nextSettings.savedProjects = Array.from(
                      new Set([...nextSettings.savedProjects, ...selectedMetadataSuggestions.projects]),
                    ).sort();
                  }
                  if (selectedMetadataSuggestions.activities.length) {
                    nextSettings.savedActivities = Array.from(
                      new Set([...nextSettings.savedActivities, ...selectedMetadataSuggestions.activities]),
                    ).sort();
                  }

                  const totalAdded = Object.values(selectedMetadataSuggestions).reduce(
                    (sum, values) => sum + values.length,
                    0,
                  );

                  if (totalAdded) {
                    void saveSettings({
                      ...nextSettings,
                    });
                    setStatusNote(
                      totalAdded === 1
                        ? "Added 1 reusable value."
                        : `Added ${totalAdded} reusable values.`,
                    );
                  }
                  setMetadataSuggestions(EMPTY_METADATA_REVIEW);
                  setSelectedMetadataSuggestions(EMPTY_METADATA_REVIEW);
                  closeOverlay();
                }}
              >
                Save selected
              </button>
              <button
                className="small-button"
                type="button"
                onClick={() => setSelectedMetadataSuggestions(metadataSuggestions)}
              >
                Select all
              </button>
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  setMetadataSuggestions(EMPTY_METADATA_REVIEW);
                  setSelectedMetadataSuggestions(EMPTY_METADATA_REVIEW);
                  closeOverlay();
                }}
              >
                Not now
              </button>
            </div>
          </div>
        );
      case "settings":
        return (
          <SettingsCard
            initialSection={settingsSection}
            settings={snapshot.settings}
            templates={snapshot.templates}
            onChange={(settings) => void saveSettings(settings)}
            onSaveTemplate={(template) => void saveTemplate(template)}
            onResetTemplates={handleResetTemplates}
            onImportLegacy={handleImportLegacy}
            onImportBackup={handleImportBackup}
            onCheckForUpdates={handleCheckForUpdates}
            onInstallUpdate={handleInstallUpdate}
            onOpenManualUpdate={handleOpenManualUpdate}
            onOpenDataFolder={handleOpenDataFolder}
            onOpenDatabaseFolder={handleOpenDatabaseFolder}
            onExportBackup={handleExportSnapshot}
            onSaveBackupAs={handleSaveSnapshotAs}
            updateStatusNote={updateStatusNote}
            desktopVersion={desktopVersion}
            desktopBundleType={desktopBundleType}
            availableUpdateVersion={availableUpdateVersion}
            manualUpdateUrl={manualUpdateUrl}
            isCheckingForUpdates={isCheckingForUpdates}
            isInstallingUpdate={isInstallingUpdate}
            storageInfo={storageInfo}
            latestLocalBackupInfo={latestLocalBackupInfo}
            aiDiagnostics={aiDiagnostics}
            aiRequestHistory={aiRequestHistory}
            textModelOptions={modelPricingSnapshot.textModels.map(buildTextModelOption)}
            transcriptionModelOptions={modelPricingSnapshot.transcriptionModels.map(buildTranscriptionModelOption)}
            modelPricingStatus={modelPricingStatus}
            onRefreshModelPricing={() => void handleRefreshModelPricing()}
            isRefreshingModelPricing={isRefreshingModelPricing}
          />
        );
      case "more":
        return (
          <div className="sidebar-card overlay-card">
            <div>
              <h3>More tools</h3>
              <p>Secondary utilities stay grouped here so the main workspace remains calm and obvious.</p>
            </div>
            <div className="stack">
              <button className="small-button" type="button" onClick={() => setActiveWorkspace("todos")}>
                Open Tasks workspace
              </button>
              <button className="small-button" type="button" onClick={() => setOpenPanel("backup")}>
                Open Back-up
              </button>
              <button className="small-button" type="button" onClick={() => openSettingsSection("other")}>
                Open Other settings
              </button>
            </div>
          </div>
        );
      case "backup":
        return (
          <div className="sidebar-card overlay-card">
            <div>
              <h3>Back-up</h3>
              <p>Keep backup and migration actions accessible without leaving the focused Notes workspace.</p>
            </div>
            <div className="sidebar-actions">
              <button className="small-button" type="button" onClick={() => void handleImportLegacy()}>
                Import current browser data
              </button>
              <button className="small-button" type="button" onClick={() => void handleImportBackup("replace")}>
                Replace from back-up
              </button>
              <button className="small-button" type="button" onClick={() => void handleImportBackup("merge")}>
                Merge from back-up
              </button>
              <button className="small-button" type="button" onClick={() => void handleExportSnapshot()}>
                Export backup to Downloads
              </button>
              <button className="small-button" type="button" onClick={() => void handleSaveSnapshotAs()}>
                Save backup as...
              </button>
              <button className="small-button" type="button" onClick={() => void handleOpenDataFolder()}>
                Open data folder
              </button>
            </div>
            {storageInfo ? (
              <div className="section-list">
                <div className="list-item">
                  <strong>Desktop version</strong>
                  <span className="muted">{desktopVersion || "Unknown"}</span>
                </div>
                <div className="list-item">
                  <strong>Database path</strong>
                  <span className="muted">{storageInfo.databasePath}</span>
                </div>
                <div className="list-item">
                  <strong>Backups folder</strong>
                  <span className="muted">{storageInfo.backupsDir}</span>
                </div>
                <div className="list-item">
                  <strong>Latest local safety backup</strong>
                  <span className="muted">
                    {latestLocalBackupInfo
                      ? `${new Date(latestLocalBackupInfo.modifiedMs).toLocaleString()}`
                      : "No local safety backup yet"}
                  </span>
                </div>
              </div>
            ) : null}
            <p className="tiny-text">
              NoteSmith creates a local safety backup automatically, including before updates. Export to Downloads or use Save backup as... when you want a copy outside the app data folder.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <RichTextCommandProvider
      customCommands={snapshot.settings.richTextCommands}
      spellCheckMode={snapshot.settings.richTextSpellCheck}
    >
    <div
      className="app-shell desktop-shell"
      data-theme={snapshot.settings.theme}
      data-workspace-rail-collapsed={isWorkspaceRailCollapsed}
      onKeyDownCapture={(event) => void handleGlobalTodoShortcut(event)}
    >
      <aside className="workspace-rail" data-collapsed={isWorkspaceRailCollapsed}>
        <div className="workspace-rail-brand">
          <div className="workspace-rail-brand-copy">
            <strong>NoteSmith</strong>
            <span className="tiny-text">Desktop</span>
          </div>
          <button
            className="workspace-rail-toggle"
            type="button"
            aria-label={isWorkspaceRailCollapsed ? "Expand workspace navigation" : "Collapse workspace navigation"}
            aria-expanded={!isWorkspaceRailCollapsed}
            title={isWorkspaceRailCollapsed ? "Expand workspace navigation" : "Collapse workspace navigation"}
            onClick={() => setIsWorkspaceRailCollapsed((current) => !current)}
          >
            {isWorkspaceRailCollapsed ? ">" : "<"}
          </button>
        </div>
        <nav className="workspace-nav">
          {PRIMARY_WORKSPACE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="workspace-nav-button"
              data-active={activeWorkspace === item.id}
              data-available={item.available}
              onClick={() => handleWorkspaceSelection(item.id, item.available)}
            >
              <span>{item.label}</span>
              <small>{item.available ? item.description : "Coming later"}</small>
            </button>
          ))}
          {DAILY_WORKSPACE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="workspace-nav-button"
              data-active={activeWorkspace === item.id}
              data-available={item.available}
              onClick={() => handleWorkspaceSelection(item.id, item.available)}
            >
              <span>{item.label}</span>
              <small>{item.available ? item.description : "Coming later"}</small>
            </button>
          ))}
          <TodosRailCard active={activeWorkspace === "todos"} onOpen={() => setActiveWorkspace("todos")} />
          {SECONDARY_WORKSPACE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="workspace-nav-button"
              data-active={activeWorkspace === item.id}
              data-available={item.available}
              onClick={() => handleWorkspaceSelection(item.id, item.available)}
            >
              <span>{item.label}</span>
              <small>{item.available ? item.description : "Coming later"}</small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace-shell">
        <header className={`topbar app-header${activeWorkspace === "notes" ? " app-header-notes-pwa" : ""}${activeWorkspace === "notebook" ? " app-header-compact" : ""}${activeWorkspace === "calendar" ? " app-header-compact app-header-calendar-home" : ""}${activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen ? " app-header-compact" : ""}`}>
          <div className="topbar-copy">
            {activeWorkspace === "notes" ? (
              <div className="topbar-status-strip topbar-status-strip-notes" />
            ) : (
              <>
                <div className="topbar-eyebrow">Focused workspace</div>
                <h1>{`${WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.label || "Workspace"}`}</h1>
                <div className="topbar-status-strip">
                  <span className={`status-chip status-chip-${saveState}`}>{saveStatusLabel}</span>
                  <span className="status-chip">{desktopVersion ? `v${desktopVersion}` : "Desktop"}</span>
                  <span className="status-chip">{baselineWorkStatusLabel}</span>
                  {activeWorkspace !== "calendar" ? <span className="status-chip">{aiActivityLabel}</span> : null}
                  {activeWorkspace !== "calendar" ? (
                    <>
                      <span className="status-chip">{selectedTextModelOption?.label || snapshot.settings.textModel}</span>
                      <span className="status-chip">{selectedTranscriptionModelOption?.label || snapshot.settings.transcriptionModel}</span>
                    </>
                  ) : null}
                  {isCheckingForUpdates ? <span className="status-chip">Checking updates...</span> : null}
                </div>
                <span className="tiny-text topbar-status-note">{statusNote}</span>
              </>
            )}
          </div>
          <div className="topbar-actions topbar-actions-split">
            <div className="topbar-secondary-cluster">
              {activeWorkspace === "notes" && linkedDetailReturnWorkspace === "calendar" ? (
                <button className="primary-button" type="button" onClick={returnFromLinkedDetail}>
                  Back to Calendar
                </button>
              ) : null}
              {activeWorkspace === "notes" ? (
                <>
                  <button
                    className="shell-button"
                    type="button"
                    aria-pressed={isNotesSessionsOpen}
                    onClick={() => setIsNotesSessionsOpen((current) => !current)}
                  >
                    Sessions
                  </button>
                  <button className="shell-button" type="button" onClick={() => openOverlay("backup")}>
                    Back-up
                  </button>
                  <button className="shell-button" type="button" onClick={() => openOverlay("instructions")}>
                    Instructions
                  </button>
                  <button className="shell-button" type="button" onClick={() => openSettingsSection("ai")}>
                    Settings
                  </button>
                  <span className={`status-chip status-chip-${saveState}`}>{saveStatusLabel}</span>
                </>
              ) : null}
              {activeWorkspace !== "notes" ? (
                <>
                  <button className="shell-button" type="button" onClick={openCommandPalette}>
                    Command palette
                  </button>
                  <button className="shell-button" type="button" onClick={() => void (availableUpdateVersion ? handleInstallUpdate() : handleCheckForUpdates())}>
                    {availableUpdateVersion ? `Install ${availableUpdateVersion}` : "Check updates"}
                  </button>
                  <button
                    className={isBaselineWorkEnabled ? "primary-button" : "shell-button"}
                    type="button"
                    onClick={() => void (isBaselineWorkEnabled ? stopWorkBaseline() : startWorkBaseline())}
                  >
                    {isBaselineWorkEnabled ? "Stop work" : "Start work"}
                  </button>
                  <button className="shell-button" type="button" onClick={() => openSettingsSection("ai")}>
                    Settings
                  </button>
                  <button className="shell-button" type="button" onClick={() => openOverlay("sessions")}>
                    All Sessions
                  </button>
                  <button className="shell-button" type="button" onClick={() => openOverlay("more")}>
                    More
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {availableUpdateVersion ? (
          <div className="workspace-alert-bar">
            <span>Desktop update {availableUpdateVersion} is available from GitHub Releases.</span>
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleInstallUpdate()}
              disabled={isInstallingUpdate}
            >
              {isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}`}
            </button>
            {manualUpdateUrl ? (
              <button className="small-button" type="button" onClick={() => void handleOpenManualUpdate()} disabled={isInstallingUpdate}>
                Download installer
              </button>
            ) : null}
          </div>
        ) : manualUpdateUrl ? (
          <div className="workspace-alert-bar">
            <span>{updateStatusNote || "A newer desktop version is available on GitHub Releases."}</span>
            <button className="primary-button" type="button" onClick={() => void handleOpenManualUpdate()}>
              Download latest installer
            </button>
          </div>
        ) : null}

        <main
          className={`notes-shell${activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen ? " notes-shell-calendar-fullscreen" : ""}${
            activeWorkspace === "notes" && isNotesSessionsOpen ? " notes-shell-with-sessions" : ""
          }${activeWorkspace === "notes" ? " notes-shell-notes-mode" : ""}${
            activeWorkspace === "notebook" ? " notes-shell-notebook" : ""
          }${
            SINGLE_PANE_WORKSPACES.includes(activeWorkspace) ? " notes-shell-single-pane" : ""
          }`}
        >
          <section
            className={`workspace-canvas${activeWorkspace === "calendar" ? " workspace-canvas-calendar" : ""}${activeWorkspace === "notebook" ? " workspace-canvas-notebook" : ""}`}
          >
            {activeWorkspace !== "notes" && !(activeWorkspace === "notebook" || activeWorkspace === "calendar" || activeWorkspace === "now") ? (
            <div className="workspace-header card">
              <div className="card-header">
                <div>
                  <div className="topbar-eyebrow">Workspace</div>
                  <h2>{WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.label || "Workspace"}</h2>
                </div>
              </div>
            </div>
            ) : null}

            {activeWorkspace === "notebook" ? (
              <NotebookWorkspace
                sessions={activeSessions}
                todos={snapshot.todos}
                runningTodoIds={getRunningTodoIds(snapshot.timelogs)}
                activeSession={activeSession}
                structureOptions={structureOptions}
                isTimeTracking={isActiveSessionTimeTracking}
                isRecordingAudio={isRecordingAudio}
                isTranscribingAudio={isTranscribingAudio}
                isGenerating={isGenerating}
                recordingStatusNote={recordingStatusNote}
                onSelect={(sessionId) => {
                  setSelectedOutputVersionId(null);
                  setActiveSessionId(sessionId);
                }}
                onCreate={() => void handleCreateNotebookPage()}
                onDelete={(sessionId) => void deleteSession(sessionId)}
                onAddTodo={(description) => void addTodo(description)}
                onSaveTodo={(todo) => void saveTodo(todo)}
                onDeleteTodo={(todoId) => void deleteTodo(todoId)}
                onAddNoteForTodo={(todoId) => {
                  void ensureSessionForTodo(todoId).then((sessionId) => {
                    if (!sessionId) return;
                    setSelectedOutputVersionId(null);
                    setActiveSessionId(sessionId);
                  });
                }}
                onToggleTodoTime={(todoId, isRunning) => void (
                  isRunning ? stopTimeTracking("todo", todoId) : startTimeTracking("todo", todoId)
                )}
                onChange={handleCaptureSessionChange}
                onToggleRecording={() =>
                  void (isRecordingAudio ? handleStopRecording() : handleStartRecording("microphone"))
                }
                onUploadAudio={() => void handleImportAudio()}
                onTranscribeAudio={() => void handleTranscribeAudio()}
                onGenerateOutput={() => void handleGenerate()}
                onOpenInNotes={(view) =>
                  openNotesTarget({
                    sessionId: activeSession.id,
                    view,
                    returnWorkspace: "notebook",
                    status: "Opened the Notebook page in the full Notes workspace.",
                  })
                }
                onToggleTimeTracking={() => void toggleActiveSessionTimeTracking()}
                outputContent={(
                  <OutputWorkspace
                    session={activeSession}
                    template={activeTemplate}
                    displayedOutput={displayedOutput}
                    layoutPresetId={snapshot.settings.outputLayoutPresetId}
                    outputVersions={activeOutputVersions}
                    selectedOutputVersionId={selectedOutputVersionId}
                    attachments={activeAttachments}
                    presentation="minimal"
                    showPresentationActions={false}
                    showPanelHeading={false}
                    showDetailsSection={false}
                    onChange={(session) => void handleOutputWorkspaceChange(session)}
                    savedPeople={snapshot.settings.savedParticipants}
                    suggestedPeople={suggestedPeople}
                    savedProjects={snapshot.settings.savedProjects}
                    suggestedProjects={suggestedProjects}
                    savedDomains={snapshot.settings.savedDomains}
                    suggestedDomains={suggestedDomains}
                    savedActivities={snapshot.settings.savedActivities}
                    suggestedActivities={suggestedActivities}
                    structureOptions={structureOptions}
                    savedTags={snapshot.settings.savedTags}
                    suggestedTags={suggestedTags}
                    isPrimaryActionRunning={outputActionConfig.isPrimaryRunning}
                    isSecondaryActionRunning={outputActionConfig.isSecondaryRunning}
                    isRevising={isRevising}
                    onPrimaryAction={outputActionConfig.onPrimary}
                    onSecondaryAction={outputActionConfig.onSecondary}
                    onCopyOutput={() => void handleCopyOutput()}
                    onTranslate={() => void handleTranslate()}
                    onRevise={(instructions) => void handleRevise(instructions)}
                    onRevertOutputVersion={handleRevertOutputVersion}
                    onOpenOutputVersion={handleOpenOutputVersion}
                    onOpenLatestOutputVersion={handleOpenLatestOutputVersion}
                    onExportText={() => exportOutputAsText({ title: activeSession.title, output: displayedOutput })}
                    onExportMarkdown={() => exportOutputAsMarkdown({ title: activeSession.title, output: displayedOutput })}
                    onExportHtml={() => exportOutputAsHtml({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
                    onExportDocx={() => void exportOutputAsDocx({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
                    onExportPdf={() => void exportOutputAsPdf({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
                    ruleSuggestions={visibleRuleSuggestions.filter((entry) => !dismissedRuleSuggestionIds.includes(entry.id))}
                    onAcceptRuleSuggestion={(suggestionId) => void handleAcceptVisibleRuleSuggestion(suggestionId)}
                    onDismissRuleSuggestion={handleDismissVisibleRuleSuggestion}
                    onIgnoreRuleSuggestion={(suggestionId) => void handleIgnoreVisibleRuleSuggestion(suggestionId)}
                    primaryActionLabel={outputActionConfig.primaryLabel}
                    secondaryActionLabel={outputActionConfig.secondaryLabel}
                    emptyStatePrimaryLabel={outputActionConfig.emptyStatePrimaryLabel}
                    emptyStateSecondaryLabel={outputActionConfig.emptyStateSecondaryLabel}
                  />
                )}
              />
            ) : activeWorkspace === "todos" ? (
              <TodosWorkspace
                todos={snapshot.todos}
                checklists={snapshot.checklists}
                checklistTemplates={snapshot.checklistTemplates}
                checklistRecurrences={snapshot.checklistRecurrences}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                settings={snapshot.settings}
                structureOptions={structureOptions}
                savedPeople={snapshot.settings.savedParticipants}
                suggestedPeople={suggestedPeople}
                requestedTodoId={requestedTodoId}
                requestedDomain={requestedTodoDomain}
                requestedProject={requestedTodoProject}
                onEditorClose={returnFromLinkedDetail}
                onToggle={(todo) => void saveTodo(todo)}
                onAdd={(description, options) => void addTodo(description, options)}
                onSave={(todo) => void saveTodo(todo)}
                onDelete={(id) => void deleteTodo(id)}
                onCreateChecklist={(todoId, title) => void createChecklist("todo", todoId, title)}
                onCreateChecklistFromTemplate={(todoId, templateId) => void createChecklistFromTemplate("todo", todoId, templateId)}
                onCreateChecklistRecurrence={(todoId, templateId, cadence) => void createChecklistRecurrence("todo", todoId, templateId, cadence)}
                onDeleteChecklistRecurrence={(id) => void deleteChecklistRecurrence(id)}
                onSaveChecklist={(checklist) => void saveChecklist(checklist)}
                onDeleteChecklist={(id) => void deleteChecklist(id)}
                onCreateChecklistTemplate={(title, category, items) => void createChecklistTemplate(title, category, items)}
                onSaveChecklistTemplate={(template) => void saveChecklistTemplate(template)}
                onDeleteChecklistTemplate={(id) => void deleteChecklistTemplate(id)}
                onConvertToActivity={(todo) => void convertTodoToActivity(todo)}
                onSaveTimeLog={(timeLog) => void saveTimeLog(timeLog)}
                onDeleteTimeLog={(id) => void deleteTimeLog(id)}
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
                onSaveSettings={(settings) => void saveSettings(settings)}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "todos")}
              />
            ) : activeWorkspace === "now" ? (
              <NowWorkspace
                todos={snapshot.todos}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                calendarItems={snapshot.calendarItems ?? []}
                settings={snapshot.settings}
                onToggleTodo={(todo) => void saveTodo(todo)}
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "now")}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "now")}
                onOpenProject={(project) =>
                  openLinkedDestination({
                    workspace: "time",
                    timeProject: project,
                    returnWorkspace: "now",
                    status: `Opened ${project} in Time.`,
                  })
                }
                onSaveSettings={(nextSettings) => void saveSettings(nextSettings)}
              />
            ) : activeWorkspace === "calendar" ? (
              <CalendarWorkspace
                todos={snapshot.todos}
                checklists={snapshot.checklists}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                calendarItems={snapshot.calendarItems ?? []}
                settings={snapshot.settings}
                openRevision={calendarOpenRevision}
                structureOptions={structureOptions}
                savedPeople={snapshot.settings.savedParticipants}
                linkedSessionStateByActivity={linkedSessionStateByActivity}
                linkedSessionStateByTodo={linkedSessionStateByTodo}
                onSaveSettings={(settings) => void saveSettings(settings)}
                onCreateFromText={(date, startSlot, value, options) => createCalendarEntryFromText(date, startSlot, value, options)}
                onMoveItem={(id, date, startSlot) => void moveCalendarItem(id, date, startSlot)}
                onSaveTodo={(todo) => void saveTodo(todo)}
                onDeleteTodo={(id) => void deleteTodo(id)}
                onCreateChecklist={(todoId, title) => void createChecklist("todo", todoId, title)}
                onSaveChecklist={(checklist) => void saveChecklist(checklist)}
                onDeleteChecklist={(id) => void deleteChecklist(id)}
                onSaveActivity={(activity) => void saveActivity(activity)}
                onDeleteActivity={(id) => void deleteActivity(id)}
                onConvertTodoToMeeting={(todo, options) =>
                  void convertTodoToActivity(todo, {
                    type: "meeting",
                    date: options.date,
                    startTime: options.startTime,
                    endTime: options.endTime,
                  })
                }
                onUpdateCalendarItem={(id, updates) => void updateCalendarItem(id, updates)}
                onSaveTimeLog={(timeLog) => void saveTimeLog(timeLog)}
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
                onOpenTodoWorkspace={() => setActiveWorkspace("todos")}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "calendar")}
                onOpenActivityWorkspace={(activityId) => openActivityFromLink(activityId, "calendar")}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "calendar")}
                onOpenSession={(sessionId, openedCalendarItemId) => {
                  const calendarItemId = openedCalendarItemId ??
                    findCalendarItemIdForSession(sessionId);
                  openSessionFromCalendar(sessionId, calendarItemId);
                }}
                highlightedItemId={linkedCalendarReturnItemId}
                onCreateLinkedMeetingSession={(activityId) =>
                  void ensureSessionForActivity(activityId).then((sessionId) => {
                    if (sessionId) {
                      openCalendarSessionTarget({
                        sessionId,
                        calendarItemId: findCalendarItemIdForSource("activity", activityId),
                        tab: "capture",
                        status: "Created linked meeting session in Calendar.",
                      });
                    }
                  })
                }
                onCreateLinkedTaskSession={(todoId) =>
                  void ensureSessionForTodo(todoId).then((sessionId) => {
                    if (sessionId) {
                      openCalendarSessionTarget({
                        sessionId,
                        calendarItemId: findCalendarItemIdForSource("todo", todoId),
                        tab: "capture",
                        status: "Created linked task note in Calendar.",
                      });
                    }
                  })
                }
                onPreviewSessionOutput={openCalendarOutputPreview}
                onFullScreenChange={setIsCalendarWorkspaceFullScreen}
              />
            ) : activeWorkspace === "time" ? (
              <TimeWorkspace
                todos={snapshot.todos}
                archivedTasks={snapshot.archivedTasks}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                structureOptions={structureOptions}
                requestedDomain={requestedTimeDomain}
                requestedProject={requestedTimeProject}
                reportPresets={snapshot.settings.timeReportPresets}
                baselineWorkActivityId={baselineWorkActivityId}
                isBaselineWorkEnabled={isBaselineWorkEnabled}
                isBaselineWorkRunning={isBaselineWorkRunning}
                hasSpecificRunningTimeLog={hasSpecificRunningTimeLog}
                onSaveTimeLog={(timeLog) => void saveTimeLog(timeLog)}
                onDeleteTimeLog={(id) => void deleteTimeLog(id)}
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
                onStartWorkBaseline={() => void startWorkBaseline()}
                onStopWorkBaseline={() => void stopWorkBaseline()}
                onStartAdhocTimeLog={(options) => void startAdhocTimeLog(options)}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "time")}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "time")}
                onSaveTodo={(todo) => void saveTodo(todo)}
                onSaveActivity={(activity) => void saveActivity(activity)}
                onSaveReportPreset={(preset) =>
                  void saveSettings({
                    ...snapshot.settings,
                    timeReportPresets: [
                      ...snapshot.settings.timeReportPresets.filter((entry) => entry.label !== preset.label),
                      { ...preset, id: crypto.randomUUID() },
                    ].sort((left, right) => left.label.localeCompare(right.label)),
                  })
                }
                onDeleteReportPreset={(presetId) =>
                  void saveSettings({
                    ...snapshot.settings,
                    timeReportPresets: snapshot.settings.timeReportPresets.filter((entry) => entry.id !== presetId),
                  })
                }
              />
            ) : activeWorkspace === "analytics" ? (
              <AnalyticsWorkspace
                todos={snapshot.todos}
                archivedTasks={snapshot.archivedTasks}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                settings={snapshot.settings}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "analytics")}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "analytics")}
                onSaveTimeLog={(timeLog) => void saveTimeLog(timeLog)}
                onSaveTodo={(todo) => void saveTodo(todo)}
                onSaveActivity={(activity) => void saveActivity(activity)}
              />
            ) : activeWorkspace === "structure" ? (
              <StructureWorkspace
                activities={snapshot.activities}
                todos={snapshot.todos}
                checklists={snapshot.checklists}
                checklistTemplates={snapshot.checklistTemplates}
                checklistRecurrences={snapshot.checklistRecurrences}
                timeLogs={snapshot.timelogs}
                savedDomains={snapshot.settings.savedDomains}
                savedProjects={snapshot.settings.savedProjects}
                projectLinks={snapshot.settings.projectLinks}
                onAddDomain={(domain) =>
                  void saveSettings({
                    ...snapshot.settings,
                    savedDomains: Array.from(new Set([...snapshot.settings.savedDomains, domain.trim()].filter(Boolean))).sort(),
                  })
                }
                onRenameDomain={(previousValue, nextValue) => void renameDomainValue(previousValue, nextValue)}
                onAddProject={(project, domain) =>
                  void saveSettings({
                    ...snapshot.settings,
                    savedProjects: Array.from(new Set([...snapshot.settings.savedProjects, project.trim()].filter(Boolean))).sort(),
                    projectLinks: domain.trim()
                      ? [
                          ...snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                          { id: crypto.randomUUID(), project: project.trim(), domain: domain.trim() },
                        ]
                        : snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                    })
                  }
                onAddActivityToProject={(description, project, domain, type) =>
                  void addActivity(description, type, {
                      project,
                      domain,
                    })
                  }
                onCreateProjectChecklist={(project, title) => void createChecklist("project", project, title)}
                onCreateProjectChecklistFromTemplate={(project, templateId) => void createChecklistFromTemplate("project", project, templateId)}
                onCreateProjectChecklistRecurrence={(project, templateId, cadence) => void createChecklistRecurrence("project", project, templateId, cadence)}
                onDeleteChecklistRecurrence={(id) => void deleteChecklistRecurrence(id)}
                onSaveChecklist={(checklist) => void saveChecklist(checklist)}
                onDeleteChecklist={(id) => void deleteChecklist(id)}
                onCreateChecklistTemplate={(title, category, items) => void createChecklistTemplate(title, category, items)}
                onSaveChecklistTemplate={(template) => void saveChecklistTemplate(template)}
                onDeleteChecklistTemplate={(id) => void deleteChecklistTemplate(id)}
                onRenameProject={(previousValue, nextValue) => void renameProjectValue(previousValue, nextValue)}
                onAssignProjectDomain={(project, domain) =>
                  void saveSettings({
                    ...snapshot.settings,
                    projectLinks: domain.trim()
                      ? [
                          ...snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                          { id: crypto.randomUUID(), project: project.trim(), domain: domain.trim() },
                        ]
                      : snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                  })
                }
                onOpenTodosForDomain={(domain) =>
                  openLinkedDestination({
                    workspace: "todos",
                    todoDomain: domain || null,
                    returnWorkspace: "structure",
                    status: domain ? `Opened Tasks filtered to ${domain}.` : "Opened Tasks.",
                  })
                }
                onOpenTodosForProject={(project) =>
                  openLinkedDestination({
                    workspace: "todos",
                    todoProject: project || null,
                    returnWorkspace: "structure",
                    status: project ? `Opened Tasks filtered to ${project}.` : "Opened Tasks.",
                  })
                }
                onOpenTimeForDomain={(domain) =>
                  openLinkedDestination({
                    workspace: "time",
                    timeDomain: domain || null,
                    returnWorkspace: "structure",
                    status: domain ? `Opened Time filtered to ${domain}.` : "Opened Time.",
                  })
                }
                onOpenTimeForProject={(project) =>
                  openLinkedDestination({
                    workspace: "time",
                    timeProject: project || null,
                    returnWorkspace: "structure",
                    status: project ? `Opened Time filtered to ${project}.` : "Opened Time.",
                  })
                }
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "structure")}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "structure")}
              />
            ) : activeWorkspace === "assistant" ? (
              <AssistantWorkspace
                snapshot={snapshot}
                onOpenSettings={() => openSettingsSection("ai")}
                onSaveSettings={(settings) => saveSettings(settings)}
              />
            ) : activeWorkspace !== "notes" ? (
              <div className="card empty-state-card">
                <h2>Coming next</h2>
                <p>{WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.description || "This workspace is planned for a later phase."}</p>
                <ol className="empty-state-steps">
                  <li>Return to Notes from the left rail whenever you want to work now.</li>
                  <li>Use Ctrl/Cmd+K to reach settings, sessions, and future actions quickly.</li>
                  <li>This workspace will use the same center-canvas plus right-inspector pattern when it ships.</li>
                </ol>
              </div>
            ) : (
              <div className="notes-pwa-workbench">
                {linkedDetailReturnWorkspace ? (
                  <div className="notes-pwa-toolbar">
                    <button className="shell-button" type="button" onClick={returnFromLinkedDetail}>
                      Back to {linkedDetailReturnWorkspace === "notebook" ? "Notebook" : linkedDetailReturnWorkspace === "calendar" ? "Calendar" : linkedDetailReturnWorkspace === "time" ? "Time" : linkedDetailReturnWorkspace === "now" ? "Now" : linkedDetailReturnWorkspace === "structure" ? "Structure" : "previous workspace"}
                    </button>
                    {activeLinkedActivity ? (
                      <button className="shell-button" type="button" onClick={() => openActivityFromLink(activeLinkedActivity.id, "notes")}>
                        Linked activity: {activeLinkedActivity.description}
                      </button>
                    ) : null}
                  </div>
                ) : activeLinkedActivity ? (
                  <div className="notes-pwa-toolbar">
                    <button className="shell-button" type="button" onClick={() => openActivityFromLink(activeLinkedActivity.id, "notes")}>
                      Linked activity: {activeLinkedActivity.description}
                    </button>
                  </div>
                ) : null}
                <div className="calendar-session-overlay-tabs notes-workspace-tabs" role="tablist" aria-label="Notes workspace tabs">
                  {(["capture", "output", "details"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className="calendar-session-overlay-tab"
                      data-active={notesWorkspaceTab === tab}
                      aria-selected={notesWorkspaceTab === tab}
                      onClick={() => {
                        setNotesWorkspaceTab(tab);
                        if (tab === "capture" || tab === "output") {
                          setActiveView(tab);
                        }
                      }}
                    >
                      {tab === "capture" ? "Capture" : tab === "output" ? "Output" : "Details"}
                    </button>
                  ))}
                </div>
                <div ref={notesLayoutRef} className="notes-pwa-tab-panel">
                  {notesWorkspaceTab === "capture" ? (
                    <div className="notes-pwa-capture">
                      <SessionEditor
                        session={activeSession}
                        templates={snapshot.templates}
                        allowedTemplateCaptureModes={linkedDetailReturnWorkspace === "notebook" ? ["quick-note", "meeting-note"] : undefined}
                        attachments={activeAttachments}
                        presentation="minimal"
                        showPresentationActions={false}
                        savedPeople={snapshot.settings.savedParticipants}
                        suggestedPeople={suggestedPeople}
                        savedProjects={snapshot.settings.savedProjects}
                        suggestedProjects={suggestedProjects}
                        savedDomains={snapshot.settings.savedDomains}
                        suggestedDomains={suggestedDomains}
                        savedActivities={snapshot.settings.savedActivities}
                        suggestedActivities={suggestedActivities}
                        structureOptions={structureOptions}
                        savedTags={snapshot.settings.savedTags}
                        suggestedTags={suggestedTags}
                        isTranscribingAudio={isTranscribingAudio}
                        recordingMode={recordingMode}
                        isRecordingAudio={isRecordingAudio}
                        recordingStatusNote={recordingStatusNote}
                        generationLog={generationLog}
                        onClearGenerationLog={() => setGenerationLog([])}
                        onChange={handleCaptureSessionChange}
                        onImportImage={() => void handleImportImage()}
                        onCreateInlineImageAttachment={(file) => handleCreateInlineImageAttachment(file)}
                        onImportAudio={() => void handleImportAudio()}
                        onTranscribeAudio={() => void handleTranscribeAudio()}
                        onChangeRecordingMode={setRecordingMode}
                        onStartRecording={(mode) => void handleStartRecording(mode)}
                        onStopRecording={() => void handleStopRecording()}
                        onImportTranscript={() => void handleImportTranscript()}
                        onRemoveAttachment={(attachmentId) => void handleRemoveAttachment(attachmentId)}
                        onUpdateAttachment={(attachment) => void handleUpdateAttachment(attachment)}
                        onOpenDetails={() => setNotesWorkspaceTab("details")}
                        onCreateSessionFromTemplate={(templateId) => void handleCreateSessionFromTemplate(templateId)}
                        onOpenInstructions={() => openOverlay("instructions")}
                      />
                    </div>
                  ) : null}
                  {notesWorkspaceTab === "output" ? (
                    <div className="notes-pwa-output">
                      <OutputWorkspace
                        session={activeSession}
                        template={activeTemplate}
                        displayedOutput={displayedOutput}
                        layoutPresetId={snapshot.settings.outputLayoutPresetId}
                        outputVersions={activeOutputVersions}
                        selectedOutputVersionId={selectedOutputVersionId}
                        attachments={activeAttachments}
                        presentation="minimal"
                        showPresentationActions={false}
                        onChange={(session) => void handleOutputWorkspaceChange(session)}
                        savedPeople={snapshot.settings.savedParticipants}
                        suggestedPeople={suggestedPeople}
                        savedProjects={snapshot.settings.savedProjects}
                        suggestedProjects={suggestedProjects}
                        savedDomains={snapshot.settings.savedDomains}
                        suggestedDomains={suggestedDomains}
                        savedActivities={snapshot.settings.savedActivities}
                        suggestedActivities={suggestedActivities}
                        structureOptions={structureOptions}
                        savedTags={snapshot.settings.savedTags}
                        suggestedTags={suggestedTags}
                        isPrimaryActionRunning={outputActionConfig.isPrimaryRunning}
                        isSecondaryActionRunning={outputActionConfig.isSecondaryRunning}
                        isRevising={isRevising}
                        onPrimaryAction={outputActionConfig.onPrimary}
                        onSecondaryAction={outputActionConfig.onSecondary}
                        onCopyOutput={() => void handleCopyOutput()}
                        onTranslate={() => void handleTranslate()}
                        onRevise={(instructions) => void handleRevise(instructions)}
                        onRevertOutputVersion={handleRevertOutputVersion}
                        onOpenOutputVersion={handleOpenOutputVersion}
                        onOpenLatestOutputVersion={handleOpenLatestOutputVersion}
                        onExportText={() => exportOutputAsText({ title: activeSession.title, output: displayedOutput })}
                        onExportMarkdown={() => exportOutputAsMarkdown({ title: activeSession.title, output: displayedOutput })}
                        onExportHtml={() => exportOutputAsHtml({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
                        onExportDocx={() => void exportOutputAsDocx({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
                        onExportPdf={() => void exportOutputAsPdf({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId })}
                        ruleSuggestions={visibleRuleSuggestions.filter((entry) => !dismissedRuleSuggestionIds.includes(entry.id))}
                        onAcceptRuleSuggestion={(suggestionId) => void handleAcceptVisibleRuleSuggestion(suggestionId)}
                        onDismissRuleSuggestion={handleDismissVisibleRuleSuggestion}
                        onIgnoreRuleSuggestion={(suggestionId) => void handleIgnoreVisibleRuleSuggestion(suggestionId)}
                        primaryActionLabel={outputActionConfig.primaryLabel}
                        secondaryActionLabel={outputActionConfig.secondaryLabel}
                        emptyStatePrimaryLabel={outputActionConfig.emptyStatePrimaryLabel}
                        emptyStateSecondaryLabel={outputActionConfig.emptyStateSecondaryLabel}
                        linkedActivity={activeLinkedActivity}
                        onOpenLinkedActivity={(activityId) => openActivityFromLink(activityId, "notes")}
                        onAddFollowUpTodo={(description, options) =>
                          void addTodo(description, {
                            ...getMeetingTodoDefaults(),
                            ...options,
                          })
                        }
                        onAddFollowUpMeeting={(description, options) => void addActivity(description, "meeting", options)}
                      />
                    </div>
                  ) : null}
                  {notesWorkspaceTab === "details" ? (
                    <div className="card calendar-session-details-card notes-workspace-details-card">
                      <div className="calendar-session-details-grid">
                        <div className="field field-wide">
                          <label htmlFor="notes-workspace-session-title">Title</label>
                          <input
                            id="notes-workspace-session-title"
                            value={activeSession.title}
                            onChange={(event) => handleCaptureSessionChange({ ...activeSession, title: event.target.value })}
                            placeholder="Session title"
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="notes-workspace-template">Template</label>
                          <select
                            id="notes-workspace-template"
                            value={activeTemplate?.id ?? ""}
                            onChange={(event) => handleCalendarOverlayTemplateChange(event.target.value)}
                          >
                            {getTemplatesForCaptureMode(snapshot.templates, activeSession.captureMode).map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="notes-workspace-date">Date</label>
                          <DateInput
                            id="notes-workspace-date"
                            value={activeSession.date}
                            onChange={(event) => handleCaptureSessionChange({ ...activeSession, date: event.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="notes-workspace-start">Start</label>
                          <DeferredTimeInput
                            id="notes-workspace-start"
                            value={activeSession.startTime}
                            onCommit={(value) => handleCaptureSessionChange({ ...activeSession, startTime: value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="notes-workspace-end">End</label>
                          <DeferredTimeInput
                            id="notes-workspace-end"
                            value={activeSession.endTime}
                            onCommit={(value) => handleCaptureSessionChange({ ...activeSession, endTime: value })}
                          />
                        </div>
                        <div className="field field-wide">
                          <label htmlFor="notes-workspace-people">People</label>
                          <PeoplePicker
                            value={activeSession.participantText}
                            savedPeople={snapshot.settings.savedParticipants}
                            suggestedPeople={suggestedPeople}
                            onChange={(value) => handleCaptureSessionChange({ ...activeSession, participantText: value })}
                            placeholder="Search or add people"
                          />
                        </div>
                        <div className="field field-wide metadata-triplet">
                          <div className="metadata-triplet-grid">
                            <div className="field metadata-subfield">
                              <label htmlFor="notes-workspace-domain">Domain</label>
                              <TokenPicker
                                value={activeSession.domain}
                                savedOptions={structureOptions.domains.length ? structureOptions.domains : snapshot.settings.savedDomains}
                                suggestedOptions={suggestedDomains}
                                placeholder="Search or add domain"
                                suggestionSummary="Recent domains"
                                suggestionBadgeText="From saved Domains"
                                mode="single"
                                onChange={handleCalendarOverlayDomainChange}
                              />
                            </div>
                            <div className="field metadata-subfield">
                              <label htmlFor="notes-workspace-project">Project</label>
                              <TokenPicker
                                value={activeSession.project}
                                savedOptions={(() => {
                                  const options = getProjectsForDomain(structureOptions, activeSession.domain);
                                  return options.length ? options : snapshot.settings.savedProjects;
                                })()}
                                suggestedOptions={suggestedProjects.filter((project) =>
                                  new Set((() => {
                                    const options = getProjectsForDomain(structureOptions, activeSession.domain);
                                    return options.length ? options : snapshot.settings.savedProjects;
                                  })()).has(project),
                                )}
                                placeholder="Search or add project"
                                suggestionSummary="Recent projects"
                                suggestionBadgeText="From saved Projects"
                                mode="single"
                                onChange={handleCalendarOverlayProjectChange}
                              />
                            </div>
                            <div className="field metadata-subfield">
                              <label htmlFor="notes-workspace-activity">Activity</label>
                              <TokenPicker
                                value={activeSession.activity}
                                savedOptions={(() => {
                                  const options = getActivitiesForSelection(structureOptions, activeSession.domain, activeSession.project);
                                  return options.length ? options : snapshot.settings.savedActivities;
                                })()}
                                suggestedOptions={suggestedActivities.filter((activity) =>
                                  new Set((() => {
                                    const options = getActivitiesForSelection(structureOptions, activeSession.domain, activeSession.project);
                                    return options.length ? options : snapshot.settings.savedActivities;
                                  })()).has(activity),
                                )}
                                placeholder="Search or add activity"
                                suggestionSummary="Recent activities"
                                suggestionBadgeText="From saved Activities"
                                mode="single"
                                onChange={(value) => handleCaptureSessionChange({ ...activeSession, activity: value })}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="field field-wide">
                          <label htmlFor="notes-workspace-tags">Tags</label>
                          <TokenPicker
                            value={activeSession.tagsText}
                            savedOptions={snapshot.settings.savedTags}
                            suggestedOptions={suggestedTags}
                            placeholder="Add tags"
                            suggestionSummary="Recent tags"
                            suggestionBadgeText="From saved Tags"
                            onChange={(value) => handleCaptureSessionChange({ ...activeSession, tagsText: value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="notes-workspace-output-language">Output language</label>
                          <select
                            id="notes-workspace-output-language"
                            value={activeSession.outputLanguage}
                            onChange={(event) =>
                              handleCaptureSessionChange({
                                ...activeSession,
                                outputLanguage: event.target.value as SessionRecord["outputLanguage"],
                              })
                            }
                          >
                            <option value="same">Same as notes</option>
                            <option value="sv">Swedish</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="notes-workspace-detail-level">Detail level</label>
                          <select
                            id="notes-workspace-detail-level"
                            value={String(activeSession.detailLevel)}
                            onChange={(event) =>
                              handleCaptureSessionChange({
                                ...activeSession,
                                detailLevel: Number(event.target.value),
                              })
                            }
                          >
                            {[1, 2, 3, 4, 5].map((level) => (
                              <option key={level} value={String(level)}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field calendar-session-details-toggle">
                          <span>Privacy</span>
                          <label className="compact-private-toggle">
                            <input
                              type="checkbox"
                              checked={activeSession.isPrivate}
                              onChange={(event) =>
                                handleCaptureSessionChange({
                                  ...activeSession,
                                  isPrivate: event.target.checked,
                                })
                              }
                            />
                            <span>Private</span>
                          </label>
                        </div>
                        <div className="field field-wide">
                          <label htmlFor="notes-workspace-instructions">Additional LLM instructions</label>
                          <textarea
                            id="notes-workspace-instructions"
                            rows={4}
                            value={activeSession.additionalInstructions}
                            onChange={(event) =>
                              handleCaptureSessionChange({
                                ...activeSession,
                                additionalInstructions: event.target.value,
                              })
                            }
                            placeholder="Example: Focus more on risks and decisions."
                          />
                        </div>
                        {(activeTemplate?.fields.filter(
                          (field) =>
                            field.enabled &&
                            !STANDARD_TEMPLATE_FIELD_KEYS.includes(field.key as (typeof STANDARD_TEMPLATE_FIELD_KEYS)[number]),
                        ) ?? []).map((field) => (
                          <div key={field.id} className={field.type === "textarea" ? "field field-wide" : "field"}>
                            <label htmlFor={`notes-workspace-custom-${field.id}`}>{field.label}</label>
                            {field.type === "textarea" ? (
                              <textarea
                                id={`notes-workspace-custom-${field.id}`}
                                rows={4}
                                value={activeSession.customFieldValues[field.id] ?? ""}
                                onChange={(event) =>
                                  handleCaptureSessionChange({
                                    ...activeSession,
                                    customFieldValues: {
                                      ...activeSession.customFieldValues,
                                      [field.id]: event.target.value,
                                    },
                                  })
                                }
                              />
                            ) : (
                              <input
                                id={`notes-workspace-custom-${field.id}`}
                                type={field.type === "number" ? "number" : field.type}
                                value={activeSession.customFieldValues[field.id] ?? ""}
                                onChange={(event) =>
                                  handleCaptureSessionChange({
                                    ...activeSession,
                                    customFieldValues: {
                                      ...activeSession.customFieldValues,
                                      [field.id]: event.target.value,
                                    },
                                  })
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>

        {!(activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen) && !HIDE_SHARED_INSPECTOR_WORKSPACES.includes(activeWorkspace) ? (
          <aside className="workspace-inspector stack">
            <div className="sidebar-card">
              <div>
                <h3>Notes status</h3>
              </div>
              {activeWorkspace === "calendar" ? (
                <div className="sidebar-actions">
                  <button className="primary-button" type="button" onClick={() => setActiveWorkspace("notes")}>
                    Back to Notes
                  </button>
                  <button className="small-button" type="button" onClick={openCommandPalette}>
                    Command palette
                  </button>
                </div>
              ) : (
                <p className="tiny-text">This inspector area will hold the primary tools for this workspace once it is implemented.</p>
              )}
            </div>

            <div className="sidebar-card">
              <div>
                <h3>Status</h3>
              </div>
              <span className={`status-chip status-chip-${saveState}`}>{saveStatusLabel}</span>
              {updateStatusNote ? <span className="tiny-text topbar-status-note">{updateStatusNote}</span> : null}
            </div>

          </aside>
          ) : null}
          {activeWorkspace === "notes" && isNotesSessionsOpen ? (
              <aside className="notes-sessions-shelf stack">
              <SessionsSidebar
                sessions={snapshot.sessions}
                activeSessionId={activeSession.id}
                onSelect={(id) => setActiveSessionId(id)}
                onCreate={() => openOverlay("new-note")}
                onClose={() => setIsNotesSessionsOpen(false)}
                onDelete={(id) => void deleteSession(id)}
                onRestore={(id) => void restoreSession(id)}
                onDeleteForever={(id) => void permanentlyDeleteSession(id)}
                compact
                title="Sessions"
              />
            </aside>
          ) : null}
        </main>
      </div>

      {isCommandPaletteOpen ? (
        <div className="overlay-backdrop" role="presentation" onClick={closeCommandPalette}>
          <div className="overlay-surface command-palette-surface" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-header">
              <div>
                <strong>Command palette</strong>
                <p className="tiny-text">Search sessions, settings, tools, and future workspaces. Keyboard first by design.</p>
              </div>
              <button className="small-button" type="button" onClick={closeCommandPalette}>
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="command-query">Search actions</label>
              <input
                id="command-query"
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Try: sessions, AI settings, translate, themes, upload image"
              />
            </div>
            <div className="command-palette-list">
              {filteredCommandActions.slice(0, 14).map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className="command-palette-item"
                  onClick={() => {
                    closeCommandPalette();
                    command.action();
                  }}
                >
                  <div>
                    <strong>{command.label}</strong>
                    <p>{command.description}</p>
                  </div>
                  {command.shortcut ? <span className="tiny-text">{command.shortcut}</span> : null}
                </button>
              ))}
              {!filteredCommandActions.length ? (
                <div className="list-item">
                  <strong>No matching actions</strong>
                  <span className="muted">Try searching by workspace, setting, or action name.</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {renderCalendarSessionOverlay()}

      {openPanel ? (
        <div className="overlay-backdrop" role="presentation" onClick={closeOverlay}>
          <div
            className="overlay-surface"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overlay-header">
              <div>
                <strong>
                    {openPanel === "capture-details"
                    ? "Capture details"
                    : openPanel === "output-details"
                    ? "Output details"
                    : openPanel === "calendar-output-preview"
                    ? "Session output"
                    : openPanel === "sessions"
                    ? "All Sessions"
                    : openPanel === "new-note"
                      ? "New note"
                    : openPanel === "metadata-review"
                      ? "People"
                    : openPanel === "backup"
                          ? "Back-up"
                          : openPanel === "more"
                            ? "More tools"
                          : "Settings"}
                </strong>
                <p className="tiny-text">Secondary tools are kept in overlays so each workspace stays focused.</p>
              </div>
              <button className="small-button" type="button" onClick={closeOverlay}>
                Close
              </button>
            </div>
            {renderOverlayContent()}
          </div>
        </div>
      ) : null}
    </div>
    </RichTextCommandProvider>
  );
};

