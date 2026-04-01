import { useEffect, useMemo, useState } from "react";
import { useDesktopStore } from "../state/useDesktopStore";
import { SessionEditor } from "../features/sessions/components/SessionEditor";
import { SessionsSidebar } from "../features/sessions/components/SessionsSidebar";
import { OutputWorkspace } from "../features/output/components/OutputWorkspace";
import { TodosCard } from "../features/todos/components/TodosCard";
import { SettingsCard } from "../features/settings/components/SettingsCard";
import { generateNotes } from "../lib/ai/services/generateNotes";
import { reviseOutput } from "../lib/ai/services/reviseOutput";
import { transcribeAudio } from "../lib/ai/services/transcribeAudio";
import { translateOutput } from "../lib/ai/services/translateOutput";
import { checkForDesktopUpdates } from "../lib/ai/updater";
import { exportOutputAsHtml, exportOutputAsMarkdown, exportOutputAsText } from "../lib/export/exportService";
import {
  fileToAttachmentRecord,
  pickAudioFile,
  pickImageFile,
  pickTranscriptFile,
  persistSelectedAttachment,
  readTranscriptFile,
  removePersistedAttachment,
} from "../lib/files/attachmentStore";

type AppWorkspace = "notes" | "tasks" | "calendar" | "assistant" | "files";
type OverlayPanel = "sessions" | "todos" | "backup" | "settings" | null;

const WORKSPACE_ITEMS: Array<{ id: AppWorkspace; label: string; description: string; available: boolean }> = [
  { id: "notes", label: "Notes", description: "Capture and shape structured notes", available: true },
  { id: "tasks", label: "Tasks", description: "Personal follow-up management", available: false },
  { id: "calendar", label: "Calendar", description: "Schedule and meeting context", available: false },
  { id: "assistant", label: "Assistant", description: "Future AI workflows and agents", available: false },
  { id: "files", label: "Files", description: "Documents, audio, and references", available: false },
];

export const App = () => {
  const {
    snapshot,
    activeSessionId,
    activeView,
    isLoaded,
    loadError,
    load,
    setActiveSessionId,
    setActiveView,
    saveSession,
    createNewSession,
    deleteSession,
    saveTodo,
    addTodo,
    deleteTodo,
    saveSettings,
    saveTemplate,
    importLegacyBrowserData,
    saveAttachments,
  } = useDesktopStore();
  const [activeWorkspace, setActiveWorkspace] = useState<AppWorkspace>("notes");
  const [openPanel, setOpenPanel] = useState<OverlayPanel>(null);
  const [statusNote, setStatusNote] = useState("Core desktop foundation ready for migration.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [pendingAudioBySession, setPendingAudioBySession] = useState<Record<string, File | undefined>>({});
  const [availableUpdateVersion, setAvailableUpdateVersion] = useState<string | null>(null);
  const [installUpdate, setInstallUpdate] = useState<null | (() => Promise<void>)>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateStatusNote, setUpdateStatusNote] = useState<string | null>(null);

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
        if (cancelled) return;
        if (result.available) {
          setAvailableUpdateVersion(result.version);
          setInstallUpdate(() => result.install);
          setUpdateStatusNote(`Version ${result.version} is available to install.`);
          setStatusNote(`Update available: ${result.version}`);
        } else {
          setUpdateStatusNote("Desktop app is up to date.");
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

    return () => {
      cancelled = true;
    };
  }, [isLoaded, loadError]);

  const activeSession = useMemo(
    () => snapshot?.sessions.find((session) => session.id === activeSessionId) ?? snapshot?.sessions[0] ?? null,
    [activeSessionId, snapshot],
  );

  const activeTemplate = useMemo(
    () => snapshot?.templates.find((template) => template.id === activeSession?.templateId) ?? null,
    [activeSession, snapshot],
  );

  const activeAttachments = useMemo(
    () => snapshot?.attachments.filter((attachment) => attachment.sessionId === activeSession?.id) ?? [],
    [activeSession, snapshot],
  );
  const includedOutputImages = useMemo(
    () =>
      activeAttachments.filter((attachment) => attachment.kind === "image" && attachment.includeInOutput),
    [activeAttachments],
  );

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
      } else {
        setAvailableUpdateVersion(null);
        setInstallUpdate(null);
        setUpdateStatusNote("Desktop app is already up to date.");
        setStatusNote("Desktop app is already up to date.");
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
        attachments: activeAttachments,
      });
      await saveSession({ ...activeSession, output });
      setStatusNote("Generated structured output with the desktop AI service.");
      setActiveView("output");
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslate = async () => {
    try {
      const targetLanguage =
        snapshot.settings.outputLanguage === "sv"
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
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Translation failed.");
    }
  };

  const handleRevise = async (instructions: string) => {
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
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Revision failed.");
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

  const handleImportAudio = async () => {
    const selection = await pickAudioFile();
    if (!selection) return;
    const persistedPath = await persistSelectedAttachment({
      sessionId: activeSession.id,
      selection,
    });

    setPendingAudioBySession((current) => ({ ...current, [activeSession.id]: selection.file }));
    await saveAttachments([
      ...snapshot.attachments.filter(
        (entry) =>
          !(entry.sessionId === activeSession.id && entry.kind === "audio" && entry.filename === selection.file.name),
      ),
      fileToAttachmentRecord({
        file: selection.file,
        sessionId: activeSession.id,
        kind: "audio",
        filePath: persistedPath,
      }),
    ]);
    setStatusNote("Uploaded audio into the desktop session. You can transcribe it into the live transcript next.");
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
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : "Audio transcription failed.");
    } finally {
      setIsTranscribingAudio(false);
    }
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

  const handleWorkspaceSelection = (workspaceId: AppWorkspace, available: boolean) => {
    if (!available) {
      setStatusNote(`${WORKSPACE_ITEMS.find((item) => item.id === workspaceId)?.label ?? "Workspace"} will arrive in a later desktop phase.`);
      return;
    }
    setActiveWorkspace(workspaceId);
  };

  const openOverlay = (panel: OverlayPanel) => setOpenPanel(panel);
  const closeOverlay = () => setOpenPanel(null);

  const renderOverlayContent = () => {
    switch (openPanel) {
      case "sessions":
        return (
          <SessionsSidebar
            sessions={snapshot.sessions}
            activeSessionId={activeSession.id}
            onSelect={(id) => {
              setActiveSessionId(id);
              closeOverlay();
            }}
            onCreate={() => void createNewSession()}
            onDelete={(id) => void deleteSession(id)}
          />
        );
      case "todos":
        return (
          <TodosCard
            todos={snapshot.todos}
            onToggle={(todo) => void saveTodo(todo)}
            onAdd={(description) => void addTodo(description)}
            onDelete={(id) => void deleteTodo(id)}
          />
        );
      case "settings":
        return (
          <SettingsCard
            settings={snapshot.settings}
            templates={snapshot.templates}
            onChange={(settings) => void saveSettings(settings)}
            onSaveTemplate={(template) => void saveTemplate(template)}
            onImportLegacy={handleImportLegacy}
            onCheckForUpdates={handleCheckForUpdates}
            updateStatusNote={updateStatusNote}
          />
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
              <button className="small-button" type="button" onClick={handleExportSnapshot}>
                Export snapshot
              </button>
            </div>
            <p className="tiny-text">
              This backup area stays separate from the main workspace so capture and output remain clear and uncluttered.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-shell desktop-shell">
      <aside className="workspace-rail">
        <div className="workspace-rail-brand">
          <strong>NoteSmith</strong>
          <span className="tiny-text">Desktop</span>
        </div>
        <nav className="workspace-nav">
          {WORKSPACE_ITEMS.map((item) => (
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
        <header className="topbar app-header">
          <div>
            <h1>Notes workspace</h1>
            <p>{statusNote}</p>
          </div>
          <div className="topbar-actions">
            {availableUpdateVersion ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleInstallUpdate()}
                disabled={isInstallingUpdate}
              >
                {isInstallingUpdate ? "Installing update..." : `Install update ${availableUpdateVersion}`}
              </button>
            ) : (
              <button
                className="shell-button"
                type="button"
                onClick={() => void handleCheckForUpdates()}
                disabled={isCheckingForUpdates}
              >
                {isCheckingForUpdates ? "Checking updates..." : "Check for updates"}
              </button>
            )}
            <button className="shell-button" type="button" onClick={() => openOverlay("sessions")}>
              All Sessions
            </button>
            <button className="shell-button" type="button" onClick={() => openOverlay("todos")}>
              To-dos
            </button>
            <button className="shell-button" type="button" onClick={() => openOverlay("backup")}>
              Back-up
            </button>
            <button className="shell-button" type="button" onClick={() => openOverlay("settings")}>
              Settings
            </button>
          </div>
        </header>

        <main className="notes-shell">
          <section className="workspace-canvas">
            <div className="workspace-header card">
              <div className="card-header">
                <div>
                  <h2>{activeView === "capture" ? "Capture" : "Output"}</h2>
                  <p>
                    Keep the current task in the center. Use the side rail to switch workspaces and overlays for secondary tools.
                  </p>
                </div>
                <div className="page-actions">
                  <button className="primary-button" type="button" onClick={() => void createNewSession()}>
                    + New Session
                  </button>
                  <div className="view-switch">
                    <button
                      className="segment-button"
                      data-active={activeView === "capture"}
                      type="button"
                      onClick={() => setActiveView("capture")}
                    >
                      Capture
                    </button>
                    <button
                      className="segment-button"
                      data-active={activeView === "output"}
                      type="button"
                      onClick={() => setActiveView("output")}
                    >
                      Output
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {activeView === "capture" ? (
              <SessionEditor
                session={activeSession}
                templates={snapshot.templates}
                attachments={activeAttachments}
                isTranscribingAudio={isTranscribingAudio}
                onChange={(session) => void saveSession(session)}
                onImportImage={() => void handleImportImage()}
                onImportAudio={() => void handleImportAudio()}
                onTranscribeAudio={() => void handleTranscribeAudio()}
                onImportTranscript={() => void handleImportTranscript()}
                onRemoveAttachment={(attachmentId) => void handleRemoveAttachment(attachmentId)}
                onUpdateAttachment={(attachment) => void handleUpdateAttachment(attachment)}
              />
            ) : (
              <OutputWorkspace
                session={activeSession}
                attachments={activeAttachments}
                onChange={(session) => void saveSession(session)}
                isGenerating={isGenerating}
                isRevising={isRevising}
                onGenerate={() => void handleGenerate()}
                onTranslate={() => void handleTranslate()}
                onRevise={(instructions) => void handleRevise(instructions)}
                onExportText={() => exportOutputAsText({ title: activeSession.title, output: activeSession.output })}
                onExportMarkdown={() => exportOutputAsMarkdown({ title: activeSession.title, output: activeSession.output })}
                onExportHtml={() => exportOutputAsHtml({ title: activeSession.title, output: activeSession.output })}
              />
            )}
          </section>

          <aside className="workspace-inspector stack">
            <div className="sidebar-card">
              <div>
                <h3>Current session</h3>
                <p>Context stays visible here while the main canvas stays focused on capture or output.</p>
              </div>
              <div className="section-list">
                <div className="list-item">
                  <strong>{activeSession.title || "Untitled session"}</strong>
                  <span className="muted">{activeTemplate?.name ?? "No template selected"}</span>
                </div>
                <div className="list-item">
                  <strong>{activeSession.date || "No date set"}</strong>
                  <span className="muted">
                    {activeSession.startTime || "--:--"} to {activeSession.endTime || "--:--"}
                  </span>
                </div>
                <div className="list-item">
                  <strong>{activeSession.participantText || "No participants yet"}</strong>
                  <span className="muted">People</span>
                </div>
                <div className="list-item">
                  <strong>{includedOutputImages.length}</strong>
                  <span className="muted">Images staged for polished output</span>
                </div>
              </div>
            </div>

            <div className="sidebar-card">
              <div>
                <h3>{activeView === "capture" ? "Capture tools" : "Output tools"}</h3>
                <p>
                  {activeView === "capture"
                    ? "Keep import and transcription actions close at hand without burying the main note fields."
                    : "Keep generation and export actions visible while the output stays front and center."}
                </p>
              </div>
              {activeView === "capture" ? (
                <div className="sidebar-actions">
                  <button className="small-button" type="button" onClick={() => void handleImportImage()}>
                    Upload image
                  </button>
                  <button className="small-button" type="button" onClick={() => void handleImportAudio()}>
                    Upload audio
                  </button>
                  <button className="small-button" type="button" onClick={() => void handleTranscribeAudio()}>
                    {isTranscribingAudio ? "Transcribing..." : "Transcribe audio"}
                  </button>
                  <button className="small-button" type="button" onClick={() => void handleImportTranscript()}>
                    Upload transcript
                  </button>
                </div>
              ) : (
                <div className="sidebar-actions">
                  <button className="primary-button" type="button" onClick={() => void handleGenerate()} disabled={isGenerating}>
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                  <button className="small-button" type="button" onClick={() => void handleTranslate()}>
                    Translate
                  </button>
                  <button className="small-button" type="button" onClick={() => exportOutputAsMarkdown({ title: activeSession.title, output: activeSession.output })}>
                    Export markdown
                  </button>
                </div>
              )}
              <p className="tiny-text">
                {activeView === "capture"
                  ? "Secondary tools stay here or in overlays so the main capture workflow remains simple."
                  : "Export and revise from here while keeping the output document itself uncluttered."}
              </p>
            </div>

            <div className="sidebar-card">
              <div>
                <h3>Quick status</h3>
                <p>Small passive information belongs in the inspector, not inline with the main workspace buttons.</p>
              </div>
              <span className="status-chip">{activeAttachments.length} attachment{activeAttachments.length === 1 ? "" : "s"}</span>
              <span className="status-chip">
                {activeTemplate?.sections.length ?? 0} output section{(activeTemplate?.sections.length ?? 0) === 1 ? "" : "s"}
              </span>
              {updateStatusNote ? <p className="tiny-text">{updateStatusNote}</p> : null}
            </div>
          </aside>
        </main>
      </div>

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
                  {openPanel === "sessions"
                    ? "All Sessions"
                    : openPanel === "todos"
                        ? "To-dos"
                        : openPanel === "backup"
                          ? "Back-up"
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
