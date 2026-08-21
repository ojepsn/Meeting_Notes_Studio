import { formatEnabledPromptBlocks, resolvePromptProfile } from "../prompts";
import { executeAITextOperation } from "../runtime";
const buildTemplateSectionPrompt = (template) => template.sections
    .map((section) => `- ${section.title}: ${section.instructions}`)
    .join("\n");
const SECTION_HEADING_ALIASES = {
    agenda: ["agenda", "dagordning"],
    summary: ["summary", "meeting summary", "executive summary", "sammanfattning"],
    discussion: ["key discussion points", "discussion points", "discussion", "viktiga diskussionspunkter", "diskussionspunkter"],
    decisions: ["decision", "decisions", "decisions made", "key decisions", "beslut", "fattade beslut", "decisions and actions"],
    actions: ["action", "actions", "action items", "next steps", "follow-up actions", "åtgärder", "åtgärdspunkter", "nästa steg", "uppföljning", "decisions and actions"],
};
const normalizeSectionHeading = (value) => value
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^(\*\*|__)(.*?)\1:?$/, "$2")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/:$/, "")
    .trim()
    .toLocaleLowerCase();
const getSectionHeadingAliases = (section) => new Set([
    normalizeSectionHeading(section.title),
    ...(SECTION_HEADING_ALIASES[section.id] ?? []).map(normalizeSectionHeading),
]);
export const removeExcludedTemplateSections = (output, template, excludedSectionIds) => {
    if (!excludedSectionIds.length || !output.trim())
        return output;
    const excludedIds = new Set(excludedSectionIds);
    const sectionsWithAliases = template.sections.map((section) => ({
        section,
        aliases: getSectionHeadingAliases(section),
    }));
    const lines = output.replace(/\r\n/g, "\n").split("\n");
    const keptLines = [];
    let skipCurrentSection = false;
    lines.forEach((line) => {
        const normalizedLine = normalizeSectionHeading(line);
        const matchingSection = sectionsWithAliases.find(({ aliases }) => aliases.has(normalizedLine))?.section;
        if (matchingSection) {
            skipCurrentSection = excludedIds.has(matchingSection.id);
        }
        if (!skipCurrentSection) {
            keptLines.push(line);
        }
    });
    return keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};
export const buildSectionSelectionContract = (template, selectedSections) => {
    const selectedIds = new Set(selectedSections.map((section) => section.id));
    const excludedSections = template.sections.filter((section) => !selectedIds.has(section.id));
    return [
        "STRICT OUTPUT SECTION CONTRACT (takes precedence over all general meeting-minute guidance):",
        `Required body sections, in this exact order: ${selectedSections.map((section) => section.title).join("; ") || "none"}.`,
        `Forbidden body sections: ${excludedSections.map((section) => section.title).join("; ") || "none"}.`,
        "After the required meeting metadata lines, create exactly the required body sections and no others.",
        "Never create a heading, standalone block, appendix, or renamed equivalent for a forbidden section.",
        "General guidance about decisions, actions, risks, or follow-up does not authorize adding an unchecked section.",
    ].join("\n");
};
const FALLBACK_SECTION = {
    id: "generated-notes",
    title: "Generated notes",
    instructions: "Create a useful polished output from the available manual notes, agenda, highlights, live transcript, or uploaded transcript.",
    enabledByDefault: true,
    position: 1,
};
const LONG_SOURCE_CHAR_LIMIT = 30_000;
const SOURCE_CHUNK_CHAR_LIMIT = 8_000;
const FINAL_OUTPUT_TOKEN_BUDGET = 20_000;
const CHUNK_SUMMARY_TOKEN_BUDGET = 4_000;
const MIN_GENERATED_OUTPUT_CHARS = 80;
const richTextToPlainText = (value) => {
    if (!value)
        return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
    return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};
const sortParticipantsAlphabetically = (participantText) => String(participantText || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
    .join(", ");
const splitSourceIntoChunks = (sourceText, maxChunkChars = SOURCE_CHUNK_CHAR_LIMIT) => {
    const paragraphs = sourceText.split(/\n{2,}/).map((entry) => entry.trim()).filter(Boolean);
    const chunks = [];
    let currentChunk = "";
    paragraphs.forEach((paragraph) => {
        if (paragraph.length > maxChunkChars) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            for (let index = 0; index < paragraph.length; index += maxChunkChars) {
                chunks.push(paragraph.slice(index, index + maxChunkChars).trim());
            }
            return;
        }
        const nextChunk = [currentChunk, paragraph].filter(Boolean).join("\n\n");
        if (nextChunk.length > maxChunkChars && currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = paragraph;
            return;
        }
        currentChunk = nextChunk;
    });
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
};
const assertUsefulGeneratedText = (text, sourceMaterial) => {
    if (sourceMaterial.trim().length < 500 || text.trim().length >= MIN_GENERATED_OUTPUT_CHARS) {
        return;
    }
    throw new Error("OpenAI returned an unusably short generation. No output was saved. Please try again; if it repeats, switch to a stronger text model in Settings.");
};
const executeUsableGeneration = async ({ sourceMaterial, retryUserText, ...options }) => {
    try {
        const output = await executeAITextOperation(options);
        assertUsefulGeneratedText(output, sourceMaterial);
        return output;
    }
    catch (error) {
        if (!retryUserText) {
            throw error;
        }
        const retryOutput = await executeAITextOperation({
            ...options,
            userText: retryUserText,
            promptVersion: options.promptVersion ? `${options.promptVersion}:retry` : "retry",
            maxOutputTokens: Math.max(options.maxOutputTokens ?? 0, FINAL_OUTPUT_TOKEN_BUDGET),
            timeoutMs: Math.max(options.timeoutMs ?? 0, 120_000),
        });
        assertUsefulGeneratedText(retryOutput, sourceMaterial);
        return retryOutput;
    }
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
const getMeetingHeaderInstruction = (session) => {
    if (session.captureMode !== "meeting-note") {
        return "";
    }
    return [
        "Always begin the final output with these labeled lines exactly once, before all sections:",
        `Meeting title: ${session.title.trim() || "Not provided"}`,
        `Date: ${session.date.trim() || "Not provided"}`,
        `Start time: ${session.startTime.trim() || "Not provided"}`,
        `End time: ${session.endTime.trim() || "Not provided"}`,
        `Participants: ${sortParticipantsAlphabetically(session.participantText) || "Not provided"}`,
    ].join("\n");
};
export const generateNotes = async ({ session, settings, template, attachments = [], onEvent, onDiagnostic, }) => {
    const promptProfile = resolvePromptProfile(settings.promptProfile);
    const sortedParticipants = sortParticipantsAlphabetically(session.participantText);
    const selectedSections = template.sections.filter((section) => !session.excludedSectionIds.includes(section.id));
    const activeSections = selectedSections.length ? selectedSections : [FALLBACK_SECTION];
    const sectionSelectionContract = buildSectionSelectionContract(template, activeSections);
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
    onDiagnostic?.("Generation source prepared.", [
        `source characters: ${sourceText.length}`,
        `manual notes characters: ${manualNotes.length}`,
        `live transcript characters: ${session.liveTranscript.trim().length}`,
        `uploaded transcript characters: ${session.uploadedTranscript.trim().length}`,
        `agenda characters: ${agendaText.length}`,
        `template: ${template.name}`,
        `model: ${settings.textModel}`,
    ].join("\n"));
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
    const systemTexts = [
        ...generationPromptTexts,
        getCaptureModeInstruction(session),
        getDiscussionFormatInstruction(session),
        getMeetingHeaderInstruction(session),
        "Do not reproduce the transcript or source notes verbatim. Transform the source into a synthesized, business-ready output with clear wording, merged duplicates, and meaningful summarization.",
        outputLanguageInstruction,
        getDetailLevelInstruction(session.detailLevel),
        session.additionalInstructions.trim()
            ? `Additional generation instructions from the user:\n${session.additionalInstructions.trim()}`
            : "",
        sectionSelectionContract,
    ];
    const buildUserText = (sourceMaterial, sourceLabel = "Source material") => `Template: ${template.name}\nSections:\n${buildTemplateSectionPrompt({ ...template, sections: activeSections })}${template.promptInstructions?.trim() ? `\nTemplate-specific instructions:\n${template.promptInstructions.trim()}` : ""}\nTemplate-specific field values:\n${buildTemplateFieldPrompt({ template, session })}\n\nContext:\nTitle: ${session.title}\nParticipants: ${sortedParticipants}\nDomain: ${session.domain}\nProject: ${session.project}\nActivity: ${session.activity}\nTags: ${session.tagsText}\nDate: ${session.date}\nTime: ${session.startTime}-${session.endTime}\nHighlights: ${session.quickHighlights}${includedImagesPrompt
        ? `\nIncluded images for polished output:\n${includedImagesPrompt}\nReference these images where appropriate and preserve their captions.`
        : ""}\n\n${sourceLabel}:\n${sourceMaterial}${extraPromptBlocks ? `\n\nAdditional prompt blocks:\n${extraPromptBlocks}` : ""}\n\n${sectionSelectionContract}`;
    let sourceForFinalGeneration = sourceText;
    if (sourceText.length > LONG_SOURCE_CHAR_LIMIT) {
        const chunks = splitSourceIntoChunks(sourceText);
        const summaries = [];
        onDiagnostic?.("Long source detected. Summarizing transcript in chunks before final generation.", `chunks: ${chunks.length}\nchunk size target: ${SOURCE_CHUNK_CHAR_LIMIT} characters`, "info");
        for (let index = 0; index < chunks.length; index += 1) {
            onDiagnostic?.(`Summarizing chunk ${index + 1} of ${chunks.length}.`, `chunk characters: ${chunks[index].length}`);
            const chunkUserText = `Transcript chunk ${index + 1} of ${chunks.length}.\n\nReturn a dense but compact intermediate summary of this chunk. Preserve decisions, actions, risks, open questions, important discussion substance, names, dates, and numbers. Merge repetition and ignore filler. Do not copy transcript wording except for essential short phrases.\n\n${chunks[index]}`;
            const summary = await executeUsableGeneration({
                settings,
                operation: "generate-notes",
                promptVersion: `${promptProfile.version}:chunk-summary`,
                systemTexts: [
                    "You are preparing an intermediate summary for later meeting-minutes generation.",
                    "Summarize the transcript chunk into factual source notes for a later final synthesis. Return enough detail for a high-quality final document, but keep it compact.",
                    outputLanguageInstruction,
                ],
                userText: chunkUserText,
                onEvent,
                cacheMode: "bypass",
                maxOutputTokens: CHUNK_SUMMARY_TOKEN_BUDGET,
                timeoutMs: 90_000,
                sourceMaterial: chunks[index],
                retryUserText: `${chunkUserText}\n\nThe previous attempt did not return usable text. Try again and return a complete intermediate summary.`,
            });
            onDiagnostic?.(`Chunk ${index + 1} summarized.`, `summary characters: ${summary.trim().length}`, "success");
            summaries.push(`Chunk ${index + 1} summary:\n${summary}`);
        }
        sourceForFinalGeneration = [
            "The original source was too long for one reliable final-generation request, so it has been condensed into factual intermediate summaries.",
            "Use these summaries as the source of truth for the final output. Synthesize them into coherent meeting minutes and do not list chunk-by-chunk summaries.",
            ...summaries,
        ].join("\n\n");
        onDiagnostic?.("Chunk summaries prepared for final generation.", `condensed source characters: ${sourceForFinalGeneration.length}`, "success");
    }
    const finalUserText = buildUserText(sourceForFinalGeneration, sourceForFinalGeneration === sourceText ? "Source material" : "Condensed source summaries");
    onDiagnostic?.("Starting final output generation.", [
        `final prompt characters: ${finalUserText.length}`,
        `max output tokens: ${FINAL_OUTPUT_TOKEN_BUDGET}`,
        `sections requested: ${activeSections.map((section) => section.title).join(", ")}`,
    ].join("\n"));
    const output = await executeUsableGeneration({
        settings,
        operation: "generate-notes",
        promptVersion: promptProfile.version,
        systemTexts,
        userText: finalUserText,
        onEvent,
        cacheMode: "bypass",
        maxOutputTokens: FINAL_OUTPUT_TOKEN_BUDGET,
        timeoutMs: sourceForFinalGeneration === sourceText ? 120_000 : 120_000,
        sourceMaterial: sourceText,
        retryUserText: `${finalUserText}\n\nThe previous attempt did not produce a usable output. Try again and return complete, synthesized notes. Do not return a single character, partial word, or copied transcript.`,
    });
    onDiagnostic?.("Final output generated.", `output characters: ${output.trim().length}`, "success");
    const constrainedOutput = removeExcludedTemplateSections(output, template, session.excludedSectionIds);
    if (constrainedOutput !== output.trim()) {
        onDiagnostic?.("Removed output sections that were unchecked for this session.", `excluded sections: ${template.sections
            .filter((section) => session.excludedSectionIds.includes(section.id))
            .map((section) => section.title)
            .join(", ")}`, "warning");
    }
    return constrainedOutput;
};
