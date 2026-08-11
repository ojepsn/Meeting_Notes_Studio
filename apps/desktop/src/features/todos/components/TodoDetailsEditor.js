import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { RichTextCommandMenu } from "../../richTextCommands/RichTextCommandMenu";
import { useDeferredRichTextChange } from "../../richTextCommands/useDeferredRichTextChange";
const TASK_DETAIL_BLOCKS = [
    { label: "Body", value: "P" },
    { label: "H1", value: "H1" },
    { label: "H2", value: "H2" },
];
const normalizeTaskDetailsHtml = (value) => {
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
export const TodoDetailsEditor = ({ value, onChange, id, compact = false, placeholder = "Add task details...", }) => {
    const editorRef = useRef(null);
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || document.activeElement === editor)
            return;
        const nextHtml = value || "";
        if (editor.innerHTML !== nextHtml)
            editor.innerHTML = nextHtml;
    }, [value]);
    const deferredChange = useDeferredRichTextChange((html) => onChange(normalizeTaskDetailsHtml(html)));
    const commit = (immediate = false) => {
        if (!editorRef.current)
            return;
        const html = editorRef.current.innerHTML;
        if (immediate)
            deferredChange.commitNow(html);
        else
            deferredChange.schedule(html);
    };
    const applyCommand = (command, commandValue) => {
        editorRef.current?.focus();
        document.execCommand(command, false, commandValue);
        commit(true);
    };
    return (_jsxs("div", { className: `todo-details-editor${compact ? " todo-details-editor-compact" : ""}`, children: [_jsxs("div", { className: "todo-details-toolbar", "aria-label": "Task details formatting", children: [_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("bold"), children: "Bold" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("italic"), children: "Italic" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertUnorderedList"), children: "Bullets" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertOrderedList"), children: "Numbered" }), TASK_DETAIL_BLOCKS.map((block) => (_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("formatBlock", block.value), children: block.label }, block.value)))] }), _jsx("div", { id: id, ref: editorRef, className: "todo-details-rich-text", contentEditable: true, suppressContentEditableWarning: true, "data-placeholder": placeholder, onInput: () => commit(), onBlur: deferredChange.flush }), _jsx(RichTextCommandMenu, { editorRef: editorRef, onContentChange: deferredChange.commitNow })] }));
};
