import { type AttachmentRecord, type SessionRecord, type TemplateDefinition } from "@notesmith/domain";
interface SessionEditorProps {
    session: SessionRecord;
    templates: TemplateDefinition[];
    attachments: AttachmentRecord[];
    savedPeople: string[];
    suggestedPeople: string[];
    isTranscribingAudio: boolean;
    recordingMode: "microphone" | "system-audio" | "hybrid";
    isRecordingAudio: boolean;
    recordingStatusNote?: string | null;
    onChange: (session: SessionRecord) => void;
    onImportTranscript: () => void;
    onImportAudio: () => void;
    onImportImage: () => void;
    onTranscribeAudio: () => void;
    onChangeRecordingMode: (mode: "microphone" | "system-audio" | "hybrid") => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onRemoveAttachment: (attachmentId: string) => void;
    onUpdateAttachment: (attachment: AttachmentRecord) => void;
}
export declare const SessionEditor: ({ session, templates, attachments, savedPeople, suggestedPeople, isTranscribingAudio, recordingMode, isRecordingAudio, recordingStatusNote, onChange, onImportTranscript, onImportAudio, onImportImage, onTranscribeAudio, onChangeRecordingMode, onStartRecording, onStopRecording, onRemoveAttachment, onUpdateAttachment, }: SessionEditorProps) => import("react/jsx-runtime").JSX.Element;
export {};
