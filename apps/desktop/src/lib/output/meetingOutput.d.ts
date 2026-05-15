import type { SessionRecord } from "@notesmith/domain";
type MeetingOutputSession = Pick<SessionRecord, "captureMode" | "title" | "date" | "startTime" | "endTime" | "participantText">;
export declare const buildMeetingOutputHeader: (session: MeetingOutputSession) => string;
export declare const ensureMeetingOutputHeader: (session: MeetingOutputSession, output: string) => string;
export {};
