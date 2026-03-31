import type { AttachmentRecord } from "@notesmith/domain";
export declare const pickTranscriptFile: () => Promise<File | null>;
export declare const fileToAttachmentRecord: ({ file, sessionId, kind, filePath, }: {
    file: File;
    sessionId: string;
    kind: AttachmentRecord["kind"];
    filePath?: string;
}) => AttachmentRecord;
