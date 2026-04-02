import type { AttachmentRecord } from "@notesmith/domain";
type SelectedAttachment = {
    file: File;
    sourcePath?: string;
};
export declare const pickTranscriptFile: () => Promise<SelectedAttachment | null>;
export declare const pickAudioFile: () => Promise<SelectedAttachment | null>;
export declare const pickImageFile: () => Promise<SelectedAttachment | null>;
export declare const persistSelectedAttachment: ({ sessionId, selection, }: {
    sessionId: string;
    selection: SelectedAttachment;
}) => Promise<string>;
export declare const persistGeneratedAttachment: ({ sessionId, file, }: {
    sessionId: string;
    file: File;
}) => Promise<string>;
export declare const removePersistedAttachment: (filePath: string) => Promise<void>;
export declare const createAttachmentPreviewUrl: ({ filePath, mimeType, }: {
    filePath: string;
    mimeType: string;
}) => Promise<string | null>;
export declare const loadPersistedAttachmentFile: (attachment: AttachmentRecord) => Promise<File | null>;
export declare const fileToAttachmentRecord: ({ file, sessionId, kind, filePath, }: {
    file: File;
    sessionId: string;
    kind: AttachmentRecord["kind"];
    filePath?: string;
}) => AttachmentRecord;
export declare const readTranscriptFile: (file: File) => Promise<string>;
export {};
