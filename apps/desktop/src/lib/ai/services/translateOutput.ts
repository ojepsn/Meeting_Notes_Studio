import type { LocalAppSettings } from "@notesmith/domain";
import { callResponsesApi } from "../client/openaiClient";

export const translateOutput = async ({
  currentOutput,
  settings,
  targetLanguage,
}: {
  currentOutput: string;
  settings: LocalAppSettings;
  targetLanguage: "English" | "Swedish";
}) => {
  if (!currentOutput.trim()) {
    throw new Error("There is no output to translate yet.");
  }

  const response = await callResponsesApi({
    apiKey: settings.apiKey,
    body: {
      model: settings.textModel,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: settings.promptProfile.translationRules }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Translate the following output to ${targetLanguage} while preserving structure:\n\n${currentOutput}`,
            },
          ],
        },
      ],
    },
  });

  return response.output_text || "";
};
