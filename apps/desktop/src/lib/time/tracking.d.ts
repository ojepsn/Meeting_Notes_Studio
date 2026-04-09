import type { TimeLogRecord } from "@notesmith/domain";
export declare const isTimeLogRunning: (entry: TimeLogRecord) => boolean;
export declare const getRunningTimeLog: (entries: TimeLogRecord[]) => TimeLogRecord | null;
export declare const calculateLiveDurationMinutes: (entry: TimeLogRecord, now?: Date) => number;
export declare const formatTrackedMinutes: (minutes: number) => string;
