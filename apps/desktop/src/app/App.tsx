import { useEffect, useMemo, useState } from "react";
import { useDesktopStore } from "../state/useDesktopStore";
import { SessionEditor } from "../features/sessions/components/SessionEditor";
import { SessionsSidebar } from "../features/sessions/components/SessionsSidebar";
import { OutputWorkspace } from "../features/output/components/OutputWorkspace";
import { TemplatesCard } from "../features/templates/components/TemplatesCard";
import { TodosCard } from "../features/todos/components/TodosCard";
import { SettingsCard } from "../features/settings/components/SettingsCard";
import { generateNotes } from "../lib/ai/services/generateNotes";
import { translateOutput } from "../lib/ai/services/translateOutput";
import { exportOutputAsText } from "../lib/export/exportService";
import { fileToAttachmentRecord, pickTranscriptFile } from "../lib/files/attachmentStore";

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
    importLegacyBrowserData,
    saveAttachments,
  } = useDesktopStore();
  const [statusNote, setStatusNote] = useState("Core desktop foundation ready for migration.");
  const [isGenerating, setIsGenerating] = useState(false);

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
      const targetLanguage = /[åäö]/i.test(activeSession.output) ? "English" : "Swedish";
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

  const handleImportTranscript = async () => {
    const file = await pickTranscriptFile();
    if (!file) return;
    const text = await file.text();
    await saveSession({ ...activeSession, uploadedTranscript: text });
    await saveAttachments([
      ...snapshot.attachments.filter((entry) => !(entry.sessionId === activeSession.id && entry.kind === "transcript")),
      fileToAttachmentRecord({ file, sessionId: activeSession.id, kind: "transcript" }),
    ]);
    setStatusNote("Imported transcript into the desktop session.");
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
              onChange={(session) => void saveSession(session)}
              onImportTranscript={() => void handleImportTranscript()}
            />
          ) : (
            <OutputWorkspace
              session={activeSession}
              onChange={(session) => void saveSession(session)}
              isGenerating={isGenerating}
              onGenerate={() => void handleGenerate()}
              onTranslate={() => void handleTranslate()}
              onExport={() => exportOutputAsText({ title: activeSession.title, output: activeSession.output })}
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
          <TemplatesCard templates={snapshot.templates} />
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
