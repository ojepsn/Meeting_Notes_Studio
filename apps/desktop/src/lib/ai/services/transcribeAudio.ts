import type { LocalAppSettings } from "@notesmith/domain";
import { callTranscriptionsApi } from "../client/openaiClient";

export const transcribeAudio = async ({
  file,
  settings,
}: {
  file: File;
  settings: LocalAppSettings;
}) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", settings.transcriptionModel);
  if (!settings.transcriptionModel.includes("diarize")) {
    formData.append("prompt", "Transcribe faithfully and clearly.");
  }

  const response = await callTranscriptionsApi({
    apiKey: settings.apiKey,
    formData,
  });

  return response.text || "";
};
