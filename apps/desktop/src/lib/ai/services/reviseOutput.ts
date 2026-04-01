import type { LocalAppSettings } from "@notesmith/domain";
import { callResponsesApi } from "../client/openaiClient";

export const reviseOutput = async ({
  currentOutput,
  instructions,
  detailLevel,
  settings,
}: {
  currentOutput: string;
  instructions: string;
  detailLevel: number;
  settings: LocalAppSettings;
}) => {
  if (!currentOutput.trim()) {
    throw new Error("There is no output to revise yet.");
  }
  if (!instructions.trim()) {
    throw new Error("Add revision instructions before asking for improvements.");
  }

  const response = await callResponsesApi({
    apiKey: settings.apiKey,
    body: {
      model: settings.textModel,
      input: [
        {
          role: "system",
          content: [
            { type: "input_text", text: settings.promptProfile.revisionRules },
            {
              type: "input_text",
              text: `Keep the revision aligned to detail level ${Math.min(5, Math.max(1, Math.round(detailLevel)))}.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Current output:\n${currentOutput}\n\nRequested improvement:\n${instructions}`,
            },
          ],
        },
      ],
    },
  });

  return response.output_text || "";
};
