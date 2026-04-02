import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TEMPLATE_BY_CAPTURE_MODE } from "@notesmith/domain";
import { useDesktopStore } from "../state/useDesktopStore";
import { SessionEditor } from "../features/sessions/components/SessionEditor";
import { SessionsSidebar } from "../features/sessions/components/SessionsSidebar";
import { OutputWorkspace } from "../features/output/components/OutputWorkspace";
import { TodosCard } from "../features/todos/components/TodosCard";
import { SettingsCard } from "../features/settings/components/SettingsCard";
import { generateNotes } from "../lib/ai/services/generateNotes";
import { getAIRequestHistory, recordAIRequestHistory } from "../lib/ai/history";
import { formatAIErrorMessage } from "../lib/ai/messages";
import { getAIDiagnosticsItems, getAIMetricsSnapshot } from "../lib/ai/metrics";
import { buildModelPricingStatus, buildTextModelOption, buildTranscriptionModelOption, createDefaultModelPricingSnapshot, fetchLatestModelPricingSnapshot, isPricingRefreshDue, msUntilNextPricingCheck, } from "../lib/ai/modelPricing";
import { reviseOutput } from "../lib/ai/services/reviseOutput";
import { createAIRuntimeStatusHandler } from "../lib/ai/status";
import { transcribeAudio } from "../lib/ai/services/transcribeAudio";
import { translateOutput } from "../lib/ai/services/translateOutput";
import { checkForDesktopUpdates } from "../lib/ai/updater";
import { exportOutputAsHtml, exportOutputAsMarkdown, exportOutputAsText } from "../lib/export/exportService";
import { fileToAttachmentRecord, loadPersistedAttachmentFile, pickAudioFile, pickImageFile, pickTranscriptFile, persistGeneratedAttachment, persistSelectedAttachment, readTranscriptFile, removePersistedAttachment, } from "../lib/files/attachmentStore";
import { buildRecordingFilename, getSupportedRecordingMimeType, getSystemAudioDisplayOptions, RECORDING_MODE_LABELS, } from "../lib/files/recording";
import { parseTokenList } from "../components/peoplePickerUtils";
const WORKSPACE_ITEMS = [
    { id: "notes", label: "Notes", description: "Capture and shape structured notes", available: true },
    { id: "tasks", label: "Tasks", description: "Personal follow-up management", available: false },
    { id: "calendar", label: "Calendar", description: "Schedule and meeting context", available: false },
    { id: "assistant", label: "Assistant", description: "Future AI workflows and agents", available: false },
    { id: "files", label: "Files", description: "Documents, audio, and references", available: false },
];
const CAPTURE_MODE_UI = {
    "meeting-note": {
        label: "Meeting note",
        description: "Best for meetings, calls, and structured minutes.",
        primaryOutputLabel: "Generate meeting notes",
    },
    "quick-note": {
        label: "Quick note",
        description: "Best for fast typed notes with minimal setup.",
        primaryOutputLabel: "Create output",
        secondaryOutputLabel: "Polish with AI",
    },
    "voice-note": {
        label: "Voice note",
        description: "Best for spoken capture, dictation, and audio-first notes.",
        primaryOutputLabel: "Create output",
        secondaryOutputLabel: "Polish with AI",
    },
};
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
export const App = () => {
    const { snapshot, activeSessionId, activeView, saveState, lastSavedAt, isLoaded, loadError, load, setActiveSessionId, setActiveView, repository, saveSession, createNewSession, deleteSession, saveTodo, addTodo, deleteTodo, saveSettings, saveTemplate, importLegacyBrowserData, saveAttachments, } = useDesktopStore();
    const [activeWorkspace, setActiveWorkspace] = useState("notes");
    const [openPanel, setOpenPanel] = useState(null);
    const [settingsSection, setSettingsSection] = useState("ai");
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [commandQuery, setCommandQuery] = useState("");
    const [statusNote, setStatusNote] = useState("Ready.");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRevising, setIsRevising] = useState(false);
    const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
    const [pendingAudioBySession, setPendingAudioBySession] = useState({});
    const [recordingMode, setRecordingMode] = useState("microphone");
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [recordingStatusNote, setRecordingStatusNote] = useState(null);
    const [availableUpdateVersion, setAvailableUpdateVersion] = useState(null);
    const [installUpdate, setInstallUpdate] = useState(null);
    const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
    const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
    const [updateStatusNote, setUpdateStatusNote] = useState(null);
    const [aiDiagnostics, setAIDiagnostics] = useState(() => getAIDiagnosticsItems());
    const [aiRequestHistory, setAIRequestHistory] = useState(() => getAIRequestHistory());
    const [modelPricingSnapshot, setModelPricingSnapshot] = useState(createDefaultModelPricingSnapshot);
    const [modelPricingStatus, setModelPricingStatus] = useState(buildModelPricingStatus(createDefaultModelPricingSnapshot()));
    const [isRefreshingModelPricing, setIsRefreshingModelPricing] = useState(false);
    const [suggestedPeopleToAdd, setSuggestedPeopleToAdd] = useState([]);
    const [selectedSuggestedPeople, setSelectedSuggestedPeople] = useState([]);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const captureSourceStreamsRef = useRef([]);
    const audioContextRef = useRef(null);
    const recordingChunksRef = useRef([]);
    const recordingSessionIdRef = useRef(null);
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
            audioContextRef.current?.close().catch(() => { });
        };
    }, []);
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
                    setInstallUpdate(() => result.install);
                    setUpdateStatusNote(`Version ${result.version} is available to install.`);
                    setStatusNote(`Update available: ${result.version}`);
                }
                else {
                    setUpdateStatusNote("Desktop app is up to date.");
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
            const nextSnapshot = await refreshPricing(savedSnapshot, false);
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
    const suggestedPeople = useMemo(() => {
        if (!snapshot) {
            return [];
        }
        return rankSavedValues(snapshot.sessions, snapshot.settings.savedParticipants, (session) => parsePeopleFromSession(session.participantText));
    }, [snapshot]);
    const suggestedProjects = useMemo(() => {
        if (!snapshot) {
            return [];
        }
        return rankSavedValues(snapshot.sessions, snapshot.settings.savedProjects, (session) => (session.project ? [session.project] : []));
    }, [snapshot]);
    const suggestedDomains = useMemo(() => {
        if (!snapshot) {
            return [];
        }
        return rankSavedValues(snapshot.sessions, snapshot.settings.savedDomains, (session) => (session.domain ? [session.domain] : []));
    }, [snapshot]);
    const suggestedActivities = useMemo(() => {
        if (!snapshot) {
            return [];
        }
        return rankSavedValues(snapshot.sessions, snapshot.settings.savedActivities, (session) => (session.activity ? [session.activity] : []));
    }, [snapshot]);
    const suggestedTags = useMemo(() => {
        if (!snapshot) {
            return [];
        }
        return rankSavedValues(snapshot.sessions, snapshot.settings.savedTags, (session) => parseTokenList(session.tagsText));
    }, [snapshot]);
    const activeSession = useMemo(() => snapshot?.sessions.find((session) => session.id === activeSessionId) ?? snapshot?.sessions[0] ?? null, [activeSessionId, snapshot]);
    const activeTemplate = useMemo(() => snapshot?.templates.find((template) => template.id === activeSession?.templateId) ?? null, [activeSession, snapshot]);
    const activeCaptureMode = activeSession?.captureMode ?? "meeting-note";
    const activeAttachments = useMemo(() => snapshot?.attachments.filter((attachment) => attachment.sessionId === activeSession?.id) ?? [], [activeSession, snapshot]);
    const activeAudioAttachment = useMemo(() => activeAttachments.find((attachment) => attachment.kind === "audio") ?? null, [activeAttachments]);
    const includedOutputImages = useMemo(() => activeAttachments.filter((attachment) => attachment.kind === "image" && attachment.includeInOutput), [activeAttachments]);
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
    const createAIRuntimeHandler = ({ onCacheHit, } = {}) => createAIRuntimeStatusHandler({
        setStatus: setStatusNote,
        logEvent: (event) => {
            logAIRuntimeEvent(event);
            setAIDiagnostics(getAIDiagnosticsItems());
            setAIRequestHistory(getAIRequestHistory());
        },
        onCacheHit,
    });
    const buildRawOutput = (session = activeSession) => {
        if (!session) {
            return "";
        }
        const segments = [];
        const title = session.title.trim();
        const date = session.date.trim();
        const time = session.captureMode === "meeting-note"
            ? [session.startTime.trim(), session.endTime.trim()].filter(Boolean).join(" - ")
            : session.startTime.trim();
        const people = session.participantText.trim();
        const project = session.project.trim();
        const domain = session.domain.trim();
        const activity = session.activity.trim();
        const tags = session.tagsText.trim();
        const highlights = session.quickHighlights.trim();
        const manualNotes = session.manualNotes.trim();
        const transcript = [session.liveTranscript.trim(), session.uploadedTranscript.trim()].filter(Boolean).join("\n\n");
        if (title) {
            segments.push(title);
        }
        if (date || time || people || domain || project || activity || tags) {
            const metaLines = [
                date,
                time,
                people ? `People: ${people}` : "",
                domain ? `Domain: ${domain}` : "",
                project ? `Project: ${project}` : "",
                activity ? `Activity: ${activity}` : "",
                tags ? `Tags: ${tags}` : "",
            ].filter(Boolean);
            if (metaLines.length) {
                segments.push(metaLines.join("\n"));
            }
        }
        if (highlights) {
            segments.push(`Highlights\n${highlights}`);
        }
        if (manualNotes) {
            segments.push(session.captureMode === "quick-note" ? manualNotes : `Notes\n${manualNotes}`);
        }
        if (transcript) {
            segments.push(session.captureMode === "voice-note" ? transcript : `Transcript\n${transcript}`);
        }
        return segments.join("\n\n").trim();
    };
    const hasTranscriptText = Boolean(activeSession?.liveTranscript.trim() || activeSession?.uploadedTranscript.trim());
    const hasWrittenCapture = Boolean(activeSession?.manualNotes.trim() || activeSession?.quickHighlights.trim());
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
        if (activeCaptureMode === "meeting-note") {
            return {
                primaryLabel: "Generate meeting notes",
                secondaryLabel: null,
                onPrimary: () => void handleGenerate(),
                onSecondary: undefined,
                isPrimaryRunning: isGenerating,
                isSecondaryRunning: false,
                emptyStatePrimaryLabel: "Generate meeting notes",
                emptyStateSecondaryLabel: null,
            };
        }
        if (activeCaptureMode === "voice-note" && hasAudioOnlyVoiceCapture) {
            return {
                primaryLabel: "Transcribe to output",
                secondaryLabel: "Transcribe and polish",
                onPrimary: () => void handleCreateOutput(),
                onSecondary: () => void handleGenerate(),
                isPrimaryRunning: isTranscribingAudio,
                isSecondaryRunning: isGenerating || isTranscribingAudio,
                emptyStatePrimaryLabel: "Transcribe to output",
                emptyStateSecondaryLabel: "Transcribe and polish",
            };
        }
        return {
            primaryLabel: "Create output",
            secondaryLabel: "Polish with AI",
            onPrimary: () => void handleCreateOutput(),
            onSecondary: () => void handleGenerate(),
            isPrimaryRunning: false,
            isSecondaryRunning: isGenerating,
            emptyStatePrimaryLabel: "Create output",
            emptyStateSecondaryLabel: "Polish with AI",
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
    const handleExportSnapshot = () => {
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `notesmith-desktop-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setStatusNote("Exported a local desktop snapshot.");
    };
    const handleCheckForUpdates = async () => {
        setIsCheckingForUpdates(true);
        setUpdateStatusNote("Checking GitHub Releases for a newer desktop version...");
        try {
            const result = await checkForDesktopUpdates();
            if (result.available) {
                setAvailableUpdateVersion(result.version);
                setInstallUpdate(() => result.install);
                setUpdateStatusNote(`Version ${result.version} is available to install.`);
                setStatusNote(`Update available: ${result.version}`);
            }
            else {
                setAvailableUpdateVersion(null);
                setInstallUpdate(null);
                setUpdateStatusNote("Desktop app is already up to date.");
                setStatusNote("Desktop app is already up to date.");
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
        if (!installUpdate || !availableUpdateVersion) {
            return;
        }
        setIsInstallingUpdate(true);
        setUpdateStatusNote(`Downloading and installing version ${availableUpdateVersion}...`);
        setStatusNote(`Installing update ${availableUpdateVersion}...`);
        try {
            await installUpdate();
            setUpdateStatusNote(`Version ${availableUpdateVersion} was installed. Restart the app to finish updating.`);
            setStatusNote(`Update ${availableUpdateVersion} installed. Restart the app to finish updating.`);
            setInstallUpdate(null);
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
    const handleGenerate = async () => {
        const template = snapshot.templates.find((entry) => entry.id === activeSession.templateId);
        if (!template) {
            setStatusNote("The selected template could not be found.");
            return;
        }
        setIsGenerating(true);
        let usedCache = false;
        try {
            let sessionForGeneration = activeSession;
            if (activeCaptureMode === "voice-note" && !hasTranscriptText && (activeAudioAttachment || pendingAudioBySession[activeSession.id])) {
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
                }
                finally {
                    setIsTranscribingAudio(false);
                }
            }
            const output = await generateNotes({
                session: sessionForGeneration,
                settings: snapshot.settings,
                template,
                attachments: activeAttachments,
                onEvent: createAIRuntimeHandler({
                    onCacheHit: () => {
                        usedCache = true;
                    },
                }),
            });
            await saveSession({ ...sessionForGeneration, output });
            setStatusNote(usedCache
                ? "Loaded structured output from a matching local AI cache entry."
                : "Generated structured output with the desktop AI service.");
            const knownPeople = new Set(snapshot.settings.savedParticipants.map((entry) => entry.trim().toLocaleLowerCase()));
            const newPeople = parsePeopleFromSession(activeSession.participantText).filter((entry) => !knownPeople.has(entry.toLocaleLowerCase()));
            if (newPeople.length) {
                setSuggestedPeopleToAdd(newPeople);
                setSelectedSuggestedPeople(newPeople);
                setOpenPanel("people-review");
            }
            setActiveView("output");
        }
        catch (error) {
            setStatusNote(formatAIErrorMessage(error, "Generation failed."));
        }
        finally {
            setIsGenerating(false);
        }
    };
    const handleCreateOutput = async () => {
        if (hasAudioOnlyVoiceCapture) {
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
                const nextSession = {
                    ...activeSession,
                    liveTranscript: [activeSession.liveTranscript.trim(), transcriptText.trim()].filter(Boolean).join("\n\n"),
                };
                const rawOutput = buildRawOutput(nextSession);
                await saveSession({ ...nextSession, output: rawOutput });
                setStatusNote("Transcribed the voice note into Output without AI polishing.");
                setActiveView("output");
            }
            catch (error) {
                setStatusNote(formatAIErrorMessage(error, "Audio transcription failed."));
            }
            finally {
                setIsTranscribingAudio(false);
            }
            return;
        }
        const rawOutput = buildRawOutput(activeSession);
        if (!rawOutput) {
            setStatusNote("There is no captured note content to create Output from yet.");
            return;
        }
        await saveSession({ ...activeSession, output: rawOutput });
        setStatusNote(activeCaptureMode === "voice-note"
            ? "Created Output from the current voice note without AI polishing."
            : "Created Output from the current note without AI polishing.");
        setActiveView("output");
    };
    const handleTranslate = async () => {
        let usedCache = false;
        try {
            const targetLanguage = snapshot.settings.outputLanguage === "sv"
                ? "Swedish"
                : snapshot.settings.outputLanguage === "en"
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
            await saveSession({ ...activeSession, output: translated });
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
                settings: snapshot.settings,
                onEvent: createAIRuntimeHandler({
                    onCacheHit: () => {
                        usedCache = true;
                    },
                }),
            });
            await saveSession({ ...activeSession, output: revised });
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
    const handleStartRecording = async () => {
        if (!activeSession) {
            return;
        }
        const recordingSession = activeSession;
        const recordingModeForRun = recordingMode;
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
                    setRecordingStatusNote(`Recorded ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()} into the current session. You can transcribe it next.`);
                    setStatusNote(`Recorded ${RECORDING_MODE_LABELS[recordingModeForRun].toLocaleLowerCase()} into the current session.`);
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
    const handleTranscribeAudio = async () => {
        const file = await getAudioFileForActiveSession();
        if (!file) {
            setStatusNote("Record or upload audio for this session first, then transcribe it.");
            return;
        }
        setIsTranscribingAudio(true);
        try {
            const transcriptText = await transcribeAudio({
                file,
                settings: snapshot.settings,
                onEvent: createAIRuntimeHandler(),
            });
            const nextTranscript = [activeSession.liveTranscript.trim(), transcriptText.trim()].filter(Boolean).join("\n\n");
            await saveSession({ ...activeSession, liveTranscript: nextTranscript });
            setStatusNote("Audio transcription complete and added to the live transcript field.");
        }
        catch (error) {
            setStatusNote(formatAIErrorMessage(error, "Audio transcription failed."));
        }
        finally {
            setIsTranscribingAudio(false);
        }
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
        setActiveWorkspace(workspaceId);
        if (!available) {
            setStatusNote(`${WORKSPACE_ITEMS.find((item) => item.id === workspaceId)?.label ?? "Workspace"} is planned next. The shell already keeps its place so the app can grow without changing navigation patterns.`);
        }
    };
    const openOverlay = (panel) => setOpenPanel(panel);
    const closeOverlay = () => setOpenPanel(null);
    const handleCreateSessionFromMode = async (captureMode) => {
        await createNewSession({
            captureMode,
            templateId: DEFAULT_TEMPLATE_BY_CAPTURE_MODE[captureMode],
        });
        setStatusNote(`Started a new ${CAPTURE_MODE_UI[captureMode].label.toLowerCase()} session.`);
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
            description: "Choose Meeting note, Quick note, or Voice note.",
            keywords: ["create session note capture meeting quick voice"],
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
            action: () => openOverlay("todos"),
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
        ...snapshot.sessions.slice(0, 8).map((session) => ({
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
            case "sessions":
                return (_jsx(SessionsSidebar, { sessions: snapshot.sessions, activeSessionId: activeSession.id, onSelect: (id) => {
                        setActiveSessionId(id);
                        closeOverlay();
                    }, onCreate: () => openOverlay("new-note"), onDelete: (id) => void deleteSession(id) }));
            case "new-note":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Choose note type" }), _jsx("p", { children: "Pick the workflow first. Templates then refine the structure inside that mode." })] }), _jsx("div", { className: "capture-mode-switch overlay-mode-switch", children: Object.keys(CAPTURE_MODE_UI).map((captureMode) => (_jsxs("button", { type: "button", className: "capture-mode-card", onClick: () => void handleCreateSessionFromMode(captureMode), children: [_jsx("strong", { children: CAPTURE_MODE_UI[captureMode].label }), _jsx("span", { children: CAPTURE_MODE_UI[captureMode].description })] }, captureMode))) })] }));
            case "people-review":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Save new people to People?" }), _jsx("p", { children: "These names were used in this note but are not yet saved in the People database. Save the ones you want available for future search and quick selection." })] }), _jsx("div", { className: "section-list", children: suggestedPeopleToAdd.map((person) => (_jsxs("label", { className: "list-item checkbox-label", children: [_jsx("input", { type: "checkbox", checked: selectedSuggestedPeople.includes(person), onChange: (event) => setSelectedSuggestedPeople((current) => event.target.checked ? Array.from(new Set([...current, person])) : current.filter((entry) => entry !== person)) }), _jsxs("span", { children: [_jsx("strong", { children: person }), _jsx("span", { className: "muted", children: "Currently only in this note. Save it to reuse in future notes." })] })] }, person))) }), _jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                        if (selectedSuggestedPeople.length) {
                                            void saveSettings({
                                                ...snapshot.settings,
                                                savedParticipants: Array.from(new Set([...snapshot.settings.savedParticipants, ...selectedSuggestedPeople])).sort(),
                                            });
                                            setStatusNote(selectedSuggestedPeople.length === 1
                                                ? `Added ${selectedSuggestedPeople[0]} to People.`
                                                : `Added ${selectedSuggestedPeople.length} people to People.`);
                                        }
                                        setSuggestedPeopleToAdd([]);
                                        setSelectedSuggestedPeople([]);
                                        closeOverlay();
                                    }, children: "Save selected to People" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setSelectedSuggestedPeople(suggestedPeopleToAdd), children: "Select all" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                        setSuggestedPeopleToAdd([]);
                                        setSelectedSuggestedPeople([]);
                                        closeOverlay();
                                    }, children: "Not now" })] })] }));
            case "todos":
                return (_jsx(TodosCard, { todos: snapshot.todos, onToggle: (todo) => void saveTodo(todo), onAdd: (description) => void addTodo(description), onDelete: (id) => void deleteTodo(id) }));
            case "settings":
                return (_jsx(SettingsCard, { initialSection: settingsSection, settings: snapshot.settings, templates: snapshot.templates, onChange: (settings) => void saveSettings(settings), onSaveTemplate: (template) => void saveTemplate(template), onImportLegacy: handleImportLegacy, onCheckForUpdates: handleCheckForUpdates, updateStatusNote: updateStatusNote, aiDiagnostics: aiDiagnostics, aiRequestHistory: aiRequestHistory, textModelOptions: modelPricingSnapshot.textModels.map(buildTextModelOption), transcriptionModelOptions: modelPricingSnapshot.transcriptionModels.map(buildTranscriptionModelOption), modelPricingStatus: modelPricingStatus, onRefreshModelPricing: () => void handleRefreshModelPricing(), isRefreshingModelPricing: isRefreshingModelPricing }));
            case "more":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "More tools" }), _jsx("p", { children: "Secondary utilities stay grouped here so the main workspace remains calm and obvious." })] }), _jsxs("div", { className: "stack", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => setOpenPanel("todos"), children: "Open To-dos" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setOpenPanel("backup"), children: "Open Back-up" }), _jsx("button", { className: "small-button", type: "button", onClick: () => openSettingsSection("other"), children: "Open Other settings" })] })] }));
            case "backup":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Back-up" }), _jsx("p", { children: "Keep backup and migration actions accessible without leaving the focused Notes workspace." })] }), _jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportLegacy(), children: "Import current browser data" }), _jsx("button", { className: "small-button", type: "button", onClick: handleExportSnapshot, children: "Export snapshot" })] }), _jsx("p", { className: "tiny-text", children: "This backup area stays separate from the main workspace so capture and output remain clear and uncluttered." })] }));
            default:
                return null;
        }
    };
    return (_jsxs("div", { className: "app-shell desktop-shell", "data-theme": snapshot.settings.theme, children: [_jsxs("aside", { className: "workspace-rail", children: [_jsxs("div", { className: "workspace-rail-brand", children: [_jsx("strong", { children: "NoteSmith" }), _jsx("span", { className: "tiny-text", children: "Desktop" })] }), _jsx("nav", { className: "workspace-nav", children: WORKSPACE_ITEMS.map((item) => (_jsxs("button", { type: "button", className: "workspace-nav-button", "data-active": activeWorkspace === item.id, "data-available": item.available, onClick: () => handleWorkspaceSelection(item.id, item.available), children: [_jsx("span", { children: item.label }), _jsx("small", { children: item.available ? item.description : "Coming later" })] }, item.id))) })] }), _jsxs("div", { className: "workspace-shell", children: [_jsxs("header", { className: "topbar app-header", children: [_jsxs("div", { className: "topbar-copy", children: [_jsx("div", { className: "topbar-eyebrow", children: "Focused workspace" }), _jsx("h1", { children: activeWorkspace === "notes" ? "Notes workspace" : `${WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.label || "Workspace"}` }), _jsx("p", { children: statusNote }), _jsxs("div", { className: "topbar-status-strip", children: [_jsx("span", { className: `status-chip status-chip-${saveState}`, children: saveStatusLabel }), _jsx("span", { className: "status-chip", children: aiActivityLabel }), _jsx("span", { className: "status-chip", children: snapshot.settings.apiKey ? "AI key local-only" : "Add API key" }), isCheckingForUpdates ? _jsx("span", { className: "status-chip", children: "Checking updates..." }) : null] })] }), _jsxs("div", { className: "topbar-actions topbar-actions-split", children: [activeWorkspace === "notes" ? (_jsx("button", { className: "primary-button", type: "button", onClick: () => openOverlay("new-note"), children: "New note" })) : null, _jsxs("div", { className: "topbar-secondary-cluster", children: [_jsx("button", { className: "shell-button", type: "button", onClick: openCommandPalette, children: "Command palette" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("sessions"), children: "All Sessions" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openSettingsSection("ai"), children: "Settings" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("more"), children: "More" })] })] })] }), availableUpdateVersion ? (_jsxs("div", { className: "workspace-alert-bar", children: [_jsxs("span", { children: ["Desktop update ", availableUpdateVersion, " is available from GitHub Releases."] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => void handleInstallUpdate(), disabled: isInstallingUpdate, children: isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}` })] })) : null, _jsxs("main", { className: "notes-shell", children: [_jsxs("section", { className: "workspace-canvas", children: [_jsxs("div", { className: "workspace-header card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h2", { children: activeWorkspace === "notes"
                                                                    ? activeView === "capture"
                                                                        ? CAPTURE_MODE_UI[activeCaptureMode].label
                                                                        : `${CAPTURE_MODE_UI[activeCaptureMode].label} output`
                                                                    : WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.label || "Workspace" }), _jsx("p", { children: activeWorkspace === "notes"
                                                                    ? activeView === "capture"
                                                                        ? `${CAPTURE_MODE_UI[activeCaptureMode].description} Secondary tools stay in the inspector or overlays so the center canvas stays calm.`
                                                                        : "Shape and export polished notes here. AI and export controls stay nearby without crowding the document."
                                                                    : "This workspace placeholder already follows the same shell structure so the product can grow without changing how navigation works." })] }), _jsx("div", { className: "page-actions", children: _jsxs("div", { className: "view-switch", children: [_jsx("button", { className: "segment-button", "data-active": activeView === "capture", type: "button", onClick: () => setActiveView("capture"), disabled: activeWorkspace !== "notes", children: "Capture" }), _jsx("button", { className: "segment-button", "data-active": activeView === "output", type: "button", onClick: () => setActiveView("output"), disabled: activeWorkspace !== "notes", children: "Output" })] }) })] }), _jsx("div", { className: "workspace-guide-row", children: _jsx("span", { className: "tiny-text", children: "Shortcuts: Ctrl/Cmd+K command palette, Ctrl/Cmd+N new session, Alt+1/2 switch views, Ctrl/Cmd+Enter primary output action." }) })] }), activeWorkspace !== "notes" ? (_jsxs("div", { className: "card empty-state-card", children: [_jsx("h2", { children: "Coming next" }), _jsx("p", { children: WORKSPACE_ITEMS.find((item) => item.id === activeWorkspace)?.description || "This workspace is planned for a later phase." }), _jsxs("ol", { className: "empty-state-steps", children: [_jsx("li", { children: "Return to Notes from the left rail whenever you want to work now." }), _jsx("li", { children: "Use Ctrl/Cmd+K to reach settings, sessions, and future actions quickly." }), _jsx("li", { children: "This workspace will use the same center-canvas plus right-inspector pattern when it ships." })] })] })) : activeView === "capture" ? (_jsx(SessionEditor, { session: activeSession, templates: snapshot.templates, attachments: activeAttachments, savedPeople: snapshot.settings.savedParticipants, suggestedPeople: suggestedPeople, savedProjects: snapshot.settings.savedProjects, suggestedProjects: suggestedProjects, savedDomains: snapshot.settings.savedDomains, suggestedDomains: suggestedDomains, savedActivities: snapshot.settings.savedActivities, suggestedActivities: suggestedActivities, savedTags: snapshot.settings.savedTags, suggestedTags: suggestedTags, isTranscribingAudio: isTranscribingAudio, recordingMode: recordingMode, isRecordingAudio: isRecordingAudio, recordingStatusNote: recordingStatusNote, onChange: (session) => void saveSession(session), onImportImage: () => void handleImportImage(), onImportAudio: () => void handleImportAudio(), onTranscribeAudio: () => void handleTranscribeAudio(), onChangeRecordingMode: setRecordingMode, onStartRecording: () => void handleStartRecording(), onStopRecording: () => void handleStopRecording(), onImportTranscript: () => void handleImportTranscript(), onRemoveAttachment: (attachmentId) => void handleRemoveAttachment(attachmentId), onUpdateAttachment: (attachment) => void handleUpdateAttachment(attachment) })) : (_jsx(OutputWorkspace, { session: activeSession, attachments: activeAttachments, onChange: (session) => void saveSession(session), isPrimaryActionRunning: outputActionConfig.isPrimaryRunning, isSecondaryActionRunning: outputActionConfig.isSecondaryRunning, isRevising: isRevising, onPrimaryAction: outputActionConfig.onPrimary, onSecondaryAction: outputActionConfig.onSecondary, onTranslate: () => void handleTranslate(), onRevise: (instructions) => void handleRevise(instructions), onExportText: () => exportOutputAsText({ title: activeSession.title, output: activeSession.output }), onExportMarkdown: () => exportOutputAsMarkdown({ title: activeSession.title, output: activeSession.output }), onExportHtml: () => exportOutputAsHtml({ title: activeSession.title, output: activeSession.output }), primaryActionLabel: outputActionConfig.primaryLabel, secondaryActionLabel: outputActionConfig.secondaryLabel, emptyStatePrimaryLabel: outputActionConfig.emptyStatePrimaryLabel, emptyStateSecondaryLabel: outputActionConfig.emptyStateSecondaryLabel }))] }), _jsxs("aside", { className: "workspace-inspector stack", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { children: _jsx("h3", { children: "Current session" }) }), _jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.title || "Untitled session" }), _jsxs("span", { className: "muted", children: [CAPTURE_MODE_UI[activeCaptureMode].label, " \u00B7 ", activeTemplate?.name ?? "No template selected"] })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.date || "No date set" }), _jsxs("span", { className: "muted", children: [activeSession.startTime || "--:--", " to ", activeSession.endTime || "--:--"] })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.participantText || (activeCaptureMode === "meeting-note" ? "No people yet" : "Optional people context") }), _jsx("span", { className: "muted", children: "People" })] }), activeSession.project ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.project }), _jsx("span", { className: "muted", children: "Project" })] })) : null, activeSession.domain ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.domain }), _jsx("span", { className: "muted", children: "Domain" })] })) : null, activeSession.activity ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.activity }), _jsx("span", { className: "muted", children: "Activity" })] })) : null, activeSession.tagsText ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.tagsText }), _jsx("span", { className: "muted", children: "Tags" })] })) : null, _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: includedOutputImages.length }), _jsx("span", { className: "muted", children: "Images staged for polished output" })] })] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { children: _jsx("h3", { children: "AI visibility" }) }), _jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: selectedTextModelOption?.label || snapshot.settings.textModel }), _jsx("span", { className: "muted", children: "Text model for generation, revision, and translation" })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: selectedTranscriptionModelOption?.label || snapshot.settings.transcriptionModel }), _jsx("span", { className: "muted", children: "Transcription model" })] }), _jsx("div", { className: "list-item", children: _jsx("strong", { children: snapshot.settings.apiKey ? "API key configured" : "No API key set yet" }) })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => openSettingsSection("ai"), children: "Open AI settings" })] }), _jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: activeView === "capture" ? "Capture tools" : "Output tools" }), _jsx("p", { children: activeView === "capture"
                                                            ? activeCaptureMode === "meeting-note"
                                                                ? "Meeting imports, transcript tools, and supporting media stay here."
                                                                : activeCaptureMode === "voice-note"
                                                                    ? "Voice capture, transcription, and audio-first actions stay here."
                                                                    : "Quick note capture stays minimal in the center; supporting imports stay here."
                                                            : "Primary output stays in the center. AI and export actions stay here." })] }), activeWorkspace === "notes" && activeView === "capture" ? (_jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportImage(), children: "Upload image" }), activeCaptureMode !== "quick-note" ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void (isRecordingAudio ? handleStopRecording() : handleStartRecording()), children: isRecordingAudio ? "Stop recording" : "Record audio" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportAudio(), children: "Upload audio" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleTranscribeAudio(), children: isTranscribingAudio ? "Transcribing..." : "Transcribe audio" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportTranscript(), children: "Upload transcript" })] })) : (_jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportTranscript(), children: "Upload note text" }))] })) : activeWorkspace === "notes" ? (_jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: outputActionConfig.onPrimary, disabled: outputActionConfig.isPrimaryRunning, children: outputActionConfig.isPrimaryRunning ? `${outputActionConfig.primaryLabel}...` : outputActionConfig.primaryLabel }), outputActionConfig.secondaryLabel && outputActionConfig.onSecondary ? (_jsx("button", { className: "small-button", type: "button", onClick: outputActionConfig.onSecondary, disabled: outputActionConfig.isSecondaryRunning, children: outputActionConfig.isSecondaryRunning ? `${outputActionConfig.secondaryLabel}...` : outputActionConfig.secondaryLabel })) : null, _jsx("button", { className: "small-button", type: "button", onClick: () => void handleTranslate(), children: "Translate" }), _jsxs("details", { className: "inspector-disclosure", children: [_jsx("summary", { children: "More output actions" }), _jsxs("div", { className: "stack", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => exportOutputAsText({ title: activeSession.title, output: activeSession.output }), children: "Export text" }), _jsx("button", { className: "small-button", type: "button", onClick: () => exportOutputAsMarkdown({ title: activeSession.title, output: activeSession.output }), children: "Export markdown" }), _jsx("button", { className: "small-button", type: "button", onClick: () => exportOutputAsHtml({ title: activeSession.title, output: activeSession.output }), children: "Export HTML" })] })] })] })) : (_jsx("p", { className: "tiny-text", children: "This inspector area will hold the primary tools for this workspace once it is implemented." }))] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { children: _jsx("h3", { children: "System status" }) }), _jsx("span", { className: `status-chip status-chip-${saveState}`, children: saveStatusLabel }), _jsxs("span", { className: "status-chip", children: [activeAttachments.length, " attachment", activeAttachments.length === 1 ? "" : "s"] }), _jsxs("span", { className: "status-chip", children: [activeTemplate?.sections.length ?? 0, " output section", (activeTemplate?.sections.length ?? 0) === 1 ? "" : "s"] }), updateStatusNote ? _jsx("p", { className: "tiny-text", children: updateStatusNote }) : null] })] })] })] }), isCommandPaletteOpen ? (_jsx("div", { className: "overlay-backdrop", role: "presentation", onClick: closeCommandPalette, children: _jsxs("div", { className: "overlay-surface command-palette-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsxs("div", { children: [_jsx("strong", { children: "Command palette" }), _jsx("p", { className: "tiny-text", children: "Search sessions, settings, tools, and future workspaces. Keyboard first by design." })] }), _jsx("button", { className: "small-button", type: "button", onClick: closeCommandPalette, children: "Close" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "command-query", children: "Search actions" }), _jsx("input", { id: "command-query", autoFocus: true, value: commandQuery, onChange: (event) => setCommandQuery(event.target.value), placeholder: "Try: sessions, AI settings, translate, themes, upload image" })] }), _jsxs("div", { className: "command-palette-list", children: [filteredCommandActions.slice(0, 14).map((command) => (_jsxs("button", { type: "button", className: "command-palette-item", onClick: () => {
                                        closeCommandPalette();
                                        command.action();
                                    }, children: [_jsxs("div", { children: [_jsx("strong", { children: command.label }), _jsx("p", { children: command.description })] }), command.shortcut ? _jsx("span", { className: "tiny-text", children: command.shortcut }) : null] }, command.id))), !filteredCommandActions.length ? (_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: "No matching actions" }), _jsx("span", { className: "muted", children: "Try searching by workspace, setting, or action name." })] })) : null] })] }) })) : null, openPanel ? (_jsx("div", { className: "overlay-backdrop", role: "presentation", onClick: closeOverlay, children: _jsxs("div", { className: "overlay-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsxs("div", { children: [_jsx("strong", { children: openPanel === "sessions"
                                                ? "All Sessions"
                                                : openPanel === "new-note"
                                                    ? "New note"
                                                    : openPanel === "people-review"
                                                        ? "People"
                                                        : openPanel === "todos"
                                                            ? "To-dos"
                                                            : openPanel === "backup"
                                                                ? "Back-up"
                                                                : openPanel === "more"
                                                                    ? "More tools"
                                                                    : "Settings" }), _jsx("p", { className: "tiny-text", children: "Secondary tools are kept in overlays so each workspace stays focused." })] }), _jsx("button", { className: "small-button", type: "button", onClick: closeOverlay, children: "Close" })] }), renderOverlayContent()] }) })) : null] }));
};
