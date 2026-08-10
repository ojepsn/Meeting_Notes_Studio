import { useEffect, useRef } from "react";
import { RichTextCommandMenu } from "../../richTextCommands/RichTextCommandMenu";

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
] as const;

const normalizeTaskDetailsHtml = (value: string) => {
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

  const commit = () => {
    if (!editorRef.current) return;
    onChange(normalizeTaskDetailsHtml(editorRef.current.innerHTML));
  };

  const applyCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    commit();
  };

  return (
    <div className={`todo-details-editor${compact ? " todo-details-editor-compact" : ""}`}>
      <div className="todo-details-toolbar" aria-label="Task details formatting">
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
        onInput={commit}
      />
      <RichTextCommandMenu editorRef={editorRef} onContentChange={(html) => onChange(normalizeTaskDetailsHtml(html))} />
    </div>
  );
};
