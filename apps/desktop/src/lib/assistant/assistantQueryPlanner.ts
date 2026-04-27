import type { AssistantQueryMemoryRecord } from "@notesmith/domain";

export type AssistantRoute = "timelogs" | "sessions" | "calendar" | "todos" | "activities" | "workspace" | "unknown";

export interface AssistantDateRange {
  fromDate: string;
  toDate: string;
  label: string;
}

export interface AssistantQueryPlan {
  route: AssistantRoute;
  fingerprint: string;
  matchedMemory: AssistantQueryMemoryRecord | null;
  dateRange: AssistantDateRange | null;
  shouldClarify: boolean;
  clarificationQuestion: string | null;
  guidance: string;
}

const QUESTION_STOPWORDS = new Set([
  "what", "which", "when", "where", "who", "whom", "why", "how", "did", "do", "does", "is", "are", "was", "were",
  "i", "we", "you", "my", "our", "the", "a", "an", "to", "for", "on", "in", "at", "from", "about", "with", "show",
  "tell", "me", "that", "this", "these", "those", "yesterday", "today", "tomorrow", "week", "month", "last", "this",
]);

const formatLocalDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfWeek = (value: Date) => {
  const next = new Date(value);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfWeek = (value: Date) => {
  const next = startOfWeek(value);
  next.setDate(next.getDate() + 6);
  return next;
};

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const endOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0);

const normalizeQuery = (query: string) => query.trim().toLocaleLowerCase();

const tokenize = (query: string) =>
  normalizeQuery(query)
    .split(/[^a-z0-9åäöæøéü_-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !QUESTION_STOPWORDS.has(token));

export const createAssistantQueryFingerprint = (query: string) => {
  const tokens = Array.from(new Set(tokenize(query)));
  return tokens.slice(0, 6).join(" ");
};

export const inferClarificationRoute = (answer: string): AssistantRoute => {
  const normalized = normalizeQuery(answer);
  if (/(time\s*log|timelog|time spent|hours|tracked time|work log)/i.test(normalized)) return "timelogs";
  if (/(session|note|minutes|decision|decisions|action items|meeting notes|output)/i.test(normalized)) return "sessions";
  if (/(calendar|schedule|meeting|meetings|scheduled)/i.test(normalized)) return "calendar";
  if (/(todo|todos|task|tasks|due|open tasks)/i.test(normalized)) return "todos";
  if (/(activity|activities|project|domain|structure)/i.test(normalized)) return "activities";
  return "unknown";
};

export const resolveAssistantDateRange = (query: string, now = new Date()): AssistantDateRange | null => {
  const normalized = normalizeQuery(query);
  if (/\byesterday\b/.test(normalized)) {
    const value = new Date(now);
    value.setDate(value.getDate() - 1);
    const date = formatLocalDate(value);
    return { fromDate: date, toDate: date, label: `yesterday (${date})` };
  }
  if (/\btoday\b/.test(normalized)) {
    const date = formatLocalDate(now);
    return { fromDate: date, toDate: date, label: `today (${date})` };
  }
  if (/\btomorrow\b/.test(normalized)) {
    const value = new Date(now);
    value.setDate(value.getDate() + 1);
    const date = formatLocalDate(value);
    return { fromDate: date, toDate: date, label: `tomorrow (${date})` };
  }
  if (/\blast week\b/.test(normalized)) {
    const value = new Date(now);
    value.setDate(value.getDate() - 7);
    return { fromDate: formatLocalDate(startOfWeek(value)), toDate: formatLocalDate(endOfWeek(value)), label: "last week" };
  }
  if (/\bthis week\b/.test(normalized)) {
    return { fromDate: formatLocalDate(startOfWeek(now)), toDate: formatLocalDate(endOfWeek(now)), label: "this week" };
  }
  if (/\blast month\b/.test(normalized)) {
    const value = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { fromDate: formatLocalDate(startOfMonth(value)), toDate: formatLocalDate(endOfMonth(value)), label: "last month" };
  }
  if (/\bthis month\b/.test(normalized)) {
    return { fromDate: formatLocalDate(startOfMonth(now)), toDate: formatLocalDate(endOfMonth(now)), label: "this month" };
  }
  return null;
};

const guidanceForRoute = (route: AssistantRoute, dateRange: AssistantDateRange | null) => {
  switch (route) {
    case "timelogs":
      return `Questions about time spent should prioritize timelogs.${dateRange ? ` Use the absolute date range ${dateRange.fromDate} to ${dateRange.toDate}.` : ""}`;
    case "sessions":
      return "Questions about decisions, summaries, outputs, or meeting content should prioritize sessions.";
    case "calendar":
      return `Questions about meetings or schedule should prioritize calendar items.${dateRange ? ` Use the absolute date range ${dateRange.fromDate} to ${dateRange.toDate}.` : ""}`;
    case "todos":
      return "Questions about open work, due work, or tasks should prioritize tasks/todos.";
    case "activities":
      return "Questions about projects, domains, or activity classification should prioritize structure/activity data.";
    default:
      return "Use the available NoteSmith context conservatively and clarify if the data area is unclear.";
  }
};

export const planAssistantQuery = (
  query: string,
  memories: AssistantQueryMemoryRecord[],
  now = new Date(),
): AssistantQueryPlan => {
  const normalized = normalizeQuery(query);
  const fingerprint = createAssistantQueryFingerprint(query);
  const matchedMemory = memories.find((entry) => entry.fingerprint === fingerprint) ?? null;
  const dateRange = resolveAssistantDateRange(query, now);
  let route: AssistantRoute = matchedMemory?.route ?? "unknown";

  if (route === "unknown") {
    if (/(spent time|time spent|worked on|log(?:ged)? time|hours on|track(?:ed)? time)/i.test(normalized)) {
      route = "timelogs";
    } else if (/(decision|decisions|agreed|action items|minutes|meeting notes|summary of meeting|output)/i.test(normalized)) {
      route = "sessions";
    } else if (
      /(calendar|schedule|scheduled|in my calendar|upcoming)/i.test(normalized) ||
      (/\bmeeting|\bmeetings/.test(normalized) && /\b(today|tomorrow|yesterday|week|month|next)\b/.test(normalized))
    ) {
      route = "calendar";
    } else if (/(task|tasks|todo|todos|due today|due tomorrow|open work)/i.test(normalized)) {
      route = "todos";
    } else if (/(project|domain|activity|activities|structure)/i.test(normalized)) {
      route = "activities";
    } else if (/(overview|summary of workspace|what is in notesmith|workspace summary)/i.test(normalized)) {
      route = "workspace";
    }
  }

  const shouldClarify = route === "unknown" && !matchedMemory;
  return {
    route,
    fingerprint,
    matchedMemory,
    dateRange,
    shouldClarify,
    clarificationQuestion: shouldClarify
      ? `To answer questions like "${query}" well, should I primarily look at timelogs, sessions, calendar items, tasks, or structure data? I’ll remember your answer for next time.`
      : null,
    guidance: guidanceForRoute(route, dateRange),
  };
};
