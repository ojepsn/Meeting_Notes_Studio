import type { SessionRecord, TemplateDefinition } from "@notesmith/domain";
interface SessionEditorProps {
    session: SessionRecord;
    templates: TemplateDefinition[];
    onChange: (session: SessionRecord) => void;
    onImportTranscript: () => void;
}
export declare const SessionEditor: ({ session, templates, onChange, onImportTranscript }: SessionEditorProps) => import("react/jsx-runtime").JSX.Element;
export {};
