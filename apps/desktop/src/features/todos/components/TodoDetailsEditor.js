import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { RichTextCommandMenu } from "../../richTextCommands/RichTextCommandMenu";
import { useDeferredRichTextChange } from "../../richTextCommands/useDeferredRichTextChange";
import { applyRichTextFont, applyRichTextFontSize, normalizeRichTextInlineFormatting, preserveAllowedRichTextStyles, RICH_TEXT_FONT_OPTIONS, RICH_TEXT_FONT_SIZE_OPTIONS } from "../../richTextCommands/richTextFormatting";
const TASK_DETAIL_BLOCKS = [
    { label: "Body", value: "P" },
    { label: "H1", value: "H1" },
    { label: "H2", value: "H2" },
    { label: "H3", value: "H3" },
    { label: "H4", value: "H4" },
    { label: "H5", value: "H5" },
    { label: "H6", value: "H6" },
];
const normalizeTaskDetailsHtml = (value) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value || "";
    normalizeRichTextInlineFormatting(wrapper);
    const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A"]);
    wrapper.querySelectorAll("*").forEach((element) => {
        if (!allowedTags.has(element.tagName)) {
            const fragment = document.createDocumentFragment();
            while (element.firstChild)
                fragment.appendChild(element.firstChild);
            element.replaceWith(fragment);
            return;
        }
        preserveAllowedRichTextStyles(element);
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
    return (_jsxs("div", { className: `todo-details-editor${compact ? " todo-details-editor-compact" : ""}`, children: [_jsxs("div", { className: "todo-details-toolbar", "aria-label": "Task details formatting", children: [_jsxs("select", { "aria-label": "Font", defaultValue: "", onChange: (event) => {
                            if (editorRef.current && event.target.value)
                                applyRichTextFont(editorRef.current, event.target.value);
                            commit(true);
                            event.target.value = "";
                        }, children: [_jsx("option", { value: "", children: "Font" }), RICH_TEXT_FONT_OPTIONS.map((option) => _jsx("option", { value: option.value, children: option.label }, option.label))] }), _jsxs("select", { "aria-label": "Font size", defaultValue: "", onChange: (event) => {
                            if (editorRef.current && event.target.value)
                                applyRichTextFontSize(editorRef.current, event.target.value);
                            commit(true);
                            event.target.value = "";
                        }, children: [_jsx("option", { value: "", children: "Size" }), RICH_TEXT_FONT_SIZE_OPTIONS.map((option) => _jsx("option", { value: option.commandValue, children: option.label }, option.commandValue))] }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("bold"), children: "Bold" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("italic"), children: "Italic" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertUnorderedList"), children: "Bullets" }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("insertOrderedList"), children: "Numbered" }), TASK_DETAIL_BLOCKS.map((block) => (_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => applyCommand("formatBlock", block.value), children: block.label }, block.value)))] }), _jsx("div", { id: id, ref: editorRef, className: "todo-details-rich-text", contentEditable: true, suppressContentEditableWarning: true, "data-placeholder": placeholder, onInput: () => commit(), onBlur: deferredChange.flush }), _jsx(RichTextCommandMenu, { editorRef: editorRef, onContentChange: deferredChange.commitNow })] }));
};
