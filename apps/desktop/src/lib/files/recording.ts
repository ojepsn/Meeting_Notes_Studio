import type { CaptureMode } from "@notesmith/domain";

export type RecordingMode = "microphone" | "system-audio" | "hybrid";

export const RECORDING_MODE_LABELS: Record<RecordingMode, string> = {
  microphone: "Microphone",
  "system-audio": "Computer audio",
  hybrid: "Microphone + computer audio",
};

export const buildRecordingFilename = ({
  sessionTitle,
  captureMode,
}: {
  sessionTitle: string;
  captureMode: CaptureMode;
}) => {
  const safeTitle = (sessionTitle.trim() || captureMode)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "recording";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeTitle}-${timestamp}.webm`;
};

export const getSupportedRecordingMimeType = (
  mediaRecorderCtor: Pick<typeof MediaRecorder, "isTypeSupported"> | undefined = typeof MediaRecorder !== "undefined"
    ? MediaRecorder
    : undefined,
) => {
  if (!mediaRecorderCtor) {
    return "";
  }

  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((candidate) => mediaRecorderCtor.isTypeSupported(candidate)) ?? "";
};

export const getSystemAudioDisplayOptions = (): DisplayMediaStreamOptions & Record<string, unknown> => ({
  video: true,
  audio: true,
  systemAudio: "include",
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  monitorTypeSurfaces: "include",
});
