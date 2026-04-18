import { resolvePromptProfile } from "../prompts";
import { executeAITextOperation } from "../runtime";
export const reviseOutput = async ({ currentOutput, instructions, detailLevel, outputLanguage, additionalInstructions, settings, onEvent, }) => {
    const promptProfile = resolvePromptProfile(settings.promptProfile);
    if (!currentOutput.trim()) {
        throw new Error("There is no output to revise yet.");
    }
    if (!instructions.trim()) {
        throw new Error("Add revision instructions before asking for improvements.");
    }
    return executeAITextOperation({
        settings,
        operation: "revise-output",
        promptVersion: promptProfile.version,
        systemTexts: [
            promptProfile.profile.revisionRules,
            `Keep the revision aligned to detail level ${Math.min(5, Math.max(1, Math.round(detailLevel)))}.`,
            outputLanguage === "same"
                ? "Keep the revision in the same language as the current output."
                : `Return the revised output in ${outputLanguage === "sv" ? "Swedish" : "English"}.`,
            additionalInstructions?.trim()
                ? `Additional generation instructions from the user:\n${additionalInstructions.trim()}`
                : "",
        ],
        userText: `Current output:\n${currentOutput}\n\nRequested improvement:\n${instructions}`,
        onEvent,
    });
};
