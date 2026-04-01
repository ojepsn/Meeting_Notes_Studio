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
import { exportOutputAsHtml, exportOutputAsMarkdown, exportOutputAsText } from "../lib/export/exportService";
import {
  fileToAttachmentRecord,
  pickAudioFile,
  pickTranscriptFile,
  persistSelectedAttachment,
  readTranscriptFile,
  removePersistedAttachment,
} from "../lib/files/attachmentStore";

export const App = () => {
  const {
    snapshot,
    activeSessionId,
    activeView,
    isLoaded,
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
  const [statusNote, setStatusNote] = useState("Core desktop foundation ready for migration.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [pendingAudioBySession, setPendingAudioBySession] = useState<Record<string, File | undefined>>({});

  useEffect(() => {
    void load();
  }, [load]);

  const activeSession = useMemo(
    () => snapshot?.sessions.find((session) => session.id === activeSessionId) ?? snapshot?.sessions[0] ?? null,
    [activeSessionId, snapshot],
  );

  if (!isLoaded || !snapshot || !activeSession) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div>
            <h1>NoteSmith Desktop</h1>
            <p>Preparing the new local-first desktop foundation...</p>
          </div>
        </div>
      </div>
    );
  }

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>NoteSmith Desktop</h1>
          <p>{statusNote}</p>
        </div>
        <div className="topbar-actions">
          <button className="shell-button" type="button" onClick={() => scrollToSection("desktop-sessions-card")}>
            All Sessions
          </button>
          <button className="shell-button" type="button" onClick={() => scrollToSection("desktop-backup-card")}>
            Back-up
          </button>
          <button className="shell-button" type="button" onClick={() => scrollToSection("desktop-settings-card")}>
            Settings
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
      </header>

      <main className="workspace">
        <div className="stack">
          {activeView === "capture" ? (
            <SessionEditor
              session={activeSession}
              templates={snapshot.templates}
              attachments={snapshot.attachments.filter((attachment) => attachment.sessionId === activeSession.id)}
              isTranscribingAudio={isTranscribingAudio}
              onChange={(session) => void saveSession(session)}
              onImportAudio={() => void handleImportAudio()}
              onTranscribeAudio={() => void handleTranscribeAudio()}
              onImportTranscript={() => void handleImportTranscript()}
              onRemoveAttachment={(attachmentId) => void handleRemoveAttachment(attachmentId)}
            />
          ) : (
            <OutputWorkspace
              session={activeSession}
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
          <TodosCard
            todos={snapshot.todos}
            onToggle={(todo) => void saveTodo(todo)}
            onAdd={(description) => void addTodo(description)}
            onDelete={(id) => void deleteTodo(id)}
          />
        </div>

        <div className="stack">
          <SessionsSidebar
            sessions={snapshot.sessions}
            activeSessionId={activeSession.id}
            onSelect={setActiveSessionId}
            onCreate={() => void createNewSession()}
            onDelete={(id) => void deleteSession(id)}
          />
          <TemplatesCard templates={snapshot.templates} onSave={(template) => void saveTemplate(template)} />
          <div id="desktop-backup-card" className="sidebar-card">
            <div>
              <h3>Back-up</h3>
              <p>This will later become the full desktop backup and import/export flow.</p>
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
              The export/import actions are intentionally simple in this first pass while we move the
              product into the new architecture.
            </p>
          </div>
          <SettingsCard
            settings={snapshot.settings}
            onChange={(settings) => void saveSettings(settings)}
            onImportLegacy={handleImportLegacy}
          />
        </div>
      </main>
    </div>
  );
};
