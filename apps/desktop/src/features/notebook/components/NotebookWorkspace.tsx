import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SessionRecord, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { NotebookTodosPanel } from "./NotebookTodosPanel";
import { RichTextCommandMenu } from "../../richTextCommands/RichTextCommandMenu";

const NOTEBOOK_BLOCK_COMMANDS = [
  { id: "body", label: "Body", value: "P" },
  { id: "h1", label: "H1", value: "H1" },
  { id: "h2", label: "H2", value: "H2" },
] as const;

const richTextToPlainText = (value: string) => {
  if (!value) return "";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  return (wrapper.innerText || wrapper.textContent || "").replace(/\s+/g, " ").trim();
};

const normalizeNotebookHtml = (value: string) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value || "";
  const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H1", "H2"]);
  wrapper.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      while (element.firstChild) fragment.appendChild(element.firstChild);
      element.replaceWith(fragment);
      return;
    }
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
  });
  return wrapper.innerHTML.replace(/<div>/gi, "<p>").replace(/<\/div>/gi, "</p>").trim();
};

export const getNotebookTitleText = (session: Pick<SessionRecord, "date" | "title">) => {
  if (session.title === session.date) return "";
  const prefix = `${session.date} `;
  return session.title.startsWith(prefix) ? session.title.slice(prefix.length) : session.title;
};

export const buildNotebookSessionTitle = (date: string, titleText: string) =>
  titleText ? `${date} ${titleText}` : date;

export const getNotebookListTitle = (session: Pick<SessionRecord, "captureMode" | "date" | "title">) => {
  const titleText = (session.captureMode === "quick-note" ? getNotebookTitleText(session) : session.title).trim();
  if (session.title === session.date || session.title.startsWith(`${session.date} `)) {
    return session.title === session.date ? `${session.date} Untitled note` : session.title;
  }
  return titleText ? `${session.date} ${titleText}` : `${session.date} Untitled note`;
};

interface NotebookWorkspaceProps {
  sessions: SessionRecord[];
  todos: TodoRecord[];
  activeSession: SessionRecord;
  isRecordingAudio: boolean;
  isTranscribingAudio: boolean;
  isGenerating: boolean;
  recordingStatusNote?: string | null;
  outputContent: ReactNode;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDelete: (sessionId: string) => void;
  onAddTodo: (description: string) => void;
  onSaveTodo: (todo: TodoRecord) => void;
  onAddNoteForTodo: (todoId: string) => void;
  onChange: (session: SessionRecord) => void;
  onToggleRecording: () => void;
  onUploadAudio: () => void;
  onTranscribeAudio: () => void;
  onGenerateOutput: () => void;
  onOpenInNotes: (view: "capture" | "output") => void;
}

export const NotebookWorkspace = ({
  sessions,
  todos,
  activeSession,
  isRecordingAudio,
  isTranscribingAudio,
  isGenerating,
  recordingStatusNote,
  outputContent,
  onSelect,
  onCreate,
  onDelete,
  onAddTodo,
  onSaveTodo,
  onAddNoteForTodo,
  onChange,
  onToggleRecording,
  onUploadAudio,
  onTranscribeAudio,
  onGenerateOutput,
  onOpenInNotes,
}: NotebookWorkspaceProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isTodosOpen, setIsTodosOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState<"capture" | "output">("capture");
  const isDatedNotebookPage = activeSession.captureMode === "quick-note";
  const titleText = isDatedNotebookPage ? getNotebookTitleText(activeSession) : activeSession.title;

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (left, right) =>
          right.date.localeCompare(left.date) ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.createdAt.localeCompare(left.createdAt),
      ),
    [sessions],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    if (editor.innerHTML !== activeSession.manualNotes) {
      editor.innerHTML = activeSession.manualNotes;
    }
    editor.dataset.empty = richTextToPlainText(activeSession.manualNotes) ? "false" : "true";
  }, [activeSession.id, activeSession.manualNotes]);

  const updateManualNotes = (html: string) => {
    const normalizedHtml = normalizeNotebookHtml(html);
    if (editorRef.current) {
      editorRef.current.dataset.empty = richTextToPlainText(normalizedHtml) ? "false" : "true";
    }
    onChange({ ...activeSession, manualNotes: normalizedHtml });
  };

  const applyCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    updateManualNotes(editorRef.current.innerHTML);
  };

  const generateOutput = () => {
    setIsTodosOpen(false);
    setIsToolsOpen(true);
    setToolsTab("output");
    onGenerateOutput();
  };

  const toggleTools = () => {
    setIsToolsOpen((current) => {
      const next = !current;
      if (next) setIsTodosOpen(false);
      return next;
    });
  };

  const toggleTodos = () => {
    setIsTodosOpen((current) => {
      const next = !current;
      if (next) setIsToolsOpen(false);
      return next;
    });
  };

  return (
    <div className="notebook-workspace" data-side-panel-open={isToolsOpen || isTodosOpen}>
      <aside className="notebook-list-pane" aria-label="Notebook pages">
        <div className="notebook-list-header">
          <div>
            <span className="section-label">Notebook</span>
            <strong>{sessions.length} pages</strong>
          </div>
          <button className="primary-button notebook-new-button" type="button" onClick={onCreate}>
            New page
          </button>
        </div>
        <div className="notebook-page-list">
          {sortedSessions.map((session) => {
            const preview = richTextToPlainText(session.manualNotes);
            return (
              <div className="notebook-page-item" data-active={session.id === activeSession.id} key={session.id}>
                <button className="notebook-page-select" type="button" onClick={() => onSelect(session.id)}>
                  <strong>{getNotebookListTitle(session)}</strong>
                  <span>{preview || "Empty page"}</span>
                </button>
                <button
                  className="notebook-page-delete"
                  type="button"
                  aria-label={`Delete ${getNotebookListTitle(session)}`}
                  title="Move to deleted sessions"
                  onClick={() => onDelete(session.id)}
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="notebook-editor-pane">
        <header className="notebook-title-row">
          <DateInput
            id="notebook-date"
            value={activeSession.date}
            onChange={(event) =>
              onChange({
                ...activeSession,
                date: event.target.value,
                title: isDatedNotebookPage
                  ? buildNotebookSessionTitle(event.target.value, titleText)
                  : activeSession.title,
              })
            }
          />
          <input
            className="notebook-title-input"
            value={titleText}
            aria-label="Notebook page title"
            placeholder="Page title"
            onChange={(event) =>
              onChange({
                ...activeSession,
                title: isDatedNotebookPage
                  ? buildNotebookSessionTitle(activeSession.date, event.target.value)
                  : event.target.value,
              })
            }
          />
        </header>

        <div className="notebook-rich-toolbar" aria-label="Notebook formatting">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("bold")}>
            Bold
          </button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("italic")}>
            Italic
          </button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertUnorderedList")}>
            Bullets
          </button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertOrderedList")}>
            Numbered
          </button>
          {NOTEBOOK_BLOCK_COMMANDS.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand("formatBlock", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          id="manual-notes"
          ref={editorRef}
          className="notebook-rich-editor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Start writing..."
          data-empty="true"
          onInput={(event) => updateManualNotes(event.currentTarget.innerHTML)}
        />
        <RichTextCommandMenu editorRef={editorRef} onContentChange={updateManualNotes} />
      </section>

      <aside className="notebook-tools-pane" data-open={isToolsOpen || isTodosOpen}>
        <div className="notebook-side-toggle-rail">
          <button
            className="notebook-tools-toggle"
            type="button"
            data-active={isToolsOpen}
            aria-expanded={isToolsOpen}
            aria-controls="notebook-tools-content"
            aria-label={isToolsOpen ? "Collapse notebook tools" : "Expand notebook tools"}
            onClick={toggleTools}
          >
            <span>{isToolsOpen ? ">" : "<"}</span>
            <strong>Tools</strong>
          </button>
          <button
            className="notebook-tools-toggle"
            type="button"
            data-active={isTodosOpen}
            aria-expanded={isTodosOpen}
            aria-controls="notebook-todos-content"
            aria-label={isTodosOpen ? "Collapse notebook todos" : "Expand notebook todos"}
            onClick={toggleTodos}
          >
            <span>{isTodosOpen ? ">" : "<"}</span>
            <strong>Todos</strong>
          </button>
        </div>
        {isToolsOpen ? (
          <div id="notebook-tools-content" className="notebook-tools-content">
            <div className="notebook-tools-tabs" role="tablist" aria-label="Notebook tools">
              <button type="button" data-active={toolsTab === "capture"} onClick={() => setToolsTab("capture")}>
                Capture
              </button>
              <button type="button" data-active={toolsTab === "output"} onClick={() => setToolsTab("output")}>
                Output
              </button>
            </div>
            {toolsTab === "capture" ? (
              <div className="notebook-capture-tools">
                <div>
                  <span className="section-label">Recording and output</span>
                  <h3>Bring more into this page</h3>
                  <p>Record or upload audio, transcribe it, then create an editable Output.</p>
                </div>
                <button className={isRecordingAudio ? "primary-button" : "secondary-button"} type="button" onClick={onToggleRecording}>
                  {isRecordingAudio ? "Stop recording" : "Record microphone"}
                </button>
                <button className="shell-button" type="button" onClick={onUploadAudio}>
                  Upload audio
                </button>
                <button className="shell-button" type="button" disabled={isTranscribingAudio} onClick={onTranscribeAudio}>
                  {isTranscribingAudio ? "Transcribing..." : "Transcribe"}
                </button>
                <button className="primary-button" type="button" disabled={isGenerating} onClick={generateOutput}>
                  {isGenerating ? "Generating..." : "Generate output"}
                </button>
                <p className="tiny-text">{recordingStatusNote || "Microphone recording is saved with this notebook session."}</p>
                <button className="small-button" type="button" onClick={() => onOpenInNotes("capture")}>
                  Open full session in Notes
                </button>
              </div>
            ) : (
              <div className="notebook-output-tools">
                {outputContent}
              </div>
            )}
          </div>
        ) : null}
        {isTodosOpen ? (
          <div id="notebook-todos-content" className="notebook-tools-content notebook-todos-content">
            <NotebookTodosPanel
              todos={todos}
              onAddTodo={onAddTodo}
              onSaveTodo={onSaveTodo}
              onAddNote={onAddNoteForTodo}
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
};
