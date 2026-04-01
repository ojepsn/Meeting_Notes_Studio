import type { SessionRecord } from "@notesmith/domain";
interface OutputWorkspaceProps {
    session: SessionRecord;
    onChange: (session: SessionRecord) => void;
    isGenerating: boolean;
    isRevising: boolean;
    onGenerate: () => void;
    onTranslate: () => void;
    onRevise: (instructions: string) => void;
    onExportText: () => void;
    onExportMarkdown: () => void;
    onExportHtml: () => void;
}
export declare const OutputWorkspace: ({ session, onChange, isGenerating, isRevising, onGenerate, onTranslate, onRevise, onExportText, onExportMarkdown, onExportHtml, }: OutputWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
