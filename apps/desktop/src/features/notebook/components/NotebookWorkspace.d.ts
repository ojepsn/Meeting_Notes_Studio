import { type ReactNode } from "react";
import type { SessionRecord } from "@notesmith/domain";
export declare const getNotebookTitleText: (session: Pick<SessionRecord, "date" | "title">) => string;
export declare const buildNotebookSessionTitle: (date: string, titleText: string) => string;
export declare const getNotebookListTitle: (session: Pick<SessionRecord, "captureMode" | "date" | "title">) => string;
interface NotebookWorkspaceProps {
    sessions: SessionRecord[];
    activeSession: SessionRecord;
    isRecordingAudio: boolean;
    isTranscribingAudio: boolean;
    isGenerating: boolean;
    recordingStatusNote?: string | null;
    outputContent: ReactNode;
    onSelect: (sessionId: string) => void;
    onCreate: () => void;
    onChange: (session: SessionRecord) => void;
    onToggleRecording: () => void;
    onUploadAudio: () => void;
    onTranscribeAudio: () => void;
    onGenerateOutput: () => void;
    onOpenInNotes: (view: "capture" | "output") => void;
}
export declare const NotebookWorkspace: ({ sessions, activeSession, isRecordingAudio, isTranscribingAudio, isGenerating, recordingStatusNote, outputContent, onSelect, onCreate, onChange, onToggleRecording, onUploadAudio, onTranscribeAudio, onGenerateOutput, onOpenInNotes, }: NotebookWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
