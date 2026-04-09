import type { TimeLogRecord } from "@notesmith/domain";

export const isTimeLogRunning = (entry: TimeLogRecord) => entry.startTime === entry.endTime;

export const getRunningTimeLog = (entries: TimeLogRecord[]) => entries.find(isTimeLogRunning) || null;

export const calculateLiveDurationMinutes = (entry: TimeLogRecord, now = new Date()) => {
  const startedAt = new Date(`${entry.date}T${entry.startTime || "00:00"}:00`);
  const diffMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);
  return Number.isFinite(diffMinutes) ? Math.max(0, diffMinutes) : 0;
};

export const formatTrackedMinutes = (minutes: number) => {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
};
