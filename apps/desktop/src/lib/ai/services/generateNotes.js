import { callResponsesApi } from "../client/openaiClient";
const buildTemplateSectionPrompt = (template) => template.sections
    .map((section) => `- ${section.title}: ${section.instructions}`)
    .join("\n");
export const generateNotes = async ({ session, settings, template, }) => {
    const sourceText = [
        session.manualNotes.trim() ? `Manual notes:\n${session.manualNotes.trim()}` : "",
        session.liveTranscript.trim() ? `Live transcript:\n${session.liveTranscript.trim()}` : "",
        session.uploadedTranscript.trim() ? `Uploaded transcript:\n${session.uploadedTranscript.trim()}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    if (!sourceText) {
        throw new Error("Add notes or transcript content before generating output.");
    }
    const extraPromptBlocks = settings.promptProfile.extraBlocks
        .filter((block) => block.enabled && block.body.trim())
        .map((block) => `${block.label || "Extra prompt"}:\n${block.body}`)
        .join("\n\n");
    const response = await callResponsesApi({
        apiKey: settings.apiKey,
        body: {
            model: settings.textModel,
            input: [
                {
                    role: "system",
                    content: [
                        { type: "input_text", text: settings.promptProfile.generationSystem },
                        { type: "input_text", text: settings.promptProfile.generationRules },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `Template: ${template.name}\nSections:\n${buildTemplateSectionPrompt(template)}\n\nContext:\nTitle: ${session.title}\nParticipants: ${session.participantText}\nDate: ${session.date}\nTime: ${session.startTime}-${session.endTime}\nHighlights: ${session.quickHighlights}\n\n${sourceText}${extraPromptBlocks ? `\n\nAdditional prompt blocks:\n${extraPromptBlocks}` : ""}`,
                        },
                    ],
                },
            ],
        },
    });
    return (response.output_text ||
        response.output
            ?.flatMap((item) => item.content || [])
            .map((contentItem) => contentItem.text || "")
            .join("\n")
            .trim() ||
        "");
};
