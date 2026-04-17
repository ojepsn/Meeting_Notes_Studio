const COMMON_REPLACEMENTS = [
    [/\bteh\b/gi, "the"],
    [/\btesing\b/gi, "testing"],
    [/\basom\b/gi, "some"],
    [/\bwhn\b/gi, "when"],
    [/\bmistakens\b/gi, "mistakes"],
    [/\bthigns\b/gi, "things"],
    [/\bdont\b/gi, "don't"],
    [/\bcant\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\brecieve\b/gi, "receive"],
    [/\bseperate\b/gi, "separate"],
    [/\boccured\b/gi, "occurred"],
    [/\bdefinately\b/gi, "definitely"],
    [/\bbecuase\b/gi, "because"],
    [/\badress\b/gi, "address"],
    [/\bmangement\b/gi, "management"],
    [/\benvironment\b/gi, "environment"],
    [/\bmtg\b/gi, "meeting"],
    [/\bw\/\b/gi, "with "],
    [/\bw\/o\b/gi, "without"],
];
const LABEL_NORMALIZATIONS = [
    [/^dec(?:ision)?\s*[:\-]?\s*/i, "Decision: "],
    [/^act(?:ion)?\s*[:\-]?\s*/i, "Action: "],
    [/^next\s*steps?\s*[:\-]?\s*/i, "Next step: "],
    [/^risk\s*[:\-]?\s*/i, "Risk: "],
    [/^summary\s*[:\-]?\s*/i, "Summary: "],
    [/^agenda\s*[:\-]?\s*/i, "Agenda: "],
];
const FILLER_ONLY_LINE = /^(uh+|um+|okay|ok|so|right)\.?$/i;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeParticipants = (value) => String(value || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
const canonicalizeParticipantMentions = (text, options) => {
    const sessionParticipants = normalizeParticipants(options.sessionParticipants || "");
    const canonicalParticipants = [...new Set([...sessionParticipants, ...(options.savedParticipants || [])])];
    let nextText = text;
    canonicalParticipants.forEach((participant) => {
        const fullNamePattern = new RegExp(`\\b${escapeRegExp(participant)}\\b`, "gi");
        nextText = nextText.replace(fullNamePattern, participant);
    });
    const uniqueFirstNames = new Map();
    const duplicateFirstNames = new Set();
    sessionParticipants.forEach((participant) => {
        const firstName = participant.split(/\s+/)[0]?.trim();
        if (!firstName) {
            return;
        }
        const key = firstName.toLocaleLowerCase();
        if (uniqueFirstNames.has(key) && uniqueFirstNames.get(key) !== participant) {
            duplicateFirstNames.add(key);
            uniqueFirstNames.delete(key);
            return;
        }
        if (!duplicateFirstNames.has(key)) {
            uniqueFirstNames.set(key, participant);
        }
    });
    uniqueFirstNames.forEach((fullName, firstName) => {
        if (fullName.toLocaleLowerCase() === firstName) {
            return;
        }
        const pattern = new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "gi");
        nextText = nextText.replace(pattern, fullName);
    });
    return nextText;
};
const expandKnownAbbreviations = (text, abbreviations) => {
    let nextText = text;
    (abbreviations || []).forEach((entry) => {
        const shortForm = String(entry?.shortForm || "").trim();
        const fullForm = String(entry?.fullForm || "").trim();
        if (!shortForm || !fullForm) {
            return;
        }
        const pattern = new RegExp(`\\b${escapeRegExp(shortForm)}\\b`, "gi");
        nextText = nextText.replace(pattern, fullForm);
    });
    return nextText;
};
const standardizeDateAndTime = (text) => text
    .replace(/\b(\d{4})\/(\d{2})\/(\d{2})\b/g, "$1-$2-$3")
    .replace(/\b(\d{1,2})[.,](\d{2})\b/g, (_, hours, minutes) => `${hours.padStart(2, "0")}:${minutes}`);
const startsWithKnownParticipantAction = (text, options) => {
    const canonicalParticipants = [...new Set([...normalizeParticipants(options.sessionParticipants || ""), ...(options.savedParticipants || [])])]
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
    return canonicalParticipants.some((participant) => {
        const pattern = new RegExp(`^${escapeRegExp(participant)}\\s+to\\s+`, "i");
        return pattern.test(text);
    });
};
const standardizeActionPattern = (text, options) => {
    if (/^(Action|Decision|Risk|Next step|Agenda|Summary):/i.test(text)) {
        return text;
    }
    if (startsWithKnownParticipantAction(text, options)) {
        return `Action: ${text}`;
    }
    return text;
};
const normalizeLinePunctuation = (text) => text
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,.;!?])(?=[^\s)\]])/g, "$1 ")
    .replace(/([,.;!?])\1+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
const capitalizeSentenceStarts = (text) => text.replace(/(^|[.!?]\s+)([a-zåäö])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);
const ensureSentenceEnding = (text) => {
    if (!text || /[:)\]]$/.test(text) || /[.!?]$/.test(text)) {
        return text;
    }
    return `${text}.`;
};
const normalizeLabelLine = (text) => {
    let nextText = text;
    LABEL_NORMALIZATIONS.forEach(([pattern, label]) => {
        if (pattern.test(nextText)) {
            nextText = nextText.replace(pattern, label);
        }
    });
    return nextText;
};
const normalizeTextLine = (line, options) => {
    let nextLine = line.replace(/\s+/g, " ").trim();
    if (!nextLine) {
        return "";
    }
    nextLine = expandKnownAbbreviations(nextLine, options.abbreviations);
    nextLine = canonicalizeParticipantMentions(nextLine, options);
    COMMON_REPLACEMENTS.forEach(([pattern, replacement]) => {
        nextLine = nextLine.replace(pattern, replacement);
    });
    nextLine = standardizeDateAndTime(nextLine);
    nextLine = normalizeLabelLine(nextLine);
    nextLine = standardizeActionPattern(nextLine, options);
    nextLine = normalizeLinePunctuation(nextLine);
    const bulletMatch = nextLine.match(/^([-*•]|\d+[.)])\s+(.+)$/);
    if (bulletMatch) {
        const marker = /^\d/.test(bulletMatch[1]) ? `${bulletMatch[1].replace(/\)+$/, ".")}` : "-";
        const body = ensureSentenceEnding(capitalizeSentenceStarts(bulletMatch[2].trim()));
        return `${marker} ${body}`;
    }
    const labelMatch = nextLine.match(/^(Decision|Action|Risk|Next step|Agenda|Summary):\s*(.+)$/i);
    if (labelMatch) {
        const label = normalizeLabelLine(labelMatch[1]).replace(/:\s*$/, "");
        const body = ensureSentenceEnding(capitalizeSentenceStarts(labelMatch[2].trim()));
        return `${label}: ${body}`;
    }
    return ensureSentenceEnding(capitalizeSentenceStarts(nextLine));
};
const isBulletLine = (line) => /^([-*•]|\d+[.)])\s+/.test(line);
const isStandaloneLabel = (line) => /^(dec(?:ision)?|act(?:ion)?|next\s*steps?|risk|summary|agenda)\b\s*[:\-]?/i.test(line)
    || (/^[A-Za-z][^.!?]{0,80}:$/.test(line) && line.split(/\s+/).length <= 8);
export const polishNonAiNotesText = (text, options = {}) => {
    const lines = String(text || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd());
    const normalizedLines = [];
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            if (normalizedLines.at(-1) !== "") {
                normalizedLines.push("");
            }
            return;
        }
        if (FILLER_ONLY_LINE.test(trimmed)) {
            return;
        }
        const previousComparable = normalizedLines
            .slice()
            .reverse()
            .find((value) => value.trim());
        if (previousComparable && previousComparable.replace(/\s+/g, " ").toLocaleLowerCase() === trimmed.replace(/\s+/g, " ").toLocaleLowerCase()) {
            return;
        }
        normalizedLines.push(trimmed);
    });
    const blocks = [];
    let paragraphBuffer = [];
    let listBuffer = [];
    const flushParagraph = () => {
        if (!paragraphBuffer.length)
            return;
        blocks.push(normalizeTextLine(paragraphBuffer.join(" "), options));
        paragraphBuffer = [];
    };
    const flushList = () => {
        if (!listBuffer.length)
            return;
        blocks.push(listBuffer.map((line) => normalizeTextLine(line, options)).join("\n"));
        listBuffer = [];
    };
    normalizedLines.forEach((line) => {
        if (!line) {
            flushParagraph();
            flushList();
            return;
        }
        if (isBulletLine(line)) {
            flushParagraph();
            listBuffer.push(line);
            return;
        }
        if (isStandaloneLabel(line)) {
            flushParagraph();
            flushList();
            blocks.push(normalizeTextLine(line, options));
            return;
        }
        if (listBuffer.length) {
            flushList();
        }
        paragraphBuffer.push(line);
    });
    flushParagraph();
    flushList();
    return blocks.filter(Boolean).join("\n\n").trim();
};
