import type { SessionRecord } from "@notesmith/domain";
interface OutputWorkspaceProps {
    session: SessionRecord;
    onChange: (session: SessionRecord) => void;
    isGenerating: boolean;
    onGenerate: () => void;
    onTranslate: () => void;
    onExport: () => void;
}
export declare const OutputWorkspace: ({ session, onChange, isGenerating, onGenerate, onTranslate, onExport, }: OutputWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
