import type { CaptureMode } from "@notesmith/domain";
export type RecordingMode = "microphone" | "system-audio" | "hybrid";
export declare const RECORDING_MODE_LABELS: Record<RecordingMode, string>;
export declare const buildRecordingFilename: ({ sessionTitle, captureMode, }: {
    sessionTitle: string;
    captureMode: CaptureMode;
}) => string;
export declare const getSupportedRecordingMimeType: (mediaRecorderCtor?: Pick<typeof MediaRecorder, "isTypeSupported"> | undefined) => string;
export declare const getSystemAudioDisplayOptions: () => DisplayMediaStreamOptions & Record<string, unknown>;
