import { AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import type { AttachmentRecord } from "@notesmith/domain";
import { loadPersistedAttachmentFile } from "../files/attachmentStore";
import { getOutputLayoutPreset, getPrimaryFontFamily } from "./outputLayouts";

type ExportPayload = {
  title: string;
  output: string;
  attachments?: AttachmentRecord[];
  layoutPresetId?: string;
};

const downloadBlob = ({
  blob,
  filename,
}: {
  blob: Blob;
  filename: string;
}) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadTextFile = ({
  content,
  filename,
  mimeType,
}: {
  content: string;
  filename: string;
  mimeType: string;
}) => {
  downloadBlob({
    blob: new Blob([content], { type: mimeType }),
    filename,
  });
};

export const toFileSafeName = (title: string) =>
  `${(title || "notesmith-output").replace(/[^\w\- ]+/g, "").trim() || "notesmith-output"}`;

const escapeHtml = (content: string) =>
  content.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character] || character));

const getIncludedImageAttachments = (attachments: AttachmentRecord[] = []) =>
  attachments
    .filter((attachment) => attachment.kind === "image" && attachment.includeInOutput)
    .sort((left, right) => left.outputPosition - right.outputPosition || left.createdAt.localeCompare(right.createdAt));

export const splitOutputBlocks = (output: string) =>
  output
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

export const isHeadingLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  if (/^[-*•]/.test(trimmed)) return false;
  if (/^\d+[.)]\s/.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  return /^[\p{L}\p{N}&/(),:'" -]+:?$/u.test(trimmed);
};

export const normalizeHeadingText = (line: string) => line.trim().replace(/:$/, "");

type StructuredOutputEntry =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "body"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "numbered"; text: string; order: number | null };

const stripInlineMarkdown = (value: string) =>
  value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/(`+)(.*?)\1/g, "$2")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1")
    .trim();

const parseStructuredLine = (line: string): StructuredOutputEntry | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const headingMatch = trimmed.match(/^(#{1,4})\s+(.+?)\s*#*$/);
  if (headingMatch) {
    const level = Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4;
    return {
      kind: "heading",
      level,
      text: stripInlineMarkdown(headingMatch[2]),
    };
  }

  const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
  if (bulletMatch) {
    return {
      kind: "bullet",
      text: stripInlineMarkdown(bulletMatch[1]),
    };
  }

  const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
  if (numberedMatch) {
    return {
      kind: "numbered",
      order: Number(numberedMatch[1]) || null,
      text: stripInlineMarkdown(numberedMatch[2]),
    };
  }

  if (isHeadingLine(trimmed)) {
    return {
      kind: "heading",
      level: 2,
      text: stripInlineMarkdown(normalizeHeadingText(trimmed)),
    };
  }

  return {
    kind: "body",
    text: stripInlineMarkdown(trimmed),
  };
};

export const buildStructuredOutput = (output: string): StructuredOutputEntry[] =>
  splitOutputBlocks(output).flatMap((block) =>
    block
      .split("\n")
      .map(parseStructuredLine)
      .filter((entry): entry is StructuredOutputEntry => Boolean(entry)),
  );

export const buildHtmlMarkup = (entries: StructuredOutputEntry[]) => {
  const parts: string[] = [];
  let activeList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (activeList) {
      parts.push(`</${activeList}>`);
      activeList = null;
    }
  };

  entries.forEach((entry) => {
    if (entry.kind === "bullet") {
      if (activeList !== "ul") {
        closeList();
        parts.push("<ul>");
        activeList = "ul";
      }
      parts.push(`<li>${escapeHtml(entry.text)}</li>`);
      return;
    }

    if (entry.kind === "numbered") {
      if (activeList !== "ol") {
        closeList();
        parts.push("<ol>");
        activeList = "ol";
      }
      parts.push(`<li>${escapeHtml(entry.text)}</li>`);
      return;
    }

    closeList();
    if (entry.kind === "heading") {
      const tag = entry.level === 1 ? "h1" : entry.level === 2 ? "h2" : entry.level === 3 ? "h3" : "h4";
      parts.push(`<${tag}>${escapeHtml(entry.text)}</${tag}>`);
      return;
    }

    parts.push(`<p>${escapeHtml(entry.text)}</p>`);
  });

  closeList();
  return parts.join("");
};

const headingTextTransform = (text: string, headingCase: "sentence" | "uppercase") =>
  headingCase === "uppercase" ? text.toUpperCase() : text;

const getHeadingSize = (level: 1 | 2 | 3 | 4, layout: ReturnType<typeof getOutputLayoutPreset>) => {
  if (level === 1) return layout.style.headingSize + 3;
  if (level === 2) return layout.style.headingSize;
  if (level === 3) return Math.max(layout.style.headingSize - 1.2, layout.style.bodySize + 1);
  return Math.max(layout.style.headingSize - 2, layout.style.bodySize + 0.5);
};

const getNarrativeColumnOffset = (layout: ReturnType<typeof getOutputLayoutPreset>, contentWidth: number) =>
  layout.variant === "narrative-memo" ? Math.max(0, (contentWidth - 390) / 2) : 0;

const getNarrativeColumnWidth = (layout: ReturnType<typeof getOutputLayoutPreset>, contentWidth: number) =>
  layout.variant === "narrative-memo" ? Math.min(contentWidth, 390) : contentWidth;

const loadImageAttachments = async (attachments: AttachmentRecord[] = []) => {
  const imageAttachments = getIncludedImageAttachments(attachments);

  const loaded = await Promise.all(
    imageAttachments.map(async (attachment) => {
      try {
        const file = await loadPersistedAttachmentFile(attachment);
        if (!file) {
          return null;
        }
        return {
          attachment,
          file,
          bytes: await file.arrayBuffer(),
        };
      } catch {
        return null;
      }
    }),
  );

  return loaded.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
};

const getDocxImageType = (mimeType: string) => {
  if (mimeType === "image/png") return "png" as const;
  if (mimeType === "image/gif") return "gif" as const;
  if (mimeType === "image/bmp") return "bmp" as const;
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg" as const;
  return null;
};

export const exportOutputAsText = ({ title, output }: ExportPayload) => {
  downloadTextFile({
    content: output,
    filename: `${toFileSafeName(title)}.txt`,
    mimeType: "text/plain;charset=utf-8",
  });
};

export const exportOutputAsMarkdown = ({ title, output }: ExportPayload) => {
  downloadTextFile({
    content: `# ${title || "Meeting Notes"}\n\n${output}`,
    filename: `${toFileSafeName(title)}.md`,
    mimeType: "text/markdown;charset=utf-8",
  });
};

export const exportOutputAsHtml = ({ title, output, attachments = [], layoutPresetId }: ExportPayload) => {
  const layout = getOutputLayoutPreset(layoutPresetId);
  const structuredOutput = buildStructuredOutput(output);
  const imageMarkup = getIncludedImageAttachments(attachments)
    .map(
      (attachment) =>
        `<figure><figcaption>${escapeHtml(attachment.caption || attachment.filename)}</figcaption></figure>`,
    )
    .join("");
  const contentMarkup = buildHtmlMarkup(structuredOutput);

  downloadTextFile({
    content: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "Meeting Notes")}</title><style>
      body { font-family: ${layout.style.bodyFont}; font-size: ${layout.style.bodySize}pt; line-height: ${layout.style.lineHeight}; margin: ${layout.style.pageMargin}pt; color: #18222c; background: #fff; }
      .document { max-width: ${layout.variant === "narrative-memo" ? "580px" : layout.variant === "executive-brief" ? "760px" : "none"}; ${layout.variant === "narrative-memo" || layout.variant === "executive-brief" ? "margin: 0 auto;" : ""} }
      .title-block { margin: 0 0 ${layout.style.sectionSpacing + (layout.variant === "executive-brief" ? 10 : 0)}px; text-align: ${layout.style.titleAlign}; }
      .title-block h1 { font-family: ${layout.style.titleFont}; font-size: ${layout.style.titleSize}pt; line-height: 1.15; margin: 0; color: ${layout.style.headingColor}; }
      ${
        layout.variant === "executive-brief"
          ? `.title-block { padding: 18px 0 14px; border-top: 3px solid ${layout.style.headingColor}; border-bottom: 1px solid rgba(39,76,119,0.24); }
             h2 { border-top: 1px solid rgba(39,76,119,0.18); padding-top: 12px; }`
          : layout.variant === "modern-minutes"
            ? `h2 { border-left: 4px solid ${layout.style.headingColor}; padding-left: 10px; }`
            : layout.variant === "formal-board"
              ? `.title-block { padding-bottom: 10px; border-bottom: 2px solid rgba(29,53,87,0.28); }
                 h2 { border-top: 1px solid rgba(29,53,87,0.2); padding-top: 10px; }`
              : layout.variant === "narrative-memo"
                ? `.title-block { max-width: 520px; }
                   h2 { margin-top: 24px; }
                   p, ul, ol { max-width: 520px; }`
                : layout.variant === "decision-log"
                  ? `h2 { background: rgba(139,61,47,0.1); border: 1px solid rgba(139,61,47,0.16); border-radius: 10px; padding: 8px 12px; }`
                  : `.title-block { display: flex; align-items: end; justify-content: space-between; gap: 14px; }
                     .title-block h1 { max-width: 78%; }
                     h2 { border-bottom: 1px solid rgba(49,75,107,0.26); padding-bottom: 6px; }`
      }
      h2, h3, h4 { font-family: ${layout.style.headingFont}; color: ${layout.style.headingColor}; text-transform: ${layout.style.headingCase === "uppercase" ? "uppercase" : "none"}; }
      h2 { font-size: ${getHeadingSize(1, layout)}pt; line-height: 1.25; margin: ${layout.style.sectionSpacing}px 0 8px; }
      h3 { font-size: ${getHeadingSize(2, layout)}pt; line-height: 1.28; margin: ${Math.max(layout.style.sectionSpacing - 4, 14)}px 0 8px; }
      h4 { font-size: ${getHeadingSize(3, layout)}pt; line-height: 1.3; margin: ${Math.max(layout.style.sectionSpacing - 8, 12)}px 0 6px; }
      p { margin: 0 0 ${layout.style.paragraphSpacing}px; }
      ul, ol { margin: 0 0 ${layout.style.paragraphSpacing}px 22px; padding: 0; }
      li { margin: 0 0 6px; }
      figcaption { font-family: ${layout.style.metaFont}; font-size: ${layout.style.metaSize}pt; color: ${layout.style.metaColor}; margin-top: 6px; text-align: ${layout.style.metaAlign}; }
      figure { margin: ${layout.style.sectionSpacing}px 0; }
    </style></head><body><div class="document"><div class="title-block"><h1>${escapeHtml(title || "Meeting Notes")}</h1></div>${contentMarkup}${imageMarkup}</div></body></html>`,
    filename: `${toFileSafeName(title)}.html`,
    mimeType: "text/html;charset=utf-8",
  });
};

export const exportOutputAsDocx = async ({ title, output, attachments = [], layoutPresetId }: ExportPayload) => {
  const layout = getOutputLayoutPreset(layoutPresetId);
  const structuredOutput = buildStructuredOutput(output);
  const titleFontFamily = getPrimaryFontFamily(layout.style.titleFont);
  const headingFontFamily = getPrimaryFontFamily(layout.style.headingFont);
  const bodyFontFamily = getPrimaryFontFamily(layout.style.bodyFont);
  const metaFontFamily = getPrimaryFontFamily(layout.style.metaFont);
  const imageAttachments = await loadImageAttachments(attachments);
  const narrativeIndent = layout.variant === "narrative-memo" ? 360 : 0;
  const paragraphs = structuredOutput.map((entry) =>
    new Paragraph({
      heading:
        entry.kind === "heading"
          ? entry.level === 1
            ? HeadingLevel.HEADING_1
            : entry.level === 2
              ? HeadingLevel.HEADING_2
              : entry.level === 3
                ? HeadingLevel.HEADING_3
                : HeadingLevel.HEADING_4
          : undefined,
      bullet: entry.kind === "bullet" ? { level: 0 } : undefined,
      numbering:
        entry.kind === "numbered"
          ? {
              reference: "notesmith-numbered-list",
              level: 0,
            }
          : undefined,
      children: [
        new TextRun({
          text: entry.kind === "heading" ? headingTextTransform(entry.text, layout.style.headingCase) : entry.text,
          font: entry.kind === "heading" ? headingFontFamily : bodyFontFamily,
          size: Math.round(
            (
              entry.kind === "heading"
                ? getHeadingSize(entry.level, layout)
                : layout.style.bodySize
            ) * 2,
          ),
          bold: entry.kind === "heading",
          color: entry.kind === "heading" ? layout.style.headingColor.replace("#", "") : undefined,
        }),
      ],
      alignment:
        entry.kind === "heading" && entry.level === 1
          ? layout.style.titleAlign === "center"
            ? AlignmentType.CENTER
            : AlignmentType.LEFT
          : layout.variant === "executive-brief" && entry.kind === "heading" && entry.level === 2
            ? AlignmentType.CENTER
            : undefined,
      thematicBreak:
        entry.kind === "heading" &&
        entry.level <= 2 &&
        (layout.style.sectionDivider === "line" || layout.variant === "formal-board"),
      border:
        entry.kind === "heading"
          ? layout.variant === "executive-brief" && entry.level <= 2
            ? {
                bottom: {
                  color: "C9D2DB",
                  style: BorderStyle.SINGLE,
                  size: 6,
                  space: 6,
                },
              }
            : layout.variant === "modern-minutes" && entry.level <= 2
              ? {
                  left: {
                    color: layout.style.headingColor.replace("#", ""),
                    style: BorderStyle.SINGLE,
                    size: 14,
                    space: 10,
                  },
                }
              : layout.variant === "formal-board" && entry.level <= 2
                ? {
                    top: {
                      color: "C9D2DB",
                      style: BorderStyle.SINGLE,
                      size: 6,
                      space: 6,
                    },
                    bottom: {
                      color: "C9D2DB",
                      style: BorderStyle.SINGLE,
                      size: 6,
                      space: 6,
                    },
                  }
                : layout.variant === "decision-log" && entry.level <= 2
                  ? {
                      left: {
                        color: layout.style.headingColor.replace("#", ""),
                        style: BorderStyle.SINGLE,
                        size: 18,
                        space: 10,
                      },
                      bottom: {
                        color: layout.style.headingColor.replace("#", ""),
                        style: BorderStyle.SINGLE,
                        size: 6,
                        space: 4,
                      },
                    }
                  : layout.variant === "compact-action-pack" && entry.level <= 2
                    ? {
                        bottom: {
                          color: layout.style.headingColor.replace("#", ""),
                          style: BorderStyle.SINGLE,
                          size: 6,
                          space: 4,
                        },
                      }
                    : undefined
          : undefined,
      indent:
        entry.kind === "heading"
          ? layout.variant === "narrative-memo"
            ? { left: narrativeIndent, right: narrativeIndent }
            : layout.variant === "modern-minutes" && entry.level <= 2
              ? { left: 160 }
              : layout.variant === "decision-log" && entry.level <= 2
                ? { left: 180 }
                : undefined
          : narrativeIndent
            ? { left: narrativeIndent, right: narrativeIndent }
            : undefined,
      spacing:
        entry.kind === "heading"
          ? { before: Math.round(layout.style.sectionSpacing * 12), after: 90 }
          : { line: Math.round(layout.style.lineHeight * 240), after: Math.round(layout.style.paragraphSpacing * 10) },
    }),
  );

  const imageParagraphs = imageAttachments.flatMap(({ attachment, bytes, file }) => {
    const imageType = getDocxImageType(file.type);
    if (!imageType) {
      return [];
    }

    return [
      new Paragraph({
        children: [
          new ImageRun({
            data: bytes,
            transformation: { width: 480, height: 300 },
            type: imageType,
          }),
        ],
        spacing: { before: 240, after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: attachment.caption || attachment.filename,
            italics: true,
            font: metaFontFamily,
            size: Math.round(layout.style.metaSize * 2),
            color: layout.style.metaColor.replace("#", ""),
          }),
        ],
        alignment: layout.style.metaAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 240 },
      }),
    ];
  });

  const document = new Document({
    numbering: {
      config: [
        {
          reference: "notesmith-numbered-list",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 260 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: title || "Meeting Notes",
                font: titleFontFamily,
                size: Math.round(layout.style.titleSize * 2),
                bold: true,
              }),
            ],
            alignment: layout.style.titleAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { after: layout.variant === "compact-action-pack" ? 180 : 240, before: layout.variant === "executive-brief" ? 120 : 0 },
            border:
              layout.variant === "executive-brief"
                ? {
                    top: {
                      color: layout.style.headingColor.replace("#", ""),
                      style: BorderStyle.SINGLE,
                      size: 12,
                      space: 10,
                    },
                    bottom: {
                      color: "C9D2DB",
                      style: BorderStyle.SINGLE,
                      size: 6,
                      space: 8,
                    },
                  }
                : layout.style.sectionDivider === "line"
                ? {
                    bottom: {
                      color: "C9D2DB",
                      style: BorderStyle.SINGLE,
                      size: 6,
                      space: 8,
                    },
                  }
                : undefined,
          }),
          ...paragraphs,
          ...imageParagraphs,
        ],
        properties: {
          page: {
            margin: {
              top: Math.round(layout.style.pageMargin * 20),
              right: Math.round(layout.style.pageMargin * 20),
              bottom: Math.round(layout.style.pageMargin * 20),
              left: Math.round(layout.style.pageMargin * 20),
            },
          },
        },
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob({
    blob,
    filename: `${toFileSafeName(title)}.docx`,
  });
};

export const exportOutputAsPdf = async ({ title, output, attachments = [], layoutPresetId }: ExportPayload) => {
  const layout = getOutputLayoutPreset(layoutPresetId);
  const structuredOutput = buildStructuredOutput(output);
  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = layout.style.pageMargin * 1.333;
  const baseContentWidth = pageWidth - margin * 2;
  const narrativeOffset = getNarrativeColumnOffset(layout, baseContentWidth);
  const contentWidth = getNarrativeColumnWidth(layout, baseContentWidth);
  const contentLeft = margin + narrativeOffset;
  let y = margin;

  pdf.setFont(layout.pdfFonts.title, "bold");
  pdf.setFontSize(layout.style.titleSize);
  pdf.setTextColor(layout.style.headingColor);
  if (layout.variant === "decision-log") {
    pdf.setFillColor(245, 234, 228);
    pdf.roundedRect(contentLeft, y - layout.style.titleSize, contentWidth, layout.style.titleSize + 18, 10, 10, "F");
    pdf.text(title || "Meeting Notes", contentLeft + 14, y + 4);
  } else if (layout.style.titleAlign === "center") {
    pdf.text(title || "Meeting Notes", pageWidth / 2, y, { align: "center" });
  } else {
    pdf.text(title || "Meeting Notes", contentLeft, y);
  }
  y += layout.style.titleSize + (layout.variant === "compact-action-pack" ? 6 : 10);
  if (layout.variant === "executive-brief") {
    pdf.setDrawColor(39, 76, 119);
    pdf.setLineWidth(2.2);
    pdf.line(contentLeft, margin - 2, contentLeft + contentWidth, margin - 2);
    pdf.setLineWidth(0.7);
    pdf.setDrawColor(201, 210, 219);
    pdf.line(contentLeft, y, contentLeft + contentWidth, y);
    y += 14;
  } else if (layout.style.sectionDivider === "line") {
    pdf.setDrawColor(201, 210, 219);
    pdf.line(contentLeft, y, contentLeft + contentWidth, y);
    y += 14;
  }

  structuredOutput.forEach((entry) => {
    const isHeading = entry.kind === "heading";
    const fontFamily = isHeading ? layout.pdfFonts.heading : layout.pdfFonts.body;
    const fontSize = entry.kind === "heading" ? getHeadingSize(entry.level, layout) : layout.style.bodySize;
    const lineHeight = isHeading ? Math.round(fontSize * 1.45) : Math.round(fontSize * layout.style.lineHeight);
    const gapAfter =
      entry.kind === "heading"
        ? Math.max(layout.style.sectionSpacing - 8, 8)
        : entry.kind === "body"
          ? layout.style.paragraphSpacing
          : 6;
    const indent = entry.kind === "body" || isHeading ? 0 : 18;
    const text = entry.kind === "heading"
      ? headingTextTransform(entry.text, layout.style.headingCase)
      : entry.text;
    const prefix = entry.kind === "bullet" ? "* " : entry.kind === "numbered" ? `${entry.order ?? 1}. ` : "";
    const lines = pdf.splitTextToSize(
      `${prefix}${text}`,
      contentWidth - indent - (layout.variant === "modern-minutes" && isHeading ? 18 : 0),
    );
    if (y + lines.length * lineHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont(fontFamily, isHeading ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(isHeading ? layout.style.headingColor : "#18222c");
    if (isHeading && layout.variant === "decision-log" && entry.level <= 2) {
      const headingHeight = lines.length * lineHeight + 10;
      pdf.setFillColor(245, 234, 228);
      pdf.roundedRect(contentLeft, y - fontSize + 2, contentWidth, headingHeight, 8, 8, "F");
    } else if (isHeading && layout.variant === "modern-minutes" && entry.level <= 2) {
      pdf.setDrawColor(47, 93, 67);
      pdf.setLineWidth(2.4);
      pdf.line(contentLeft, y - fontSize + 1, contentLeft, y + lines.length * lineHeight - 4);
    } else if (isHeading && layout.variant === "formal-board" && entry.level <= 2) {
      pdf.setDrawColor(201, 210, 219);
      pdf.setLineWidth(0.7);
      pdf.line(contentLeft, y - fontSize, contentLeft + contentWidth, y - fontSize);
    } else if (isHeading && layout.variant === "compact-action-pack" && entry.level <= 2) {
      pdf.setDrawColor(49, 75, 107);
      pdf.setLineWidth(0.7);
      pdf.line(contentLeft, y + 4, contentLeft + contentWidth, y + 4);
    }
    const textX = contentLeft + indent + (layout.variant === "modern-minutes" && isHeading ? 12 : 0);
    pdf.text(lines, textX, y);
    y += lines.length * lineHeight + gapAfter;
  });

  const imageAttachments = await loadImageAttachments(attachments);
  for (const { attachment, file } of imageAttachments) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const imageFormat =
      file.type === "image/png" ? "PNG" : file.type === "image/webp" ? "WEBP" : "JPEG";

    if (y + 260 > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

    pdf.addImage(dataUrl, imageFormat, contentLeft, y, contentWidth, 220);
    y += 234;
    pdf.setFont(layout.pdfFonts.meta, "normal");
    pdf.setFontSize(layout.style.metaSize);
    pdf.setTextColor(layout.style.metaColor);
    pdf.text(attachment.caption || attachment.filename, contentLeft, y);
    pdf.setFont(layout.pdfFonts.body, "normal");
    pdf.setFontSize(layout.style.bodySize);
    pdf.setTextColor("#18222c");
    y += 18;
  }

  pdf.save(`${toFileSafeName(title)}.pdf`);
};

