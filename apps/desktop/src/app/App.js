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
export const App = () => {
    const { snapshot, activeSessionId, activeView, isLoaded, loadError, load, setActiveSessionId, setActiveView, saveSession, createNewSession, deleteSession, saveTodo, addTodo, deleteTodo, saveSettings, saveTemplate, importLegacyBrowserData, saveAttachments, } = useDesktopStore();
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
    if (!isLoaded || !snapshot || !activeSession) {
        return (_jsxs("div", { className: "app-shell", children: [_jsx("div", { className: "topbar", children: _jsxs("div", { children: [_jsx("h1", { children: "NoteSmith Desktop" }), _jsx("p", { children: loadError || "Preparing the new local-first desktop foundation..." })] }) }), isLoaded && loadError ? (_jsx("main", { className: "workspace", children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Desktop startup failed" }), _jsx("p", { children: "The app could not finish loading its local services." })] }) }), _jsxs("div", { className: "stack", children: [_jsx("p", { className: "muted", children: loadError }), _jsx("p", { className: "tiny-text", children: "This is usually caused by a missing Tauri capability or a blocked plugin/database permission." })] })] }) })) : null] }));
    }
    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
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
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("header", { className: "topbar", children: [_jsxs("div", { children: [_jsx("h1", { children: "NoteSmith Desktop" }), _jsx("p", { children: statusNote })] }), _jsxs("div", { className: "topbar-actions", children: [availableUpdateVersion ? (_jsx("button", { className: "primary-button", type: "button", onClick: () => void handleInstallUpdate(), disabled: isInstallingUpdate, children: isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}` })) : (_jsx("button", { className: "shell-button", type: "button", onClick: () => void handleCheckForUpdates(), disabled: isCheckingForUpdates, children: isCheckingForUpdates ? "Checking updates..." : "Check for updates" })), _jsx("button", { className: "shell-button", type: "button", onClick: () => scrollToSection("desktop-sessions-card"), children: "All Sessions" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => scrollToSection("desktop-backup-card"), children: "Back-up" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => scrollToSection("desktop-settings-card"), children: "Settings" }), _jsxs("div", { className: "view-switch", children: [_jsx("button", { className: "segment-button", "data-active": activeView === "capture", type: "button", onClick: () => setActiveView("capture"), children: "Capture" }), _jsx("button", { className: "segment-button", "data-active": activeView === "output", type: "button", onClick: () => setActiveView("output"), children: "Output" })] })] })] }), _jsxs("main", { className: "workspace", children: [_jsxs("div", { className: "stack", children: [activeView === "capture" ? (_jsx(SessionEditor, { session: activeSession, templates: snapshot.templates, attachments: snapshot.attachments.filter((attachment) => attachment.sessionId === activeSession.id), isTranscribingAudio: isTranscribingAudio, onChange: (session) => void saveSession(session), onImportAudio: () => void handleImportAudio(), onTranscribeAudio: () => void handleTranscribeAudio(), onImportTranscript: () => void handleImportTranscript(), onRemoveAttachment: (attachmentId) => void handleRemoveAttachment(attachmentId) })) : (_jsx(OutputWorkspace, { session: activeSession, onChange: (session) => void saveSession(session), isGenerating: isGenerating, isRevising: isRevising, onGenerate: () => void handleGenerate(), onTranslate: () => void handleTranslate(), onRevise: (instructions) => void handleRevise(instructions), onExportText: () => exportOutputAsText({ title: activeSession.title, output: activeSession.output }), onExportMarkdown: () => exportOutputAsMarkdown({ title: activeSession.title, output: activeSession.output }), onExportHtml: () => exportOutputAsHtml({ title: activeSession.title, output: activeSession.output }) })), _jsx(TodosCard, { todos: snapshot.todos, onToggle: (todo) => void saveTodo(todo), onAdd: (description) => void addTodo(description), onDelete: (id) => void deleteTodo(id) })] }), _jsxs("div", { className: "stack", children: [_jsx(SessionsSidebar, { sessions: snapshot.sessions, activeSessionId: activeSession.id, onSelect: setActiveSessionId, onCreate: () => void createNewSession(), onDelete: (id) => void deleteSession(id) }), _jsx(TemplatesCard, { templates: snapshot.templates, onSave: (template) => void saveTemplate(template) }), _jsxs("div", { id: "desktop-backup-card", className: "sidebar-card", children: [_jsxs("div", { children: [_jsx("h3", { children: "Back-up" }), _jsx("p", { children: "This will later become the full desktop backup and import/export flow." })] }), _jsxs("div", { className: "sidebar-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => void handleImportLegacy(), children: "Import current browser data" }), _jsx("button", { className: "small-button", type: "button", onClick: handleExportSnapshot, children: "Export snapshot" })] }), _jsx("p", { className: "tiny-text", children: "The export/import actions are intentionally simple in this first pass while we move the product into the new architecture." })] }), _jsx(SettingsCard, { settings: snapshot.settings, onChange: (settings) => void saveSettings(settings), onImportLegacy: handleImportLegacy, onCheckForUpdates: handleCheckForUpdates, updateStatusNote: updateStatusNote })] })] })] }));
};
