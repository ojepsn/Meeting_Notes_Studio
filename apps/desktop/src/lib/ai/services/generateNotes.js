import { callResponsesApi } from "../client/openaiClient";
const buildTemplateSectionPrompt = (template) => template.sections
    .map((section) => `- ${section.title}: ${section.instructions}`)
    .join("\n");
const buildTemplateFieldPrompt = ({ template, session, }) => {
    const customFields = template.fields.filter((field) => field.enabled && !["title", "participants", "date", "startTime", "endTime"].includes(field.key));
    if (!customFields.length) {
        return "No template-specific field values.";
    }
    return customFields
        .map((field) => `- ${field.label}: ${session.customFieldValues[field.id]?.trim() || "Not provided"}`)
        .join("\n");
};
const getDetailLevelInstruction = (detailLevel) => {
    const labels = {
        1: "minimal",
        2: "concise",
        3: "balanced",
        4: "detailed",
        5: "comprehensive",
    };
    return `Match a ${labels[Math.min(5, Math.max(1, Math.round(detailLevel)))]} level of detail.`;
};
export const generateNotes = async ({ session, settings, template, }) => {
    const activeSections = template.sections.filter((section) => !session.excludedSectionIds.includes(section.id));
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
    if (!activeSections.length) {
        throw new Error("Enable at least one output section for this session before generating output.");
    }
    const extraPromptBlocks = settings.promptProfile.extraBlocks
        .filter((block) => block.enabled && block.body.trim())
        .map((block) => `${block.label || "Extra prompt"}:\n${block.body}`)
        .join("\n\n");
    const outputLanguageInstruction = settings.outputLanguage === "same"
        ? "Keep the output in the same language as the source notes."
        : `Return the final notes in ${settings.outputLanguage === "sv" ? "Swedish" : "English"}.`;
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
                        { type: "input_text", text: outputLanguageInstruction },
                        { type: "input_text", text: getDetailLevelInstruction(session.detailLevel) },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `Template: ${template.name}\nSections:\n${buildTemplateSectionPrompt({ ...template, sections: activeSections })}${template.promptInstructions?.trim()
                                ? `\nTemplate-specific instructions:\n${template.promptInstructions.trim()}`
                                : ""}\nTemplate-specific field values:\n${buildTemplateFieldPrompt({ template, session })}\n\nContext:\nTitle: ${session.title}\nParticipants: ${session.participantText}\nDate: ${session.date}\nTime: ${session.startTime}-${session.endTime}\nHighlights: ${session.quickHighlights}\n\n${sourceText}${extraPromptBlocks ? `\n\nAdditional prompt blocks:\n${extraPromptBlocks}` : ""}`,
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
