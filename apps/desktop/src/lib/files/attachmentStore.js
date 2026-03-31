import { isTauriRuntime } from "../storage/environment";
export const pickTranscriptFile = async () => {
    if (isTauriRuntime()) {
        const dialog = await import("@tauri-apps/plugin-dialog");
        const selected = await dialog.open({
            multiple: false,
            filters: [{ name: "Text or transcript files", extensions: ["txt", "md"] }],
        });
        if (!selected || Array.isArray(selected)) {
            return null;
        }
        return null;
    }
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".txt,.md";
        input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true });
        input.click();
    });
};
export const fileToAttachmentRecord = ({ file, sessionId, kind, filePath = "", }) => ({
    id: crypto.randomUUID(),
    sessionId,
    kind,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    filePath,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
});
