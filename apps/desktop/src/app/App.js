import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPrimaryCaptureMode, getTemplatesForCaptureMode } from "@notesmith/domain";
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
import { AssistantWorkspace } from "../features/assistant/components/AssistantWorkspace";
import { SettingsCard } from "../features/settings/components/SettingsCard";
import { hydrateAITextCache, snapshotAITextCache } from "../lib/ai/cache";
import { generateNotes } from "../lib/ai/services/generateNotes";
import { getAIRequestHistory, hydrateAIRequestHistory, recordAIRequestHistory } from "../lib/ai/history";
import { formatAIErrorMessage } from "../lib/ai/messages";
import { getAIDiagnosticsItems, getAIMetricsSnapshot } from "../lib/ai/metrics";
import { buildModelPricingStatus, buildTextModelOption, buildTranscriptionModelOption, createDefaultModelPricingSnapshot, fetchLatestModelPricingSnapshot, isPricingRefreshDue, msUntilNextPricingCheck, } from "../lib/ai/modelPricing";
import { reviseOutput } from "../lib/ai/services/reviseOutput";
import { createAIRuntimeStatusHandler } from "../lib/ai/status";
import { transcribeAudio } from "../lib/ai/services/transcribeAudio";
import { translateOutput } from "../lib/ai/services/translateOutput";
import { checkForDesktopUpdates } from "../lib/ai/updater";
import { exportOutputAsDocx, exportOutputAsHtml, exportOutputAsMarkdown, exportOutputAsPdf, exportOutputAsText } from "../lib/export/exportService";
import { fileToAttachmentRecord, loadPersistedAttachmentFile, pickAudioFile, pickImageFile, pickTranscriptFile, persistGeneratedAttachment, persistSelectedAttachment, readTranscriptFile, removePersistedAttachment, } from "../lib/files/attachmentStore";
import { buildRecordingFilename, getSupportedRecordingMimeType, getSystemAudioDisplayOptions, RECORDING_MODE_LABELS, } from "../lib/files/recording";
import { createLocalSnapshotBackup, downloadInstallerToDownloads, downloadInstallerToDownloadsAndOpen, exportSnapshotBackup, exportSnapshotBackupToDownloads, getDesktopBundleType, getDesktopAppVersion, getDesktopStorageInfo, getLatestLocalBackupInfo, importSnapshotBackup, mergeImportedPwaSnapshot, openDesktopPath, openDesktopUrl, revealDesktopPath, } from "../lib/storage/desktopStorage";
import { buildMetadataReview, EMPTY_METADATA_REVIEW } from "../lib/metadata/review";
import { findActivityIdForSession, findSessionIdForActivity } from "../lib/links/entityLinks";
import { polishNonAiNotesText } from "../lib/output/manualPolish";
import { acceptRuleSuggestion, collectRuleSuggestionObservations, ignoreRuleSuggestion, mergeRuleSuggestionObservations } from "../lib/output/ruleSuggestions";
import { buildStructureOptions, createEmptyStructureOptions } from "../lib/structure/options";
import { parseActivityShortcut, parseMeetingShortcut, parseTodoShortcut } from "../lib/todos/shortcut";
import { parseTokenList } from "../components/peoplePickerUtils";
const richTextToPlainText = (value) => {
    if (!value)
        return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
    return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};
const splitStructuredOutput = (output) => output
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => block.split("\n").map((line) => line.trim()).filter(Boolean));
const isStructuredHeading = (line) => {
    if (!line || line.length > 80)
        return false;
    if (/^[-*•]/.test(line))
        return false;
    if (/^\d+[.)]\s/.test(line))
        return false;
    if (/[.!?]$/.test(line))
        return false;
    return /^[\p{L}\p{N}&/(),:'" -]+:?$/u.test(line);
};
const WORKSPACE_ITEMS = [
    { id: "notes", label: "Notes", description: "Capture and shape structured notes", available: true },
    { id: "todos", label: "Todos", description: "Focused follow-up management", available: true },
    { id: "activities", label: "Activities", description: "Tracked work with time and scheduling", available: true },
    { id: "calendar", label: "Calendar", description: "Schedule and meeting context", available: true },
    { id: "time", label: "Timelogs", description: "Active timers, dense logs, and reporting", available: true },
    { id: "structure", label: "Structure", description: "Domains and projects as operational views", available: true },
    { id: "assistant", label: "Assistant", description: "Agentic chat with NoteSmith data", available: true },
    { id: "files", label: "Files", description: "Documents, audio, and references", available: false },
];
const PRIMARY_WORKSPACE_ITEMS = WORKSPACE_ITEMS.slice(0, 1);
const SECONDARY_WORKSPACE_ITEMS = WORKSPACE_ITEMS.slice(2);
const logAIRuntimeEvent = (event) => {
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
const clampNotesCapturePaneWidth = (value, maxWidth = NOTES_PANEL_MAX_WIDTH) => Math.min(maxWidth, Math.max(NOTES_PANEL_MIN_WIDTH, Math.round(value)));
const normalizeOutputVersionHistory = (outputVersions, currentOutput, updatedAt) => {
    const normalized = Array.isArray(outputVersions)
        ? outputVersions
            .filter((version) => Boolean(version) &&
            typeof version.id === "string" &&
            typeof version.output === "string" &&
            typeof version.generatedAt === "string" &&
            version.output.trim().length > 0)
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
const buildOutputVersionPatch = (session, nextOutput) => {
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
    const { snapshot, activeSessionId, saveState, lastSavedAt, isLoaded, loadError, load, setActiveSessionId, setActiveView, repository, saveSession, createNewSession, deleteSession, restoreSession, permanentlyDeleteSession, saveTodo, addTodo, deleteTodo, saveActivity, addActivity, deleteActivity, saveTimeLog, deleteTimeLog, startTimeTracking, stopTimeTracking, createCalendarEntryFromText, rollForwardOverdueTodos, moveCalendarItem, updateCalendarItem, convertTodoToActivity, ensureSessionForActivity, saveSettings, renameDomainValue, renameProjectValue, saveTemplate, resetTemplates, importLegacyBrowserData, importBackupSnapshot: restoreBackupSnapshot, saveAttachments, } = useDesktopStore();
    const [activeWorkspace, setActiveWorkspace] = useState("calendar");
    const [openPanel, setOpenPanel] = useState(null);
    const [isNotesSessionsOpen, setIsNotesSessionsOpen] = useState(false);
    const [selectedOutputVersionId, setSelectedOutputVersionId] = useState(null);
    const [settingsSection, setSettingsSection] = useState("ai");
    const [notesCapturePaneWidth, setNotesCapturePaneWidth] = useState(640);
    const [requestedActivityId, setRequestedActivityId] = useState(null);
    const [requestedTodoId, setRequestedTodoId] = useState(null);
    const [requestedActivityDomain, setRequestedActivityDomain] = useState(null);
    const [requestedActivityProject, setRequestedActivityProject] = useState(null);
    const [requestedTodoDomain, setRequestedTodoDomain] = useState(null);
    const [requestedTodoProject, setRequestedTodoProject] = useState(null);
    const [requestedTimeDomain, setRequestedTimeDomain] = useState(null);
    const [requestedTimeProject, setRequestedTimeProject] = useState(null);
    const [linkedDetailReturnWorkspace, setLinkedDetailReturnWorkspace] = useState(null);
    const [linkedCalendarReturnItemId, setLinkedCalendarReturnItemId] = useState(null);
    const [isCalendarWorkspaceFullScreen, setIsCalendarWorkspaceFullScreen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [commandQuery, setCommandQuery] = useState("");
    const [statusNote, setStatusNote] = useState("Ready.");
    const [generationLog, setGenerationLog] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRevising, setIsRevising] = useState(false);
    const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
    const [pendingAudioBySession, setPendingAudioBySession] = useState({});
    const [recordingMode, setRecordingMode] = useState("microphone");
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [recordingStatusNote, setRecordingStatusNote] = useState(null);
    const [availableUpdateVersion, setAvailableUpdateVersion] = useState(null);
    const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
    const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
    const [updateStatusNote, setUpdateStatusNote] = useState(null);
    const [desktopVersion, setDesktopVersion] = useState(null);
    const [desktopBundleType, setDesktopBundleType] = useState(null);
    const [storageInfo, setStorageInfo] = useState(null);
    const [latestLocalBackupInfo, setLatestLocalBackupInfo] = useState(null);
    const [manualUpdateUrl, setManualUpdateUrl] = useState(null);
    const [calendarOutputPreviewSessionId, setCalendarOutputPreviewSessionId] = useState(null);
    const [aiDiagnostics, setAIDiagnostics] = useState(() => getAIDiagnosticsItems());
    const [aiRequestHistory, setAIRequestHistory] = useState(() => getAIRequestHistory());
    const [modelPricingSnapshot, setModelPricingSnapshot] = useState(createDefaultModelPricingSnapshot);
    const [modelPricingStatus, setModelPricingStatus] = useState(buildModelPricingStatus(createDefaultModelPricingSnapshot()));
    const [isRefreshingModelPricing, setIsRefreshingModelPricing] = useState(false);
    const [metadataSuggestions, setMetadataSuggestions] = useState(EMPTY_METADATA_REVIEW);
    const [selectedMetadataSuggestions, setSelectedMetadataSuggestions] = useState(EMPTY_METADATA_REVIEW);
    const [visibleRuleSuggestions, setVisibleRuleSuggestions] = useState([]);
    const [dismissedRuleSuggestionIds, setDismissedRuleSuggestionIds] = useState([]);
    const notesLayoutRef = useRef(null);
    const activeSessionDraftRef = useRef(null);
    const notesSplitterDraggingRef = useRef(false);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const captureSourceStreamsRef = useRef([]);
    const audioContextRef = useRef(null);
    const recordingChunksRef = useRef([]);
    const recordingSessionIdRef = useRef(null);
    const todoRolloverDateRef = useRef(new Date().toDateString());
    const localSafetyBackupDateRef = useRef(null);
    const buildDesktopBackupBundle = () => {
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
        if (!isLoaded || loadError)
            return;
        const checkTodoRolloverDate = () => {
            const currentDate = new Date().toDateString();
            if (todoRolloverDateRef.current === currentDate)
                return;
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
        }
        catch {
            setLatestLocalBackupInfo(null);
        }
    };
    useEffect(() => {
        if (!isLoaded || loadError)
            return;
        void refreshLatestLocalBackupInfo();
    }, [isLoaded, loadError]);
    useEffect(() => {
        if (!isLoaded || loadError || !snapshot || !storageInfo)
            return;
        const latestBackupDate = latestLocalBackupInfo
            ? new Date(latestLocalBackupInfo.modifiedMs).toLocaleDateString("sv-SE")
            : null;
        const today = new Date().toLocaleDateString("sv-SE");
        if (localSafetyBackupDateRef.current === today || latestBackupDate === today) {
            localSafetyBackupDateRef.current = today;
            return;
        }
        localSafetyBackupDateRef.current = today;
        const createAutomaticLocalBackup = async () => {
            const backupBundle = buildDesktopBackupBundle();
            if (!backupBundle)
                return;
            const backupPath = await createLocalSnapshotBackup(backupBundle);
            if (!backupPath)
                return;
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
            audioContextRef.current?.close().catch(() => { });
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
        setIsCalendarWorkspaceFullScreen(snapshot.settings.calendarFullScreenPreferenceInitialized ? snapshot.settings.calendarIsFullScreen : true);
    }, [
        activeWorkspace,
        snapshot,
    ]);
    useEffect(() => {
        if (!snapshot)
            return;
        setNotesCapturePaneWidth(snapshot.settings.notesCapturePaneWidth);
    }, [snapshot?.settings.notesCapturePaneWidth]);
    useEffect(() => {
        setSelectedOutputVersionId(null);
    }, [activeSessionId]);
    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!notesSplitterDraggingRef.current || !notesLayoutRef.current)
                return;
            const rect = notesLayoutRef.current.getBoundingClientRect();
            const computedStyles = window.getComputedStyle(notesLayoutRef.current);
            const columnGap = parseFloat(computedStyles.columnGap || computedStyles.gap || "0") || 0;
            const splitterWidth = notesLayoutRef.current.querySelector(".notes-pwa-splitter")?.getBoundingClientRect().width ?? 12;
            const maxCaptureWidth = rect.width - splitterWidth - columnGap * 2 - NOTES_PANEL_MIN_WIDTH;
            setNotesCapturePaneWidth(clampNotesCapturePaneWidth(event.clientX - rect.left, maxCaptureWidth));
        };
        const handleMouseUp = () => {
            if (!notesSplitterDraggingRef.current)
                return;
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
                if (cancelled)
                    return;
                if (result.available) {
                    setAvailableUpdateVersion(result.version);
                    setManualUpdateUrl(result.downloadUrl ?? null);
                    setUpdateStatusNote(`Version ${result.version} is available to install.`);
                    setStatusNote(`Update available: ${result.version}`);
                }
                else {
                    setAvailableUpdateVersion(null);
                    setManualUpdateUrl("downloadUrl" in result && result.downloadUrl ? result.downloadUrl : null);
                    setUpdateStatusNote(result.note ?? "Desktop app is up to date.");
                }
            }
            catch (error) {
                if (cancelled)
                    return;
                setUpdateStatusNote(error instanceof Error ? error.message : "Could not check for updates.");
            }
            finally {
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
        let timerId = null;
        const refreshPricing = async (currentSnapshot, forceRefresh) => {
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
            }
            catch (error) {
                if (!cancelled) {
                    setModelPricingSnapshot(baseSnapshot);
                    setModelPricingStatus(`${buildModelPricingStatus(baseSnapshot)} Live refresh from OpenAI could not be completed${error instanceof Error ? `: ${error.message}` : "."}`);
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
        }
        catch (error) {
            setModelPricingStatus(`${buildModelPricingStatus(modelPricingSnapshot)} Live refresh from OpenAI could not be completed${error instanceof Error ? `: ${error.message}` : "."}`);
        }
        finally {
            setIsRefreshingModelPricing(false);
        }
    };
    const parsePeopleFromSession = (participantText) => parseTokenList(participantText);
    const rankSavedValues = (sessions, savedValues, collectEntries) => {
        const savedLookup = new Map(savedValues
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => [entry.toLocaleLowerCase(), entry]));
        const stats = new Map();
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
                }
                else {
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
    const activeSessions = useMemo(() => (snapshot ? snapshot.sessions.filter((session) => !session.deletedAt) : []), [snapshot]);
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
    const structureOptions = useMemo(() => snapshot
        ? buildStructureOptions({
            savedDomains: snapshot.settings.savedDomains,
            savedProjects: snapshot.settings.savedProjects,
            savedActivities: snapshot.settings.savedActivities,
            projectLinks: snapshot.settings.projectLinks,
            sessions: snapshot.sessions,
            todos: snapshot.todos,
            activities: snapshot.activities,
        })
        : createEmptyStructureOptions(), [snapshot]);
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
    const activeTemplate = useMemo(() => activeSession && snapshot
        ? getTemplatesForCaptureMode(snapshot.templates, activeSession.captureMode).find((template) => template.id === activeSession.templateId) ??
            getTemplatesForCaptureMode(snapshot.templates, activeSession.captureMode)[0] ??
            null
        : null, [activeSession, snapshot]);
    const quickStartTemplates = useMemo(() => {
        const templates = snapshot?.templates ?? [];
        const preferredOrder = ["meeting", "personal-note", "one-on-one"];
        const builtIns = preferredOrder
            .map((templateId) => templates.find((template) => template.id === templateId))
            .filter((template) => Boolean(template));
        const customs = templates.filter((template) => template.kind === "custom" && !preferredOrder.includes(template.id));
        return [...builtIns, ...customs];
    }, [snapshot]);
    const activeCaptureMode = activeSession?.captureMode ?? "meeting-note";
    const activeAttachments = useMemo(() => snapshot?.attachments.filter((attachment) => attachment.sessionId === activeSession?.id) ?? [], [activeSession, snapshot]);
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
            activityLabel: activeLinkedActivity?.description.trim() || activeSession.activity.trim() || "Other",
        };
    };
    const linkedSessionStateByActivity = useMemo(() => Object.fromEntries((snapshot?.activities ?? []).map((activity) => {
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
    })), [snapshot]);
    const calendarPreviewSession = useMemo(() => calendarOutputPreviewSessionId
        ? snapshot?.sessions.find((session) => session.id === calendarOutputPreviewSessionId) ?? null
        : null, [calendarOutputPreviewSessionId, snapshot]);
    const activeAudioAttachment = useMemo(() => activeAttachments.find((attachment) => attachment.kind === "audio") ?? null, [activeAttachments]);
    const activeOutputVersions = useMemo(() => normalizeOutputVersionHistory(activeSession?.outputVersions, activeSession?.output ?? "", activeSession?.updatedAt ?? new Date().toISOString()), [activeSession]);
    const selectedOutputVersion = useMemo(() => activeOutputVersions.find((version) => version.id === selectedOutputVersionId) ?? null, [activeOutputVersions, selectedOutputVersionId]);
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
    const saveStatusLabel = saveState === "saving"
        ? "Saving..."
        : saveState === "error"
            ? "Save issue"
            : lastSavedAt
                ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Saved locally";
    const appendGenerationLog = (message, level = "info", details) => {
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
    const createAIRuntimeHandler = ({ onCacheHit, } = {}) => createAIRuntimeStatusHandler({
        setStatus: setStatusNote,
        logEvent: (event) => {
            logAIRuntimeEvent(event);
            if (event.type === "request-start") {
                appendGenerationLog(`OpenAI request started: ${event.operation}`, "info", `request id: ${event.requestId}\nprompt: ${event.promptVersion ?? "default"}`);
            }
            else if (event.type === "request-retry") {
                appendGenerationLog(`OpenAI request retry: ${event.operation}`, "warning", `attempt: ${event.attempt} of ${event.maxRetries}\ndelay: ${event.delayMs} ms\nerror: ${event.error.message}`);
            }
            else if (event.type === "request-success") {
                appendGenerationLog(`OpenAI request succeeded: ${event.operation}`, "success", `request id: ${event.requestId}\nduration: ${event.durationMs} ms\nprompt: ${event.promptVersion ?? "default"}`);
            }
            else if (event.type === "request-failure") {
                appendGenerationLog(`OpenAI request failed: ${event.operation}`, "error", `request id: ${event.requestId}\nduration: ${event.durationMs} ms\nprompt: ${event.promptVersion ?? "default"}\nerror: ${event.error instanceof Error ? event.error.message : String(event.error)}`);
            }
            else if (event.type === "cache-hit") {
                appendGenerationLog(`AI cache hit: ${event.operation}`, "success", `request id: ${event.requestId}\nprompt: ${event.promptVersion ?? "default"}`);
            }
            setAIDiagnostics(getAIDiagnosticsItems());
            setAIRequestHistory(getAIRequestHistory());
        },
        onCacheHit,
    });
    const openMetadataReviewIfNeeded = async (session) => {
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
            : { nextSettings: null, visibleSuggestions: [] };
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
    const handleGlobalTodoShortcut = async (event) => {
        if (!activeSession) {
            return;
        }
        if (event.key !== "Enter" ||
            event.shiftKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.nativeEvent.isComposing) {
            return;
        }
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }
        if (target instanceof HTMLInputElement &&
            !["text", "search", "email", "url", "tel", "password"].includes(target.type)) {
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
    const resolveSessionOutputLanguage = (session = activeSession) => session?.outputLanguage === "sv" || session?.outputLanguage === "en"
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
        const time = session.captureMode === "meeting-note"
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
    const normalizeForCopyCheck = (value) => value
        .toLowerCase()
        .replace(/[^a-z0-9\u00c0-\u024f]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    const isLikelyCopiedSourceOutput = (output, sourceText) => {
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
            sessionParticipants: session.participantText,
            savedParticipants: snapshot?.settings.savedParticipants ?? [],
            preferredParticipantNames: snapshot?.settings.preferredParticipantNames ?? [],
        };
        const title = session.title.trim();
        const metaBlock = buildOutputMetaBlock(session);
        const agenda = getAgendaText(session, template);
        const manualNotes = polishNonAiNotesText(richTextToPlainText(session.manualNotes), manualPolishOptions);
        const transcript = polishNonAiNotesText([session.liveTranscript.trim(), session.uploadedTranscript.trim()].filter(Boolean).join("\n\n"), manualPolishOptions);
        const notesBody = [manualNotes, transcript].filter(Boolean).join("\n\n").trim();
        return [
            title,
            metaBlock,
            agenda ? `Agenda\n${agenda}` : "",
            notesBody ? `Notes\n${notesBody}` : "",
        ]
            .filter(Boolean)
            .join("\n\n")
            .trim();
    };
    const hasTranscriptText = Boolean(activeSession?.liveTranscript.trim() || activeSession?.uploadedTranscript.trim());
    const hasWrittenCapture = Boolean((activeSession ? richTextToPlainText(activeSession.manualNotes) : "") || activeSession?.quickHighlights.trim());
    const hasAnyTextCapture = hasTranscriptText || hasWrittenCapture;
    const hasAudioOnlyVoiceCapture = activeCaptureMode === "voice-note" &&
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
        audioContextRef.current?.close().catch(() => { });
        audioContextRef.current = null;
    };
    const createMixedRecorderStream = async (streams) => {
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
    const persistAudioAttachmentForSession = async ({ sessionId, file, persistedPath, }) => {
        const latestSnapshot = await repository.loadSnapshot();
        const existingAudioAttachments = latestSnapshot.attachments.filter((entry) => entry.sessionId === sessionId && entry.kind === "audio");
        await saveAttachments([
            ...latestSnapshot.attachments.filter((entry) => !(entry.sessionId === sessionId && entry.kind === "audio")),
            fileToAttachmentRecord({
                file,
                sessionId,
                kind: "audio",
                filePath: persistedPath,
            }),
        ]);
        await Promise.all(existingAudioAttachments
            .map((attachment) => attachment.filePath)
            .filter(Boolean)
            .map((filePath) => removePersistedAttachment(filePath)));
    };
    const outputActionConfig = (() => {
        const isManualPolishMode = activeSession?.transcribeOnly === true;
        return {
            primaryLabel: isManualPolishMode ? "Polish Manual notes" : "Generate with AI",
            secondaryLabel: null,
            onPrimary: () => void handleGenerate(),
            onSecondary: undefined,
            isPrimaryRunning: isGenerating || (activeSession?.transcribeOnly ? false : isTranscribingAudio && hasAudioOnlyVoiceCapture),
            isSecondaryRunning: false,
            emptyStatePrimaryLabel: isManualPolishMode ? "Polish Manual notes" : "Generate with AI",
            emptyStateSecondaryLabel: null,
        };
    })();
    if (!isLoaded || !snapshot || !activeSession) {
        return (_jsxs("div", { className: "app-shell", children: [_jsx("div", { className: "topbar", children: _jsxs("div", { children: [_jsx("h1", { children: "NoteSmith Desktop" }), _jsx("p", { children: loadError || "Preparing the new local-first desktop foundation..." })] }) }), isLoaded && loadError ? (_jsx("main", { className: "workspace", children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Desktop startup failed" }), _jsx("p", { children: "The app could not finish loading its local services." })] }) }), _jsxs("div", { className: "stack", children: [_jsx("p", { className: "muted", children: loadError }), _jsx("p", { className: "tiny-text", children: "This is usually caused by a missing Tauri capability or a blocked plugin/database permission." })] })] }) })) : null] }));
    }
    const handleImportLegacy = async () => {
        const result = await importLegacyBrowserData();
        setStatusNote(result === "imported"
            ? "Imported current browser app data into the new desktop foundation."
            : "No current browser app data was found to import.");
    };
    const handleExportSnapshot = async () => {
        try {
            const backupBundle = buildDesktopBackupBundle();
            if (!backupBundle) {
                setStatusNote("Nothing is loaded yet to export.");
                return;
            }
            setStatusNote("Exporting backup to Downloads...");
            const result = await exportSnapshotBackupToDownloads(backupBundle);
            setStatusNote(`Exported a desktop backup file to ${result.path}.`);
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Could not export the desktop backup file.");
        }
    };
    const handleSaveSnapshotAs = async () => {
        try {
            const backupBundle = buildDesktopBackupBundle();
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
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Could not save the desktop backup file.");
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
            }
            else {
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
        }
        catch (error) {
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
        }
        catch (error) {
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
        }
        catch (error) {
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
            }
            else {
                setAvailableUpdateVersion(null);
                setManualUpdateUrl("downloadUrl" in result && result.downloadUrl ? result.downloadUrl : null);
                setUpdateStatusNote(result.note ?? "Desktop app is already up to date.");
                setStatusNote(result.note ?? "Desktop app is already up to date.");
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Could not check for updates.";
            setUpdateStatusNote(message);
            setStatusNote(message);
        }
        finally {
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
            const backupBundle = buildDesktopBackupBundle();
            const backupPath = backupBundle ? await createLocalSnapshotBackup(backupBundle) : null;
            const downloadsBackupPath = backupBundle ? await exportSnapshotBackupToDownloads(backupBundle) : null;
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
            setUpdateStatusNote(`Downloading the signed ${availableUpdateVersion} installer to Downloads...`);
            const installer = await downloadInstallerToDownloadsAndOpen(manualUpdateUrl, availableUpdateVersion);
            setUpdateStatusNote(`Downloaded and opened the ${availableUpdateVersion} installer from ${installer.path}. Close NoteSmith if Windows asks before continuing.`);
            setStatusNote(`Opened installer for update ${availableUpdateVersion}.`);
            setAvailableUpdateVersion(null);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Could not install the update.";
            setUpdateStatusNote(message);
            setStatusNote(message);
        }
        finally {
            setIsInstallingUpdate(false);
        }
    };
    const handleOpenManualUpdate = async () => {
        if (!manualUpdateUrl) {
            return;
        }
        try {
            const backupBundle = buildDesktopBackupBundle();
            if (backupBundle) {
                const backupPath = await exportSnapshotBackupToDownloads(backupBundle);
                setStatusNote(`Created a Downloads backup at ${backupPath.path} before opening the installer download.`);
            }
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
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Could not open the GitHub release page.");
        }
    };
    const handleResetTemplates = async () => {
        await resetTemplates();
        setStatusNote("Restored the default built-in templates.");
    };
    const readVisibleCaptureDraft = (session, template) => {
        const manualNotesElement = document.getElementById("manual-notes");
        const agendaElement = document.getElementById("session-agenda");
        const liveTranscriptElement = document.getElementById("session-transcript");
        const uploadedTranscriptElement = document.getElementById("session-uploaded-transcript");
        const agendaField = template.fields.find((field) => field.enabled && field.key === "agenda");
        const nextCustomFieldValues = agendaField && agendaElement instanceof HTMLDivElement
            ? {
                ...session.customFieldValues,
                [agendaField.id]: agendaElement.innerHTML,
            }
            : session.customFieldValues;
        return {
            ...session,
            manualNotes: manualNotesElement instanceof HTMLDivElement ? manualNotesElement.innerHTML : session.manualNotes,
            liveTranscript: liveTranscriptElement instanceof HTMLTextAreaElement ? liveTranscriptElement.value : session.liveTranscript,
            uploadedTranscript: uploadedTranscriptElement instanceof HTMLTextAreaElement
                ? uploadedTranscriptElement.value
                : session.uploadedTranscript,
            customFieldValues: nextCustomFieldValues,
        };
    };
    const handleCaptureSessionChange = (session) => {
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
        const currentSession = (activeSessionDraftRef.current?.id === currentSessionId ? activeSessionDraftRef.current : null) ??
            latestSnapshot?.sessions.find((session) => session.id === currentSessionId && !session.deletedAt) ??
            activeSession;
        const template = currentSession && latestSnapshot
            ? getTemplatesForCaptureMode(latestSnapshot.templates, currentSession.captureMode).find((entry) => entry.id === currentSession.templateId) ??
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
        appendGenerationLog(visibleSession.transcribeOnly ? "Manual polish started." : "AI generation started.", "info", `session: ${visibleSession.title || "Untitled session"}\ntemplate: ${template.name}`);
        setIsGenerating(true);
        let usedCache = false;
        try {
            let sessionForGeneration = visibleSession;
            activeSessionDraftRef.current = visibleSession;
            await saveSession(visibleSession);
            const shouldUseManualMode = sessionForGeneration.transcribeOnly === true;
            const sessionAttachments = (latestSnapshot?.attachments ?? activeAttachments).filter((attachment) => attachment.sessionId === sessionForGeneration.id);
            const sessionAudioAttachment = sessionAttachments.find((attachment) => attachment.kind === "audio") ?? null;
            const sessionHasTranscriptText = Boolean(sessionForGeneration.liveTranscript.trim() || sessionForGeneration.uploadedTranscript.trim());
            const hasManualOrTranscriptText = Boolean(richTextToPlainText(sessionForGeneration.manualNotes).trim() ||
                sessionForGeneration.liveTranscript.trim() ||
                sessionForGeneration.uploadedTranscript.trim());
            const sourceTextForLog = buildGenerationSourceText(sessionForGeneration, template);
            appendGenerationLog("Captured source text checked.", "info", [
                `total source characters: ${sourceTextForLog.length}`,
                `manual notes characters: ${richTextToPlainText(sessionForGeneration.manualNotes).trim().length}`,
                `live transcript characters: ${sessionForGeneration.liveTranscript.trim().length}`,
                `uploaded transcript characters: ${sessionForGeneration.uploadedTranscript.trim().length}`,
                `has text: ${hasManualOrTranscriptText ? "yes" : "no"}`,
            ].join("\n"));
            if (shouldUseManualMode && !hasManualOrTranscriptText) {
                appendGenerationLog("Manual polish stopped because no source text was found.", "warning");
                setStatusNote("Add text to Manual notes or Transcript first. This mode transfers captured text directly into Output without AI generation.");
                return;
            }
            if (!shouldUseManualMode &&
                sessionForGeneration.captureMode === "voice-note" &&
                !sessionHasTranscriptText &&
                (sessionAudioAttachment || pendingAudioBySession[sessionForGeneration.id])) {
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
                }
                finally {
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
                throw new Error("AI generation returned output that was too similar to the source transcript. No output was saved. Try again, or add an instruction such as 'summarize into concise meeting minutes and do not reproduce the transcript'.");
            }
            await saveSession({ ...sessionForGeneration, ...buildOutputVersionPatch(sessionForGeneration, output) });
            appendGenerationLog("Output saved to the session.", "success", `output characters: ${output.trim().length}`);
            setStatusNote(shouldUseManualMode
                ? "Manual notes were transferred to Output without AI generation."
                : usedCache
                    ? "Loaded structured output from a matching local AI cache entry."
                    : "Generated structured output with the desktop AI service.");
            await openMetadataReviewIfNeeded(sessionForGeneration);
            openNotesTarget({ sessionId: sessionForGeneration.id, view: "output" });
        }
        catch (error) {
            appendGenerationLog(visibleSession.transcribeOnly ? "Manual polish failed." : "Generation failed.", "error", error instanceof Error ? error.message : String(error));
            setStatusNote(visibleSession.transcribeOnly
                ? `Manual-notes transfer failed: ${error instanceof Error ? error.message : "Unknown error."}`
                : formatAIErrorMessage(error, "Generation failed."));
        }
        finally {
            setIsGenerating(false);
        }
    };
    const handleTranslate = async () => {
        let usedCache = false;
        try {
            const targetLanguage = resolveSessionOutputLanguage(activeSession) === "sv"
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
            setStatusNote(usedCache
                ? `Loaded a cached translation to ${targetLanguage}.`
                : `Translated the current output to ${targetLanguage}.`);
        }
        catch (error) {
            setStatusNote(formatAIErrorMessage(error, "Translation failed."));
        }
    };
    const handleRevise = async (instructions) => {
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
            setStatusNote(usedCache
                ? "Loaded a cached revision for the current output."
                : "Revised the current output with the desktop AI service.");
        }
        catch (error) {
            setStatusNote(formatAIErrorMessage(error, "Revision failed."));
        }
        finally {
            setIsRevising(false);
        }
    };
    const handleImportTranscript = async () => {
        const selection = await pickTranscriptFile();
        if (!selection)
            return;
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
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Transcript import failed.");
        }
    };
    const handleOpenOutputVersion = (versionId) => {
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
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Clipboard access was blocked. You can still copy the output manually.");
        }
    };
    const handleAcceptVisibleRuleSuggestion = async (suggestionId) => {
        const nextSettings = acceptRuleSuggestion(snapshot.settings, suggestionId);
        await saveSettings(nextSettings);
        setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
    };
    const handleDismissVisibleRuleSuggestion = (suggestionId) => {
        setDismissedRuleSuggestionIds((current) => Array.from(new Set([...current, suggestionId])));
    };
    const handleIgnoreVisibleRuleSuggestion = async (suggestionId) => {
        const nextSettings = ignoreRuleSuggestion(snapshot.settings, suggestionId, { forever: true });
        await saveSettings(nextSettings);
        setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
    };
    const handleOutputWorkspaceChange = async (nextSession) => {
        if (!nextSession) {
            return;
        }
        if (!activeSession) {
            await saveSession(nextSession);
            return;
        }
        if (nextSession.output !== activeSession.output) {
            const nextVersions = normalizeOutputVersionHistory(nextSession.outputVersions, activeSession.output, activeSession.updatedAt);
            if (nextVersions[0]) {
                nextVersions[0] = {
                    ...nextVersions[0],
                    output: nextSession.output,
                };
            }
            else if (nextSession.output.trim()) {
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
        if (!selection)
            return;
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
    const handleStartRecording = async (modeOverride) => {
        if (!activeSession) {
            return;
        }
        const recordingSession = activeSession;
        const recordingModeForRun = modeOverride ?? recordingMode;
        setRecordingMode(recordingModeForRun);
        if ((recordingModeForRun === "microphone" && !navigator.mediaDevices?.getUserMedia) ||
            ((recordingModeForRun === "system-audio" || recordingModeForRun === "hybrid") && !navigator.mediaDevices?.getDisplayMedia) ||
            typeof MediaRecorder === "undefined") {
            setRecordingStatusNote(`${RECORDING_MODE_LABELS[recordingModeForRun]} recording is not supported in this runtime yet.`);
            return;
        }
        try {
            cleanupRecordingResources();
            let recorderStream;
            const captureStreams = [];
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
            }
            else if (recordingModeForRun === "system-audio") {
                setRecordingStatusNote("Next, choose the Zoom/Teams window or screen and make sure audio sharing is enabled.");
                const displayStream = await navigator.mediaDevices.getDisplayMedia(getSystemAudioDisplayOptions());
                if (!displayStream.getAudioTracks().length) {
                    displayStream.getTracks().forEach((track) => track.stop());
                    throw new Error("No computer audio was shared. Start again and enable audio sharing in the capture picker.");
                }
                captureStreams.push(displayStream);
                recorderStream = await createMixedRecorderStream([displayStream]);
            }
            else {
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
                }
                catch (error) {
                    setRecordingStatusNote(error instanceof Error ? error.message : "Recording finished, but saving the audio failed.");
                }
            };
            recorder.onerror = () => {
                setRecordingStatusNote(`${RECORDING_MODE_LABELS[recordingModeForRun]} recording hit an error and could not continue.`);
            };
            mediaRecorderRef.current = recorder;
            captureStreams.forEach((stream) => {
                stream.getTracks().forEach((track) => {
                    track.addEventListener("ended", () => {
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                            mediaRecorderRef.current.stop();
                            setRecordingStatusNote(`${RECORDING_MODE_LABELS[recordingModeForRun]} capture ended.`);
                        }
                    }, { once: true });
                });
            });
            recorder.start();
            setIsRecordingAudio(true);
            setRecordingStatusNote(`Recording from ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()}...`);
            setStatusNote(`Recording from ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()}...`);
        }
        catch (error) {
            setRecordingStatusNote(error instanceof Error
                ? `Could not start ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()} recording: ${error.message}`
                : `Could not start ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()} recording.`);
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
        if (!selection)
            return;
        const persistedPath = await persistSelectedAttachment({
            sessionId: activeSession.id,
            selection,
        });
        const nextOutputPosition = activeAttachments.filter((attachment) => attachment.kind === "image").length + 1;
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
    const transcribeAudioIntoSession = async ({ sessionId, file, statusPrefix, }) => {
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
            setStatusNote(statusPrefix
                ? `${statusPrefix} The transcript was added to the live transcript field.`
                : "Audio transcription complete and added to the live transcript field.");
            setRecordingStatusNote("Transcript added to the session.");
        }
        catch (error) {
            const message = formatAIErrorMessage(error, "Audio transcription failed.");
            setStatusNote(statusPrefix ? `${statusPrefix} ${message}` : message);
            setRecordingStatusNote("Audio was saved, but transcription needs another try.");
        }
        finally {
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
    const handleRemoveAttachment = async (attachmentId) => {
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
    const handleUpdateAttachment = async (attachmentUpdates) => {
        await saveAttachments(snapshot.attachments.map((entry) => (entry.id === attachmentUpdates.id ? attachmentUpdates : entry)));
    };
    const openSettingsSection = (section) => {
        setSettingsSection(section);
        setOpenPanel("settings");
    };
    const handleWorkspaceSelection = (workspaceId, available) => {
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
    const openLinkedDestination = ({ workspace, activityId = null, todoId = null, activityDomain = null, activityProject = null, todoDomain = null, todoProject = null, timeDomain = null, timeProject = null, returnWorkspace = null, status, }) => {
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
    const openNotesTarget = ({ sessionId, view = "capture", returnWorkspace = null, calendarItemId = null, status, }) => {
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
    const openSessionFromLink = (sessionId, returnWorkspace = null, calendarItemId = null) => openNotesTarget({
        sessionId,
        view: "capture",
        returnWorkspace,
        calendarItemId,
        status: returnWorkspace === "calendar" ? "Opened linked session from Calendar. Return to Calendar when you are done." : "Opened linked session.",
    });
    const openActivityFromLink = (activityId, returnWorkspace = null) => openLinkedDestination({
        workspace: "activities",
        activityId,
        returnWorkspace,
        status: "Opened linked activity.",
    });
    const openTodoDetailFromLink = (todoId, returnWorkspace = null) => openLinkedDestination({
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
    const openCalendarOutputPreview = (sessionId) => {
        setCalendarOutputPreviewSessionId(sessionId);
        setOpenPanel("calendar-output-preview");
    };
    const openOverlay = (panel) => setOpenPanel(panel);
    const closeOverlay = () => {
        setOpenPanel(null);
        setCalendarOutputPreviewSessionId(null);
    };
    const handleCreateSessionFromTemplate = async (templateId) => {
        const template = snapshot?.templates.find((entry) => entry.id === templateId) ??
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
    const commandActions = [
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
            keywords: [session.title, session.participantText, session.domain, session.project, session.activity, session.tagsText, session.date].filter(Boolean),
            action: () => {
                setActiveSessionId(session.id);
                setActiveView("capture");
            },
        })),
    ];
    const filteredCommandActions = (() => {
        const query = commandQuery.trim().toLowerCase();
        if (!query)
            return commandActions;
        return commandActions.filter((command) => [command.label, command.description, ...command.keywords].join(" ").toLowerCase().includes(query));
    })();
    const renderOverlayContent = () => {
        switch (openPanel) {
            case "capture-details":
                return (_jsx(SessionEditor, { session: activeSession, templates: snapshot.templates, attachments: activeAttachments, presentation: "full", showPresentationActions: false, savedPeople: snapshot.settings.savedParticipants, suggestedPeople: suggestedPeople, savedProjects: snapshot.settings.savedProjects, suggestedProjects: suggestedProjects, savedDomains: snapshot.settings.savedDomains, suggestedDomains: suggestedDomains, savedActivities: snapshot.settings.savedActivities, suggestedActivities: suggestedActivities, structureOptions: structureOptions, savedTags: snapshot.settings.savedTags, suggestedTags: suggestedTags, isTranscribingAudio: isTranscribingAudio, recordingMode: recordingMode, isRecordingAudio: isRecordingAudio, recordingStatusNote: recordingStatusNote, generationLog: generationLog, onClearGenerationLog: () => setGenerationLog([]), onChange: handleCaptureSessionChange, onImportImage: () => void handleImportImage(), onImportAudio: () => void handleImportAudio(), onTranscribeAudio: () => void handleTranscribeAudio(), onChangeRecordingMode: setRecordingMode, onStartRecording: (mode) => void handleStartRecording(mode), onStopRecording: () => void handleStopRecording(), onImportTranscript: () => void handleImportTranscript(), onRemoveAttachment: (attachmentId) => void handleRemoveAttachment(attachmentId), onUpdateAttachment: (attachment) => void handleUpdateAttachment(attachment) }));
            case "output-details":
                return (_jsx(OutputWorkspace, { session: activeSession, template: activeTemplate, displayedOutput: displayedOutput, outputVersions: activeOutputVersions, selectedOutputVersionId: selectedOutputVersionId, attachments: activeAttachments, presentation: "full", showPresentationActions: false, onChange: (session) => void handleOutputWorkspaceChange(session), savedPeople: snapshot.settings.savedParticipants, suggestedPeople: suggestedPeople, savedProjects: snapshot.settings.savedProjects, suggestedProjects: suggestedProjects, savedDomains: snapshot.settings.savedDomains, suggestedDomains: suggestedDomains, savedActivities: snapshot.settings.savedActivities, suggestedActivities: suggestedActivities, structureOptions: structureOptions, savedTags: snapshot.settings.savedTags, suggestedTags: suggestedTags, isPrimaryActionRunning: outputActionConfig.isPrimaryRunning, isSecondaryActionRunning: outputActionConfig.isSecondaryRunning, isRevising: isRevising, onPrimaryAction: outputActionConfig.onPrimary, onSecondaryAction: outputActionConfig.onSecondary, onCopyOutput: () => void handleCopyOutput(), onTranslate: () => void handleTranslate(), onRevise: (instructions) => void handleRevise(instructions), onRevertOutputVersion: handleRevertOutputVersion, onOpenOutputVersion: handleOpenOutputVersion, onOpenLatestOutputVersion: handleOpenLatestOutputVersion, onExportText: () => exportOutputAsText({ title: activeSession.title, output: displayedOutput }), onExportMarkdown: () => exportOutputAsMarkdown({ title: activeSession.title, output: displayedOutput }), onExportHtml: () => exportOutputAsHtml({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId }), onExportDocx: () => void exportOutputAsDocx({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId }), onExportPdf: () => void exportOutputAsPdf({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId }), ruleSuggestions: visibleRuleSuggestions.filter((entry) => !dismissedRuleSuggestionIds.includes(entry.id)), onAcceptRuleSuggestion: (suggestionId) => void handleAcceptVisibleRuleSuggestion(suggestionId), onDismissRuleSuggestion: handleDismissVisibleRuleSuggestion, onIgnoreRuleSuggestion: (suggestionId) => void handleIgnoreVisibleRuleSuggestion(suggestionId), primaryActionLabel: outputActionConfig.primaryLabel, secondaryActionLabel: outputActionConfig.secondaryLabel, emptyStatePrimaryLabel: outputActionConfig.emptyStatePrimaryLabel, emptyStateSecondaryLabel: outputActionConfig.emptyStateSecondaryLabel, linkedActivity: activeLinkedActivity, onOpenLinkedActivity: (activityId) => openActivityFromLink(activityId, "notes"), onAddFollowUpTodo: (description, options) => void addTodo(description, {
                        ...getMeetingTodoDefaults(),
                        ...options,
                    }), onAddFollowUpMeeting: (description, options) => void addActivity(description, "meeting", options) }));
            case "calendar-output-preview": {
                const previewLines = calendarPreviewSession ? splitStructuredOutput(calendarPreviewSession.output) : [];
                return (_jsxs("div", { className: "sidebar-card overlay-card calendar-output-preview-card", children: [_jsx("div", { className: "overlay-header calendar-output-preview-header", children: _jsxs("div", { children: [_jsx("h3", { children: calendarPreviewSession?.title || "Session output" }), _jsx("p", { className: "tiny-text", children: calendarPreviewSession
                                            ? `${calendarPreviewSession.date} • ${calendarPreviewSession.startTime} to ${calendarPreviewSession.endTime}`
                                            : "Linked session preview" })] }) }), calendarPreviewSession && calendarPreviewSession.output.trim() ? (_jsx("div", { className: "calendar-output-preview-body", children: previewLines.map((line, index) => isStructuredHeading(line) ? (_jsx("h4", { children: line.replace(/:$/, "") }, `${line}-${index}`)) : (_jsx("p", { children: line }, `${line}-${index}`))) })) : (_jsxs("div", { className: "card", children: [_jsx("h4", { children: "No output yet" }), _jsx("p", { className: "muted", children: "Generate output in the linked session first, then return here to preview it." })] }))] }));
            }
            case "sessions":
                return (_jsx(SessionsSidebar, { sessions: snapshot.sessions, activeSessionId: activeSession.id, onSelect: (id) => {
                        setActiveSessionId(id);
                        closeOverlay();
                    }, onCreate: () => openOverlay("new-note"), onDelete: (id) => void deleteSession(id), onRestore: (id) => void restoreSession(id), onDeleteForever: (id) => void permanentlyDeleteSession(id) }));
            case "new-note":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "New session" }), _jsx("p", { children: "Choose the type of session you want to start." })] }), _jsx("div", { className: "session-quick-start-row", children: _jsx("div", { className: "session-template-pill-row", children: quickStartTemplates.map((template) => (_jsx("button", { type: "button", className: "segment-button session-template-pill", onClick: () => void handleCreateSessionFromTemplate(template.id), children: `New ${template.name}` }, template.id))) }) })] }));
            case "instructions":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Notes instructions" }), _jsx("p", { children: "Desktop Notes now follows the same calmer session workflow as the PWA, while keeping the stronger native desktop capture options." })] }), _jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Starting sessions" }), _jsx("span", { className: "muted", children: "Start directly with the session type you want. Use New Meeting, New Quick note, or New 1:1 / Phone call to jump straight into capture." })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Capture" }), _jsx("span", { className: "muted", children: "Keep Details, People, transcript, and context folded away until needed. Manual notes stay central so the main writing surface is always easy to reach." })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Recording" }), _jsx("span", { className: "muted", children: "Use room or hybrid capture when the space hears everything through microphones and speakers. Use direct computer audio when you need native in-computer sound from this device." })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Output" }), _jsx("span", { className: "muted", children: "Generate, translate, export, and revise from the action row first. The Output document stays below, with follow-up work and details folded into calmer sections." })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Technical design" }), _jsx("span", { className: "muted", children: "The desktop app runs in Tauri with React, TypeScript, local SQLite-backed storage, OpenAI text generation, and desktop-native recording, file, and export flows." })] })] })] }));
            case "metadata-review":
                const hasPeopleSuggestions = metadataSuggestions.people.length > 0;
                const hasNonPeopleSuggestions = metadataSuggestions.domains.length > 0 ||
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
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: reviewTitle }), _jsx("p", { children: reviewDescription })] }), [
                            { key: "people", label: "People", helper: "Save these names to reuse in future notes and participant pickers." },
                            { key: "domains", label: "Domains", helper: "Save these top-level business areas for future notes." },
                            { key: "projects", label: "Projects", helper: "Save these projects to reuse in future notes." },
                            { key: "activities", label: "Activities", helper: "Save these activities to reuse in future notes." },
                        ].map((section) => metadataSuggestions[section.key].length ? (_jsxs("div", { className: "section-divider", children: [_jsx("strong", { children: section.label }), _jsx("div", { className: "section-list", children: metadataSuggestions[section.key].map((value) => (_jsxs("label", { className: "list-item checkbox-label", children: [_jsx("input", { type: "checkbox", checked: selectedMetadataSuggestions[section.key].includes(value), onChange: (event) => setSelectedMetadataSuggestions((current) => ({
                                                    ...current,
                                                    [section.key]: event.target.checked
                                                        ? Array.from(new Set([...current[section.key], value]))
                                                        : current[section.key].filter((entry) => entry !== value),
                                                })) }), _jsxs("span", { children: [_jsx("strong", { children: value }), _jsx("span", { className: "muted", children: section.helper })] })] }, `${section.key}-${value}`))) })] }, section.key)) : null), activeRuleSuggestions.length ? (_jsxs("div", { className: "section-divider", children: [_jsx("strong", { children: "Suggested rules" }), _jsx("div", { className: "section-list", children: activeRuleSuggestions.map((suggestion) => (_jsxs("div", { className: "list-item", children: [_jsxs("span", { children: [_jsx("strong", { children: suggestion.type === "abbreviation" ? "Suggested abbreviation" : "Preferred participant name" }), _jsx("span", { className: "muted", children: `${suggestion.sourceValue} -> ${suggestion.suggestedValue} · Seen ${suggestion.evidenceCount} times` })] }), _jsxs("div", { className: "list-item-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                            const nextSettings = acceptRuleSuggestion(snapshot.settings, suggestion.id);
                                                            void saveSettings(nextSettings);
                                                            setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestion.id));
                                                        }, children: "Add" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setDismissedRuleSuggestionIds((current) => Array.from(new Set([...current, suggestion.id]))), children: "Not now" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => {
                                                            const nextSettings = ignoreRuleSuggestion(snapshot.settings, suggestion.id, { forever: true });
                                                            void saveSettings(nextSettings);
                                                            setVisibleRuleSuggestions((current) => current.filter((entry) => entry.id !== suggestion.id));
                                                        }, children: "Never suggest" })] })] }, suggestion.id))) })] })) : null, _jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                        const nextSettings = { ...snapshot.settings };
                                        if (selectedMetadataSuggestions.people.length) {
                                            nextSettings.savedParticipants = Array.from(new Set([...nextSettings.savedParticipants, ...selectedMetadataSuggestions.people])).sort();
                                        }
                                        if (selectedMetadataSuggestions.domains.length) {
                                            nextSettings.savedDomains = Array.from(new Set([...nextSettings.savedDomains, ...selectedMetadataSuggestions.domains])).sort();
                                        }
                                        if (selectedMetadataSuggestions.projects.length) {
                                            nextSettings.savedProjects = Array.from(new Set([...nextSettings.savedProjects, ...selectedMetadataSuggestions.projects])).sort();
                                        }
                                        if (selectedMetadataSuggestions.activities.length) {
                                            nextSettings.savedActivities = Array.from(new Set([...nextSettings.savedActivities, ...selectedMetadataSuggestions.activities])).sort();
                                        }
                                        const totalAdded = Object.values(selectedMetadataSuggestions).reduce((sum, values) => sum + values.length, 0);
                                        if (totalAdded) {
                                            void saveSettings({
                                                ...nextSettings,
                                            });
                                            setStatusNote(totalAdded === 1
                                                ? "Added 1 reusable value."
                                                : `Added ${totalAdded} reusable values.`);
                                        }
                                        setMetadataSuggestions(EMPTY_METADATA_REVIEW);
                                        setSelectedMetadataSuggestions(EMPTY_METADATA_REVIEW);
                                        closeOverlay();
                                    }, children: "Save selected" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setSelectedMetadataSuggestions(metadataSuggestions), children: "Select all" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                        setMetadataSuggestions(EMPTY_METADATA_REVIEW);
                                        setSelectedMetadataSuggestions(EMPTY_METADATA_REVIEW);
                                        closeOverlay();
                                    }, children: "Not now" })] })] }));
            case "settings":
                return (_jsx(SettingsCard, { initialSection: settingsSection, settings: snapshot.settings, templates: snapshot.templates, onChange: (settings) => void saveSettings(settings), onSaveTemplate: (template) => void saveTemplate(template), onResetTemplates: handleResetTemplates, onImportLegacy: handleImportLegacy, onImportBackup: handleImportBackup, onCheckForUpdates: handleCheckForUpdates, onInstallUpdate: handleInstallUpdate, onOpenManualUpdate: handleOpenManualUpdate, onOpenDataFolder: handleOpenDataFolder, onOpenDatabaseFolder: handleOpenDatabaseFolder, onExportBackup: handleExportSnapshot, onSaveBackupAs: handleSaveSnapshotAs, updateStatusNote: updateStatusNote, desktopVersion: desktopVersion, desktopBundleType: desktopBundleType, availableUpdateVersion: availableUpdateVersion, manualUpdateUrl: manualUpdateUrl, isCheckingForUpdates: isCheckingForUpdates, isInstallingUpdate: isInstallingUpdate, storageInfo: storageInfo, latestLocalBackupInfo: latestLocalBackupInfo, aiDiagnostics: aiDiagnostics, aiRequestHistory: aiRequestHistory, textModelOptions: modelPricingSnapshot.textModels.map(buildTextModelOption), transcriptionModelOptions: modelPricingSnapshot.transcriptionModels.map(buildTranscriptionModelOption), modelPricingStatus: modelPricingStatus, onRefreshModelPricing: () => void handleRefreshModelPricing(), isRefreshingModelPricing: isRefreshingModelPricing }));
            case "more":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "More tools" }), _jsx("p", { children: "Secondary utilities stay grouped here so the main workspace remains calm and obvious." })] }), _jsxs("div", { className: "stack", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => setActiveWorkspace("todos"), children: "Open Todos workspace" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setOpenPanel("backup"), children: "Open Back-up" }), _jsx("button", { className: "small-button", type: "button", onClick: () => openSettingsSection("other"), children: "Open Other settings" })] })] }));
            case "backup":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Back-up" }), _jsx("p", { children: "Keep backup and migration actions accessible without leaving the focused Notes workspace." })] }), _jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportLegacy(), children: "Import current browser data" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportBackup(), children: "Import backup file" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleExportSnapshot(), children: "Export backup to Downloads" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleSaveSnapshotAs(), children: "Save backup as..." }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleOpenDataFolder(), children: "Open data folder" })] }), storageInfo ? (_jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Desktop version" }), _jsx("span", { className: "muted", children: desktopVersion || "Unknown" })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Database path" }), _jsx("span", { className: "muted", children: storageInfo.databasePath })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Backups folder" }), _jsx("span", { className: "muted", children: storageInfo.backupsDir })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "Latest local safety backup" }), _jsx("span", { className: "muted", children: latestLocalBackupInfo
                                                ? `${new Date(latestLocalBackupInfo.modifiedMs).toLocaleString()}`
                                                : "No local safety backup yet" })] })] })) : null, _jsx("p", { className: "tiny-text", children: "NoteSmith creates a local safety backup automatically, including before updates. Export to Downloads or use Save backup as... when you want a copy outside the app data folder." })] }));
            default:
                return null;
        }
    };
    return (_jsxs("div", { className: "app-shell desktop-shell", "data-theme": snapshot.settings.theme, onKeyDownCapture: (event) => void handleGlobalTodoShortcut(event), children: [_jsxs("aside", { className: "workspace-rail", children: [_jsxs("div", { className: "workspace-rail-brand", children: [_jsx("strong", { children: "NoteSmith" }), _jsx("span", { className: "tiny-text", children: "Desktop" })] }), _jsxs("nav", { className: "workspace-nav", children: [PRIMARY_WORKSPACE_ITEMS.map((item) => (_jsxs("button", { type: "button", className: "workspace-nav-button", "data-active": activeWorkspace === item.id, "data-available": item.available, onClick: () => handleWorkspaceSelection(item.id, item.available), children: [_jsx("span", { children: item.label }), _jsx("small", { children: item.available ? item.description : "Coming later" })] }, item.id))), _jsx(TodosRailCard, { active: activeWorkspace === "todos", onOpen: () => setActiveWorkspace("todos") }), SECONDARY_WORKSPACE_ITEMS.map((item) => (_jsxs("button", { type: "button", className: "workspace-nav-button", "data-active": activeWorkspace === item.id, "data-available": item.available, onClick: () => handleWorkspaceSelection(item.id, item.available), children: [_jsx("span", { children: item.label }), _jsx("small", { children: item.available ? item.description : "Coming later" })] }, item.id)))] })] }), _jsxs("div", { className: "workspace-shell", children: [_jsxs("header", { className: `topbar app-header${activeWorkspace === "notes" ? " app-header-notes-pwa" : ""}${activeWorkspace === "calendar" ? " app-header-compact app-header-calendar-home" : ""}${activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen ? " app-header-compact" : ""}`, children: [_jsx("div", { className: "topbar-copy", children: activeWorkspace === "notes" ? (_jsx("div", { className: "topbar-status-strip topbar-status-strip-notes" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "topbar-eyebrow", children: "Focused workspace" }), _jsx("h1", { children: `${WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.label || "Workspace"}` }), _jsxs("div", { className: "topbar-status-strip", children: [_jsx("span", { className: `status-chip status-chip-${saveState}`, children: saveStatusLabel }), _jsx("span", { className: "status-chip", children: desktopVersion ? `v${desktopVersion}` : "Desktop" }), activeWorkspace !== "calendar" ? _jsx("span", { className: "status-chip", children: aiActivityLabel }) : null, activeWorkspace !== "calendar" ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "status-chip", children: selectedTextModelOption?.label || snapshot.settings.textModel }), _jsx("span", { className: "status-chip", children: selectedTranscriptionModelOption?.label || snapshot.settings.transcriptionModel })] })) : null, isCheckingForUpdates ? _jsx("span", { className: "status-chip", children: "Checking updates..." }) : null] }), _jsx("span", { className: "tiny-text topbar-status-note", children: statusNote })] })) }), _jsx("div", { className: "topbar-actions topbar-actions-split", children: _jsxs("div", { className: "topbar-secondary-cluster", children: [activeWorkspace === "notes" && linkedDetailReturnWorkspace === "calendar" ? (_jsx("button", { className: "primary-button", type: "button", onClick: returnFromLinkedDetail, children: "Back to Calendar" })) : null, activeWorkspace === "notes" ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "shell-button", type: "button", "aria-pressed": isNotesSessionsOpen, onClick: () => setIsNotesSessionsOpen((current) => !current), children: "Sessions" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("backup"), children: "Back-up" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("instructions"), children: "Instructions" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openSettingsSection("ai"), children: "Settings" }), _jsx("span", { className: `status-chip status-chip-${saveState}`, children: saveStatusLabel })] })) : null, activeWorkspace !== "notes" ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "shell-button", type: "button", onClick: openCommandPalette, children: "Command palette" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => void (availableUpdateVersion ? handleInstallUpdate() : handleCheckForUpdates()), children: availableUpdateVersion ? `Install ${availableUpdateVersion}` : "Check updates" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openSettingsSection("ai"), children: "Settings" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("sessions"), children: "All Sessions" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("more"), children: "More" })] })) : null] }) })] }), availableUpdateVersion ? (_jsxs("div", { className: "workspace-alert-bar", children: [_jsxs("span", { children: ["Desktop update ", availableUpdateVersion, " is available from GitHub Releases."] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => void handleInstallUpdate(), disabled: isInstallingUpdate, children: isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}` }), manualUpdateUrl ? (_jsx("button", { className: "small-button", type: "button", onClick: () => void handleOpenManualUpdate(), disabled: isInstallingUpdate, children: "Download installer" })) : null] })) : manualUpdateUrl ? (_jsxs("div", { className: "workspace-alert-bar", children: [_jsx("span", { children: updateStatusNote || "A newer desktop version is available on GitHub Releases." }), _jsx("button", { className: "primary-button", type: "button", onClick: () => void handleOpenManualUpdate(), children: "Download latest installer" })] })) : null, _jsxs("main", { className: `notes-shell${activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen ? " notes-shell-calendar-fullscreen" : ""}${activeWorkspace === "notes" && isNotesSessionsOpen ? " notes-shell-with-sessions" : ""}${activeWorkspace === "notes" ? " notes-shell-notes-mode" : ""}`, children: [_jsxs("section", { className: "workspace-canvas", children: [activeWorkspace !== "notes" && !(activeWorkspace === "calendar") ? (_jsx("div", { className: "workspace-header card", children: _jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("div", { className: "topbar-eyebrow", children: "Workspace" }), _jsx("h2", { children: WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.label || "Workspace" })] }) }) })) : null, activeWorkspace === "todos" ? (_jsx(TodosWorkspace, { todos: snapshot.todos, activities: snapshot.activities, timeLogs: snapshot.timelogs, structureOptions: structureOptions, requestedTodoId: requestedTodoId, requestedDomain: requestedTodoDomain, requestedProject: requestedTodoProject, onEditorClose: returnFromLinkedDetail, onToggle: (todo) => void saveTodo(todo), onAdd: (description, options) => void addTodo(description, options), onSave: (todo) => void saveTodo(todo), onDelete: (id) => void deleteTodo(id), onConvertToActivity: (todo) => void convertTodoToActivity(todo), onSaveTimeLog: (timeLog) => void saveTimeLog(timeLog), onDeleteTimeLog: (id) => void deleteTimeLog(id), onStartTracking: (targetType, targetId) => void startTimeTracking(targetType, targetId), onStopTracking: (targetType, targetId) => void stopTimeTracking(targetType, targetId), onOpenActivityDetail: (activityId) => openActivityFromLink(activityId, "todos") })) : activeWorkspace === "activities" ? (_jsx(ActivitiesWorkspace, { activities: snapshot.activities, todos: snapshot.todos, timeLogs: snapshot.timelogs, structureOptions: structureOptions, linkedSessionStateByActivity: linkedSessionStateByActivity, requestedActivityId: requestedActivityId, requestedDomain: requestedActivityDomain, requestedProject: requestedActivityProject, onEditorClose: returnFromLinkedDetail, onToggle: (activity) => void saveActivity(activity), onAdd: (description, type) => void addActivity(description, type), onAddChildTodo: (description, activityId) => void addTodo(description, { activityId }), onAddChildMeeting: (description, activityId) => void addActivity(description, "meeting", { parentActivityId: activityId }), onSave: (activity) => void saveActivity(activity), onDelete: (id) => void deleteActivity(id), onCreateLinkedMeetingSession: (activityId) => void ensureSessionForActivity(activityId).then((sessionId) => {
                                            if (sessionId) {
                                                openSessionFromLink(sessionId, "activities");
                                            }
                                        }), onOpenSession: (sessionId) => openSessionFromLink(sessionId, "activities"), onPreviewSessionOutput: openCalendarOutputPreview, onOpenTodoDetail: (todoId) => openTodoDetailFromLink(todoId, "activities"), onSaveTimeLog: (timeLog) => void saveTimeLog(timeLog), onDeleteTimeLog: (id) => void deleteTimeLog(id), onStartTracking: (targetType, targetId) => void startTimeTracking(targetType, targetId), onStopTracking: (targetType, targetId) => void stopTimeTracking(targetType, targetId) })) : activeWorkspace === "calendar" ? (_jsx(CalendarWorkspace, { todos: snapshot.todos, activities: snapshot.activities, timeLogs: snapshot.timelogs, calendarItems: snapshot.calendarItems ?? [], settings: snapshot.settings, structureOptions: structureOptions, linkedSessionStateByActivity: linkedSessionStateByActivity, onSaveSettings: (settings) => void saveSettings(settings), onCreateFromText: (date, startSlot, value, options) => createCalendarEntryFromText(date, startSlot, value, options), onMoveItem: (id, date, startSlot) => void moveCalendarItem(id, date, startSlot), onSaveTodo: (todo) => void saveTodo(todo), onDeleteTodo: (id) => void deleteTodo(id), onSaveActivity: (activity) => void saveActivity(activity), onDeleteActivity: (id) => void deleteActivity(id), onConvertTodoToActivity: (todo, options) => void convertTodoToActivity(todo, {
                                            type: "task",
                                            date: options.date,
                                            startTime: options.startTime,
                                            endTime: options.endTime,
                                        }), onConvertTodoToMeeting: (todo, options) => void convertTodoToActivity(todo, {
                                            type: "meeting",
                                            date: options.date,
                                            startTime: options.startTime,
                                            endTime: options.endTime,
                                        }), onUpdateCalendarItem: (id, updates) => void updateCalendarItem(id, updates), onStartTracking: (targetType, targetId) => void startTimeTracking(targetType, targetId), onStopTracking: (targetType, targetId) => void stopTimeTracking(targetType, targetId), onOpenTodoWorkspace: () => setActiveWorkspace("todos"), onOpenTodoDetail: (todoId) => openTodoDetailFromLink(todoId, "calendar"), onOpenActivityWorkspace: (activityId) => openActivityFromLink(activityId, "calendar"), onOpenActivityDetail: (activityId) => openActivityFromLink(activityId, "calendar"), onOpenSession: (sessionId, openedCalendarItemId) => {
                                            const calendarItemId = openedCalendarItemId ??
                                                snapshot.calendarItems.find((item) => {
                                                    if (item.targetType !== "activity")
                                                        return false;
                                                    const activitySessionId = linkedSessionStateByActivity[item.targetId]?.sessionId;
                                                    return activitySessionId === sessionId;
                                                })?.id ?? null;
                                            openSessionFromLink(sessionId, "calendar", calendarItemId);
                                        }, highlightedItemId: linkedCalendarReturnItemId, onCreateLinkedMeetingSession: (activityId) => void ensureSessionForActivity(activityId).then((sessionId) => {
                                            if (sessionId) {
                                                setStatusNote("Created linked meeting session.");
                                            }
                                        }), onPreviewSessionOutput: openCalendarOutputPreview, onFullScreenChange: setIsCalendarWorkspaceFullScreen })) : activeWorkspace === "time" ? (_jsx(TimeWorkspace, { todos: snapshot.todos, activities: snapshot.activities, timeLogs: snapshot.timelogs, requestedDomain: requestedTimeDomain, requestedProject: requestedTimeProject, reportPresets: snapshot.settings.timeReportPresets, onSaveTimeLog: (timeLog) => void saveTimeLog(timeLog), onDeleteTimeLog: (id) => void deleteTimeLog(id), onStartTracking: (targetType, targetId) => void startTimeTracking(targetType, targetId), onStopTracking: (targetType, targetId) => void stopTimeTracking(targetType, targetId), onOpenTodoDetail: (todoId) => openTodoDetailFromLink(todoId, "time"), onOpenActivityDetail: (activityId) => openActivityFromLink(activityId, "time"), onSaveReportPreset: (preset) => void saveSettings({
                                            ...snapshot.settings,
                                            timeReportPresets: [
                                                ...snapshot.settings.timeReportPresets.filter((entry) => entry.label !== preset.label),
                                                { ...preset, id: crypto.randomUUID() },
                                            ].sort((left, right) => left.label.localeCompare(right.label)),
                                        }), onDeleteReportPreset: (presetId) => void saveSettings({
                                            ...snapshot.settings,
                                            timeReportPresets: snapshot.settings.timeReportPresets.filter((entry) => entry.id !== presetId),
                                        }) })) : activeWorkspace === "structure" ? (_jsx(StructureWorkspace, { activities: snapshot.activities, todos: snapshot.todos, timeLogs: snapshot.timelogs, savedDomains: snapshot.settings.savedDomains, savedProjects: snapshot.settings.savedProjects, projectLinks: snapshot.settings.projectLinks, onAddDomain: (domain) => void saveSettings({
                                            ...snapshot.settings,
                                            savedDomains: Array.from(new Set([...snapshot.settings.savedDomains, domain.trim()].filter(Boolean))).sort(),
                                        }), onRenameDomain: (previousValue, nextValue) => void renameDomainValue(previousValue, nextValue), onAddProject: (project, domain) => void saveSettings({
                                            ...snapshot.settings,
                                            savedProjects: Array.from(new Set([...snapshot.settings.savedProjects, project.trim()].filter(Boolean))).sort(),
                                            projectLinks: domain.trim()
                                                ? [
                                                    ...snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                                                    { id: crypto.randomUUID(), project: project.trim(), domain: domain.trim() },
                                                ]
                                                : snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                                        }), onAddActivityToProject: (description, project, domain, type) => void addActivity(description, type, {
                                            project,
                                            domain,
                                        }), onRenameProject: (previousValue, nextValue) => void renameProjectValue(previousValue, nextValue), onAssignProjectDomain: (project, domain) => void saveSettings({
                                            ...snapshot.settings,
                                            projectLinks: domain.trim()
                                                ? [
                                                    ...snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                                                    { id: crypto.randomUUID(), project: project.trim(), domain: domain.trim() },
                                                ]
                                                : snapshot.settings.projectLinks.filter((entry) => entry.project !== project.trim()),
                                        }), onOpenActivitiesForDomain: (domain) => {
                                            openLinkedDestination({
                                                workspace: "activities",
                                                activityDomain: domain || null,
                                                returnWorkspace: "structure",
                                                status: domain ? `Opened Activities filtered to ${domain}.` : "Opened Activities.",
                                            });
                                        }, onOpenActivitiesForProject: (project) => {
                                            openLinkedDestination({
                                                workspace: "activities",
                                                activityProject: project || null,
                                                returnWorkspace: "structure",
                                                status: project ? `Opened Activities filtered to ${project}.` : "Opened Activities.",
                                            });
                                        }, onOpenTodosForDomain: (domain) => openLinkedDestination({
                                            workspace: "todos",
                                            todoDomain: domain || null,
                                            returnWorkspace: "structure",
                                            status: domain ? `Opened Todos filtered to ${domain}.` : "Opened Todos.",
                                        }), onOpenTodosForProject: (project) => openLinkedDestination({
                                            workspace: "todos",
                                            todoProject: project || null,
                                            returnWorkspace: "structure",
                                            status: project ? `Opened Todos filtered to ${project}.` : "Opened Todos.",
                                        }), onOpenTimeForDomain: (domain) => openLinkedDestination({
                                            workspace: "time",
                                            timeDomain: domain || null,
                                            returnWorkspace: "structure",
                                            status: domain ? `Opened Time filtered to ${domain}.` : "Opened Time.",
                                        }), onOpenTimeForProject: (project) => openLinkedDestination({
                                            workspace: "time",
                                            timeProject: project || null,
                                            returnWorkspace: "structure",
                                            status: project ? `Opened Time filtered to ${project}.` : "Opened Time.",
                                        }), onOpenActivityDetail: (activityId) => openActivityFromLink(activityId, "structure"), onOpenTodoDetail: (todoId) => openTodoDetailFromLink(todoId, "structure") })) : activeWorkspace === "assistant" ? (_jsx(AssistantWorkspace, { snapshot: snapshot, onOpenSettings: () => openSettingsSection("ai") })) : activeWorkspace !== "notes" ? (_jsxs("div", { className: "card empty-state-card", children: [_jsx("h2", { children: "Coming next" }), _jsx("p", { children: WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.description || "This workspace is planned for a later phase." }), _jsxs("ol", { className: "empty-state-steps", children: [_jsx("li", { children: "Return to Notes from the left rail whenever you want to work now." }), _jsx("li", { children: "Use Ctrl/Cmd+K to reach settings, sessions, and future actions quickly." }), _jsx("li", { children: "This workspace will use the same center-canvas plus right-inspector pattern when it ships." })] })] })) : (_jsxs("div", { className: "notes-pwa-workbench", children: [linkedDetailReturnWorkspace ? (_jsxs("div", { className: "notes-pwa-toolbar", children: [_jsxs("button", { className: "shell-button", type: "button", onClick: returnFromLinkedDetail, children: ["Back to ", linkedDetailReturnWorkspace === "calendar" ? "Calendar" : linkedDetailReturnWorkspace === "activities" ? "Activities" : linkedDetailReturnWorkspace === "time" ? "Time" : linkedDetailReturnWorkspace === "structure" ? "Structure" : "previous workspace"] }), activeLinkedActivity ? (_jsxs("button", { className: "shell-button", type: "button", onClick: () => openActivityFromLink(activeLinkedActivity.id, "notes"), children: ["Linked activity: ", activeLinkedActivity.description] })) : null] })) : activeLinkedActivity ? (_jsx("div", { className: "notes-pwa-toolbar", children: _jsxs("button", { className: "shell-button", type: "button", onClick: () => openActivityFromLink(activeLinkedActivity.id, "notes"), children: ["Linked activity: ", activeLinkedActivity.description] }) })) : null, _jsxs("div", { ref: notesLayoutRef, className: "notes-pwa-grid notes-pwa-grid-resizable", style: { gridTemplateColumns: `${notesCapturePaneWidth}px 12px minmax(${NOTES_PANEL_MIN_WIDTH}px, 1fr)` }, children: [_jsx("div", { className: "notes-pwa-capture", children: _jsx(SessionEditor, { session: activeSession, templates: snapshot.templates, attachments: activeAttachments, presentation: "minimal", showPresentationActions: false, savedPeople: snapshot.settings.savedParticipants, suggestedPeople: suggestedPeople, savedProjects: snapshot.settings.savedProjects, suggestedProjects: suggestedProjects, savedDomains: snapshot.settings.savedDomains, suggestedDomains: suggestedDomains, savedActivities: snapshot.settings.savedActivities, suggestedActivities: suggestedActivities, structureOptions: structureOptions, savedTags: snapshot.settings.savedTags, suggestedTags: suggestedTags, isTranscribingAudio: isTranscribingAudio, recordingMode: recordingMode, isRecordingAudio: isRecordingAudio, recordingStatusNote: recordingStatusNote, generationLog: generationLog, onClearGenerationLog: () => setGenerationLog([]), onChange: handleCaptureSessionChange, onImportImage: () => void handleImportImage(), onImportAudio: () => void handleImportAudio(), onTranscribeAudio: () => void handleTranscribeAudio(), onChangeRecordingMode: setRecordingMode, onStartRecording: (mode) => void handleStartRecording(mode), onStopRecording: () => void handleStopRecording(), onImportTranscript: () => void handleImportTranscript(), onRemoveAttachment: (attachmentId) => void handleRemoveAttachment(attachmentId), onUpdateAttachment: (attachment) => void handleUpdateAttachment(attachment), onOpenDetails: () => openOverlay("capture-details"), onCreateSessionFromTemplate: (templateId) => void handleCreateSessionFromTemplate(templateId), onOpenInstructions: () => openOverlay("instructions") }) }), _jsx("div", { className: "notes-pwa-splitter", role: "separator", "aria-orientation": "vertical", "aria-label": "Resize capture and output panels", onMouseDown: () => {
                                                            notesSplitterDraggingRef.current = true;
                                                            document.body.style.cursor = "col-resize";
                                                        } }), _jsx("div", { className: "notes-pwa-output", children: _jsx(OutputWorkspace, { session: activeSession, template: activeTemplate, displayedOutput: displayedOutput, outputVersions: activeOutputVersions, selectedOutputVersionId: selectedOutputVersionId, attachments: activeAttachments, presentation: "minimal", showPresentationActions: false, onChange: (session) => void handleOutputWorkspaceChange(session), savedPeople: snapshot.settings.savedParticipants, suggestedPeople: suggestedPeople, savedProjects: snapshot.settings.savedProjects, suggestedProjects: suggestedProjects, savedDomains: snapshot.settings.savedDomains, suggestedDomains: suggestedDomains, savedActivities: snapshot.settings.savedActivities, suggestedActivities: suggestedActivities, structureOptions: structureOptions, savedTags: snapshot.settings.savedTags, suggestedTags: suggestedTags, isPrimaryActionRunning: outputActionConfig.isPrimaryRunning, isSecondaryActionRunning: outputActionConfig.isSecondaryRunning, isRevising: isRevising, onPrimaryAction: outputActionConfig.onPrimary, onSecondaryAction: outputActionConfig.onSecondary, onCopyOutput: () => void handleCopyOutput(), onTranslate: () => void handleTranslate(), onRevise: (instructions) => void handleRevise(instructions), onRevertOutputVersion: handleRevertOutputVersion, onOpenOutputVersion: handleOpenOutputVersion, onOpenLatestOutputVersion: handleOpenLatestOutputVersion, onExportText: () => exportOutputAsText({ title: activeSession.title, output: displayedOutput }), onExportMarkdown: () => exportOutputAsMarkdown({ title: activeSession.title, output: displayedOutput }), onExportHtml: () => exportOutputAsHtml({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId }), onExportDocx: () => void exportOutputAsDocx({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId }), onExportPdf: () => void exportOutputAsPdf({ title: activeSession.title, output: displayedOutput, attachments: activeAttachments, layoutPresetId: snapshot.settings.outputLayoutPresetId }), ruleSuggestions: visibleRuleSuggestions.filter((entry) => !dismissedRuleSuggestionIds.includes(entry.id)), onAcceptRuleSuggestion: (suggestionId) => void handleAcceptVisibleRuleSuggestion(suggestionId), onDismissRuleSuggestion: handleDismissVisibleRuleSuggestion, onIgnoreRuleSuggestion: (suggestionId) => void handleIgnoreVisibleRuleSuggestion(suggestionId), primaryActionLabel: outputActionConfig.primaryLabel, secondaryActionLabel: outputActionConfig.secondaryLabel, emptyStatePrimaryLabel: outputActionConfig.emptyStatePrimaryLabel, emptyStateSecondaryLabel: outputActionConfig.emptyStateSecondaryLabel, linkedActivity: activeLinkedActivity, onOpenLinkedActivity: (activityId) => openActivityFromLink(activityId, "notes"), onAddFollowUpTodo: (description, options) => void addTodo(description, {
                                                                ...getMeetingTodoDefaults(),
                                                                ...options,
                                                            }), onAddFollowUpMeeting: (description, options) => void addActivity(description, "meeting", options) }) })] })] }))] }), !(activeWorkspace === "calendar" && isCalendarWorkspaceFullScreen) && activeWorkspace !== "notes" && activeWorkspace !== "todos" ? (_jsxs("aside", { className: "workspace-inspector stack", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { children: _jsx("h3", { children: "Notes status" }) }), activeWorkspace === "activities" || activeWorkspace === "calendar" ? (_jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => setActiveWorkspace("notes"), children: "Back to Notes" }), _jsx("button", { className: "small-button", type: "button", onClick: openCommandPalette, children: "Command palette" })] })) : (_jsx("p", { className: "tiny-text", children: "This inspector area will hold the primary tools for this workspace once it is implemented." }))] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { children: _jsx("h3", { children: "Status" }) }), _jsx("span", { className: `status-chip status-chip-${saveState}`, children: saveStatusLabel }), activeWorkspace === "activities" ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "status-chip", children: [snapshot.activities.filter((activity) => !activity.isDone).length, " open activities"] }), _jsxs("span", { className: "status-chip", children: [snapshot.activities.filter((activity) => activity.isDone).length, " completed"] })] })) : null, updateStatusNote ? _jsx("span", { className: "tiny-text topbar-status-note", children: updateStatusNote }) : null] })] })) : null, activeWorkspace === "notes" && isNotesSessionsOpen ? (_jsx("aside", { className: "notes-sessions-shelf stack", children: _jsx(SessionsSidebar, { sessions: snapshot.sessions, activeSessionId: activeSession.id, onSelect: (id) => setActiveSessionId(id), onCreate: () => openOverlay("new-note"), onClose: () => setIsNotesSessionsOpen(false), onDelete: (id) => void deleteSession(id), onRestore: (id) => void restoreSession(id), onDeleteForever: (id) => void permanentlyDeleteSession(id), compact: true, title: "Sessions" }) })) : null] })] }), isCommandPaletteOpen ? (_jsx("div", { className: "overlay-backdrop", role: "presentation", onClick: closeCommandPalette, children: _jsxs("div", { className: "overlay-surface command-palette-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsxs("div", { children: [_jsx("strong", { children: "Command palette" }), _jsx("p", { className: "tiny-text", children: "Search sessions, settings, tools, and future workspaces. Keyboard first by design." })] }), _jsx("button", { className: "small-button", type: "button", onClick: closeCommandPalette, children: "Close" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "command-query", children: "Search actions" }), _jsx("input", { id: "command-query", autoFocus: true, value: commandQuery, onChange: (event) => setCommandQuery(event.target.value), placeholder: "Try: sessions, AI settings, translate, themes, upload image" })] }), _jsxs("div", { className: "command-palette-list", children: [filteredCommandActions.slice(0, 14).map((command) => (_jsxs("button", { type: "button", className: "command-palette-item", onClick: () => {
                                        closeCommandPalette();
                                        command.action();
                                    }, children: [_jsxs("div", { children: [_jsx("strong", { children: command.label }), _jsx("p", { children: command.description })] }), command.shortcut ? _jsx("span", { className: "tiny-text", children: command.shortcut }) : null] }, command.id))), !filteredCommandActions.length ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "No matching actions" }), _jsx("span", { className: "muted", children: "Try searching by workspace, setting, or action name." })] })) : null] })] }) })) : null, openPanel ? (_jsx("div", { className: "overlay-backdrop", role: "presentation", onClick: closeOverlay, children: _jsxs("div", { className: "overlay-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsxs("div", { children: [_jsx("strong", { children: openPanel === "capture-details"
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
                                                                            : "Settings" }), _jsx("p", { className: "tiny-text", children: "Secondary tools are kept in overlays so each workspace stays focused." })] }), _jsx("button", { className: "small-button", type: "button", onClick: closeOverlay, children: "Close" })] }), renderOverlayContent()] }) })) : null] }));
};
