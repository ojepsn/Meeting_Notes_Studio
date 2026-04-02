import type { AttachmentRecord, SessionRecord } from "@notesmith/domain";
interface OutputWorkspaceProps {
    session: SessionRecord;
    attachments: AttachmentRecord[];
    onChange: (session: SessionRecord) => void;
    isPrimaryActionRunning: boolean;
    isSecondaryActionRunning: boolean;
    isRevising: boolean;
    onPrimaryAction: () => void;
    onSecondaryAction?: () => void;
    onTranslate: () => void;
    onRevise: (instructions: string) => void;
    onExportText: () => void;
    onExportMarkdown: () => void;
    onExportHtml: () => void;
    primaryActionLabel?: string;
    secondaryActionLabel?: string | null;
    emptyStatePrimaryLabel?: string;
    emptyStateSecondaryLabel?: string | null;
}
export declare const OutputWorkspace: ({ session, attachments, onChange, isPrimaryActionRunning, isSecondaryActionRunning, isRevising, onPrimaryAction, onSecondaryAction, onTranslate, onRevise, onExportText, onExportMarkdown, onExportHtml, primaryActionLabel, secondaryActionLabel, emptyStatePrimaryLabel, emptyStateSecondaryLabel, }: OutputWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
