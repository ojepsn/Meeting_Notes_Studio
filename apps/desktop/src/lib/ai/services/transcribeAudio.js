import { callTranscriptionsApi } from "../client/openaiClient";
export const transcribeAudio = async ({ file, settings, }) => {
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
