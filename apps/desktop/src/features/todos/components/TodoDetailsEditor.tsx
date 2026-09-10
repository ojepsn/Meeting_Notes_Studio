import { useEffect, useRef } from "react";
import { RichTextCommandMenu } from "../../richTextCommands/RichTextCommandMenu";
import { useDeferredRichTextChange } from "../../richTextCommands/useDeferredRichTextChange";
import { applyRichTextFont, applyRichTextFontSize, normalizeRichTextInlineFormatting, preserveAllowedRichTextStyles, RICH_TEXT_FONT_OPTIONS, RICH_TEXT_FONT_SIZE_OPTIONS } from "../../richTextCommands/richTextFormatting";

interface TodoDetailsEditorProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  compact?: boolean;
  placeholder?: string;
}

const TASK_DETAIL_BLOCKS = [
  { label: "Body", value: "P" },
  { label: "H1", value: "H1" },
  { label: "H2", value: "H2" },
  { label: "H3", value: "H3" },
  { label: "H4", value: "H4" },
  { label: "H5", value: "H5" },
  { label: "H6", value: "H6" },
] as const;

const normalizeTaskDetailsHtml = (value: string) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value || "";
  normalizeRichTextInlineFormatting(wrapper);
  const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A"]);
  wrapper.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      while (element.firstChild) fragment.appendChild(element.firstChild);
      element.replaceWith(fragment);
      return;
    }
    preserveAllowedRichTextStyles(element);
  });
  return wrapper.innerHTML.replace(/<div>/gi, "<p>").replace(/<\/div>/gi, "</p>").trim();
};

export const TodoDetailsEditor = ({
  value,
  onChange,
  id,
  compact = false,
  placeholder = "Add task details...",
}: TodoDetailsEditorProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const nextHtml = value || "";
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
  }, [value]);

  const deferredChange = useDeferredRichTextChange((html) => onChange(normalizeTaskDetailsHtml(html)));

  const commit = (immediate = false) => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (immediate) deferredChange.commitNow(html);
    else deferredChange.schedule(html);
  };

  const applyCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    commit(true);
  };

  return (
    <div className={`todo-details-editor${compact ? " todo-details-editor-compact" : ""}`}>
      <div className="todo-details-toolbar" aria-label="Task details formatting">
        <select
          aria-label="Font"
          defaultValue=""
          onChange={(event) => {
            if (editorRef.current && event.target.value) applyRichTextFont(editorRef.current, event.target.value);
            commit(true);
            event.target.value = "";
          }}
        >
          <option value="">Font</option>
          {RICH_TEXT_FONT_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
        </select>
        <select
          aria-label="Font size"
          defaultValue=""
          onChange={(event) => {
            if (editorRef.current && event.target.value) applyRichTextFontSize(editorRef.current, event.target.value);
            commit(true);
            event.target.value = "";
          }}
        >
          <option value="">Size</option>
          {RICH_TEXT_FONT_SIZE_OPTIONS.map((option) => <option key={option.commandValue} value={option.commandValue}>{option.label}</option>)}
        </select>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("bold")}>Bold</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("italic")}>Italic</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertUnorderedList")}>Bullets</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertOrderedList")}>Numbered</button>
        {TASK_DETAIL_BLOCKS.map((block) => (
          <button key={block.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("formatBlock", block.value)}>
            {block.label}
          </button>
        ))}
      </div>
      <div
        id={id}
        ref={editorRef}
        className="todo-details-rich-text"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => commit()}
        onBlur={deferredChange.flush}
      />
      <RichTextCommandMenu editorRef={editorRef} onContentChange={deferredChange.commitNow} />
    </div>
  );
};
