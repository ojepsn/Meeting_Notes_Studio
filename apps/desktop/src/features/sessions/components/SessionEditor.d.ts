import { type AttachmentRecord, type SessionRecord, type TemplateDefinition } from "@notesmith/domain";
interface SessionEditorProps {
    session: SessionRecord;
    templates: TemplateDefinition[];
    attachments: AttachmentRecord[];
    isTranscribingAudio: boolean;
    onChange: (session: SessionRecord) => void;
    onImportTranscript: () => void;
    onImportAudio: () => void;
    onImportImage: () => void;
    onTranscribeAudio: () => void;
    onRemoveAttachment: (attachmentId: string) => void;
    onUpdateAttachment: (attachment: AttachmentRecord) => void;
}
export declare const SessionEditor: ({ session, templates, attachments, isTranscribingAudio, onChange, onImportTranscript, onImportAudio, onImportImage, onTranscribeAudio, onRemoveAttachment, onUpdateAttachment, }: SessionEditorProps) => import("react/jsx-runtime").JSX.Element;
export {};
