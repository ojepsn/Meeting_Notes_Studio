import type { AttachmentRecord } from "@notesmith/domain";
type ExportPayload = {
    title: string;
    output: string;
    attachments?: AttachmentRecord[];
    layoutPresetId?: string;
};
export declare const toFileSafeName: (title: string) => string;
export declare const splitOutputBlocks: (output: string) => string[];
export declare const isHeadingLine: (line: string) => boolean;
export declare const normalizeHeadingText: (line: string) => string;
export declare const buildStructuredOutput: (output: string) => {
    kind: "body" | "heading";
    text: string;
}[];
export declare const exportOutputAsText: ({ title, output }: ExportPayload) => void;
export declare const exportOutputAsMarkdown: ({ title, output }: ExportPayload) => void;
export declare const exportOutputAsHtml: ({ title, output, attachments, layoutPresetId }: ExportPayload) => void;
export declare const exportOutputAsDocx: ({ title, output, attachments, layoutPresetId }: ExportPayload) => Promise<void>;
export declare const exportOutputAsPdf: ({ title, output, attachments, layoutPresetId }: ExportPayload) => Promise<void>;
export {};
