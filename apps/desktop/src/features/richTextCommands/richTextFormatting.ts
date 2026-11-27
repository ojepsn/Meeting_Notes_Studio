export const RICH_TEXT_FONT_OPTIONS = [
  { label: "Aptos", value: "Aptos, Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, Georgia, serif" },
  { label: "Calibri", value: "Calibri, Arial, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Monospace", value: "Consolas, 'Courier New', monospace" },
] as const;

export const RICH_TEXT_FONT_SIZE_OPTIONS = [
  { label: "10 px", commandValue: "1", cssValue: "10px" },
  { label: "13 px", commandValue: "2", cssValue: "13px" },
  { label: "16 px", commandValue: "3", cssValue: "16px" },
  { label: "18 px", commandValue: "4", cssValue: "18px" },
  { label: "24 px", commandValue: "5", cssValue: "24px" },
  { label: "32 px", commandValue: "6", cssValue: "32px" },
  { label: "48 px", commandValue: "7", cssValue: "48px" },
] as const;

const normalizeFontFamily = (value: string) => value.replace(/["']/g, "").replace(/\s*,\s*/g, ", ").trim();
const allowedFontSizes = new Set<string>(RICH_TEXT_FONT_SIZE_OPTIONS.map((option) => option.cssValue));
const PASTED_RICH_TEXT_BLOCK_TAGS = new Set(["P", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "TABLE"]);

export const RICH_TEXT_TABLE_TAGS = ["TABLE", "CAPTION", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD"] as const;
const richTextTableTagSet = new Set<string>(RICH_TEXT_TABLE_TAGS);

export const RICH_TEXT_CHECKLIST_ATTRIBUTE = "data-notesmith-checklist";
export const RICH_TEXT_CHECKED_ATTRIBUTE = "data-checked";

export const isRichTextChecklist = (element: Element | null) =>
  element?.tagName === "UL" && element.getAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE) === "true";

export const isRichTextChecklistItem = (element: Element | null) =>
  element?.tagName === "LI" && isRichTextChecklist(element.parentElement);

export const resolveSafeRichTextHref = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};

export const resolveAllowedRichTextFont = (value: string) => {
  const normalized = normalizeFontFamily(value);
  return RICH_TEXT_FONT_OPTIONS.find((option) => normalizeFontFamily(option.value) === normalized)?.value ?? "";
};

export const resolveToolbarFontFamily = (value: string) => {
  const normalized = normalizeFontFamily(value);
  const exact = resolveAllowedRichTextFont(normalized);
  if (exact) return exact;
  const firstFamily = normalized.split(",")[0]?.trim();
  return RICH_TEXT_FONT_OPTIONS.find((option) => normalizeFontFamily(option.value).split(",")[0]?.trim() === firstFamily)?.value ?? "";
};

export const normalizeRichTextInlineFormatting = (wrapper: HTMLElement) => {
  wrapper.querySelectorAll("font").forEach((fontElement) => {
    const span = document.createElement("span");
    const fontFamily = resolveAllowedRichTextFont(fontElement.getAttribute("face") ?? "");
    const fontSize = RICH_TEXT_FONT_SIZE_OPTIONS.find((option) => option.commandValue === fontElement.getAttribute("size"))?.cssValue;
    if (fontFamily) span.style.fontFamily = fontFamily;
    if (fontSize) span.style.fontSize = fontSize;
    while (fontElement.firstChild) span.appendChild(fontElement.firstChild);
    fontElement.replaceWith(span);
  });
};

export const preserveAllowedRichTextStyles = (element: Element) => {
  const fontFamily = element instanceof HTMLElement ? resolveAllowedRichTextFont(element.style.fontFamily) : "";
  const fontSize = element instanceof HTMLElement && allowedFontSizes.has(element.style.fontSize) ? element.style.fontSize : "";
  const href = element.tagName === "A" ? resolveSafeRichTextHref(element.getAttribute("href") ?? "") : "";
  const isChecklist = isRichTextChecklist(element);
  const isChecklistItem = isRichTextChecklistItem(element);
  const isChecked = isChecklistItem && element.getAttribute(RICH_TEXT_CHECKED_ATTRIBUTE) === "true";
  const isTableCell = element.tagName === "TH" || element.tagName === "TD";
  const columnSpan = isTableCell ? normalizeRichTextTableSpan(element.getAttribute("colspan")) : "";
  const rowSpan = isTableCell ? normalizeRichTextTableSpan(element.getAttribute("rowspan")) : "";
  const headerScope = element.tagName === "TH" && ["col", "row"].includes(element.getAttribute("scope") ?? "")
    ? element.getAttribute("scope") ?? ""
    : "";
  Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
  if (!(element instanceof HTMLElement)) return;
  if (isChecklist) element.setAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE, "true");
  if (isChecklistItem) element.setAttribute(RICH_TEXT_CHECKED_ATTRIBUTE, isChecked ? "true" : "false");
  if (columnSpan) element.setAttribute("colspan", columnSpan);
  if (rowSpan) element.setAttribute("rowspan", rowSpan);
  if (headerScope) element.setAttribute("scope", headerScope);
  if (fontFamily) element.style.fontFamily = fontFamily;
  if (fontSize) element.style.fontSize = fontSize;
  if (element.tagName === "A" && href) {
    element.setAttribute("href", href);
    element.setAttribute("target", "_blank");
    element.setAttribute("rel", "noopener noreferrer");
  }
};

export const isRichTextTableTag = (tagName: string) => richTextTableTagSet.has(tagName.toUpperCase());

export const normalizeRichTextTableSpan = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 2 && parsed <= 20 ? String(parsed) : "";
};

const selectedListInsideEditor = (editor: HTMLDivElement) => {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const node = selection.getRangeAt(0).startContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  if (!element || !editor.contains(element)) return null;
  const list = element.closest("ul, ol");
  return list && editor.contains(list) ? list : null;
};

export const insertRichTextChecklist = (editor: HTMLDivElement) => {
  editor.focus();
  const selectedList = selectedListInsideEditor(editor);
  let lists: Element[] = selectedList?.tagName === "UL" ? [selectedList] : [];
  if (!lists.length) {
    const previousLists = new Map<Element, Set<Element>>(Array.from(editor.querySelectorAll("ul"), (list) => [
      list,
      new Set(list.querySelectorAll(":scope > li")),
    ]));
    document.execCommand("insertUnorderedList");
    // execCommand may leave the selection on the editor or paragraph boundary.
    // It can also merge the new item into an adjacent, pre-existing bullet list.
    lists = Array.from(editor.querySelectorAll("ul")).filter((list) => !previousLists.has(list));
    previousLists.forEach((oldItems, oldList) => {
      if (!editor.contains(oldList)) return;
      const currentItems = Array.from(oldList.querySelectorAll(":scope > li"));
      const newItems = currentItems.filter((item) => !oldItems.has(item));
      if (!newItems.length) return;
      if (!oldItems.size) {
        lists.push(oldList);
        return;
      }
      const firstOldIndex = currentItems.findIndex((item) => oldItems.has(item));
      const lastOldIndex = currentItems.reduce((last, item, index) => oldItems.has(item) ? index : last, -1);
      const beforeOldItems = newItems.every((item) => currentItems.indexOf(item) < firstOldIndex);
      const afterOldItems = newItems.every((item) => currentItems.indexOf(item) > lastOldIndex);
      if (!beforeOldItems && !afterOldItems) return;
      const newList = document.createElement("ul");
      newList.append(...newItems);
      if (beforeOldItems) oldList.before(newList);
      else oldList.after(newList);
      lists.push(newList);
    });
    if (!lists.length) {
      const listAtSelection = selectedListInsideEditor(editor);
      if (listAtSelection?.tagName === "UL" && !previousLists.has(listAtSelection)) lists = [listAtSelection];
    }
  }
  if (!lists.length) return false;
  lists.forEach((list) => {
    list.setAttribute(RICH_TEXT_CHECKLIST_ATTRIBUTE, "true");
    list.querySelectorAll(":scope > li").forEach((item) => {
      if (!item.hasAttribute(RICH_TEXT_CHECKED_ATTRIBUTE)) {
        item.setAttribute(RICH_TEXT_CHECKED_ATTRIBUTE, "false");
      }
    });
  });
  const selection = window.getSelection();
  const startContainer = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
  if (selection && !lists.some((list) => startContainer && list.contains(startContainer))) {
    const firstItem = lists[0].querySelectorAll(":scope > li")[0];
    if (firstItem) {
      const range = document.createRange();
      range.selectNodeContents(firstItem);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  return true;
};

export const insertRichTextTable = (editor: HTMLDivElement, rowCount = 3, columnCount = 3) => {
  editor.focus();
  const rows = Math.max(2, Math.min(10, Math.round(rowCount)));
  const columns = Math.max(2, Math.min(10, Math.round(columnCount)));
  const table = document.createElement("table");
  const head = table.createTHead();
  const headerRow = head.insertRow();
  for (let column = 0; column < columns; column += 1) {
    const header = document.createElement("th");
    header.scope = "col";
    header.textContent = `Column ${column + 1}`;
    headerRow.appendChild(header);
  }
  const body = table.createTBody();
  for (let row = 1; row < rows; row += 1) {
    const tableRow = body.insertRow();
    for (let column = 0; column < columns; column += 1) {
      tableRow.insertCell().appendChild(document.createElement("br"));
    }
  }
  const trailingParagraph = document.createElement("p");
  trailingParagraph.appendChild(document.createElement("br"));
  const selection = window.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (selectedRange && editor.contains(selectedRange.commonAncestorContainer)) {
    selectedRange.deleteContents();
    const fragment = document.createDocumentFragment();
    fragment.append(table, trailingParagraph);
    selectedRange.insertNode(fragment);
  } else {
    editor.append(table, trailingParagraph);
  }
  const firstHeader = table.querySelector("th");
  if (firstHeader && selection) {
    const nextRange = document.createRange();
    nextRange.selectNodeContents(firstHeader);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }
  return true;
};

export const toggleRichTextChecklistItem = (editor: HTMLDivElement, target: EventTarget | null, clientX: number) => {
  const element = target instanceof Element ? target : null;
  const item = element?.closest("li") ?? null;
  if (!item || !editor.contains(item) || !isRichTextChecklistItem(item)) return false;
  const itemRect = item.getBoundingClientRect();
  if (clientX > itemRect.left + 28) return false;
  const isChecked = item.getAttribute(RICH_TEXT_CHECKED_ATTRIBUTE) === "true";
  item.setAttribute(RICH_TEXT_CHECKED_ATTRIBUTE, isChecked ? "false" : "true");
  return true;
};

export const shouldUnwrapPastedRichTextDiv = (directChildTags: string[]) =>
  directChildTags.some((tagName) => PASTED_RICH_TEXT_BLOCK_TAGS.has(tagName.toUpperCase()));

export const normalizePastedRichTextHtml = (value: string) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  Array.from(wrapper.querySelectorAll("div")).reverse().forEach((div) => {
    const directChildTags = Array.from(div.children).map((child) => child.tagName);
    if (shouldUnwrapPastedRichTextDiv(directChildTags)) {
      div.replaceWith(...Array.from(div.childNodes));
      return;
    }
    const paragraph = document.createElement("p");
    while (div.firstChild) paragraph.appendChild(div.firstChild);
    div.replaceWith(paragraph);
  });
  normalizeRichTextInlineFormatting(wrapper);
  const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", ...RICH_TEXT_TABLE_TAGS]);
  wrapper.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      while (element.firstChild) fragment.appendChild(element.firstChild);
      element.replaceWith(fragment);
      return;
    }
    preserveAllowedRichTextStyles(element);
  });
  return wrapper.innerHTML;
};

export const applyRichTextFont = (editor: HTMLDivElement, fontFamily: string) => {
  editor.focus();
  document.execCommand("fontName", false, fontFamily);
};

export const applyRichTextFontSize = (editor: HTMLDivElement, commandValue: string) => {
  editor.focus();
  document.execCommand("fontSize", false, commandValue);
};
