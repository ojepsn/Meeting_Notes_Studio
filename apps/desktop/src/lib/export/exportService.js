const downloadTextFile = ({ content, filename, mimeType, }) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
const toFileSafeName = (title) => `${(title || "notesmith-output").replace(/[^\w\- ]+/g, "").trim() || "notesmith-output"}`;
export const exportOutputAsText = ({ title, output, }) => {
    downloadTextFile({
        content: output,
        filename: `${toFileSafeName(title)}.txt`,
        mimeType: "text/plain;charset=utf-8",
    });
};
export const exportOutputAsMarkdown = ({ title, output, }) => {
    downloadTextFile({
        content: `# ${title || "Meeting Notes"}\n\n${output}`,
        filename: `${toFileSafeName(title)}.md`,
        mimeType: "text/markdown;charset=utf-8",
    });
};
export const exportOutputAsHtml = ({ title, output, }) => {
    downloadTextFile({
        content: `<!doctype html><html><head><meta charset="utf-8"><title>${title || "Meeting Notes"}</title></head><body><pre style="white-space: pre-wrap; font: 16px/1.6 Segoe UI, Arial, sans-serif;">${output.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character] || character))}</pre></body></html>`,
        filename: `${toFileSafeName(title)}.html`,
        mimeType: "text/html;charset=utf-8",
    });
};
