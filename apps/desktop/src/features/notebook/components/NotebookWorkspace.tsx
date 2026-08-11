import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { SessionRecord, TodoRecord } from "@notesmith/domain";
import { DateInput } from "../../../components/DateInput";
import { NotebookTodosPanel } from "./NotebookTodosPanel";
import { openDetachedTodosWindow } from "../todosWindowBridge";
import { RichTextCommandMenu } from "../../richTextCommands/RichTextCommandMenu";
import { useDeferredRichTextChange } from "../../richTextCommands/useDeferredRichTextChange";

const NOTEBOOK_BLOCK_COMMANDS = [
  { id: "body", label: "Body", value: "P" },
  { id: "h1", label: "H1", value: "H1" },
  { id: "h2", label: "H2", value: "H2" },
] as const;

type NotebookTodosMode = "closed" | "minimized" | "standard" | "maximized";
type ExpandedNotebookTodosMode = Extract<NotebookTodosMode, "standard" | "maximized">;
type TodosResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const TODOS_RESIZE_EDGES: TodosResizeEdge[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

interface TodosDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
  panelWidth: number;
  panelHeight: number;
  workspaceLeft: number;
  workspaceTop: number;
  workspaceRight: number;
  workspaceBottom: number;
  originX: number;
  originY: number;
}

interface TodosResizeState {
  pointerId: number;
  edge: TodosResizeEdge;
  mode: ExpandedNotebookTodosMode;
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
  workspaceLeft: number;
  workspaceTop: number;
  workspaceRight: number;
  workspaceBottom: number;
  originX: number;
  originY: number;
}

const NOTEBOOK_TODOS_MODE_KEY = "notesmith:notebook-todos-mode";

const readNotebookTodosMode = (): NotebookTodosMode => {
  try {
    const saved = window.localStorage.getItem(NOTEBOOK_TODOS_MODE_KEY);
    if (saved === "minimized" || saved === "standard" || saved === "maximized") return saved;
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
  return "closed";
};

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
  onDeleteTodo: (todoId: string) => void;
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
  onDeleteTodo,
  onAddNoteForTodo,
  onChange,
  onToggleRecording,
  onUploadAudio,
  onTranscribeAudio,
  onGenerateOutput,
  onOpenInNotes,
}: NotebookWorkspaceProps) => {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const todosOverlayRef = useRef<HTMLElement | null>(null);
  const todosDragRef = useRef<TodosDragState | null>(null);
  const todosResizeRef = useRef<TodosResizeState | null>(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isTodosDragging, setIsTodosDragging] = useState(false);
  const [isTodosResizing, setIsTodosResizing] = useState(false);
  const [todosPosition, setTodosPosition] = useState({ x: 0, y: 0 });
  const [todosSizes, setTodosSizes] = useState<Record<ExpandedNotebookTodosMode, { width: number; height: number } | null>>({
    standard: null,
    maximized: null,
  });
  const [todosMode, setTodosMode] = useState<NotebookTodosMode>(readNotebookTodosMode);
  const [lastExpandedTodosMode, setLastExpandedTodosMode] = useState<"standard" | "maximized">(
    todosMode === "maximized" ? "maximized" : "standard",
  );
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

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTEBOOK_TODOS_MODE_KEY, todosMode);
    } catch {
      // The panel still works when storage is unavailable.
    }
  }, [todosMode]);

  const commitManualNotes = (html: string) => {
    const normalizedHtml = normalizeNotebookHtml(html);
    onChange({ ...activeSession, manualNotes: normalizedHtml });
  };
  const deferredManualNotes = useDeferredRichTextChange(commitManualNotes);

  const updateManualNotes = (html: string) => {
    if (editorRef.current) {
      editorRef.current.dataset.empty = editorRef.current.textContent?.trim() ? "false" : "true";
    }
    deferredManualNotes.schedule(html);
  };

  const applyCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    deferredManualNotes.commitNow(editorRef.current.innerHTML);
  };

  const generateOutput = () => {
    setTodosMode((current) => current === "standard" || current === "maximized" ? "minimized" : current);
    setIsToolsOpen(true);
    setToolsTab("output");
    onGenerateOutput();
  };

  const toggleTools = () => {
    setIsToolsOpen((current) => {
      const next = !current;
      if (next) setTodosMode((mode) => mode === "standard" || mode === "maximized" ? "minimized" : mode);
      return next;
    });
  };

  const toggleTodos = () => {
    setIsToolsOpen(false);
    setTodosMode((current) => current === "standard" || current === "maximized" ? "minimized" : lastExpandedTodosMode);
  };

  const expandTodos = (mode: "standard" | "maximized") => {
    setIsToolsOpen(false);
    setLastExpandedTodosMode(mode);
    setTodosMode(mode);
  };

  const minimizeTodos = () => {
    setTodosMode((current) => {
      if (current === "standard" || current === "maximized") {
        setLastExpandedTodosMode(current);
        return "minimized";
      }
      return current;
    });
  };

  const handleWorkspacePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (todosMode !== "standard" && todosMode !== "maximized") return;
    const target = event.target as Node;
    if (todosOverlayRef.current?.contains(target)) return;
    if (target instanceof Element && target.closest("[data-notebook-todos-control]")) return;
    minimizeTodos();
  };

  const startTodosDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (target.closest("button, input, select, textarea, [contenteditable='true']")) return;
    const overlay = todosOverlayRef.current;
    const workspace = workspaceRef.current;
    if (!overlay || !workspace) return;
    const panelRect = overlay.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    todosDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: panelRect.left,
      startTop: panelRect.top,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height,
      workspaceLeft: workspaceRect.left,
      workspaceTop: workspaceRect.top,
      workspaceRight: workspaceRect.right,
      workspaceBottom: workspaceRect.bottom,
      originX: todosPosition.x,
      originY: todosPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setIsTodosDragging(true);
  };

  const moveTodosDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = todosDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const desiredLeft = drag.startLeft + event.clientX - drag.startClientX;
    const desiredTop = drag.startTop + event.clientY - drag.startClientY;
    setTodosPosition({
      x: drag.originX + desiredLeft - drag.startLeft,
      y: drag.originY + desiredTop - drag.startTop,
    });
  };

  const endTodosDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = todosDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    todosDragRef.current = null;
    setIsTodosDragging(false);
  };

  const startTodosResize = (edge: TodosResizeEdge, event: ReactPointerEvent<HTMLElement>) => {
    if (todosMode !== "standard" && todosMode !== "maximized") return;
    const overlay = todosOverlayRef.current;
    const workspace = workspaceRef.current;
    if (!overlay || !workspace) return;
    const panelRect = overlay.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    todosResizeRef.current = {
      pointerId: event.pointerId,
      edge,
      mode: todosMode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: panelRect.left,
      startTop: panelRect.top,
      startWidth: panelRect.width,
      startHeight: panelRect.height,
      workspaceLeft: workspaceRect.left,
      workspaceTop: workspaceRect.top,
      workspaceRight: workspaceRect.right,
      workspaceBottom: workspaceRect.bottom,
      originX: todosPosition.x,
      originY: todosPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setIsTodosResizing(true);
  };

  const moveTodosResize = (event: ReactPointerEvent<HTMLElement>) => {
    const resize = todosResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - resize.startClientX;
    const deltaY = event.clientY - resize.startClientY;
    const startRight = resize.startLeft + resize.startWidth;
    const startBottom = resize.startTop + resize.startHeight;
    const minimumWidth = Math.min(520, resize.workspaceRight - resize.workspaceLeft - 16);
    const minimumHeight = Math.min(360, resize.workspaceBottom - resize.workspaceTop - 16);
    let left = resize.startLeft;
    let right = startRight;
    let top = resize.startTop;
    let bottom = startBottom;

    if (resize.edge.includes("e")) {
      right = Math.min(Math.max(startRight + deltaX, left + minimumWidth), resize.workspaceRight - 8);
    }
    if (resize.edge.includes("w")) {
      left = Math.max(Math.min(resize.startLeft + deltaX, right - minimumWidth), resize.workspaceLeft + 8);
    }
    if (resize.edge.includes("s")) {
      bottom = Math.min(Math.max(startBottom + deltaY, top + minimumHeight), resize.workspaceBottom - 8);
    }
    if (resize.edge.includes("n")) {
      top = Math.max(Math.min(resize.startTop + deltaY, bottom - minimumHeight), resize.workspaceTop + 8);
    }

    const nextWidth = right - left;
    const nextHeight = bottom - top;
    setTodosSizes((current) => ({
      ...current,
      [resize.mode]: { width: nextWidth, height: nextHeight },
    }));
    setTodosPosition({
      // The overlay is right-anchored, so compensate for the left shift caused by width changes.
      x: resize.originX + left - resize.startLeft + nextWidth - resize.startWidth,
      y: resize.originY + top - resize.startTop,
    });
  };

  const endTodosResize = (event: ReactPointerEvent<HTMLElement>) => {
    const resize = todosResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    todosResizeRef.current = null;
    setIsTodosResizing(false);
  };

  const constrainTodosToWorkspace = () => {
    const overlay = todosOverlayRef.current;
    const workspace = workspaceRef.current;
    if (!overlay || !workspace) return;
    const panelRect = overlay.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const minLeft = workspaceRect.left + 8;
    const maxLeft = Math.max(minLeft, workspaceRect.right - panelRect.width - 8);
    const minTop = workspaceRect.top + 8;
    const maxTop = Math.max(minTop, workspaceRect.bottom - panelRect.height - 8);
    const boundedLeft = Math.min(Math.max(panelRect.left, minLeft), maxLeft);
    const boundedTop = Math.min(Math.max(panelRect.top, minTop), maxTop);
    const correctionX = boundedLeft - panelRect.left;
    const correctionY = boundedTop - panelRect.top;
    if (!correctionX && !correctionY) return;
    setTodosPosition((current) => ({ x: current.x + correctionX, y: current.y + correctionY }));
  };

  useEffect(() => {
    if (todosMode !== "standard" && todosMode !== "maximized") return;
    const frame = window.requestAnimationFrame(constrainTodosToWorkspace);
    window.addEventListener("resize", constrainTodosToWorkspace);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", constrainTodosToWorkspace);
    };
  }, [todosMode]);

  const activeTodosSize = todosMode === "standard" || todosMode === "maximized" ? todosSizes[todosMode] : null;

  return (
    <div
      ref={workspaceRef}
      className="notebook-workspace"
      data-side-panel-open={isToolsOpen}
      onPointerDownCapture={handleWorkspacePointerDownCapture}
      onPointerMove={moveTodosResize}
      onPointerUp={endTodosResize}
      onPointerCancel={endTodosResize}
    >
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
          onBlur={deferredManualNotes.flush}
        />
        <RichTextCommandMenu editorRef={editorRef} onContentChange={deferredManualNotes.commitNow} />
      </section>

      <aside className="notebook-tools-pane" data-open={isToolsOpen}>
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
            data-active={todosMode !== "closed"}
            data-notebook-todos-control
            aria-expanded={todosMode === "standard" || todosMode === "maximized"}
            aria-controls="notebook-todos-overlay"
            aria-label={todosMode === "standard" || todosMode === "maximized" ? "Minimize notebook todos" : "Open notebook todos"}
            onClick={toggleTodos}
          >
            <span>{todosMode === "standard" || todosMode === "maximized" ? ">" : "<"}</span>
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
      </aside>

      {todosMode === "standard" || todosMode === "maximized" ? (
        <section
          id="notebook-todos-overlay"
          ref={todosOverlayRef}
          className="notebook-todos-overlay"
          data-dragging={isTodosDragging}
          data-resizing={isTodosResizing}
          data-size={todosMode}
          aria-label="Todos workspace"
          style={{
            translate: `${todosPosition.x}px ${todosPosition.y}px`,
            ...(activeTodosSize ? { width: `${activeTodosSize.width}px`, height: `${activeTodosSize.height}px` } : {}),
          } as CSSProperties}
        >
          <NotebookTodosPanel
            todos={todos}
            onAddTodo={onAddTodo}
            onSaveTodo={onSaveTodo}
            onDeleteTodo={onDeleteTodo}
            onAddNote={onAddNoteForTodo}
            onHeaderPointerDown={startTodosDrag}
            onHeaderPointerMove={moveTodosDrag}
            onHeaderPointerUp={endTodosDrag}
            headerActions={(
              <div className="notebook-todos-window-actions">
                <button className="small-button" type="button" onClick={minimizeTodos}>Minimize</button>
                <button
                  className="small-button"
                  type="button"
                  onClick={() => {
                    void openDetachedTodosWindow().then(minimizeTodos).catch((error) => {
                      console.error("Could not open detached Todos window", error);
                    });
                  }}
                >
                  Pop out
                </button>
                <button
                  className="small-button"
                  type="button"
                  onClick={() => expandTodos(todosMode === "maximized" ? "standard" : "maximized")}
                >
                  {todosMode === "maximized" ? "Restore" : "Maximize"}
                </button>
                <button className="small-button" type="button" onClick={() => setTodosMode("closed")}>Close</button>
              </div>
            )}
          />
          {TODOS_RESIZE_EDGES.map((edge) => (
            <span
              aria-hidden="true"
              className="notebook-todos-resize-handle"
              data-edge={edge}
              key={edge}
              onPointerDown={(event) => startTodosResize(edge, event)}
              onPointerMove={moveTodosResize}
              onPointerUp={endTodosResize}
              onPointerCancel={endTodosResize}
            />
          ))}
        </section>
      ) : null}

      {todosMode === "minimized" ? (
        <button
          className="notebook-todos-launcher"
          type="button"
          data-notebook-todos-control
          onClick={() => expandTodos(lastExpandedTodosMode)}
        >
          <strong>Todos</strong>
          <span>{todos.filter((todo) => !todo.isDone).length} open</span>
        </button>
      ) : null}
    </div>
  );
};
