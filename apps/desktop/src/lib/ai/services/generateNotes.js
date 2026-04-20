import { formatEnabledPromptBlocks, resolvePromptProfile } from "../prompts";
import { executeAITextOperation } from "../runtime";
const buildTemplateSectionPrompt = (template) => template.sections
    .map((section) => `- ${section.title}: ${section.instructions}`)
    .join("\n");
const FALLBACK_SECTION = {
    id: "generated-notes",
    title: "Generated notes",
    instructions: "Create a useful polished output from the available manual notes, agenda, highlights, live transcript, or uploaded transcript.",
    enabledByDefault: true,
    position: 1,
};
const richTextToPlainText = (value) => {
    if (!value)
        return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
    return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};
const buildTemplateFieldPrompt = ({ template, session, }) => {
    const customFields = template.fields.filter((field) => field.enabled && !["title", "participants", "date", "startTime", "endTime"].includes(field.key));
    if (!customFields.length) {
        return "No template-specific field values.";
    }
    return customFields
        .map((field) => {
        const rawValue = session.customFieldValues[field.id] ?? "";
        const normalizedValue = field.type === "textarea" ? richTextToPlainText(rawValue) : rawValue.trim();
        return `- ${field.label}: ${normalizedValue || "Not provided"}`;
    })
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
const getCaptureModeInstruction = (session) => {
    switch (session.captureMode) {
        case "quick-note":
            return "This is a quick note workflow. Keep the output lightweight, clear, and proportionate rather than overly formal meeting minutes.";
        case "voice-note":
            return "This is a voice note workflow. Clean up spoken phrasing, keep the note concise, and preserve the sense of a dictated personal/work note unless the template asks for more structure.";
        default:
            return "This is a meeting note workflow. Produce clearly structured professional meeting notes rather than a transcript-style recap.";
    }
};
const getDiscussionFormatInstruction = (session) => {
    if (session.captureMode !== "meeting-note") {
        return "Use paragraphs by default and only use bullets when they genuinely improve readability for the note type.";
    }
    return [
        "For meeting minutes, write substantive discussion sections as flowing paragraphs, not lists.",
        "Use bullets only for agenda, decisions, or action items.",
        "Do not convert ordinary discussion summaries, status updates, or narrative meeting content into bullets.",
        "When uncertain, choose prose.",
    ].join(" ");
};
export const generateNotes = async ({ session, settings, template, attachments = [], onEvent, }) => {
    const promptProfile = resolvePromptProfile(settings.promptProfile);
    const selectedSections = template.sections.filter((section) => !session.excludedSectionIds.includes(section.id));
    const activeSections = selectedSections.length ? selectedSections : [FALLBACK_SECTION];
    const manualNotes = richTextToPlainText(session.manualNotes);
    const agendaText = template.fields
        .filter((field) => field.enabled && field.key === "agenda")
        .map((field) => richTextToPlainText(session.customFieldValues[field.id] ?? ""))
        .filter(Boolean)
        .join("\n\n");
    const sourceText = [
        agendaText ? `Agenda:\n${agendaText}` : "",
        session.quickHighlights.trim() ? `Highlights:\n${session.quickHighlights.trim()}` : "",
        manualNotes ? `Manual notes:\n${manualNotes}` : "",
        session.liveTranscript.trim() ? `Live transcript:\n${session.liveTranscript.trim()}` : "",
        session.uploadedTranscript.trim() ? `Uploaded transcript:\n${session.uploadedTranscript.trim()}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    if (!sourceText) {
        throw new Error("Add notes or transcript content before generating output.");
    }
    const extraPromptBlocks = formatEnabledPromptBlocks(promptProfile.profile.extraBlocks);
    const requestedOutputLanguage = session.outputLanguage === "sv" || session.outputLanguage === "en"
        ? session.outputLanguage
        : settings.outputLanguage;
    const outputLanguageInstruction = requestedOutputLanguage === "same"
        ? "Keep the output in the same language as the source notes."
        : `Return the final notes in ${requestedOutputLanguage === "sv" ? "Swedish" : "English"}.`;
    const includedImagesPrompt = attachments
        .filter((attachment) => attachment.kind === "image" && attachment.includeInOutput)
        .sort((left, right) => left.outputPosition - right.outputPosition || left.createdAt.localeCompare(right.createdAt))
        .map((attachment, index) => `- Image ${index + 1}: ${attachment.caption.trim() || attachment.filename} (${attachment.filename})`)
        .join("\n");
    const generationPromptTexts = session.captureMode === "meeting-note"
        ? [promptProfile.profile.meetingMinutesSystem, promptProfile.profile.meetingMinutesRules]
        : [promptProfile.profile.personalNotesSystem, promptProfile.profile.personalNotesRules];
    return executeAITextOperation({
        settings,
        operation: "generate-notes",
        promptVersion: promptProfile.version,
        systemTexts: [
            ...generationPromptTexts,
            getCaptureModeInstruction(session),
            getDiscussionFormatInstruction(session),
            outputLanguageInstruction,
            getDetailLevelInstruction(session.detailLevel),
            session.additionalInstructions.trim()
                ? `Additional generation instructions from the user:\n${session.additionalInstructions.trim()}`
                : "",
        ],
        userText: `Template: ${template.name}\nSections:\n${buildTemplateSectionPrompt({ ...template, sections: activeSections })}${template.promptInstructions?.trim() ? `\nTemplate-specific instructions:\n${template.promptInstructions.trim()}` : ""}\nTemplate-specific field values:\n${buildTemplateFieldPrompt({ template, session })}\n\nContext:\nTitle: ${session.title}\nParticipants: ${session.participantText}\nDomain: ${session.domain}\nProject: ${session.project}\nActivity: ${session.activity}\nTags: ${session.tagsText}\nDate: ${session.date}\nTime: ${session.startTime}-${session.endTime}\nHighlights: ${session.quickHighlights}${includedImagesPrompt
            ? `\nIncluded images for polished output:\n${includedImagesPrompt}\nReference these images where appropriate and preserve their captions.`
            : ""}\n\n${sourceText}${extraPromptBlocks ? `\n\nAdditional prompt blocks:\n${extraPromptBlocks}` : ""}`,
        onEvent,
    });
};
