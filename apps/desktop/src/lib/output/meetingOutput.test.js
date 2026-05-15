import { ensureMeetingOutputHeader } from "./meetingOutput";
describe("meetingOutput", () => {
    const meetingSession = {
        captureMode: "meeting-note",
        title: "Weekly project sync",
        date: "2026-05-15",
        startTime: "09:00",
        endTime: "09:30",
        participantText: "Marcus, Anna",
    };
    it("prepends the required meeting header", () => {
        expect(ensureMeetingOutputHeader(meetingSession, "Decisions\n- Ship on Friday")).toBe([
            "Meeting title: Weekly project sync",
            "Date: 2026-05-15",
            "Start time: 09:00",
            "End time: 09:30",
            "Participants: Anna, Marcus",
            "",
            "Decisions",
            "- Ship on Friday",
        ].join("\n"));
    });
    it("replaces an existing leading meeting header without duplication", () => {
        const existingOutput = [
            "Meeting title: Older title",
            "Date: 2025-01-01",
            "Start time: 08:00",
            "End time: 08:15",
            "Participants: Someone Else",
            "",
            "Weekly project sync",
            "",
            "Summary",
            "Important update",
        ].join("\n");
        expect(ensureMeetingOutputHeader(meetingSession, existingOutput)).toBe([
            "Meeting title: Weekly project sync",
            "Date: 2026-05-15",
            "Start time: 09:00",
            "End time: 09:30",
            "Participants: Anna, Marcus",
            "",
            "Summary",
            "Important update",
        ].join("\n"));
    });
    it("leaves non-meeting output unchanged", () => {
        expect(ensureMeetingOutputHeader({
            ...meetingSession,
            captureMode: "quick-note",
        }, "Free-form output")).toBe("Free-form output");
    });
});
