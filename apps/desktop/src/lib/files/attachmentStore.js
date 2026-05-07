import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../storage/environment";
const createFileFromBytes = ({ bytes, filename, mimeType, }) => new File([Uint8Array.from(bytes)], filename, { type: mimeType });
const getFilenameFromPath = (path) => path.split(/[/\\]/).pop() || "attachment";
const getTranscriptMimeType = (filename) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    if (extension === "md")
        return "text/markdown";
    if (extension === "docx")
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return "text/plain";
};
const getAudioMimeType = (filename) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    if (extension === "mp3")
        return "audio/mpeg";
    if (extension === "m4a")
        return "audio/mp4";
    if (extension === "mpeg" || extension === "mpga")
        return "audio/mpeg";
    if (extension === "wav")
        return "audio/wav";
    if (extension === "webm")
        return "audio/webm";
    if (extension === "ogg" || extension === "oga")
        return "audio/ogg";
    if (extension === "opus")
        return "audio/ogg";
    if (extension === "flac")
        return "audio/flac";
    if (extension === "aac")
        return "audio/aac";
    if (extension === "mp4")
        return "video/mp4";
    return "application/octet-stream";
};
const getImageMimeType = (filename) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    if (extension === "jpg" || extension === "jpeg")
        return "image/jpeg";
    if (extension === "png")
        return "image/png";
    if (extension === "webp")
        return "image/webp";
    if (extension === "gif")
        return "image/gif";
    if (extension === "bmp")
        return "image/bmp";
    return "application/octet-stream";
};
const pickFileInBrowser = (accept) => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true });
    input.click();
});
const pickFileInTauri = async ({ filters, mimeTypeResolver, }) => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const selected = await dialog.open({
        multiple: false,
        filters,
    });
    if (!selected || Array.isArray(selected)) {
        return null;
    }
    const filename = getFilenameFromPath(selected);
    const bytes = await invoke("read_file_bytes", { path: selected });
    return {
        file: createFileFromBytes({
            bytes,
            filename,
            mimeType: mimeTypeResolver(filename),
        }),
        sourcePath: selected,
    };
};
export const pickTranscriptFile = async () => {
    if (isTauriRuntime()) {
        return pickFileInTauri({
            filters: [{ name: "Transcript files", extensions: ["txt", "md", "docx"] }],
            mimeTypeResolver: getTranscriptMimeType,
        });
    }
    const file = await pickFileInBrowser(".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return file ? { file } : null;
};
export const pickAudioFile = async () => {
    if (isTauriRuntime()) {
        return pickFileInTauri({
            filters: [{ name: "Audio files", extensions: ["mp3", "m4a", "wav", "webm", "mp4", "mpeg", "mpga", "ogg", "oga", "opus", "flac", "aac"] }],
            mimeTypeResolver: getAudioMimeType,
        });
    }
    const file = await pickFileInBrowser(".mp3,.m4a,.wav,.webm,.mp4,.mpeg,.mpga,.ogg,.oga,.opus,.flac,.aac,audio/*,video/mp4");
    return file ? { file } : null;
};
export const pickImageFile = async () => {
    if (isTauriRuntime()) {
        return pickFileInTauri({
            filters: [{ name: "Image files", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"] }],
            mimeTypeResolver: getImageMimeType,
        });
    }
    const file = await pickFileInBrowser(".jpg,.jpeg,.png,.webp,.gif,.bmp,image/*");
    return file ? { file } : null;
};
export const persistSelectedAttachment = async ({ sessionId, selection, }) => {
    if (!isTauriRuntime() || !selection.sourcePath) {
        return "";
    }
    return invoke("copy_file_into_app_data", {
        sessionId,
        sourcePath: selection.sourcePath,
        filename: selection.file.name,
    });
};
export const persistGeneratedAttachment = async ({ sessionId, file, }) => {
    if (!isTauriRuntime()) {
        return "";
    }
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    return invoke("write_bytes_into_app_data", {
        sessionId,
        filename: file.name,
        bytes,
    });
};
export const removePersistedAttachment = async (filePath) => {
    if (!isTauriRuntime() || !filePath) {
        return;
    }
    await invoke("delete_persisted_file", { path: filePath });
};
const decodeBase64ToBytes = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return Array.from(bytes);
};
export const restoreImportedAttachmentFiles = async ({ attachments, attachmentFiles, }) => {
    if (!isTauriRuntime() || !attachmentFiles.length) {
        return attachments;
    }
    const fileMap = new Map(attachmentFiles.map((entry) => [entry.attachmentId, entry]));
    return Promise.all(attachments.map(async (attachment) => {
        const fileEntry = fileMap.get(attachment.id);
        if (!fileEntry) {
            return attachment;
        }
        try {
            const filePath = await invoke("write_bytes_into_app_data", {
                sessionId: attachment.sessionId,
                filename: fileEntry.filename || attachment.filename,
                bytes: decodeBase64ToBytes(fileEntry.base64),
            });
            return {
                ...attachment,
                filename: fileEntry.filename || attachment.filename,
                filePath,
                updatedAt: new Date().toISOString(),
            };
        }
        catch {
            return attachment;
        }
    }));
};
export const createAttachmentPreviewUrl = async ({ filePath, mimeType, }) => {
    if (!filePath) {
        return null;
    }
    if (isTauriRuntime()) {
        const bytes = await invoke("read_file_bytes", { path: filePath });
        const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType || "application/octet-stream" });
        return URL.createObjectURL(blob);
    }
    return null;
};
export const loadPersistedAttachmentFile = async (attachment) => {
    if (!attachment.filePath) {
        return null;
    }
    if (isTauriRuntime()) {
        const bytes = await invoke("read_file_bytes", { path: attachment.filePath });
        return createFileFromBytes({
            bytes,
            filename: attachment.filename,
            mimeType: attachment.mimeType || "application/octet-stream",
        });
    }
    return null;
};
export const fileToAttachmentRecord = ({ file, sessionId, kind, filePath = "", }) => {
    const timestamp = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        sessionId,
        kind,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        filePath,
        sizeBytes: file.size,
        caption: "",
        includeInOutput: kind === "image",
        outputPosition: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
};
export const readTranscriptFile = async (file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (extension === "doc") {
        throw new Error("Legacy .doc transcript files are not supported yet. Please resave the file as .docx or .txt.");
    }
    if (extension === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = String(result.value || "").replace(/\r\n/g, "\n").trim();
        if (!text) {
            throw new Error("The uploaded Word document did not contain any readable transcript text.");
        }
        return text;
    }
    const text = (await file.text()).replace(/\r\n/g, "\n").trim();
    if (!text) {
        throw new Error("The uploaded transcript file did not contain any readable text.");
    }
    return text;
};
