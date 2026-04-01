import { AI_PROMPT_PROFILE_VERSION } from "../prompts";
import { executeAITranscriptionOperation } from "../runtime";
export const transcribeAudio = async ({ file, settings, onEvent, }) => {
    const formData = new FormData();
    formData.append("file", file);
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
