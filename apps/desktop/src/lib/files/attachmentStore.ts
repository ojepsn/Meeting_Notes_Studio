import type { AttachmentRecord } from "@notesmith/domain";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../storage/environment";

type SelectedAttachment = {
  file: File;
  sourcePath?: string;
};

const createFileFromBytes = ({
  bytes,
  filename,
  mimeType,
}: {
  bytes: number[];
  filename: string;
  mimeType: string;
}) => new File([Uint8Array.from(bytes)], filename, { type: mimeType });

const getFilenameFromPath = (path: string) => path.split(/[/\\]/).pop() || "attachment";

const getTranscriptMimeType = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "md") return "text/markdown";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/plain";
};

const getAudioMimeType = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "wav") return "audio/wav";
  if (extension === "webm") return "audio/webm";
  if (extension === "mp4") return "video/mp4";
  return "application/octet-stream";
};

const getImageMimeType = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "bmp") return "image/bmp";
  return "application/octet-stream";
};

const pickFileInBrowser = (accept: string) =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true });
    input.click();
  });

const pickFileInTauri = async ({
  filters,
  mimeTypeResolver,
}: {
  filters: Array<{ name: string; extensions: string[] }>;
  mimeTypeResolver: (filename: string) => string;
}): Promise<SelectedAttachment | null> => {
  const dialog = await import("@tauri-apps/plugin-dialog");
  const selected = await dialog.open({
    multiple: false,
    filters,
  });
  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const filename = getFilenameFromPath(selected);
  const bytes = await invoke<number[]>("read_file_bytes", { path: selected });
  return {
    file: createFileFromBytes({
      bytes,
      filename,
      mimeType: mimeTypeResolver(filename),
    }),
    sourcePath: selected,
  };
};

export const pickTranscriptFile = async (): Promise<SelectedAttachment | null> => {
  if (isTauriRuntime()) {
    return pickFileInTauri({
      filters: [{ name: "Transcript files", extensions: ["txt", "md", "docx"] }],
      mimeTypeResolver: getTranscriptMimeType,
    });
  }

  const file = await pickFileInBrowser(
    ".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  return file ? { file } : null;
};

export const pickAudioFile = async (): Promise<SelectedAttachment | null> => {
  if (isTauriRuntime()) {
    return pickFileInTauri({
      filters: [{ name: "Audio files", extensions: ["mp3", "m4a", "wav", "webm", "mp4"] }],
      mimeTypeResolver: getAudioMimeType,
    });
  }

  const file = await pickFileInBrowser(".mp3,.m4a,.wav,.webm,.mp4,audio/*,video/mp4");
  return file ? { file } : null;
};

export const pickImageFile = async (): Promise<SelectedAttachment | null> => {
  if (isTauriRuntime()) {
    return pickFileInTauri({
      filters: [{ name: "Image files", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"] }],
      mimeTypeResolver: getImageMimeType,
    });
  }

  const file = await pickFileInBrowser(".jpg,.jpeg,.png,.webp,.gif,.bmp,image/*");
  return file ? { file } : null;
};

export const persistSelectedAttachment = async ({
  sessionId,
  selection,
}: {
  sessionId: string;
  selection: SelectedAttachment;
}) => {
  if (!isTauriRuntime() || !selection.sourcePath) {
    return "";
  }

  return invoke<string>("copy_file_into_app_data", {
    sessionId,
    sourcePath: selection.sourcePath,
    filename: selection.file.name,
  });
};

export const removePersistedAttachment = async (filePath: string) => {
  if (!isTauriRuntime() || !filePath) {
    return;
  }

  await invoke("delete_persisted_file", { path: filePath });
};

export const createAttachmentPreviewUrl = async ({
  filePath,
  mimeType,
}: {
  filePath: string;
  mimeType: string;
}) => {
  if (!filePath) {
    return null;
  }

  if (isTauriRuntime()) {
    const bytes = await invoke<number[]>("read_file_bytes", { path: filePath });
    const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType || "application/octet-stream" });
    return URL.createObjectURL(blob);
  }

  return null;
};

export const loadPersistedAttachmentFile = async (attachment: AttachmentRecord) => {
  if (!attachment.filePath) {
    return null;
  }

  if (isTauriRuntime()) {
    const bytes = await invoke<number[]>("read_file_bytes", { path: attachment.filePath });
    return createFileFromBytes({
      bytes,
      filename: attachment.filename,
      mimeType: attachment.mimeType || "application/octet-stream",
    });
  }

  return null;
};

export const fileToAttachmentRecord = ({
  file,
  sessionId,
  kind,
  filePath = "",
}: {
  file: File;
  sessionId: string;
  kind: AttachmentRecord["kind"];
  filePath?: string;
}): AttachmentRecord => ({
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
  createdAt: new Date().toISOString(),
});

export const readTranscriptFile = async (file: File): Promise<string> => {
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
