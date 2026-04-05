import type { AttachmentRecord } from "@notesmith/domain";
type ExportPayload = {
    title: string;
    output: string;
    attachments?: AttachmentRecord[];
    layoutPresetId?: string;
};
export declare const exportOutputAsText: ({ title, output }: ExportPayload) => void;
export declare const exportOutputAsMarkdown: ({ title, output }: ExportPayload) => void;
export declare const exportOutputAsHtml: ({ title, output, attachments, layoutPresetId }: ExportPayload) => void;
export declare const exportOutputAsDocx: ({ title, output, attachments, layoutPresetId }: ExportPayload) => Promise<void>;
export declare const exportOutputAsPdf: ({ title, output, attachments, layoutPresetId }: ExportPayload) => Promise<void>;
export {};
