import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateInput } from "../../../components/DateInput";
const NOTEBOOK_BLOCK_COMMANDS = [
    { id: "body", label: "Body", value: "P" },
    { id: "h1", label: "H1", value: "H1" },
    { id: "h2", label: "H2", value: "H2" },
];
const richTextToPlainText = (value) => {
    if (!value)
        return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    return (wrapper.innerText || wrapper.textContent || "").replace(/\s+/g, " ").trim();
};
const normalizeNotebookHtml = (value) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value || "";
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
    return wrapper.innerHTML.replace(/<div>/gi, "<p>").replace(/<\/div>/gi, "</p>").trim();
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
export const NotebookWorkspace = ({ sessions, activeSession, isRecordingAudio, isTranscribingAudio, isGenerating, recordingStatusNote, outputContent, onSelect, onCreate, onChange, onToggleRecording, onUploadAudio, onTranscribeAudio, onGenerateOutput, onOpenInNotes, }) => {
    const editorRef = useRef(null);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [toolsTab, setToolsTab] = useState("capture");
    const isDatedNotebookPage = activeSession.captureMode === "quick-note";
    const titleText = isDatedNotebookPage ? getNotebookTitleText(activeSession) : activeSession.title;
    const sortedSessions = useMemo(() => [...sessions].sort((left, right) => right.date.localeCompare(left.date) ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.createdAt.localeCompare(left.createdAt)), [sessions]);
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || document.activeElement === editor)
            return;
        if (editor.innerHTML !== activeSession.manualNotes) {
            editor.innerHTML = activeSession.manualNotes;
        }
        editor.dataset.empty = richTextToPlainText(activeSession.manualNotes) ? "false" : "true";
    }, [activeSession.id, activeSession.manualNotes]);
    const updateManualNotes = (html) => {
        const normalizedHtml = normalizeNotebookHtml(html);
        if (editorRef.current) {
            editorRef.current.dataset.empty = richTextToPlainText(normalizedHtml) ? "false" : "true";
        }
        onChange({ ...activeSession, manualNotes: normalizedHtml });
    };
    const applyCommand = (command, value) => {
        if (!editorRef.current)
            return;
        editorRef.current.focus();
        document.execCommand(command, false, value);
        updateManualNotes(editorRef.current.innerHTML);
    };
    const generateOutput = () => {
        setIsToolsOpen(true);
        setToolsTab("output");
        onGenerateOutput();
    };
    return (_jsxs("div", { className: "notebook-workspace", "data-tools-open": isToolsOpen, children: [_jsxs("aside", { className: "notebook-list-pane", "aria-label": "Notebook pages", children: [_jsxs("div", { className: "notebook-list-header", children: [_jsxs("div", { children: [_jsx("span", { className: "section-label", children: "Notebook" }), _jsxs("strong", { children: [sessions.length, " pages"] })] }), _jsx("button", { className: "primary-button notebook-new-button", type: "button", onClick: onCreate, children: "New page" })] }), _jsx("div", { className: "notebook-page-list", children: sortedSessions.map((session) => {
                            const preview = richTextToPlainText(session.manualNotes);
                            return (_jsxs("button", { className: "notebook-page-item", type: "button", "data-active": session.id === activeSession.id, onClick: () => onSelect(session.id), children: [_jsx("strong", { children: getNotebookListTitle(session) }), _jsx("span", { children: preview || "Empty page" })] }, session.id));
                        }) })] }), _jsxs("section", { className: "notebook-editor-pane", children: [_jsxs("header", { className: "notebook-title-row", children: [_jsx(DateInput, { id: "notebook-date", value: activeSession.date, onChange: (event) => onChange({
                                    ...activeSession,
                                    date: event.target.value,
                                    title: isDatedNotebookPage
                                        ? buildNotebookSessionTitle(event.target.value, titleText)
                                        : activeSession.title,
                                }) }), _jsx("input", { className: "notebook-title-input", value: titleText, "aria-label": "Notebook page title", placeholder: "Page title", onChange: (event) => onChange({
                                    ...activeSession,
                                    title: isDatedNotebookPage
                                        ? buildNotebookSessionTitle(activeSession.date, event.target.value)
                                        : event.target.value,
                                }) })] }), _jsxs("div", { className: "notebook-rich-toolbar", "aria-label": "Notebook formatting", children: [_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("bold"), children: "Bold" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("italic"), children: "Italic" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertUnorderedList"), children: "Bullets" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertOrderedList"), children: "Numbered" }), NOTEBOOK_BLOCK_COMMANDS.map((option) => (_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("formatBlock", option.value), children: option.label }, option.id)))] }), _jsx("div", { id: "manual-notes", ref: editorRef, className: "notebook-rich-editor", contentEditable: true, suppressContentEditableWarning: true, "data-placeholder": "Start writing...", "data-empty": "true", onInput: (event) => updateManualNotes(event.currentTarget.innerHTML) })] }), _jsxs("aside", { className: "notebook-tools-pane", "data-open": isToolsOpen, children: [_jsxs("button", { className: "notebook-tools-toggle", type: "button", "aria-expanded": isToolsOpen, "aria-label": isToolsOpen ? "Collapse notebook tools" : "Expand notebook tools", onClick: () => setIsToolsOpen((current) => !current), children: [_jsx("span", { children: isToolsOpen ? ">" : "<" }), !isToolsOpen ? _jsx("strong", { children: "Tools" }) : null] }), isToolsOpen ? (_jsxs("div", { className: "notebook-tools-content", children: [_jsxs("div", { className: "notebook-tools-tabs", role: "tablist", "aria-label": "Notebook tools", children: [_jsx("button", { type: "button", "data-active": toolsTab === "capture", onClick: () => setToolsTab("capture"), children: "Capture" }), _jsx("button", { type: "button", "data-active": toolsTab === "output", onClick: () => setToolsTab("output"), children: "Output" })] }), toolsTab === "capture" ? (_jsxs("div", { className: "notebook-capture-tools", children: [_jsxs("div", { children: [_jsx("span", { className: "section-label", children: "Recording and output" }), _jsx("h3", { children: "Bring more into this page" }), _jsx("p", { children: "Record or upload audio, transcribe it, then create an editable Output." })] }), _jsx("button", { className: isRecordingAudio ? "primary-button" : "secondary-button", type: "button", onClick: onToggleRecording, children: isRecordingAudio ? "Stop recording" : "Record microphone" }), _jsx("button", { className: "shell-button", type: "button", onClick: onUploadAudio, children: "Upload audio" }), _jsx("button", { className: "shell-button", type: "button", disabled: isTranscribingAudio, onClick: onTranscribeAudio, children: isTranscribingAudio ? "Transcribing..." : "Transcribe" }), _jsx("button", { className: "primary-button", type: "button", disabled: isGenerating, onClick: generateOutput, children: isGenerating ? "Generating..." : "Generate output" }), _jsx("p", { className: "tiny-text", children: recordingStatusNote || "Microphone recording is saved with this notebook session." }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenInNotes("capture"), children: "Open full session in Notes" })] })) : (_jsx("div", { className: "notebook-output-tools", children: outputContent }))] })) : null] })] }));
};
