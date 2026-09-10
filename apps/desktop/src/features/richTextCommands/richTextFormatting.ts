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
  Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
  if (!(element instanceof HTMLElement)) return;
  if (fontFamily) element.style.fontFamily = fontFamily;
  if (fontSize) element.style.fontSize = fontSize;
  if (element.tagName === "A" && href) {
    element.setAttribute("href", href);
    element.setAttribute("target", "_blank");
    element.setAttribute("rel", "noopener noreferrer");
  }
};

export const normalizePastedRichTextHtml = (value: string) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  wrapper.querySelectorAll("div").forEach((div) => {
    const paragraph = document.createElement("p");
    while (div.firstChild) paragraph.appendChild(div.firstChild);
    div.replaceWith(paragraph);
  });
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
