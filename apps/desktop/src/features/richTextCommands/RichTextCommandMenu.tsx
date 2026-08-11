import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { RichTextCommandRecord } from "@notesmith/domain";

export interface RichTextCommand {
  trigger: string;
  label: string;
  description: string;
  template: string;
}

interface RichTextCommandProviderProps {
  customCommands?: RichTextCommandRecord[];
  children: ReactNode;
}

interface RichTextCommandMenuProps {
  editorRef: RefObject<HTMLDivElement | null>;
  onContentChange: (html: string) => void;
}

type ActiveQuery = {
  query: string;
  top: number;
  left: number;
};

const RichTextCommandContext = createContext<RichTextCommandRecord[]>([]);

const BUILTIN_COMMANDS: RichTextCommand[] = [
  { trigger: "now", label: "Current time", description: "24-hour time, HH:mm", template: "{time}" },
  { trigger: "n", label: "Current time", description: "Short alias for @now", template: "{time}" },
  { trigger: "date", label: "Today's date", description: "YYYY-MM-DD", template: "{date}" },
  { trigger: "d", label: "Today's date", description: "Short alias for @date", template: "{date}" },
  { trigger: "datetime", label: "Date and time", description: "YYYY-MM-DD HH:mm", template: "{datetime}" },
  { trigger: "dt", label: "Date and time", description: "Short alias for @datetime", template: "{datetime}" },
  { trigger: "tomorrow", label: "Tomorrow", description: "Tomorrow's date", template: "{tomorrow}" },
  { trigger: "tm", label: "Tomorrow", description: "Short alias for @tomorrow", template: "{tomorrow}" },
  { trigger: "yesterday", label: "Yesterday", description: "Yesterday's date", template: "{yesterday}" },
  { trigger: "y", label: "Yesterday", description: "Short alias for @yesterday", template: "{yesterday}" },
  { trigger: "week", label: "ISO week", description: "YYYY-Www", template: "{week}" },
  { trigger: "w", label: "ISO week", description: "Short alias for @week", template: "{week}" },
  { trigger: "day", label: "Weekday", description: "Current weekday", template: "{day}" },
  { trigger: "stamp", label: "Timestamp", description: "Date, time, and separator", template: "{datetime} - " },
  { trigger: "s", label: "Timestamp", description: "Short alias for @stamp", template: "{datetime} - " },
];

const pad = (value: number) => String(value).padStart(2, "0");

const formatLocalDate = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const formatLocalTime = (value: Date) => `${pad(value.getHours())}:${pad(value.getMinutes())}`;

const formatIsoWeek = (value: Date) => {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
};

export const resolveRichTextCommandValue = (template: string, now = new Date()) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const replacements: Record<string, string> = {
    date: formatLocalDate(now),
    time: formatLocalTime(now),
    datetime: `${formatLocalDate(now)} ${formatLocalTime(now)}`,
    tomorrow: formatLocalDate(tomorrow),
    yesterday: formatLocalDate(yesterday),
    week: formatIsoWeek(now),
    day: now.toLocaleDateString(undefined, { weekday: "long" }),
  };
  return template.replace(/\{(date|time|datetime|tomorrow|yesterday|week|day)\}/g, (_, key: string) => replacements[key]);
};

export const buildRichTextCommands = (customCommands: RichTextCommandRecord[] = []) => {
  const reserved = new Set(BUILTIN_COMMANDS.map((command) => command.trigger));
  const custom = customCommands
    .map<RichTextCommand>((command) => ({
      trigger: command.trigger.replace(/^@+/, "").trim().toLowerCase(),
      label: command.label.trim() || command.trigger,
      description: "Custom text command",
      template: command.template,
    }))
    .filter((command) => /^[a-z0-9_-]{1,24}$/.test(command.trigger) && command.template.trim() && !reserved.has(command.trigger));
  return [...BUILTIN_COMMANDS, ...custom];
};

export const findRichTextCommandQuery = (text: string, offset = text.length) => {
  const beforeCaret = text.slice(0, offset);
  const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  if (!match) return null;
  return {
    query: match[1].toLowerCase(),
    start: beforeCaret.lastIndexOf("@"),
    end: offset,
  };
};

export const richTextCommandMatchesQuery = (command: RichTextCommand, query: string) =>
  !query ||
  command.trigger.startsWith(query) ||
  command.label.toLowerCase().split(/\s+/).some((word) => word.startsWith(query));

const getCommandQuery = (editor: HTMLDivElement) => {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) return null;
  const text = node.textContent || "";
  const match = findRichTextCommandQuery(text, range.startOffset);
  if (!match) return null;
  return {
    node: node as Text,
    start: match.start,
    end: match.end,
    query: match.query,
    range,
  };
};

export const RichTextCommandProvider = ({ customCommands = [], children }: RichTextCommandProviderProps) => (
  <RichTextCommandContext.Provider value={customCommands}>{children}</RichTextCommandContext.Provider>
);

export const RichTextCommandMenu = ({ editorRef, onContentChange }: RichTextCommandMenuProps) => {
  const customCommands = useContext(RichTextCommandContext);
  const commands = useMemo(() => buildRichTextCommands(customCommands), [customCommands]);
  const [activeQuery, setActiveQuery] = useState<ActiveQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(activeIndex);
  const onContentChangeRef = useRef(onContentChange);
  activeIndexRef.current = activeIndex;
  onContentChangeRef.current = onContentChange;
  const filteredCommands = useMemo(() => {
    if (!activeQuery) return [];
    return commands
      .filter((command) => richTextCommandMatchesQuery(command, activeQuery.query))
      .slice(0, 8);
  }, [activeQuery, commands]);

  useEffect(() => setActiveIndex(0), [activeQuery?.query]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const refreshQuery = () => {
      const match = getCommandQuery(editor);
      if (!match) {
        setActiveQuery(null);
        return;
      }
      const caretRange = match.range.cloneRange();
      caretRange.collapse(true);
      const rect = caretRange.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();
      setActiveQuery({
        query: match.query,
        top: Math.min(window.innerHeight - 260, (rect.height ? rect.bottom : editorRect.top + 30) + 6),
        left: Math.min(window.innerWidth - 330, Math.max(8, rect.width || rect.height ? rect.left : editorRect.left + 12)),
      });
    };

    const insertCommand = (command: RichTextCommand, suffix: "space" | "line" | "none") => {
      const match = getCommandQuery(editor);
      if (!match) return;
      const range = document.createRange();
      range.setStart(match.node, match.start);
      range.setEnd(match.node, match.end);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const insertedText = resolveRichTextCommandValue(command.template) + (suffix === "space" ? " " : "");
      const insertedWithNativeUndo = document.execCommand("insertText", false, insertedText);
      if (!insertedWithNativeUndo) {
        range.deleteContents();
        const textNode = document.createTextNode(insertedText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      if (suffix === "line") document.execCommand("insertLineBreak");
      setActiveQuery(null);
      onContentChangeRef.current(editor.innerHTML);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const match = getCommandQuery(editor);
      if (!match) return;
      const matching = commands
        .filter((command) => richTextCommandMatchesQuery(command, match.query))
        .slice(0, 8);
      if (event.key === "ArrowDown" && matching.length) {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % matching.length);
        return;
      }
      if (event.key === "ArrowUp" && matching.length) {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + matching.length) % matching.length);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveQuery(null);
        return;
      }
      if (event.key === " ") {
        const exact = commands.find((command) => command.trigger === match.query);
        if (exact) {
          event.preventDefault();
          insertCommand(exact, "space");
        }
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && matching.length) {
        event.preventDefault();
        const exact = commands.find((command) => command.trigger === match.query);
        insertCommand(exact || matching[Math.min(activeIndexRef.current, matching.length - 1)], event.key === "Enter" ? "line" : "none");
      }
    };

    const handleInput = () => refreshQuery();
    const handleBlur = () => window.setTimeout(() => setActiveQuery(null), 120);
    const handleMenuCommand = (event: Event) => {
      const trigger = (event as CustomEvent<string>).detail;
      const command = commands.find((entry) => entry.trigger === trigger);
      if (command) insertCommand(command, "none");
    };
    editor.addEventListener("input", handleInput);
    editor.addEventListener("keydown", handleKeyDown);
    editor.addEventListener("blur", handleBlur);
    editor.addEventListener("notesmith-rich-text-command", handleMenuCommand);
    return () => {
      editor.removeEventListener("input", handleInput);
      editor.removeEventListener("keydown", handleKeyDown);
      editor.removeEventListener("blur", handleBlur);
      editor.removeEventListener("notesmith-rich-text-command", handleMenuCommand);
    };
  }, [commands, editorRef]);

  if (!activeQuery || !filteredCommands.length) return null;

  return (
    <div className="rich-text-command-menu" role="listbox" aria-label="Text commands" style={{ top: activeQuery.top, left: activeQuery.left }}>
      <div className="rich-text-command-menu-heading">Text commands</div>
      {filteredCommands.map((command, index) => (
        <button
          key={command.trigger}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          data-active={index === activeIndex}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const editor = editorRef.current;
            if (!editor) return;
            editor.focus();
            editor.dispatchEvent(new CustomEvent("notesmith-rich-text-command", { detail: command.trigger }));
          }}
        >
          <strong>@{command.trigger}</strong>
          <span>{command.label}</span>
          <small>{command.description}</small>
        </button>
      ))}
      <div className="rich-text-command-menu-hint">Enter or Tab to insert | Esc to close</div>
    </div>
  );
};
