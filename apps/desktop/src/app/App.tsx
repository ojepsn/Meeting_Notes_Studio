import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { getPrimaryCaptureMode, getTemplatesForCaptureMode, type CaptureMode, type RuleSuggestionRecord } from "@notesmith/domain";
import { useDesktopStore } from "../state/useDesktopStore";
import { SessionEditor } from "../features/sessions/components/SessionEditor";
import { SessionsSidebar } from "../features/sessions/components/SessionsSidebar";
import { OutputWorkspace } from "../features/output/components/OutputWorkspace";
import { ActivitiesWorkspace } from "../features/activities/components/ActivitiesWorkspace";
import { CalendarWorkspace } from "../features/calendar/components/CalendarWorkspace";
import { TodosRailCard } from "../features/todos/components/TodosRailCard";
import { TodosWorkspace } from "../features/todos/components/TodosWorkspace";
import { TimeWorkspace } from "../features/time/components/TimeWorkspace";
import { StructureWorkspace } from "../features/structure/components/StructureWorkspace";
import { SettingsCard } from "../features/settings/components/SettingsCard";
import type { SettingsSection } from "../features/settings/components/SettingsCard";
import { hydrateAITextCache, snapshotAITextCache } from "../lib/ai/cache";
import { generateNotes } from "../lib/ai/services/generateNotes";
import { getAIRequestHistory, hydrateAIRequestHistory, recordAIRequestHistory } from "../lib/ai/history";
import { formatAIErrorMessage } from "../lib/ai/messages";
import { getAIDiagnosticsItems, getAIMetricsSnapshot } from "../lib/ai/metrics";
import {
  buildModelPricingStatus,
  buildTextModelOption,
  buildTranscriptionModelOption,
  createDefaultModelPricingSnapshot,
  fetchLatestModelPricingSnapshot,
  isPricingRefreshDue,
  msUntilNextPricingCheck,
  type AIModelPricingSnapshot,
} from "../lib/ai/modelPricing";
import { reviseOutput } from "../lib/ai/services/reviseOutput";
import { createAIRuntimeStatusHandler } from "../lib/ai/status";
import { transcribeAudio } from "../lib/ai/services/transcribeAudio";
import { translateOutput } from "../lib/ai/services/translateOutput";
import type { AIRuntimeEvent } from "../lib/ai/runtime";
import { checkForDesktopUpdates } from "../lib/ai/updater";
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
  exportSnapshotBackup,
  getDesktopBundleType,
  getDesktopAppVersion,
  getDesktopStorageInfo,
  importSnapshotBackup,
  mergeImportedPwaSnapshot,
  openDesktopPath,
  type DesktopStorageInfo,
} from "../lib/storage/desktopStorage";
import { buildMetadataReview, EMPTY_METADATA_REVIEW, type MetadataReviewState } from "../lib/metadata/review";
import { findActivityIdForSession, findSessionIdForActivity } from "../lib/links/entityLinks";
import { polishNonAiNotesText } from "../lib/output/manualPolish";
import { acceptRuleSuggestion, collectRuleSuggestionObservations, ignoreRuleSuggestion, mergeRuleSuggestionObservations } from "../lib/output/ruleSuggestions";
import { buildStructureOptions, createEmptyStructureOptions } from "../lib/structure/options";
import { parseActivityShortcut, parseMeetingShortcut, parseTodoShortcut } from "../lib/todos/shortcut";
import { parseTokenList } from "../components/peoplePickerUtils";

type AppWorkspace = "notes" | "todos" | "activities" | "calendar" | "time" | "structure" | "assistant" | "files";
type OverlayPanel = "new-note" | "metadata-review" | "sessions" | "backup" | "settings" | "more" | "capture-details" | "output-details" | "calendar-output-preview" | "instructions" | null;
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

const isStructuredHeading = (line: string) => {
  if (!line || line.length > 80) return false;
  if (/^[-*•]/.test(line)) return false;
  if (/^\d+[.)]\s/.test(line)) return false;
  if (/[.!?]$/.test(line)) return false;
  return /^[\p{L}\p{N}&/(),:'" -]+:?$/u.test(line);
};

const WORKSPACE_ITEMS: Array<{ id: AppWorkspace; label: string; description: string; available: boolean }> = [
  { id: "notes", label: "Notes", description: "Capture and shape structured notes", available: true },
  { id: "todos", label: "Todos", description: "Focused follow-up management", available: true },
  { id: "activities", label: "Activities", description: "Tracked work with time and scheduling", available: true },
  { id: "calendar", label: "Calendar", description: "Schedule and meeting context", available: true },
  { id: "time", label: "Timelogs", description: "Active timers, dense logs, and reporting", available: true },
  { id: "structure", label: "Structure", description: "Domains and projects as operational views", available: true },
  { id: "assistant", label: "Assistant", description: "Future AI workflows and agents", available: false },
  { id: "files", label: "Files", description: "Documents, audio, and references", available: false },
];

const PRIMARY_WORKSPACE_ITEMS = WORKSPACE_ITEMS.slice(0, 1);
const SECONDARY_WORKSPACE_ITEMS = WORKSPACE_ITEMS.slice(2);

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
  session: { output: string; outputVersions?: OutputVersionRecord[]; updatedAt: string },
  nextOutput: string,
): Pick<{ output: string; outputVersions: OutputVersionRecord[] }, "output" | "outputVersions"> => {
  const generatedAt = new Date().toISOString();
  const previousHistory = normalizeOutputVersionHistory(session.outputVersions, session.output, session.updatedAt);
  return {
    output: nextOutput,
    outputVersions: [
      {
        id: crypto.randomUUID(),
        output: nextOutput,
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
    saveTimeLog,
    deleteTimeLog,
    startTimeTracking,
    stopTimeTracking,
    createCalendarEntryFromText,
    moveCalendarItem,
    updateCalendarItem,
    convertTodoToActivity,
    ensureSessionForActivity,
    saveSettings,
    renameDomainValue,
    renameProjectValue,
    saveTemplate,
    resetTemplates,
    importLegacyBrowserData,
    importBackupSnapshot: restoreBackupSnapshot,
    saveAttachments,
  } = useDesktopStore();
  const [activeWorkspace, setActiveWorkspace] = useState<AppWorkspace>("calendar");
  const [openPanel, setOpenPanel] = useState<OverlayPanel>(null);
  const [isNotesSessionsOpen, setIsNotesSessionsOpen] = useState(false);
  const [selectedOutputVersionId, setSelectedOutputVersionId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("ai");
  const [notesCapturePaneWidth, setNotesCapturePaneWidth] = useState(640);
  const [requestedActivityId, setRequestedActivityId] = useState<string | null>(null);
  const [requestedTodoId, setRequestedTodoId] = useState<string | null>(null);
  const [requestedActivityDomain, setRequestedActivityDomain] = useState<string | null>(null);
  const [requestedActivityProject, setRequestedActivityProject] = useState<string | null>(null);
  const [requestedTodoDomain, setRequestedTodoDomain] = useState<string | null>(null);
  const [requestedTodoProject, setRequestedTodoProject] = useState<string | null>(null);
  const [requestedTimeDomain, setRequestedTimeDomain] = useState<string | null>(null);
  const [requestedTimeProject, setRequestedTimeProject] = useState<string | null>(null);
  const [linkedDetailReturnWorkspace, setLinkedDetailReturnWorkspace] = useState<AppWorkspace | null>(null);
  const [linkedCalendarReturnItemId, setLinkedCalendarReturnItemId] = useState<string | null>(null);
  const [isCalendarWorkspaceFullScreen, setIsCalendarWorkspaceFullScreen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [statusNote, setStatusNote] = useState("Ready.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [pendingAudioBySession, setPendingAudioBySession] = useState<Record<string, File | undefined>>({});
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("microphone");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingStatusNote, setRecordingStatusNote] = useState<string | null>(null);
  const [availableUpdateVersion, setAvailableUpdateVersion] = useState<string | null>(null);
  const [installUpdate, setInstallUpdate] = useState<null | (() => Promise<void>)>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateStatusNote, setUpdateStatusNote] = useState<string | null>(null);
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);
  const [desktopBundleType, setDesktopBundleType] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<DesktopStorageInfo | null>(null);
  const [manualUpdateUrl, setManualUpdateUrl] = useState<string | null>(null);
  const [calendarOutputPreviewSessionId, setCalendarOutputPreviewSessionId] = useState<string | null>(null);
  const [aiDiagnostics, setAIDiagnostics] = useState(() => getAIDiagnosticsItems());
  const [aiRequestHistory, setAIRequestHistory] = useState(() => getAIRequestHistory());
  const [modelPricingSnapshot, setModelPricingSnapshot] = useState<AIModelPricingSnapshot>(createDefaultModelPricingSnapshot);
  const [modelPricingStatus, setModelPricingStatus] = useState(buildModelPricingStatus(createDefaultModelPricingSnapshot()));
  const [isRefreshingModelPricing, setIsRefreshingModelPricing] = useState(false);
  const [metadataSuggestions, setMetadataSuggestions] = useState<MetadataReviewState>(EMPTY_METADATA_REVIEW);
  const [selectedMetadataSuggestions, setSelectedMetadataSuggestions] = useState<MetadataReviewState>(EMPTY_METADATA_REVIEW);
  const [visibleRuleSuggestions, setVisibleRuleSuggestions] = useState<RuleSuggestionRecord[]>([]);
  const [dismissedRuleSuggestionIds, setDismissedRuleSuggestionIds] = useState<string[]>([]);
  const notesLayoutRef = useRef<HTMLDivElement | null>(null);
  const notesSplitterDraggingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureSourceStreamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingSessionIdRef = useRef<string | null>(null);

  const buildDesktopBackupBundle = (): DesktopBackupBundle | null => {
    if (!snapshot) {
      return null;
    }

    return {
      kind: "notesmith-desktop-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      snapshot,
      aiTextCache: snapshotAITextCache(),
      aiRequestHistory: getAIRequestHistory(),
      aiModelPricing: modelPricingSnapshot,
    };
  };

  useEffect(() => {
    void load();
  }, [load]);

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
          setInstallUpdate(() => result.install);
          setManualUpdateUrl(null);
          setUpdateStatusNote(`Version ${result.version} is available to install.`);
          setStatusNote(`Update available: ${result.version}`);
        } else {
          setAvailableUpdateVersion(null);
          setInstallUpdate(null);
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

  const rankSavedValues = (
    sessions: (typeof snapshot extends null ? never : NonNullable<typeof snapshot>["sessions"]),
    savedValues: string[],
    collectEntries: (session: NonNullable<typeof snapshot>["sessions"][number]) => string[],
  ) => {
    const savedLookup = new Map(
      savedValues
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => [entry.toLocaleLowerCase(), entry] as const),
    );
    const stats = new Map<string, { name: string; count: number; lastSeen: number }>();

    sessions.forEach((session) => {
      const lastSeen = Date.parse(session.updatedAt || session.createdAt || "") || 0;
      collectEntries(session).forEach((entry) => {
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

  const suggestedPeople = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return rankSavedValues(activeSessions, snapshot.settings.savedParticipants, (session) => parsePeopleFromSession(session.participantText));
  }, [activeSessions, snapshot]);

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
  const calendarPreviewSession = useMemo(
    () =>
      calendarOutputPreviewSessionId
        ? snapshot?.sessions.find((session) => session.id === calendarOutputPreviewSessionId) ?? null
        : null,
    [calendarOutputPreviewSessionId, snapshot],
  );
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
  const displayedOutput = selectedOutputVersion?.output ?? activeSession?.output ?? "";

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

  const createAIRuntimeHandler = ({
    onCacheHit,
  }: {
    onCacheHit?: () => void;
  } = {}) =>
    createAIRuntimeStatusHandler({
      setStatus: setStatusNote,
      logEvent: (event) => {
        logAIRuntimeEvent(event);
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
      setStatusNote(`Added to-do: ${todoDescription}`);
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
      sessionParticipants: session.participantText,
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
      session.participantText.trim() ? `People: ${session.participantText.trim()}` : "",
      session.domain.trim() ? `Domain: ${session.domain.trim()}` : "",
      session.project.trim() ? `Project: ${session.project.trim()}` : "",
      session.activity.trim() ? `Activity: ${session.activity.trim()}` : "",
      session.tagsText.trim() ? `Tags: ${session.tagsText.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const buildLocalPolishedOutput = (session = activeSession, template = activeTemplate) => {
    if (!session || !template) {
      return "";
    }

    const manualPolishOptions = {
      abbreviations: snapshot?.settings.abbreviations ?? [],
      sessionParticipants: session.participantText,
      savedParticipants: snapshot?.settings.savedParticipants ?? [],
      preferredParticipantNames: snapshot?.settings.preferredParticipantNames ?? [],
    };
    const title = session.title.trim();
    const metaBlock = buildOutputMetaBlock(session);
    const agenda = getAgendaText(session, template);
    const manualNotes = polishNonAiNotesText(richTextToPlainText(session.manualNotes), manualPolishOptions);
    const transcript = polishNonAiNotesText(
      [session.liveTranscript.trim(), session.uploadedTranscript.trim()].filter(Boolean).join("\n\n"),
      manualPolishOptions,
    );
    const highlights = polishNonAiNotesText(session.quickHighlights.trim(), manualPolishOptions);
    const combinedDiscussion = [manualNotes, transcript].filter(Boolean).join("\n\n").trim();
    const decisionLines = combinedDiscussion
      .split(/\r?\n/)
      .filter((line) => /^Decision:/i.test(line.trim()));
    const actionLines = combinedDiscussion
      .split(/\r?\n/)
      .filter((line) => /^(Action|Next step):/i.test(line.trim()));
    const firstDiscussionParagraph = combinedDiscussion
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .find(Boolean) ?? "";
    const summary = firstDiscussionParagraph
      ? firstDiscussionParagraph
          .split(/(?<=[.!?])\s+/)
          .slice(0, 2)
          .join(" ")
      : "";
    const enabledSections = [...template.sections]
      .sort((left, right) => left.position - right.position)
      .filter((section) => !session.excludedSectionIds.includes(section.id));
    const sectionBlocks = enabledSections
      .map((section) => {
        const lowerTitle = section.title.toLowerCase();
        if (section.id === "agenda" || lowerTitle.includes("agenda")) {
          return agenda ? `${section.title}\n${agenda}` : "";
        }
        if (section.id === "summary" || lowerTitle.includes("summary")) {
          return summary ? `${section.title}\n${summary}` : "";
        }
        if (section.id === "decisions" || lowerTitle.includes("decision")) {
          return decisionLines.length ? `${section.title}\n${decisionLines.join("\n")}` : "";
        }
        if (section.id === "actions" || lowerTitle.includes("action") || lowerTitle.includes("follow-up")) {
          return actionLines.length ? `${section.title}\n${actionLines.join("\n")}` : "";
        }
        if (lowerTitle.includes("highlight")) {
          return highlights ? `${section.title}\n${highlights}` : "";
        }
        return combinedDiscussion ? `${section.title}\n${combinedDiscussion}` : "";
      })
      .filter(Boolean);

    return [title, metaBlock, ...sectionBlocks].filter(Boolean).join("\n\n").trim();
  };

  const buildManualNotesOnlyOutput = (session = activeSession, template = activeTemplate) => {
    if (!session || !template) {
      return "";
    }

    const manualPolishOptions = {
      abbreviations: snapshot?.settings.abbreviations ?? [],
      sessionParticipants: session.participantText,
      savedParticipants: snapshot?.settings.savedParticipants ?? [],
      preferredParticipantNames: snapshot?.settings.preferredParticipantNames ?? [],
    };
    const title = session.title.trim();
    const metaBlock = buildOutputMetaBlock(session);
    const agenda = getAgendaText(session, template);
    const manualNotes = polishNonAiNotesText(richTextToPlainText(session.manualNotes), manualPolishOptions);

    return [
      title,
      metaBlock,
      agenda ? `Agenda\n${agenda}` : "",
      manualNotes ? `Manual notes\n${manualNotes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
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

  const outputActionConfig = (() => {
    return {
      primaryLabel: "Generate",
      secondaryLabel: null as string | null,
      onPrimary: () => void handleGenerate(),
      onSecondary: undefined as (() => void) | undefined,
      isPrimaryRunning: isGenerating || (activeSession?.transcribeOnly ? false : isTranscribingAudio && hasAudioOnlyVoiceCapture),
      isSecondaryRunning: false,
      emptyStatePrimaryLabel: "Generate",
      emptyStateSecondaryLabel: null as string | null,
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
      const backupBundle = buildDesktopBackupBundle();
      if (!backupBundle) {
        setStatusNote("Nothing is loaded yet to export.");
        return;
      }
      const result = await exportSnapshotBackup(backupBundle);
      if (!result) {
        setStatusNote("Backup export was cancelled.");
        return;
      }
      setStatusNote(`Exported a desktop backup file to ${result.path}.`);
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not export the desktop backup file.");
    }
  };

  const handleCreateLocalBackup = async () => {
    try {
      const backupBundle = buildDesktopBackupBundle();
      if (!backupBundle) {
        setStatusNote("Nothing is loaded yet to back up.");
        return;
      }
      const backupPath = await createLocalSnapshotBackup(backupBundle);
      if (!backupPath) {
        setStatusNote("Local backup creation is only available in the installed desktop app.");
        return;
      }
      setStatusNote(`Created a local safety backup at ${backupPath}.`);
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not create the local safety backup.");
    }
  };

  const handleImportBackup = async () => {
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
        await restoreBackupSnapshot(imported.snapshot);
        if (imported.aiTextCache) {
          hydrateAITextCache({ records: imported.aiTextCache });
          await repository.saveAITextCache(imported.aiTextCache);
        }
        if (imported.aiRequestHistory) {
          hydrateAIRequestHistory(imported.aiRequestHistory);
          setAIRequestHistory(getAIRequestHistory());
          await repository.saveAIRequestHistory(imported.aiRequestHistory);
        }
        if (imported.aiModelPricing) {
          setModelPricingSnapshot(imported.aiModelPricing);
          setModelPricingStatus(buildModelPricingStatus(imported.aiModelPricing));
          await repository.saveAIModelPricing(imported.aiModelPricing);
        }
        setStatusNote("Imported the selected desktop backup file.");
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
        setInstallUpdate(() => result.install);
        setManualUpdateUrl(null);
        setUpdateStatusNote(`Version ${result.version} is available to install.`);
        setStatusNote(`Update available: ${result.version}`);
      } else {
        setAvailableUpdateVersion(null);
        setInstallUpdate(null);
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
    if (!installUpdate || !availableUpdateVersion) {
      return;
    }

    setIsInstallingUpdate(true);
    setUpdateStatusNote(`Downloading and installing version ${availableUpdateVersion}...`);
    setStatusNote(`Installing update ${availableUpdateVersion}...`);
    try {
      const backupBundle = buildDesktopBackupBundle();
      const backupPath = backupBundle ? await createLocalSnapshotBackup(backupBundle) : null;
      if (backupPath) {
        setStatusNote(`Created a local safety backup at ${backupPath} before installing ${availableUpdateVersion}.`);
      }
      await installUpdate();
      setUpdateStatusNote(`Version ${availableUpdateVersion} was installed. Restart the app to finish updating.`);
      setStatusNote(`Update ${availableUpdateVersion} installed. Restart the app to finish updating.`);
      setInstallUpdate(null);
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
      await openDesktopPath(manualUpdateUrl);
      setStatusNote("Opened the GitHub release page for manual update download.");
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Could not open the GitHub release page.");
    }
  };

  const handleResetTemplates = async () => {
    await resetTemplates();
    setStatusNote("Restored the default built-in templates.");
  };

  const handleGenerate = async () => {
    const template = activeTemplate;
    if (!template) {
      setStatusNote("The selected template could not be found.");
      return;
    }

    setIsGenerating(true);
    let usedCache = false;
    try {
      let sessionForGeneration = activeSession;
      const shouldUseManualMode = sessionForGeneration.transcribeOnly === true;

      if (shouldUseManualMode && !richTextToPlainText(sessionForGeneration.manualNotes).trim()) {
        setStatusNote("Add text to Manual notes first. This mode transfers Manual notes directly into Output without AI generation.");
        return;
      }

      if (!shouldUseManualMode && activeCaptureMode === "voice-note" && !hasTranscriptText && (activeAudioAttachment || pendingAudioBySession[activeSession.id])) {
        const audioFile = await getAudioFileForActiveSession();
        if (!audioFile) {
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
            ...activeSession,
            liveTranscript: [activeSession.liveTranscript.trim(), transcriptText.trim()].filter(Boolean).join("\n\n"),
          };
          await saveSession(sessionForGeneration);
        } finally {
          setIsTranscribingAudio(false);
        }
      }

      const output = shouldUseManualMode
        ? buildManualNotesOnlyOutput(sessionForGeneration, template)
        : snapshot.settings.apiKey
          ? await generateNotes({
              session: sessionForGeneration,
              settings: snapshot.settings,
              template,
              attachments: activeAttachments,
              onEvent: createAIRuntimeHandler({
                onCacheHit: () => {
                  usedCache = true;
                },
              }),
            })
          : buildLocalPolishedOutput(sessionForGeneration, template);
      setSelectedOutputVersionId(null);
      await saveSession({ ...sessionForGeneration, ...buildOutputVersionPatch(sessionForGeneration, output) });
      setStatusNote(
        shouldUseManualMode
          ? "Manual notes were transferred to Output without AI generation."
          : usedCache
            ? "Loaded structured output from a matching local AI cache entry."
            : snapshot.settings.apiKey
              ? "Generated structured output with the desktop AI service."
              : sessionForGeneration.outputLanguage !== "same"
                ? "No API key was available, so a local polish pass was used. Language translation still requires AI generation."
                : "No API key was available, so a local polish pass was used instead.",
      );
      await openMetadataReviewIfNeeded(sessionForGeneration);
      openNotesTarget({ sessionId: sessionForGeneration.id, view: "output" });
    } catch (error) {
      setStatusNote(
        activeSession.transcribeOnly
          ? `Manual-notes transfer failed: ${error instanceof Error ? error.message : "Unknown error."}`
          : formatAIErrorMessage(error, "Generation failed."),
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
        currentOutput: activeSession.output,
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
        currentOutput: activeSession.output,
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

    if (!activeSession) {
      await saveSession(nextSession);
      return;
    }

    if (nextSession.output !== activeSession.output) {
      const nextVersions = normalizeOutputVersionHistory(
        nextSession.outputVersions,
        activeSession.output,
        activeSession.updatedAt,
      );
      if (nextVersions[0]) {
        nextVersions[0] = {
          ...nextVersions[0],
          output: nextSession.output,
        };
      } else if (nextSession.output.trim()) {
        nextVersions.unshift({
          id: crypto.randomUUID(),
          output: nextSession.output,
          generatedAt: new Date().toISOString(),
        });
      }

      await saveSession({
        ...nextSession,
        outputVersions: nextVersions,
      });
      return;
    }

    await saveSession(nextSession);
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
    setStatusNote("Uploaded audio into the desktop session. You can transcribe it into the live transcript next.");
    setRecordingStatusNote("Audio file attached to the current session.");
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

  const transcribeAudioIntoSession = async ({
    sessionId,
    file,
    statusPrefix,
  }: {
    sessionId: string;
    file: File;
    statusPrefix?: string;
  }) => {
    setIsTranscribingAudio(true);
    try {
      const transcriptText = await transcribeAudio({
        file,
        settings: snapshot.settings,
        onEvent: createAIRuntimeHandler(),
      });
      const targetSession = snapshot.sessions.find((session) => session.id === sessionId);
      if (!targetSession) {
        throw new Error("The session could not be found after recording.");
      }
      const nextTranscript = [targetSession.liveTranscript.trim(), transcriptText.trim()].filter(Boolean).join("\n\n");
      await saveSession({ ...targetSession, liveTranscript: nextTranscript });
      setStatusNote(
        statusPrefix
          ? `${statusPrefix} The transcript was added to the live transcript field.`
          : "Audio transcription complete and added to the live transcript field.",
      );
      setRecordingStatusNote("Transcript added to the session.");
    } catch (error) {
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
    await transcribeAudioIntoSession({ sessionId: activeSession.id, file });
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

    setStatusNote(`Removed ${attachment.filename} from the session attachments.`);
  };

  const handleUpdateAttachment = async (attachmentUpdates: typeof activeAttachments[number]) => {
    await saveAttachments(
      snapshot.attachments.map((entry) => (entry.id === attachmentUpdates.id ? attachmentUpdates : entry)),
    );
  };

  const openSettingsSection = (section: SettingsSection) => {
    setSettingsSection(section);
    setOpenPanel("settings");
  };

  const handleWorkspaceSelection = (workspaceId: AppWorkspace, available: boolean) => {
    setRequestedActivityId(null);
    setRequestedTodoId(null);
    setRequestedActivityDomain(null);
    setRequestedActivityProject(null);
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
    setRequestedActivityId(null);
    setRequestedTodoId(null);
    setRequestedActivityDomain(null);
    setRequestedActivityProject(null);
    setRequestedTodoDomain(null);
    setRequestedTodoProject(null);
    setRequestedTimeDomain(null);
    setRequestedTimeProject(null);
  };
  const openLinkedDestination = ({
    workspace,
    activityId = null,
    todoId = null,
    activityDomain = null,
    activityProject = null,
    todoDomain = null,
    todoProject = null,
    timeDomain = null,
    timeProject = null,
    returnWorkspace = null,
    status,
  }: {
    workspace: AppWorkspace;
    activityId?: string | null;
    todoId?: string | null;
    activityDomain?: string | null;
    activityProject?: string | null;
    todoDomain?: string | null;
    todoProject?: string | null;
    timeDomain?: string | null;
    timeProject?: string | null;
    returnWorkspace?: AppWorkspace | null;
    status?: string;
  }) => {
    clearRequestedFilters();
    setRequestedActivityId(activityId);
    setRequestedTodoId(todoId);
    setRequestedActivityDomain(activityDomain);
    setRequestedActivityProject(activityProject);
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
  const openSessionFromLink = (sessionId: string, returnWorkspace: AppWorkspace | null = null, calendarItemId: string | null = null) =>
    openNotesTarget({
      sessionId,
      view: "capture",
      returnWorkspace,
      calendarItemId,
      status: returnWorkspace === "calendar" ? "Opened linked session from Calendar. Return to Calendar when you are done." : "Opened linked session.",
    });
  const openActivityFromLink = (activityId: string, returnWorkspace: AppWorkspace | null = null) =>
    openLinkedDestination({
      workspace: "activities",
      activityId,
      returnWorkspace,
      status: "Opened linked activity.",
    });
  const openTodoDetailFromLink = (todoId: string, returnWorkspace: AppWorkspace | null = null) =>
    openLinkedDestination({
      workspace: "todos",
      todoId,
      returnWorkspace,
      status: "Opened linked todo.",
    });
  const returnFromLinkedDetail = () => {
    if (!requestedActivityId && !requestedTodoId && !linkedDetailReturnWorkspace) {
      return;
    }
    const nextWorkspace = linkedDetailReturnWorkspace ?? "calendar";
    setRequestedActivityId(null);
    setRequestedTodoId(null);
    setRequestedActivityDomain(null);
    setRequestedActivityProject(null);
    setRequestedTodoDomain(null);
    setRequestedTodoProject(null);
    setRequestedTimeDomain(null);
    setRequestedTimeProject(null);
    setLinkedDetailReturnWorkspace(null);
    if (nextWorkspace !== "calendar") {
      setLinkedCalendarReturnItemId(null);
    }
    setActiveWorkspace(nextWorkspace);
    setStatusNote(`Returned to ${nextWorkspace === "time" ? "Time" : nextWorkspace === "calendar" ? "Calendar" : "the previous workspace"}.`);
  };
  const openCalendarOutputPreview = (sessionId: string) => {
    setCalendarOutputPreviewSessionId(sessionId);
    setOpenPanel("calendar-output-preview");
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
        label: "Open To-dos",
        description: "See personal follow-ups captured from notes.",
        keywords: ["todo tasks follow up"],
        action: () => setActiveWorkspace("todos"),
      },
      {
        id: "activities",
        label: "Open Activities",
        description: "See tracked work and time-based activities.",
        keywords: ["activities work tracked time"],
        action: () => setActiveWorkspace("activities"),
      },
      {
        id: "calendar",
        label: "Open Calendar",
        description: "Schedule todos, activities, and meetings across time.",
        keywords: ["calendar schedule plan meeting"],
        action: () => setActiveWorkspace("calendar"),
      },
      {
        id: "time",
        label: "Open Time",
        description: "Review timers, logs, and time summaries.",
        keywords: ["time logs timer reporting"],
        action: () => setActiveWorkspace("time"),
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
            onChange={(session) => void saveSession(session)}
            onImportImage={() => void handleImportImage()}
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
        const previewLines = calendarPreviewSession ? splitStructuredOutput(calendarPreviewSession.output) : [];
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
            {calendarPreviewSession && calendarPreviewSession.output.trim() ? (
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
            onCreateLocalBackup={handleCreateLocalBackup}
            updateStatusNote={updateStatusNote}
            desktopVersion={desktopVersion}
            desktopBundleType={desktopBundleType}
            availableUpdateVersion={availableUpdateVersion}
            manualUpdateUrl={manualUpdateUrl}
            isCheckingForUpdates={isCheckingForUpdates}
            isInstallingUpdate={isInstallingUpdate}
            storageInfo={storageInfo}
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
                Open Todos workspace
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
              <button className="small-button" type="button" onClick={() => void handleImportBackup()}>
                Import backup file
              </button>
              <button className="small-button" type="button" onClick={() => void handleExportSnapshot()}>
                Export backup file
              </button>
              <button className="small-button" type="button" onClick={() => void handleCreateLocalBackup()}>
                Create local safety backup
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
              </div>
            ) : null}
            <p className="tiny-text">Export a backup file to a folder outside AppData before uninstalling the app.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-shell desktop-shell" data-theme={snapshot.settings.theme} onKeyDownCapture={(event) => void handleGlobalTodoShortcut(event)}>
      <aside className="workspace-rail">
        <div className="workspace-rail-brand">
          <strong>NoteSmith</strong>
          <span className="tiny-text">Desktop</span>
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
        <header className={`topbar app-header${activeWorkspace === "notes" ? " app-header-notes-pwa" : ""}${activeWorkspace === "calendar" ? " app-header-compact app-header-calendar-home" : ""}${activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen ? " app-header-compact" : ""}`}>
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
          }${activeWorkspace === "notes" ? " notes-shell-notes-mode" : ""}`}
        >
          <section className="workspace-canvas">
            {activeWorkspace !== "notes" && !(activeWorkspace === "calendar") ? (
            <div className="workspace-header card">
              <div className="card-header">
                <div>
                  <div className="topbar-eyebrow">Workspace</div>
                  <h2>{WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.label || "Workspace"}</h2>
                </div>
              </div>
            </div>
            ) : null}

            {activeWorkspace === "todos" ? (
              <TodosWorkspace
                todos={snapshot.todos}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                structureOptions={structureOptions}
                requestedTodoId={requestedTodoId}
                requestedDomain={requestedTodoDomain}
                requestedProject={requestedTodoProject}
                onEditorClose={returnFromLinkedDetail}
                onToggle={(todo) => void saveTodo(todo)}
                onAdd={(description, options) => void addTodo(description, options)}
                onSave={(todo) => void saveTodo(todo)}
                onDelete={(id) => void deleteTodo(id)}
                onConvertToActivity={(todo) => void convertTodoToActivity(todo)}
                onSaveTimeLog={(timeLog) => void saveTimeLog(timeLog)}
                onDeleteTimeLog={(id) => void deleteTimeLog(id)}
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "todos")}
              />
            ) : activeWorkspace === "activities" ? (
              <ActivitiesWorkspace
                activities={snapshot.activities}
                todos={snapshot.todos}
                timeLogs={snapshot.timelogs}
                structureOptions={structureOptions}
                linkedSessionStateByActivity={linkedSessionStateByActivity}
                requestedActivityId={requestedActivityId}
                requestedDomain={requestedActivityDomain}
                requestedProject={requestedActivityProject}
                onEditorClose={returnFromLinkedDetail}
                onToggle={(activity) => void saveActivity(activity)}
                onAdd={(description, type) => void addActivity(description, type)}
                onAddChildTodo={(description, activityId) => void addTodo(description, { activityId })}
                onAddChildMeeting={(description, activityId) => void addActivity(description, "meeting", { parentActivityId: activityId })}
                onSave={(activity) => void saveActivity(activity)}
                onDelete={(id) => void deleteActivity(id)}
                onCreateLinkedMeetingSession={(activityId) =>
                  void ensureSessionForActivity(activityId).then((sessionId) => {
                    if (sessionId) {
                      openSessionFromLink(sessionId, "activities");
                    }
                  })
                }
                onOpenSession={(sessionId) => openSessionFromLink(sessionId, "activities")}
                onPreviewSessionOutput={openCalendarOutputPreview}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "activities")}
                onSaveTimeLog={(timeLog) => void saveTimeLog(timeLog)}
                onDeleteTimeLog={(id) => void deleteTimeLog(id)}
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
              />
            ) : activeWorkspace === "calendar" ? (
              <CalendarWorkspace
                todos={snapshot.todos}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                calendarItems={snapshot.calendarItems ?? []}
                settings={snapshot.settings}
                structureOptions={structureOptions}
                linkedSessionStateByActivity={linkedSessionStateByActivity}
                onSaveSettings={(settings) => void saveSettings(settings)}
                onCreateFromText={(date, startSlot, value, options) => createCalendarEntryFromText(date, startSlot, value, options)}
                onMoveItem={(id, date, startSlot) => void moveCalendarItem(id, date, startSlot)}
                onSaveTodo={(todo) => void saveTodo(todo)}
                onDeleteTodo={(id) => void deleteTodo(id)}
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
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
                onOpenTodoWorkspace={() => setActiveWorkspace("todos")}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "calendar")}
                onOpenActivityWorkspace={(activityId) => openActivityFromLink(activityId, "calendar")}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "calendar")}
                onOpenSession={(sessionId) => {
                  const calendarItemId =
                    snapshot.calendarItems.find((item) => {
                      if (item.targetType !== "activity") return false;
                      const activitySessionId = linkedSessionStateByActivity[item.targetId]?.sessionId;
                      return activitySessionId === sessionId;
                    })?.id ?? null;
                  openSessionFromLink(sessionId, "calendar", calendarItemId);
                }}
                highlightedItemId={linkedCalendarReturnItemId}
                onCreateLinkedMeetingSession={(activityId) =>
                  void ensureSessionForActivity(activityId).then((sessionId) => {
                    if (sessionId) {
                      setStatusNote("Created linked meeting session.");
                    }
                  })
                }
                onPreviewSessionOutput={openCalendarOutputPreview}
                onFullScreenChange={setIsCalendarWorkspaceFullScreen}
              />
            ) : activeWorkspace === "time" ? (
              <TimeWorkspace
                todos={snapshot.todos}
                activities={snapshot.activities}
                timeLogs={snapshot.timelogs}
                requestedDomain={requestedTimeDomain}
                requestedProject={requestedTimeProject}
                reportPresets={snapshot.settings.timeReportPresets}
                onSaveTimeLog={(timeLog) => void saveTimeLog(timeLog)}
                onDeleteTimeLog={(id) => void deleteTimeLog(id)}
                onStartTracking={(targetType, targetId) => void startTimeTracking(targetType, targetId)}
                onStopTracking={(targetType, targetId) => void stopTimeTracking(targetType, targetId)}
                onOpenTodoDetail={(todoId) => openTodoDetailFromLink(todoId, "time")}
                onOpenActivityDetail={(activityId) => openActivityFromLink(activityId, "time")}
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
            ) : activeWorkspace === "structure" ? (
              <StructureWorkspace
                activities={snapshot.activities}
                todos={snapshot.todos}
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
                onOpenActivitiesForDomain={(domain) => {
                  openLinkedDestination({
                    workspace: "activities",
                    activityDomain: domain || null,
                    returnWorkspace: "structure",
                    status: domain ? `Opened Activities filtered to ${domain}.` : "Opened Activities.",
                  });
                }}
                onOpenActivitiesForProject={(project) => {
                  openLinkedDestination({
                    workspace: "activities",
                    activityProject: project || null,
                    returnWorkspace: "structure",
                    status: project ? `Opened Activities filtered to ${project}.` : "Opened Activities.",
                  });
                }}
                onOpenTodosForDomain={(domain) =>
                  openLinkedDestination({
                    workspace: "todos",
                    todoDomain: domain || null,
                    returnWorkspace: "structure",
                    status: domain ? `Opened Todos filtered to ${domain}.` : "Opened Todos.",
                  })
                }
                onOpenTodosForProject={(project) =>
                  openLinkedDestination({
                    workspace: "todos",
                    todoProject: project || null,
                    returnWorkspace: "structure",
                    status: project ? `Opened Todos filtered to ${project}.` : "Opened Todos.",
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
                      Back to {linkedDetailReturnWorkspace === "calendar" ? "Calendar" : linkedDetailReturnWorkspace === "activities" ? "Activities" : linkedDetailReturnWorkspace === "time" ? "Time" : linkedDetailReturnWorkspace === "structure" ? "Structure" : "previous workspace"}
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
                <div
                  ref={notesLayoutRef}
                  className="notes-pwa-grid notes-pwa-grid-resizable"
                  style={{ gridTemplateColumns: `${notesCapturePaneWidth}px 12px minmax(${NOTES_PANEL_MIN_WIDTH}px, 1fr)` }}
                >
                  <div className="notes-pwa-capture">
                    <SessionEditor
                      session={activeSession}
                      templates={snapshot.templates}
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
                      onChange={(session) => void saveSession(session)}
                      onImportImage={() => void handleImportImage()}
                      onImportAudio={() => void handleImportAudio()}
                      onTranscribeAudio={() => void handleTranscribeAudio()}
                      onChangeRecordingMode={setRecordingMode}
                      onStartRecording={(mode) => void handleStartRecording(mode)}
                      onStopRecording={() => void handleStopRecording()}
                      onImportTranscript={() => void handleImportTranscript()}
                      onRemoveAttachment={(attachmentId) => void handleRemoveAttachment(attachmentId)}
                      onUpdateAttachment={(attachment) => void handleUpdateAttachment(attachment)}
                      onOpenDetails={() => openOverlay("capture-details")}
                      onCreateSessionFromTemplate={(templateId) => void handleCreateSessionFromTemplate(templateId)}
                      onOpenInstructions={() => openOverlay("instructions")}
                    />
                  </div>
                  <div
                    className="notes-pwa-splitter"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize capture and output panels"
                    onMouseDown={() => {
                      notesSplitterDraggingRef.current = true;
                      document.body.style.cursor = "col-resize";
                    }}
                  />
                  <div className="notes-pwa-output">
                    <OutputWorkspace
                      session={activeSession}
                      template={activeTemplate}
                      displayedOutput={displayedOutput}
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
                </div>
              </div>
            )}
          </section>

        {!(activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen) && activeWorkspace !== "notes" && activeWorkspace !== "todos" ? (
          <aside className="workspace-inspector stack">
            <div className="sidebar-card">
              <div>
                <h3>Notes status</h3>
              </div>
              {activeWorkspace === "activities" || activeWorkspace === "calendar" ? (
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
              {activeWorkspace === "activities" ? (
                <>
                  <span className="status-chip">{snapshot.activities.filter((activity) => !activity.isDone).length} open activities</span>
                  <span className="status-chip">{snapshot.activities.filter((activity) => activity.isDone).length} completed</span>
                </>
              ) : null}
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
  );
};

