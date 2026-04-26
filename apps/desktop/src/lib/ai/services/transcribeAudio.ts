import type { LocalAppSettings } from "@notesmith/domain";
import { AI_PROMPT_PROFILE_VERSION } from "../prompts";
import type { AIRuntimeEvent } from "../runtime";
import { executeAITranscriptionOperation } from "../runtime";

const inferTranscriptionMimeType = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "mp3" || extension === "mpeg" || extension === "mpga") return "audio/mpeg";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "wav") return "audio/wav";
  if (extension === "webm") return "audio/webm";
  if (extension === "ogg" || extension === "oga" || extension === "opus") return "audio/ogg";
  if (extension === "flac") return "audio/flac";
  if (extension === "aac") return "audio/aac";
  if (extension === "mp4") return "video/mp4";
  return "application/octet-stream";
};

export const transcribeAudio = async ({
  file,
  settings,
  onEvent,
}: {
  file: File;
  settings: LocalAppSettings;
  onEvent?: (event: AIRuntimeEvent) => void;
}) => {
  const normalizedFile =
    !file.type || file.type === "application/octet-stream"
      ? new File([file], file.name, { type: inferTranscriptionMimeType(file.name) })
      : file;
  const formData = new FormData();
  formData.append("file", normalizedFile, normalizedFile.name);
  formData.append("model", settings.transcriptionModel);
  if (!settings.transcriptionModel.includes("diarize")) {
    formData.append("prompt", "Transcribe faithfully and clearly.");
  }

  return executeAITranscriptionOperation({
    settings,
    formData,
    operation: "transcribe-audio",
    promptVersion: AI_PROMPT_PROFILE_VERSION,
    onEvent,
  });
};
