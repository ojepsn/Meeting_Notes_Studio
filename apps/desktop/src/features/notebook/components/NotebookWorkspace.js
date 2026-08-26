import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateInput } from "../../../components/DateInput";
import { DeferredTimeInput } from "../../../components/DeferredTimeInput";
import { DeferredTextInput } from "../../../components/DeferredTextInput";
import { TokenPicker } from "../../../components/TokenPicker";
import { getActivitiesForSelection, getProjectsForDomain } from "../../../lib/structure/options";
import { NotebookTodosPanel } from "./NotebookTodosPanel";
import { openDetachedTodosWindow } from "../todosWindowBridge";
import { isTauriRuntime } from "../../../lib/storage/environment";
import { RichTextCommandMenu } from "../../richTextCommands/RichTextCommandMenu";
import { useDeferredRichTextChange } from "../../richTextCommands/useDeferredRichTextChange";
const NOTEBOOK_BLOCK_COMMANDS = [
    { id: "body", label: "Body", value: "P" },
    { id: "h1", label: "H1", value: "H1" },
    { id: "h2", label: "H2", value: "H2" },
];
const TODOS_RESIZE_EDGES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const NOTEBOOK_TODOS_MODE_KEY = "notesmith:notebook-todos-mode";
const readNotebookTodosMode = () => {
    // Desktop Todos live in their own native window and must never restore as a clipped DOM overlay.
    if (isTauriRuntime())
        return "closed";
    try {
        const saved = window.localStorage.getItem(NOTEBOOK_TODOS_MODE_KEY);
        if (saved === "minimized" || saved === "standard" || saved === "maximized")
            return saved;
    }
    catch {
        // Storage may be unavailable in restricted browser contexts.
    }
    return "closed";
};
const richTextToPlainText = (value) => {
    if (!value)
        return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    return (wrapper.innerText || wrapper.textContent || "").replace(/\s+/g, " ").trim();
};
export const preserveNotebookRowBreaks = (value) => value
    .replace(/<div(?:\s[^>]*)?>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>");
const normalizeNotebookHtml = (value) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = preserveNotebookRowBreaks(value || "");
    const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H1", "H2"]);
    wrapper.querySelectorAll("*").forEach((element) => {
        if (!allowedTags.has(element.tagName)) {
            const fragment = document.createDocumentFragment();
            while (element.firstChild)
                fragment.appendChild(element.firstChild);
            element.replaceWith(fragment);
            return;
        }
        Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
    });
    return wrapper.innerHTML.trim();
};
export const getNotebookTitleText = (session) => {
    if (session.title === session.date)
        return "";
    const prefix = `${session.date} `;
    return session.title.startsWith(prefix) ? session.title.slice(prefix.length) : session.title;
};
export const buildNotebookSessionTitle = (date, titleText) => titleText ? `${date} ${titleText}` : date;
export const getNotebookListTitle = (session) => {
    const titleText = (session.captureMode === "quick-note" ? getNotebookTitleText(session) : session.title).trim();
    if (session.title === session.date || session.title.startsWith(`${session.date} `)) {
        return session.title === session.date ? `${session.date} Untitled note` : session.title;
    }
    return titleText ? `${session.date} ${titleText}` : `${session.date} Untitled note`;
};
const normalizeFilterValue = (value) => value.trim().toLocaleLowerCase();
export const filterNotebookSessions = (sessions, filters) => {
    const query = normalizeFilterValue(filters.query);
    const domain = normalizeFilterValue(filters.domain);
    const project = normalizeFilterValue(filters.project);
    const activity = normalizeFilterValue(filters.activity);
    return sessions.filter((session) => {
        if (domain !== "all" && normalizeFilterValue(session.domain) !== domain)
            return false;
        if (project !== "all" && normalizeFilterValue(session.project) !== project)
            return false;
        if (activity !== "all" && normalizeFilterValue(session.activity) !== activity)
            return false;
        if (!query)
            return true;
        const searchableText = [
            session.date,
            session.startTime,
            session.title,
            session.domain,
            session.project,
            session.activity,
            session.manualNotes.replace(/<[^>]*>/g, " "),
        ].join(" ").toLocaleLowerCase();
        return searchableText.includes(query);
    });
};
export const compareNotebookSessionsNewestFirst = (left, right) => right.date.localeCompare(left.date) ||
    right.startTime.localeCompare(left.startTime) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt);
const collectNotebookStructureValues = (sessions, field) => Array.from(new Map(sessions
    .map((session) => session[field].trim())
    .filter(Boolean)
    .map((value) => [value.toLocaleLowerCase(), value])).values()).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
export const NotebookWorkspace = ({ sessions, todos, runningTodoIds, activeSession, structureOptions, isTimeTracking, isRecordingAudio, isTranscribingAudio, isGenerating, recordingStatusNote, outputContent, onSelect, onCreate, onDelete, onAddTodo, onSaveTodo, onDeleteTodo, onAddNoteForTodo, onToggleTodoTime, onChange, onToggleRecording, onUploadAudio, onTranscribeAudio, onGenerateOutput, onOpenInNotes, onToggleTimeTracking, }) => {
    const workspaceRef = useRef(null);
    const editorRef = useRef(null);
    const todosOverlayRef = useRef(null);
    const todosDragRef = useRef(null);
    const todosResizeRef = useRef(null);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [isTodosDragging, setIsTodosDragging] = useState(false);
    const [isTodosResizing, setIsTodosResizing] = useState(false);
    const [todosPosition, setTodosPosition] = useState({ x: 0, y: 0 });
    const [todosSizes, setTodosSizes] = useState({
        standard: null,
        maximized: null,
    });
    const [todosMode, setTodosMode] = useState(readNotebookTodosMode);
    const [lastExpandedTodosMode, setLastExpandedTodosMode] = useState(todosMode === "maximized" ? "maximized" : "standard");
    const [toolsTab, setToolsTab] = useState("capture");
    const [pageQuery, setPageQuery] = useState("");
    const [pageDomain, setPageDomain] = useState("all");
    const [pageProject, setPageProject] = useState("all");
    const [pageActivity, setPageActivity] = useState("all");
    const isDatedNotebookPage = activeSession.captureMode === "quick-note";
    const titleText = isDatedNotebookPage ? getNotebookTitleText(activeSession) : activeSession.title;
    const projectOptions = getProjectsForDomain(structureOptions, activeSession.domain);
    const activityOptions = getActivitiesForSelection(structureOptions, activeSession.domain, activeSession.project);
    const updateDomain = (domain) => {
        const nextProjects = getProjectsForDomain(structureOptions, domain);
        const project = nextProjects.includes(activeSession.project) ? activeSession.project : "Other";
        const nextActivities = getActivitiesForSelection(structureOptions, domain, project);
        const activity = nextActivities.includes(activeSession.activity) ? activeSession.activity : "Other";
        onChange({ ...activeSession, domain, project, activity });
    };
    const updateProject = (project) => {
        const nextActivities = getActivitiesForSelection(structureOptions, activeSession.domain, project);
        const activity = nextActivities.includes(activeSession.activity) ? activeSession.activity : "Other";
        onChange({ ...activeSession, project, activity });
    };
    const domainFilterOptions = useMemo(() => collectNotebookStructureValues(sessions, "domain"), [sessions]);
    const projectFilterOptions = useMemo(() => collectNotebookStructureValues(sessions, "project"), [sessions]);
    const activityFilterOptions = useMemo(() => collectNotebookStructureValues(sessions, "activity"), [sessions]);
    const filteredSessions = useMemo(() => filterNotebookSessions(sessions, {
        query: pageQuery,
        domain: pageDomain,
        project: pageProject,
        activity: pageActivity,
    }), [pageActivity, pageDomain, pageProject, pageQuery, sessions]);
    const sortedSessions = useMemo(() => [...filteredSessions].sort(compareNotebookSessionsNewestFirst), [filteredSessions]);
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || document.activeElement === editor)
            return;
        if (editor.innerHTML !== activeSession.manualNotes) {
            editor.innerHTML = activeSession.manualNotes;
        }
        editor.dataset.empty = richTextToPlainText(activeSession.manualNotes) ? "false" : "true";
    }, [activeSession.id, activeSession.manualNotes]);
    useEffect(() => {
        try {
            window.localStorage.setItem(NOTEBOOK_TODOS_MODE_KEY, todosMode);
        }
        catch {
            // The panel still works when storage is unavailable.
        }
    }, [todosMode]);
    useEffect(() => {
        if (todosMode !== "standard" && todosMode !== "maximized")
            return;
        const closeEmbeddedTodos = (event) => {
            if (event.key !== "Escape")
                return;
            setTodosMode("closed");
            setTodosPosition({ x: 0, y: 0 });
        };
        window.addEventListener("keydown", closeEmbeddedTodos);
        return () => window.removeEventListener("keydown", closeEmbeddedTodos);
    }, [todosMode]);
    const commitManualNotes = (html) => {
        const normalizedHtml = normalizeNotebookHtml(html);
        onChange({ ...activeSession, manualNotes: normalizedHtml });
    };
    const deferredManualNotes = useDeferredRichTextChange(commitManualNotes);
    const updateManualNotes = (html) => {
        if (editorRef.current) {
            editorRef.current.dataset.empty = editorRef.current.textContent?.trim() ? "false" : "true";
        }
        deferredManualNotes.schedule(html);
    };
    const applyCommand = (command, value) => {
        if (!editorRef.current)
            return;
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
            if (next)
                setTodosMode((mode) => mode === "standard" || mode === "maximized" ? "minimized" : mode);
            return next;
        });
    };
    const openTodos = () => {
        setIsToolsOpen(false);
        if (isTauriRuntime()) {
            setTodosMode("closed");
            void openDetachedTodosWindow().catch((error) => {
                console.error("Could not open detached Todos window", error);
                setTodosMode(lastExpandedTodosMode);
            });
            return;
        }
        setTodosMode((current) => current === "standard" || current === "maximized" ? "minimized" : lastExpandedTodosMode);
    };
    const expandTodos = (mode) => {
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
    const handleWorkspacePointerDownCapture = (event) => {
        if (todosMode !== "standard" && todosMode !== "maximized")
            return;
        const target = event.target;
        if (todosOverlayRef.current?.contains(target))
            return;
        if (target instanceof Element && target.closest("[data-notebook-todos-control]"))
            return;
        minimizeTodos();
    };
    const startTodosDrag = (event) => {
        const target = event.target;
        if (target.closest("button, input, select, textarea, [contenteditable='true']"))
            return;
        const overlay = todosOverlayRef.current;
        const workspace = workspaceRef.current;
        if (!overlay || !workspace)
            return;
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
    const moveTodosDrag = (event) => {
        const drag = todosDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        const desiredLeft = drag.startLeft + event.clientX - drag.startClientX;
        const desiredTop = drag.startTop + event.clientY - drag.startClientY;
        setTodosPosition({
            x: drag.originX + desiredLeft - drag.startLeft,
            y: drag.originY + desiredTop - drag.startTop,
        });
    };
    const endTodosDrag = (event) => {
        const drag = todosDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        todosDragRef.current = null;
        setIsTodosDragging(false);
    };
    const startTodosResize = (edge, event) => {
        if (todosMode !== "standard" && todosMode !== "maximized")
            return;
        const overlay = todosOverlayRef.current;
        const workspace = workspaceRef.current;
        if (!overlay || !workspace)
            return;
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
    const moveTodosResize = (event) => {
        const resize = todosResizeRef.current;
        if (!resize || resize.pointerId !== event.pointerId)
            return;
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
    const endTodosResize = (event) => {
        const resize = todosResizeRef.current;
        if (!resize || resize.pointerId !== event.pointerId)
            return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        todosResizeRef.current = null;
        setIsTodosResizing(false);
    };
    const constrainTodosToWorkspace = () => {
        const overlay = todosOverlayRef.current;
        const workspace = workspaceRef.current;
        if (!overlay || !workspace)
            return;
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
        if (!correctionX && !correctionY)
            return;
        setTodosPosition((current) => ({ x: current.x + correctionX, y: current.y + correctionY }));
    };
    useEffect(() => {
        if (todosMode !== "standard" && todosMode !== "maximized")
            return;
        const frame = window.requestAnimationFrame(constrainTodosToWorkspace);
        window.addEventListener("resize", constrainTodosToWorkspace);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("resize", constrainTodosToWorkspace);
        };
    }, [todosMode]);
    const activeTodosSize = todosMode === "standard" || todosMode === "maximized" ? todosSizes[todosMode] : null;
    return (_jsxs("div", { ref: workspaceRef, className: "notebook-workspace", "data-side-panel-open": isToolsOpen, onPointerDownCapture: handleWorkspacePointerDownCapture, onPointerMove: moveTodosResize, onPointerUp: endTodosResize, onPointerCancel: endTodosResize, children: [_jsxs("aside", { className: "notebook-list-pane", "aria-label": "Notebook pages", children: [_jsxs("div", { className: "notebook-list-header", children: [_jsxs("div", { children: [_jsx("span", { className: "section-label", children: "Notebook" }), _jsxs("strong", { children: [filteredSessions.length === sessions.length ? sessions.length : `${filteredSessions.length}/${sessions.length}`, " pages"] })] }), _jsx("button", { className: "primary-button notebook-new-button", type: "button", onClick: onCreate, children: "New page" })] }), _jsxs("div", { className: "notebook-page-filters", "aria-label": "Filter notebook pages", children: [_jsx("input", { className: "notebook-page-filter-query", type: "search", value: pageQuery, "aria-label": "Filter notebook pages by text", placeholder: "Filter pages", onChange: (event) => setPageQuery(event.target.value) }), _jsxs("select", { value: pageDomain, "aria-label": "Filter notebook pages by domain", onChange: (event) => setPageDomain(event.target.value), children: [_jsx("option", { value: "all", children: "All domains" }), domainFilterOptions.map((value) => _jsx("option", { value: value, children: value }, value))] }), _jsxs("select", { value: pageProject, "aria-label": "Filter notebook pages by project", onChange: (event) => setPageProject(event.target.value), children: [_jsx("option", { value: "all", children: "All projects" }), projectFilterOptions.map((value) => _jsx("option", { value: value, children: value }, value))] }), _jsxs("select", { value: pageActivity, "aria-label": "Filter notebook pages by activity", onChange: (event) => setPageActivity(event.target.value), children: [_jsx("option", { value: "all", children: "All activities" }), activityFilterOptions.map((value) => _jsx("option", { value: value, children: value }, value))] })] }), _jsxs("div", { className: "notebook-page-list", children: [sortedSessions.map((session) => (_jsxs("div", { className: "notebook-page-item", "data-active": session.id === activeSession.id, children: [_jsx("button", { className: "notebook-page-select", type: "button", onClick: () => onSelect(session.id), children: _jsx("strong", { children: getNotebookListTitle(session) }) }), _jsx("button", { className: "notebook-page-delete", type: "button", "aria-label": `Delete ${getNotebookListTitle(session)}`, title: "Move to deleted sessions", onClick: () => onDelete(session.id), children: "x" })] }, session.id))), !sortedSessions.length ? _jsx("p", { className: "notebook-page-filter-empty", children: "No pages match these filters." }) : null] })] }), _jsxs("section", { className: "notebook-editor-pane", children: [_jsxs("header", { className: "notebook-title-row", children: [_jsx(DateInput, { id: "notebook-date", className: "notebook-date-input", value: activeSession.date, onChange: (event) => onChange({
                                    ...activeSession,
                                    date: event.target.value,
                                    title: isDatedNotebookPage
                                        ? buildNotebookSessionTitle(event.target.value, titleText)
                                        : activeSession.title,
                                }) }), _jsx(DeferredTimeInput, { id: "notebook-time", className: "notebook-time-input", value: activeSession.startTime, "aria-label": "Notebook page time", onCommit: (startTime) => onChange({ ...activeSession, startTime }) }), _jsx(DeferredTextInput, { className: "notebook-title-input", value: titleText, "aria-label": "Notebook page title", placeholder: "Page title", onCommit: (nextTitle) => onChange({
                                    ...activeSession,
                                    title: isDatedNotebookPage
                                        ? buildNotebookSessionTitle(activeSession.date, nextTitle)
                                        : nextTitle,
                                }) }, `${activeSession.id}-title`), _jsx("button", { className: "secondary-button notebook-open-session-button", type: "button", onClick: () => onOpenInNotes("capture"), children: "Open/create Session" })] }), _jsxs("div", { className: "notebook-context-bar", "aria-label": "Notebook page context and time tracking", children: [_jsxs("label", { children: [_jsx("span", { children: "Domain" }), _jsx(TokenPicker, { id: "notebook-page-domain", value: activeSession.domain, savedOptions: structureOptions.domains, suggestedOptions: structureOptions.domains, placeholder: "Domain", mode: "single", onChange: updateDomain })] }), _jsxs("label", { children: [_jsx("span", { children: "Project" }), _jsx(TokenPicker, { id: "notebook-page-project", value: activeSession.project, savedOptions: projectOptions, suggestedOptions: projectOptions, placeholder: "Project", mode: "single", onChange: updateProject })] }), _jsxs("label", { children: [_jsx("span", { children: "Activity" }), _jsx(TokenPicker, { id: "notebook-page-activity", value: activeSession.activity, savedOptions: activityOptions, suggestedOptions: activityOptions, placeholder: "Activity", mode: "single", onChange: (activity) => onChange({ ...activeSession, activity }) })] }), _jsx("button", { className: isTimeTracking ? "primary-button notebook-time-button" : "small-button notebook-time-button", type: "button", onClick: onToggleTimeTracking, children: isTimeTracking ? "Stop time" : "Start time" })] }), _jsxs("div", { className: "notebook-rich-toolbar", "aria-label": "Notebook formatting", children: [_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("bold"), children: "Bold" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("italic"), children: "Italic" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertUnorderedList"), children: "Bullets" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertOrderedList"), children: "Numbered" }), NOTEBOOK_BLOCK_COMMANDS.map((option) => (_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("formatBlock", option.value), children: option.label }, option.id)))] }), _jsx("div", { id: "manual-notes", ref: editorRef, className: "notebook-rich-editor", contentEditable: true, suppressContentEditableWarning: true, "data-placeholder": "Start writing...", "data-empty": "true", onInput: (event) => updateManualNotes(event.currentTarget.innerHTML), onBlur: deferredManualNotes.flush }), _jsx(RichTextCommandMenu, { editorRef: editorRef, onContentChange: deferredManualNotes.commitNow })] }), _jsxs("aside", { className: "notebook-tools-pane", "data-open": isToolsOpen, children: [_jsxs("div", { className: "notebook-side-toggle-rail", children: [_jsxs("button", { className: "notebook-tools-toggle", type: "button", "data-active": isToolsOpen, "aria-expanded": isToolsOpen, "aria-controls": "notebook-tools-content", "aria-label": isToolsOpen ? "Collapse notebook tools" : "Expand notebook tools", onClick: toggleTools, children: [_jsx("span", { children: isToolsOpen ? ">" : "<" }), _jsx("strong", { children: "Tools" })] }), _jsxs("button", { className: "notebook-tools-toggle", type: "button", "data-active": todosMode !== "closed", "data-notebook-todos-control": true, "aria-expanded": todosMode === "standard" || todosMode === "maximized", "aria-controls": "notebook-todos-overlay", "aria-label": todosMode === "standard" || todosMode === "maximized" ? "Minimize notebook todos" : "Open notebook todos", onClick: openTodos, children: [_jsx("span", { children: todosMode === "standard" || todosMode === "maximized" ? ">" : "<" }), _jsx("strong", { children: "Todos" })] })] }), isToolsOpen ? (_jsxs("div", { id: "notebook-tools-content", className: "notebook-tools-content", children: [_jsxs("div", { className: "notebook-tools-tabs", role: "tablist", "aria-label": "Notebook tools", children: [_jsx("button", { type: "button", "data-active": toolsTab === "capture", onClick: () => setToolsTab("capture"), children: "Capture" }), _jsx("button", { type: "button", "data-active": toolsTab === "output", onClick: () => setToolsTab("output"), children: "Output" })] }), toolsTab === "capture" ? (_jsxs("div", { className: "notebook-capture-tools", children: [_jsxs("div", { children: [_jsx("span", { className: "section-label", children: "Recording and output" }), _jsx("h3", { children: "Bring more into this page" }), _jsx("p", { children: "Record or upload audio, transcribe it, then create an editable Output." })] }), _jsx("button", { className: isRecordingAudio ? "primary-button" : "secondary-button", type: "button", onClick: onToggleRecording, children: isRecordingAudio ? "Stop recording" : "Record microphone" }), _jsx("button", { className: "shell-button", type: "button", onClick: onUploadAudio, children: "Upload audio" }), _jsx("button", { className: "shell-button", type: "button", disabled: isTranscribingAudio, onClick: onTranscribeAudio, children: isTranscribingAudio ? "Transcribing..." : "Transcribe" }), _jsx("button", { className: "primary-button", type: "button", disabled: isGenerating, onClick: generateOutput, children: isGenerating ? "Generating..." : "Generate output" }), _jsx("p", { className: "tiny-text", children: recordingStatusNote || "Microphone recording is saved with this notebook session." }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenInNotes("capture"), children: "Open full session in Notes" })] })) : (_jsx("div", { className: "notebook-output-tools", children: outputContent }))] })) : null] }), todosMode === "standard" || todosMode === "maximized" ? (_jsxs("section", { id: "notebook-todos-overlay", ref: todosOverlayRef, className: "notebook-todos-overlay", "data-dragging": isTodosDragging, "data-resizing": isTodosResizing, "data-size": todosMode, "aria-label": "Todos workspace", style: {
                    translate: `${todosPosition.x}px ${todosPosition.y}px`,
                    ...(activeTodosSize ? { width: `${activeTodosSize.width}px`, height: `${activeTodosSize.height}px` } : {}),
                }, children: [_jsx(NotebookTodosPanel, { todos: todos, runningTodoIds: runningTodoIds, onAddTodo: onAddTodo, onSaveTodo: onSaveTodo, onDeleteTodo: onDeleteTodo, onAddNote: onAddNoteForTodo, onToggleTime: onToggleTodoTime, onHeaderPointerDown: startTodosDrag, onHeaderPointerMove: moveTodosDrag, onHeaderPointerUp: endTodosDrag, headerActions: (_jsxs("div", { className: "notebook-todos-window-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: minimizeTodos, children: "Minimize" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                        void openDetachedTodosWindow().then(minimizeTodos).catch((error) => {
                                            console.error("Could not open detached Todos window", error);
                                        });
                                    }, children: "Pop out" }), _jsx("button", { className: "small-button", type: "button", onClick: () => expandTodos(todosMode === "maximized" ? "standard" : "maximized"), children: todosMode === "maximized" ? "Restore" : "Maximize" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setTodosMode("closed"), children: "Close" })] })) }), TODOS_RESIZE_EDGES.map((edge) => (_jsx("span", { "aria-hidden": "true", className: "notebook-todos-resize-handle", "data-edge": edge, onPointerDown: (event) => startTodosResize(edge, event), onPointerMove: moveTodosResize, onPointerUp: endTodosResize, onPointerCancel: endTodosResize }, edge)))] })) : null, todosMode === "minimized" ? (_jsxs("button", { className: "notebook-todos-launcher", type: "button", "data-notebook-todos-control": true, onClick: openTodos, children: [_jsx("strong", { children: "Todos" }), _jsxs("span", { children: [todos.filter((todo) => !todo.isDone).length, " open"] })] })) : null] }));
};
