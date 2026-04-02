import type { AttachmentRecord, SessionRecord } from "@notesmith/domain";
interface OutputWorkspaceProps {
    session: SessionRecord;
    attachments: AttachmentRecord[];
    onChange: (session: SessionRecord) => void;
    isGenerating: boolean;
    isRevising: boolean;
    onGenerate: () => void;
    onTranslate: () => void;
    onRevise: (instructions: string) => void;
    onExportText: () => void;
    onExportMarkdown: () => void;
    onExportHtml: () => void;
    primaryActionLabel?: string;
    emptyStateLabel?: string;
}
export declare const OutputWorkspace: ({ session, attachments, onChange, isGenerating, isRevising, onGenerate, onTranslate, onRevise, onExportText, onExportMarkdown, onExportHtml, primaryActionLabel, emptyStateLabel, }: OutputWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
