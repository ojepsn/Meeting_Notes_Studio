const sortParticipantsAlphabetically = (participantText) => String(participantText || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
    .join(", ");
const normalizeMeetingValue = (value, fallback = "Not provided") => value.trim() || fallback;
const isMeetingHeaderLine = (line) => /^(Meeting title|Date|Start time|End time|Participants):/i.test(line.trim());
const sameText = (left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }) === 0;
const stripLeadingMeetingHeader = (output, title) => {
    const normalized = output.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return "";
    }
    const lines = normalized.split("\n");
    let index = 0;
    while (index < lines.length && !lines[index].trim()) {
        index += 1;
    }
    let consumedHeaderLine = false;
    while (index < lines.length) {
        const trimmed = lines[index].trim();
        if (!trimmed) {
            if (consumedHeaderLine) {
                index += 1;
                break;
            }
            index += 1;
            continue;
        }
        if (isMeetingHeaderLine(trimmed)) {
            consumedHeaderLine = true;
            index += 1;
            continue;
        }
        if (!consumedHeaderLine && title.trim() && sameText(trimmed, title.trim())) {
            index += 1;
            continue;
        }
        break;
    }
    const remainingLines = lines.slice(index);
    while (remainingLines.length && !remainingLines[0].trim()) {
        remainingLines.shift();
    }
    if (title.trim() && remainingLines.length && sameText(remainingLines[0].trim(), title.trim())) {
        remainingLines.shift();
        while (remainingLines.length && !remainingLines[0].trim()) {
            remainingLines.shift();
        }
    }
    return remainingLines.join("\n").trim();
};
export const buildMeetingOutputHeader = (session) => [
    `Meeting title: ${normalizeMeetingValue(session.title)}`,
    `Date: ${normalizeMeetingValue(session.date)}`,
    `Start time: ${normalizeMeetingValue(session.startTime)}\nEnd time: ${normalizeMeetingValue(session.endTime)}`,
    `Participants: ${normalizeMeetingValue(sortParticipantsAlphabetically(session.participantText), "Not provided")}`,
].join("\n");
export const ensureMeetingOutputHeader = (session, output) => {
    if (session.captureMode !== "meeting-note") {
        return output;
    }
    const header = buildMeetingOutputHeader(session);
    const remainingBody = stripLeadingMeetingHeader(output, session.title);
    return remainingBody ? `${header}\n\n${remainingBody}` : header;
};
