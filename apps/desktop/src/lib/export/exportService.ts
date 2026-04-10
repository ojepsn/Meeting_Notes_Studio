import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx";
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
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
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

  const headingMatch = trimmed.match(/^(#{1,3})\s+(.+?)\s*#*$/);
  if (headingMatch) {
    const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
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

const buildHtmlMarkup = (entries: StructuredOutputEntry[]) => {
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
      const tag = entry.level === 1 ? "h1" : entry.level === 2 ? "h2" : "h3";
      parts.push(`<${tag}>${escapeHtml(entry.text)}</${tag}>`);
      return;
    }

    parts.push(`<p>${escapeHtml(entry.text)}</p>`);
  });

  closeList();
  return parts.join("");
};

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
      body { font-family: ${layout.style.bodyFont}; font-size: ${layout.style.bodySize}pt; line-height: ${layout.style.lineHeight}; margin: 48px; color: #18222c; }
      h1 { font-family: ${layout.style.titleFont}; font-size: ${layout.style.titleSize}pt; line-height: 1.2; margin: 0 0 20px; }
      h2 { font-family: ${layout.style.headingFont}; font-size: ${layout.style.headingSize}pt; line-height: 1.3; margin: 22px 0 8px; }
      h3 { font-family: ${layout.style.headingFont}; font-size: ${Math.max(layout.style.headingSize - 1, layout.style.bodySize + 0.5)}pt; line-height: 1.3; margin: 16px 0 8px; }
      p { margin: 0 0 12px; }
      ul, ol { margin: 0 0 12px 22px; padding: 0; }
      li { margin: 0 0 6px; }
      figcaption { font-family: ${layout.style.metaFont}; font-size: ${layout.style.metaSize}pt; color: #54606c; margin-top: 6px; }
      figure { margin: 22px 0; }
    </style></head><body><h1>${escapeHtml(title || "Meeting Notes")}</h1>${contentMarkup}${imageMarkup}</body></html>`,
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
  const paragraphs = structuredOutput.map((entry) =>
    new Paragraph({
      heading:
        entry.kind === "heading"
          ? entry.level === 1
            ? HeadingLevel.HEADING_1
            : entry.level === 2
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3
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
          text: entry.text,
          font: entry.kind === "heading" ? headingFontFamily : bodyFontFamily,
          size: Math.round(
            (
              entry.kind === "heading"
                ? entry.level === 1
                  ? layout.style.titleSize
                  : entry.level === 2
                    ? layout.style.headingSize
                    : Math.max(layout.style.headingSize - 1, layout.style.bodySize + 0.5)
                : layout.style.bodySize
            ) * 2,
          ),
          bold: entry.kind === "heading",
        }),
      ],
      spacing:
        entry.kind === "heading"
          ? { before: 220, after: 90 }
          : { line: Math.round(layout.style.lineHeight * 240), after: entry.kind === "body" ? 120 : 80 },
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
          }),
        ],
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
            spacing: { after: 240 },
          }),
          ...paragraphs,
          ...imageParagraphs,
        ],
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
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  pdf.setFont(layout.pdfFonts.title, "bold");
  pdf.setFontSize(layout.style.titleSize);
  pdf.text(title || "Meeting Notes", margin, y);
  y += layout.style.titleSize + 10;

  structuredOutput.forEach((entry) => {
    const isHeading = entry.kind === "heading";
    const fontFamily = isHeading ? layout.pdfFonts.heading : layout.pdfFonts.body;
    const fontSize =
      entry.kind === "heading"
        ? entry.level === 1
          ? layout.style.titleSize
          : entry.level === 2
            ? layout.style.headingSize
            : Math.max(layout.style.headingSize - 1, layout.style.bodySize + 0.5)
        : layout.style.bodySize;
    const lineHeight = isHeading ? Math.round(fontSize * 1.45) : Math.round(fontSize * layout.style.lineHeight);
    const gapAfter = isHeading ? 8 : entry.kind === "body" ? 10 : 6;
    const prefix = entry.kind === "bullet" ? "• " : entry.kind === "numbered" ? `${entry.order ?? 1}. ` : "";
    const indent = entry.kind === "body" || isHeading ? 0 : 18;
    const lines = pdf.splitTextToSize(`${prefix}${entry.text}`, contentWidth - indent);
    if (y + lines.length * lineHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont(fontFamily, isHeading ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    pdf.text(lines, margin + indent, y);
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

    pdf.addImage(dataUrl, imageFormat, margin, y, contentWidth, 220);
    y += 234;
    pdf.setFont(layout.pdfFonts.meta, "normal");
    pdf.setFontSize(layout.style.metaSize);
    pdf.text(attachment.caption || attachment.filename, margin, y);
    pdf.setFont(layout.pdfFonts.body, "normal");
    pdf.setFontSize(layout.style.bodySize);
    y += 18;
  }

  pdf.save(`${toFileSafeName(title)}.pdf`);
};
