import type { LocalAppSettings } from "@notesmith/domain";
import { resolvePromptProfile } from "../prompts";
import type { AIRuntimeEvent } from "../runtime";
import { executeAITextOperation } from "../runtime";

export const translateOutput = async ({
  currentOutput,
  settings,
  targetLanguage,
  onEvent,
}: {
  currentOutput: string;
  settings: LocalAppSettings;
  targetLanguage: "English" | "Swedish";
  onEvent?: (event: AIRuntimeEvent) => void;
}) => {
  const promptProfile = resolvePromptProfile(settings.promptProfile);
  if (!currentOutput.trim()) {
    throw new Error("There is no output to translate yet.");
  }

  return executeAITextOperation({
    settings,
    operation: "translate-output",
    promptVersion: promptProfile.version,
    systemTexts: [
      promptProfile.profile.translationRules,
      `Return the translated output in ${targetLanguage}.`,
    ],
    userText: `Translate the following output to ${targetLanguage} while preserving structure:\n\n${currentOutput}`,
    onEvent,
  });
};
