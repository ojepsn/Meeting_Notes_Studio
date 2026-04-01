import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useDesktopStore } from "../state/useDesktopStore";
import { SessionEditor } from "../features/sessions/components/SessionEditor";
import { SessionsSidebar } from "../features/sessions/components/SessionsSidebar";
import { OutputWorkspace } from "../features/output/components/OutputWorkspace";
import { TemplatesCard } from "../features/templates/components/TemplatesCard";
import { TodosCard } from "../features/todos/components/TodosCard";
import { SettingsCard } from "../features/settings/components/SettingsCard";
import { generateNotes } from "../lib/ai/services/generateNotes";
import { reviseOutput } from "../lib/ai/services/reviseOutput";
import { transcribeAudio } from "../lib/ai/services/transcribeAudio";
import { translateOutput } from "../lib/ai/services/translateOutput";
import { checkForDesktopUpdates } from "../lib/ai/updater";
import { exportOutputAsHtml, exportOutputAsMarkdown, exportOutputAsText } from "../lib/export/exportService";
import { fileToAttachmentRecord, pickAudioFile, pickTranscriptFile, persistSelectedAttachment, readTranscriptFile, removePersistedAttachment, } from "../lib/files/attachmentStore";
const WORKSPACE_ITEMS = [
    { id: "notes", label: "Notes", description: "Capture and shape structured notes", available: true },
    { id: "tasks", label: "Tasks", description: "Personal follow-up management", available: false },
    { id: "calendar", label: "Calendar", description: "Schedule and meeting context", available: false },
    { id: "assistant", label: "Assistant", description: "Future AI workflows and agents", available: false },
    { id: "files", label: "Files", description: "Documents, audio, and references", available: false },
];
export const App = () => {
    const { snapshot, activeSessionId, activeView, isLoaded, loadError, load, setActiveSessionId, setActiveView, saveSession, createNewSession, deleteSession, saveTodo, addTodo, deleteTodo, saveSettings, saveTemplate, importLegacyBrowserData, saveAttachments, } = useDesktopStore();
    const [activeWorkspace, setActiveWorkspace] = useState("notes");
    const [openPanel, setOpenPanel] = useState(null);
    const [statusNote, setStatusNote] = useState("Core desktop foundation ready for migration.");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRevising, setIsRevising] = useState(false);
    const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
    const [pendingAudioBySession, setPendingAudioBySession] = useState({});
    const [availableUpdateVersion, setAvailableUpdateVersion] = useState(null);
    const [installUpdate, setInstallUpdate] = useState(null);
    const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
    const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
    const [updateStatusNote, setUpdateStatusNote] = useState(null);
    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        if (!isLoaded || loadError) {
            return;
        }
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
    const activeSession = useMemo(() => snapshot?.sessions.find((session) => session.id === activeSessionId) ?? snapshot?.sessions[0] ?? null, [activeSessionId, snapshot]);
    const activeTemplate = useMemo(() => snapshot?.templates.find((template) => template.id === activeSession?.templateId) ?? null, [activeSession, snapshot]);
    const activeAttachments = useMemo(() => snapshot?.attachments.filter((attachment) => attachment.sessionId === activeSession?.id) ?? [], [activeSession, snapshot]);
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
        try {
            const output = await generateNotes({
                session: activeSession,
                settings: snapshot.settings,
                template,
            });
            await saveSession({ ...activeSession, output });
            setStatusNote("Generated structured output with the desktop AI service.");
            setActiveView("output");
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Generation failed.");
        }
        finally {
            setIsGenerating(false);
        }
    };
    const handleTranslate = async () => {
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
            });
            await saveSession({ ...activeSession, output: translated });
            setStatusNote(`Translated the current output to ${targetLanguage}.`);
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Translation failed.");
        }
    };
    const handleRevise = async (instructions) => {
        setIsRevising(true);
        try {
            const revised = await reviseOutput({
                currentOutput: activeSession.output,
                instructions,
                detailLevel: activeSession.detailLevel,
                settings: snapshot.settings,
            });
            await saveSession({ ...activeSession, output: revised });
            setStatusNote("Revised the current output with the desktop AI service.");
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Revision failed.");
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
        await saveAttachments([
            ...snapshot.attachments.filter((entry) => !(entry.sessionId === activeSession.id && entry.kind === "audio" && entry.filename === selection.file.name)),
            fileToAttachmentRecord({
                file: selection.file,
                sessionId: activeSession.id,
                kind: "audio",
                filePath: persistedPath,
            }),
        ]);
        setStatusNote("Uploaded audio into the desktop session. You can transcribe it into the live transcript next.");
    };
    const handleTranscribeAudio = async () => {
        const file = pendingAudioBySession[activeSession.id];
        if (!file) {
            setStatusNote("Upload audio for this session first, then transcribe it.");
            return;
        }
        setIsTranscribingAudio(true);
        try {
            const transcriptText = await transcribeAudio({
                file,
                settings: snapshot.settings,
            });
            const nextTranscript = [activeSession.liveTranscript.trim(), transcriptText.trim()].filter(Boolean).join("\n\n");
            await saveSession({ ...activeSession, liveTranscript: nextTranscript });
            setStatusNote("Audio transcription complete and added to the live transcript field.");
        }
        catch (error) {
            setStatusNote(error instanceof Error ? error.message : "Audio transcription failed.");
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
    const handleWorkspaceSelection = (workspaceId, available) => {
        if (!available) {
            setStatusNote(`${WORKSPACE_ITEMS.find((item) => item.id === workspaceId)?.label ?? "Workspace"} will arrive in a later desktop phase.`);
            return;
        }
        setActiveWorkspace(workspaceId);
    };
    const openOverlay = (panel) => setOpenPanel(panel);
    const closeOverlay = () => setOpenPanel(null);
    const renderOverlayContent = () => {
        switch (openPanel) {
            case "sessions":
                return (_jsx(SessionsSidebar, { sessions: snapshot.sessions, activeSessionId: activeSession.id, onSelect: (id) => {
                        setActiveSessionId(id);
                        closeOverlay();
                    }, onCreate: () => void createNewSession(), onDelete: (id) => void deleteSession(id) }));
            case "templates":
                return _jsx(TemplatesCard, { templates: snapshot.templates, onSave: (template) => void saveTemplate(template) });
            case "todos":
                return (_jsx(TodosCard, { todos: snapshot.todos, onToggle: (todo) => void saveTodo(todo), onAdd: (description) => void addTodo(description), onDelete: (id) => void deleteTodo(id) }));
            case "settings":
                return (_jsx(SettingsCard, { settings: snapshot.settings, onChange: (settings) => void saveSettings(settings), onImportLegacy: handleImportLegacy, onCheckForUpdates: handleCheckForUpdates, updateStatusNote: updateStatusNote }));
            case "backup":
                return (_jsxs("div", { className: "sidebar-card overlay-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Back-up" }), _jsx("p", { children: "Keep backup and migration actions accessible without leaving the focused Notes workspace." })] }), _jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportLegacy(), children: "Import current browser data" }), _jsx("button", { className: "small-button", type: "button", onClick: handleExportSnapshot, children: "Export snapshot" })] }), _jsx("p", { className: "tiny-text", children: "This backup area stays separate from the main workspace so capture and output remain clear and uncluttered." })] }));
            default:
                return null;
        }
    };
    return (_jsxs("div", { className: "app-shell desktop-shell", children: [_jsxs("aside", { className: "workspace-rail", children: [_jsxs("div", { className: "workspace-rail-brand", children: [_jsx("strong", { children: "NoteSmith" }), _jsx("span", { className: "tiny-text", children: "Desktop" })] }), _jsx("nav", { className: "workspace-nav", children: WORKSPACE_ITEMS.map((item) => (_jsxs("button", { type: "button", className: "workspace-nav-button", "data-active": activeWorkspace === item.id, "data-available": item.available, onClick: () => handleWorkspaceSelection(item.id, item.available), children: [_jsx("span", { children: item.label }), _jsx("small", { children: item.available ? item.description : "Coming later" })] }, item.id))) })] }), _jsxs("div", { className: "workspace-shell", children: [_jsxs("header", { className: "topbar app-header", children: [_jsxs("div", { children: [_jsx("h1", { children: "Notes workspace" }), _jsx("p", { children: statusNote })] }), _jsxs("div", { className: "topbar-actions", children: [availableUpdateVersion ? (_jsx("button", { className: "primary-button", type: "button", onClick: () => void handleInstallUpdate(), disabled: isInstallingUpdate, children: isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}` })) : (_jsx("button", { className: "shell-button", type: "button", onClick: () => void handleCheckForUpdates(), disabled: isCheckingForUpdates, children: isCheckingForUpdates ? "Checking updates..." : "Check for updates" })), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("sessions"), children: "All Sessions" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("templates"), children: "Templates" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("todos"), children: "To-dos" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("backup"), children: "Back-up" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => openOverlay("settings"), children: "Settings" })] })] }), _jsxs("main", { className: "notes-shell", children: [_jsxs("section", { className: "workspace-canvas", children: [_jsx("div", { className: "workspace-header card", children: _jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h2", { children: activeView === "capture" ? "Capture" : "Output" }), _jsx("p", { children: "Keep the current task in the center. Use the side rail to switch workspaces and overlays for secondary tools." })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => void createNewSession(), children: "+ New Session" }), _jsxs("div", { className: "view-switch", children: [_jsx("button", { className: "segment-button", "data-active": activeView === "capture", type: "button", onClick: () => setActiveView("capture"), children: "Capture" }), _jsx("button", { className: "segment-button", "data-active": activeView === "output", type: "button", onClick: () => setActiveView("output"), children: "Output" })] })] })] }) }), activeView === "capture" ? (_jsx(SessionEditor, { session: activeSession, templates: snapshot.templates, attachments: activeAttachments, isTranscribingAudio: isTranscribingAudio, onChange: (session) => void saveSession(session), onImportAudio: () => void handleImportAudio(), onTranscribeAudio: () => void handleTranscribeAudio(), onImportTranscript: () => void handleImportTranscript(), onRemoveAttachment: (attachmentId) => void handleRemoveAttachment(attachmentId) })) : (_jsx(OutputWorkspace, { session: activeSession, onChange: (session) => void saveSession(session), isGenerating: isGenerating, isRevising: isRevising, onGenerate: () => void handleGenerate(), onTranslate: () => void handleTranslate(), onRevise: (instructions) => void handleRevise(instructions), onExportText: () => exportOutputAsText({ title: activeSession.title, output: activeSession.output }), onExportMarkdown: () => exportOutputAsMarkdown({ title: activeSession.title, output: activeSession.output }), onExportHtml: () => exportOutputAsHtml({ title: activeSession.title, output: activeSession.output }) }))] }), _jsxs("aside", { className: "workspace-inspector stack", children: [_jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Current session" }), _jsx("p", { children: "Context stays visible here while the main canvas stays focused on capture or output." })] }), _jsxs("div", { className: "section-list", children: [_jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.title || "Untitled session" }), _jsx("span", { className: "muted", children: activeTemplate?.name ?? "No template selected" })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.date || "No date set" }), _jsxs("span", { className: "muted", children: [activeSession.startTime || "--:--", " to ", activeSession.endTime || "--:--"] })] }), _jsxs("div", { className: "list-item", children: [_jsx("strong", { children: activeSession.participantText || "No participants yet" }), _jsx("span", { className: "muted", children: "Participants" })] })] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: activeView === "capture" ? "Capture tools" : "Output tools" }), _jsx("p", { children: activeView === "capture"
                                                            ? "Keep import and transcription actions close at hand without burying the main note fields."
                                                            : "Keep generation and export actions visible while the output stays front and center." })] }), activeView === "capture" ? (_jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportAudio(), children: "Upload audio" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleTranscribeAudio(), children: isTranscribingAudio ? "Transcribing..." : "Transcribe audio" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportTranscript(), children: "Upload transcript" })] })) : (_jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => void handleGenerate(), disabled: isGenerating, children: isGenerating ? "Generating..." : "Generate" }), _jsx("button", { className: "small-button", type: "button", onClick: () => void handleTranslate(), children: "Translate" }), _jsx("button", { className: "small-button", type: "button", onClick: () => exportOutputAsMarkdown({ title: activeSession.title, output: activeSession.output }), children: "Export markdown" })] })), _jsx("p", { className: "tiny-text", children: activeView === "capture"
                                                    ? "Secondary tools stay here or in overlays so the main capture workflow remains simple."
                                                    : "Export and revise from here while keeping the output document itself uncluttered." })] }), _jsxs("div", { className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Quick status" }), _jsx("p", { children: "Small passive information belongs in the inspector, not inline with the main workspace buttons." })] }), _jsxs("span", { className: "status-chip", children: [activeAttachments.length, " attachment", activeAttachments.length === 1 ? "" : "s"] }), _jsxs("span", { className: "status-chip", children: [activeTemplate?.sections.length ?? 0, " output section", (activeTemplate?.sections.length ?? 0) === 1 ? "" : "s"] }), updateStatusNote ? _jsx("p", { className: "tiny-text", children: updateStatusNote }) : null] })] })] })] }), openPanel ? (_jsx("div", { className: "overlay-backdrop", role: "presentation", onClick: closeOverlay, children: _jsxs("div", { className: "overlay-surface", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "overlay-header", children: [_jsxs("div", { children: [_jsx("strong", { children: openPanel === "sessions"
                                                ? "All Sessions"
                                                : openPanel === "templates"
                                                    ? "Templates"
                                                    : openPanel === "todos"
                                                        ? "To-dos"
                                                        : openPanel === "backup"
                                                            ? "Back-up"
                                                            : "Settings" }), _jsx("p", { className: "tiny-text", children: "Secondary tools are kept in overlays so each workspace stays focused." })] }), _jsx("button", { className: "small-button", type: "button", onClick: closeOverlay, children: "Close" })] }), renderOverlayContent()] }) })) : null] }));
};
