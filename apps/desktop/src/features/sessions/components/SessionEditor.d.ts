import type { AttachmentRecord, SessionRecord, TemplateDefinition } from "@notesmith/domain";
interface SessionEditorProps {
    session: SessionRecord;
    templates: TemplateDefinition[];
    attachments: AttachmentRecord[];
    isTranscribingAudio: boolean;
    onChange: (session: SessionRecord) => void;
    onImportTranscript: () => void;
    onImportAudio: () => void;
    onTranscribeAudio: () => void;
    onRemoveAttachment: (attachmentId: string) => void;
}
export declare const SessionEditor: ({ session, templates, attachments, isTranscribingAudio, onChange, onImportTranscript, onImportAudio, onTranscribeAudio, onRemoveAttachment, }: SessionEditorProps) => import("react/jsx-runtime").JSX.Element;
export {};
