import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import { loadPersistedAttachmentFile } from "../files/attachmentStore";
import { getOutputLayoutPreset, getPrimaryFontFamily } from "./outputLayouts";
const downloadBlob = ({ blob, filename, }) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
const downloadTextFile = ({ content, filename, mimeType, }) => {
    downloadBlob({
        blob: new Blob([content], { type: mimeType }),
        filename,
    });
};
const toFileSafeName = (title) => `${(title || "notesmith-output").replace(/[^\w\- ]+/g, "").trim() || "notesmith-output"}`;
const escapeHtml = (content) => content.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character] || character));
const getIncludedImageAttachments = (attachments = []) => attachments
    .filter((attachment) => attachment.kind === "image" && attachment.includeInOutput)
    .sort((left, right) => left.outputPosition - right.outputPosition || left.createdAt.localeCompare(right.createdAt));
const splitOutputBlocks = (output) => output
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
const isHeadingLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed)
        return false;
    if (trimmed.length > 80)
        return false;
    if (/^[-*•]/.test(trimmed))
        return false;
    if (/^\d+[.)]\s/.test(trimmed))
        return false;
    if (/[.!?]$/.test(trimmed))
        return false;
    return /^[\p{L}\p{N}&/(),:'" -]+:?$/u.test(trimmed);
};
const normalizeHeadingText = (line) => line.trim().replace(/:$/, "");
const buildStructuredOutput = (output) => splitOutputBlocks(output).flatMap((block) => block.split("\n").flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed)
        return [];
    return [
        {
            kind: isHeadingLine(trimmed) ? "heading" : "body",
            text: isHeadingLine(trimmed) ? normalizeHeadingText(trimmed) : trimmed,
        },
    ];
}));
const loadImageAttachments = async (attachments = []) => {
    const imageAttachments = getIncludedImageAttachments(attachments);
    const loaded = await Promise.all(imageAttachments.map(async (attachment) => {
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
        }
        catch {
            return null;
        }
    }));
    return loaded.filter((entry) => Boolean(entry));
};
const getDocxImageType = (mimeType) => {
    if (mimeType === "image/png")
        return "png";
    if (mimeType === "image/gif")
        return "gif";
    if (mimeType === "image/bmp")
        return "bmp";
    if (mimeType === "image/jpeg" || mimeType === "image/jpg")
        return "jpg";
    return null;
};
export const exportOutputAsText = ({ title, output }) => {
    downloadTextFile({
        content: output,
        filename: `${toFileSafeName(title)}.txt`,
        mimeType: "text/plain;charset=utf-8",
    });
};
export const exportOutputAsMarkdown = ({ title, output }) => {
    downloadTextFile({
        content: `# ${title || "Meeting Notes"}\n\n${output}`,
        filename: `${toFileSafeName(title)}.md`,
        mimeType: "text/markdown;charset=utf-8",
    });
};
export const exportOutputAsHtml = ({ title, output, attachments = [], layoutPresetId }) => {
    const layout = getOutputLayoutPreset(layoutPresetId);
    const imageMarkup = getIncludedImageAttachments(attachments)
        .map((attachment) => `<figure><figcaption>${escapeHtml(attachment.caption || attachment.filename)}</figcaption></figure>`)
        .join("");
    const contentMarkup = buildStructuredOutput(output)
        .map((entry) => entry.kind === "heading"
        ? `<h2>${escapeHtml(entry.text)}</h2>`
        : `<p>${escapeHtml(entry.text)}</p>`)
        .join("");
    downloadTextFile({
        content: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "Meeting Notes")}</title><style>
      body { font-family: ${layout.style.bodyFont}; font-size: ${layout.style.bodySize}pt; line-height: ${layout.style.lineHeight}; margin: 48px; color: #18222c; }
      h1 { font-family: ${layout.style.titleFont}; font-size: ${layout.style.titleSize}pt; line-height: 1.2; margin: 0 0 20px; }
      h2 { font-family: ${layout.style.headingFont}; font-size: ${layout.style.headingSize}pt; line-height: 1.3; margin: 22px 0 8px; }
      p { margin: 0 0 12px; }
      figcaption { font-family: ${layout.style.metaFont}; font-size: ${layout.style.metaSize}pt; color: #54606c; margin-top: 6px; }
      figure { margin: 22px 0; }
    </style></head><body><h1>${escapeHtml(title || "Meeting Notes")}</h1>${contentMarkup}${imageMarkup}</body></html>`,
        filename: `${toFileSafeName(title)}.html`,
        mimeType: "text/html;charset=utf-8",
    });
};
export const exportOutputAsDocx = async ({ title, output, attachments = [], layoutPresetId }) => {
    const layout = getOutputLayoutPreset(layoutPresetId);
    const titleFontFamily = getPrimaryFontFamily(layout.style.titleFont);
    const headingFontFamily = getPrimaryFontFamily(layout.style.headingFont);
    const bodyFontFamily = getPrimaryFontFamily(layout.style.bodyFont);
    const metaFontFamily = getPrimaryFontFamily(layout.style.metaFont);
    const imageAttachments = await loadImageAttachments(attachments);
    const paragraphs = buildStructuredOutput(output).map((entry) => new Paragraph({
        heading: entry.kind === "heading" ? HeadingLevel.HEADING_2 : undefined,
        children: [
            new TextRun({
                text: entry.text,
                font: entry.kind === "heading" ? headingFontFamily : bodyFontFamily,
                size: Math.round((entry.kind === "heading" ? layout.style.headingSize : layout.style.bodySize) * 2),
                bold: entry.kind === "heading",
            }),
        ],
        spacing: entry.kind === "heading"
            ? { before: 220, after: 90 }
            : { line: Math.round(layout.style.lineHeight * 240), after: 120 },
    }));
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
export const exportOutputAsPdf = async ({ title, output, attachments = [], layoutPresetId }) => {
    const layout = getOutputLayoutPreset(layoutPresetId);
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
    buildStructuredOutput(output).forEach((entry) => {
        const fontFamily = entry.kind === "heading" ? layout.pdfFonts.heading : layout.pdfFonts.body;
        const fontSize = entry.kind === "heading" ? layout.style.headingSize : layout.style.bodySize;
        const lineHeight = entry.kind === "heading" ? Math.round(fontSize * 1.45) : Math.round(fontSize * layout.style.lineHeight);
        const gapAfter = entry.kind === "heading" ? 8 : 10;
        const lines = pdf.splitTextToSize(entry.text, contentWidth);
        if (y + lines.length * lineHeight > pageHeight - margin) {
            pdf.addPage();
            y = margin;
        }
        pdf.setFont(fontFamily, entry.kind === "heading" ? "bold" : "normal");
        pdf.setFontSize(fontSize);
        pdf.text(lines, margin, y);
        y += lines.length * lineHeight + gapAfter;
    });
    const imageAttachments = await loadImageAttachments(attachments);
    for (const { attachment, file } of imageAttachments) {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
        const imageFormat = file.type === "image/png" ? "PNG" : file.type === "image/webp" ? "WEBP" : "JPEG";
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
