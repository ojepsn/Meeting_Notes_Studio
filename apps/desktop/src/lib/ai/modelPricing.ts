export type TextModelId = "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna";
export type TranscriptionModelId = "gpt-transcribe" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";

type LegacyTextModelId = "gpt-5-mini" | "gpt-5" | "gpt-4.1" | "gpt-5.4" | "gpt-5.4-mini" | "gpt-5.4-nano" | "gpt-5.4-pro";
type LegacyTranscriptionModelId = "gpt-4o-transcribe-diarize";

export interface TextModelPricingEntry {
  id: TextModelId;
  label: string;
  inputPer1MTokens: number;
  cachedInputPer1MTokens?: number;
  outputPer1MTokens: number;
  pricingDate: string;
  summary: string;
  recommendedFor: string;
  recommendation: string;
  contextWindow: string;
  latency: string;
  tags: string[];
}

export interface TranscriptionModelPricingEntry {
  id: TranscriptionModelId;
  label: string;
  tokenPer1MTokens: number;
  perMinute: number;
  pricingDate: string;
  summary: string;
  recommendedFor: string;
  recommendation: string;
  latency: string;
  tags: string[];
}

export interface AIModelPricingSnapshot {
  source: string;
  sourceUrls: string[];
  refreshedAt: string;
  refreshDay: string;
  textModels: TextModelPricingEntry[];
  transcriptionModels: TranscriptionModelPricingEntry[];
}

export interface SelectModelOption {
  id: string;
  label: string;
  summary: string;
  recommendedFor: string;
  recommendation: string;
  pricingDate: string;
  pricingLines: string[];
  metadataLines: string[];
  tags: string[];
}

type PartialTextModelPricingEntry = Partial<TextModelPricingEntry> & { id?: string | null };
type PartialTranscriptionModelPricingEntry = Partial<TranscriptionModelPricingEntry> & { id?: string | null };
type PartialAIModelPricingSnapshot = Partial<AIModelPricingSnapshot> & {
  textModels?: PartialTextModelPricingEntry[] | null;
  transcriptionModels?: PartialTranscriptionModelPricingEntry[] | null;
};

const OPENAI_COMPARE_MODELS_URL = "https://developers.openai.com/api/docs/models/compare";
const OPENAI_MODELS_URL = "https://developers.openai.com/api/docs/models/text";
const OPENAI_ALL_MODELS_URL = "https://developers.openai.com/api/docs/models/all";
const OPENAI_MODEL_CATALOG_URL = "https://developers.openai.com/api/docs/models";
const OPENAI_LATEST_MODEL_URL = "https://developers.openai.com/api/docs/guides/latest-model";
const OPENAI_GPT_TRANSCRIBE_URL = "https://developers.openai.com/api/docs/models/gpt-transcribe";
const OPENAI_GPT_4O_TRANSCRIBE_URL = "https://developers.openai.com/api/docs/models/gpt-4o-transcribe";
const OPENAI_GPT_4O_MINI_TRANSCRIBE_URL = "https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe";
const OPENAI_DOC_URLS = [
  OPENAI_COMPARE_MODELS_URL,
  OPENAI_MODELS_URL,
  OPENAI_ALL_MODELS_URL,
  OPENAI_MODEL_CATALOG_URL,
  OPENAI_LATEST_MODEL_URL,
  OPENAI_GPT_TRANSCRIBE_URL,
  OPENAI_GPT_4O_TRANSCRIBE_URL,
  OPENAI_GPT_4O_MINI_TRANSCRIBE_URL,
];

const STOCKHOLM_TIMEZONE = "Europe/Stockholm";
const TOKENS_PER_1000_WORDS = 1_500;
const PRICING_REFRESH_HOUR = 5;
const DEFAULT_TEXT_MODEL_ID: TextModelId = "gpt-5.6-terra";
const DEFAULT_TRANSCRIPTION_MODEL_ID: TranscriptionModelId = "gpt-transcribe";

const CURRENT_TEXT_MODEL_IDS = new Set<TextModelId>(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
const CURRENT_TRANSCRIPTION_MODEL_IDS = new Set<TranscriptionModelId>([
  "gpt-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
]);

const DEFAULT_TEXT_MODEL_PRICING: TextModelPricingEntry[] = [
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    inputPer1MTokens: 5,
    cachedInputPer1MTokens: 0.5,
    outputPer1MTokens: 30,
    pricingDate: "2026-08-10",
    summary: "Frontier model for complex professional work.",
    recommendedFor: "Flagship drafting, coding, restructuring, and high-stakes note generation where strongest quality matters most.",
    recommendation: "Choose this when you want OpenAI's flagship GPT-5.6 capability and are comfortable paying more for it.",
    contextWindow: "1.05M context",
    latency: "Fast",
    tags: ["Flagship", "Best quality", "Long context"],
  },
  {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    inputPer1MTokens: 2,
    cachedInputPer1MTokens: 0.2,
    outputPer1MTokens: 12,
    pricingDate: "2026-08-10",
    summary: "GPT-5.6 model that balances intelligence and cost.",
    recommendedFor: "Default day-to-day note generation, revision, and meeting output when you want strong quality at a lower price than Sol.",
    recommendation: "Use this as the practical default when you want current GPT-5.6 quality without paying frontier rates for every run.",
    contextWindow: "1.05M context",
    latency: "Fast",
    tags: ["Recommended", "Balanced", "Daily default"],
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    inputPer1MTokens: 0.2,
    cachedInputPer1MTokens: 0.02,
    outputPer1MTokens: 1.2,
    pricingDate: "2026-08-10",
    summary: "GPT-5.6 model optimized for cost-sensitive workloads.",
    recommendedFor: "High-volume drafting, formatting, and lighter transformations where cost efficiency matters more than maximum reasoning strength.",
    recommendation: "Use this for efficient everyday throughput and bulk transformations where you still want a current GPT-5.6 family model.",
    contextWindow: "1.05M context",
    latency: "Faster",
    tags: ["Lowest cost", "High volume", "Fast"],
  },
];

const DEFAULT_TRANSCRIPTION_MODEL_PRICING: TranscriptionModelPricingEntry[] = [
  {
    id: "gpt-transcribe",
    label: "GPT Transcribe",
    tokenPer1MTokens: 0,
    perMinute: 0.0045,
    pricingDate: "2026-08-10",
    summary: "High-accuracy speech-to-text model for file and Realtime input transcription.",
    recommendedFor: "Default transcription for uploaded audio, meetings, and desktop capture when you want the current OpenAI transcription default.",
    recommendation: "Use this as the main transcription default unless you have a specific reason to prefer the older GPT-4o transcription models.",
    latency: "Fast",
    tags: ["Default", "High accuracy", "Realtime-ready"],
  },
  {
    id: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    tokenPer1MTokens: 2.5,
    perMinute: 0.006,
    pricingDate: "2026-08-10",
    summary: "Speech-to-text model powered by GPT-4o.",
    recommendedFor: "Important recordings where transcript fidelity matters and you want the established GPT-4o transcription behavior.",
    recommendation: "Choose this when you intentionally want GPT-4o transcription rather than the newer GPT Transcribe default.",
    latency: "Fast",
    tags: ["Established", "Higher token cost", "Accurate"],
  },
  {
    id: "gpt-4o-mini-transcribe",
    label: "GPT-4o mini Transcribe",
    tokenPer1MTokens: 1.25,
    perMinute: 0.003,
    pricingDate: "2026-08-10",
    summary: "Speech-to-text model powered by GPT-4o mini.",
    recommendedFor: "Routine recordings and higher-volume audio workflows where lower transcription cost matters.",
    recommendation: "Choose this when you want the lowest-cost GPT-4o-family transcription option for routine audio.",
    latency: "Faster",
    tags: ["Cost-aware", "Routine audio", "Lower cost"],
  },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatUsd = (value: number, maximumFractionDigits = 6) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 6 : 2,
    maximumFractionDigits,
  }).format(value);

const formatUsdPerToken = (per1MTokens: number) => formatUsd(per1MTokens / 1_000_000, 8);

const formatUsdPer1KWords = (per1MTokens: number) => formatUsd((per1MTokens / 1_000_000) * TOKENS_PER_1000_WORDS, 6);

const formatUsdPerMinute = (value: number) => formatUsd(value, 6);

const getDateFormatter = () =>
  new Intl.DateTimeFormat("en-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: STOCKHOLM_TIMEZONE,
  });

const getDateTimeFormatter = () =>
  new Intl.DateTimeFormat("en-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STOCKHOLM_TIMEZONE,
  });

const getZonedParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STOCKHOLM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
};

const zonedDateTimeToUtc = ({
  year,
  month,
  day,
  hour,
  minute,
  second,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const zonedGuess = getZonedParts(utcGuess);
  const desiredMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const guessedMs = Date.UTC(
    zonedGuess.year,
    zonedGuess.month - 1,
    zonedGuess.day,
    zonedGuess.hour,
    zonedGuess.minute,
    zonedGuess.second,
  );
  return new Date(utcGuess.getTime() + (desiredMs - guessedMs));
};

const normalizePageText = (text: string) => text.replace(/\s+/g, " ").trim();

const sanitizeSentence = (value: string | null | undefined) => (value || "").replace(/`/g, "").replace(/\s+/g, " ").trim();

const findFirstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return sanitizeSentence(match[1]);
    }
  }
  return null;
};

const findFirstSentence = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      return sanitizeSentence(match[0]);
    }
  }
  return null;
};

export const normalizeTextModelId = (value: string | null | undefined): TextModelId => {
  if (value && CURRENT_TEXT_MODEL_IDS.has(value as TextModelId)) {
    return value as TextModelId;
  }

  switch (value as LegacyTextModelId | undefined) {
    case "gpt-5":
    case "gpt-4.1":
    case "gpt-5.4":
    case "gpt-5.4-pro":
      return "gpt-5.6-sol";
    case "gpt-5-mini":
    case "gpt-5.4-mini":
      return "gpt-5.6-terra";
    case "gpt-5.4-nano":
      return "gpt-5.6-luna";
    default:
      return DEFAULT_TEXT_MODEL_ID;
  }
};

export const normalizeTranscriptionModelId = (value: string | null | undefined): TranscriptionModelId => {
  if (value && CURRENT_TRANSCRIPTION_MODEL_IDS.has(value as TranscriptionModelId)) {
    return value as TranscriptionModelId;
  }
  if ((value as LegacyTranscriptionModelId | undefined) === "gpt-4o-transcribe-diarize") {
    return "gpt-4o-transcribe";
  }
  return DEFAULT_TRANSCRIPTION_MODEL_ID;
};

export const getPricingRefreshDay = (date: Date) => {
  const zoned = getZonedParts(date);
  const refreshDate = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day));
  if (zoned.hour < PRICING_REFRESH_HOUR) {
    refreshDate.setUTCDate(refreshDate.getUTCDate() - 1);
  }
  return refreshDate.toISOString().slice(0, 10);
};

export const isPricingRefreshDue = ({
  snapshot,
  now = new Date(),
}: {
  snapshot: AIModelPricingSnapshot | null;
  now?: Date;
}) => {
  if (!snapshot) {
    return true;
  }

  return snapshot.refreshDay !== getPricingRefreshDay(now);
};

export const msUntilNextPricingCheck = (now = new Date()) => {
  const zoned = getZonedParts(now);
  const todayRefreshUtc = zonedDateTimeToUtc({
    year: zoned.year,
    month: zoned.month,
    day: zoned.day,
    hour: PRICING_REFRESH_HOUR,
    minute: 0,
    second: 0,
  });

  if (now.getTime() < todayRefreshUtc.getTime()) {
    return Math.max(60_000, todayRefreshUtc.getTime() - now.getTime());
  }

  const tomorrow = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day));
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowRefreshUtc = zonedDateTimeToUtc({
    year: tomorrow.getUTCFullYear(),
    month: tomorrow.getUTCMonth() + 1,
    day: tomorrow.getUTCDate(),
    hour: PRICING_REFRESH_HOUR,
    minute: 0,
    second: 0,
  });

  return Math.max(60_000, tomorrowRefreshUtc.getTime() - now.getTime());
};

export const createDefaultModelPricingSnapshot = (): AIModelPricingSnapshot => ({
  source: "OpenAI model, compare, and transcription docs",
  sourceUrls: [...OPENAI_DOC_URLS],
  refreshedAt: `${DEFAULT_TEXT_MODEL_PRICING[0].pricingDate}T05:00:00.000Z`,
  refreshDay: DEFAULT_TEXT_MODEL_PRICING[0].pricingDate,
  textModels: DEFAULT_TEXT_MODEL_PRICING.map((model) => ({ ...model })),
  transcriptionModels: DEFAULT_TRANSCRIPTION_MODEL_PRICING.map((model) => ({ ...model })),
});

export const normalizeAIModelPricingSnapshot = (
  snapshot: PartialAIModelPricingSnapshot | null | undefined,
): AIModelPricingSnapshot | null => {
  if (!snapshot) {
    return null;
  }

  const defaultSnapshot = createDefaultModelPricingSnapshot();

  const hasOnlyCurrentTextModels = Boolean(
    snapshot.textModels?.length && snapshot.textModels.every((entry) => CURRENT_TEXT_MODEL_IDS.has(entry?.id as TextModelId)),
  );
  const savedTextModelIds = new Set((snapshot.textModels || []).map((entry) => normalizeTextModelId(entry?.id)));
  const textFallbacks = hasOnlyCurrentTextModels
    ? DEFAULT_TEXT_MODEL_PRICING.filter((entry) => savedTextModelIds.has(entry.id))
    : DEFAULT_TEXT_MODEL_PRICING;
  const textModels = textFallbacks.map((fallback) => {
    const current = snapshot.textModels?.find((entry) => entry?.id === fallback.id);
    return {
      ...fallback,
      ...current,
      id: fallback.id,
      label: fallback.label,
      summary: typeof current?.summary === "string" && current.summary.trim() ? current.summary : fallback.summary,
      recommendedFor:
        typeof current?.recommendedFor === "string" && current.recommendedFor.trim()
          ? current.recommendedFor
          : fallback.recommendedFor,
      recommendation:
        typeof current?.recommendation === "string" && current.recommendation.trim()
          ? current.recommendation
          : fallback.recommendation,
      contextWindow:
        typeof current?.contextWindow === "string" && current.contextWindow.trim()
          ? current.contextWindow
          : fallback.contextWindow,
      latency: typeof current?.latency === "string" && current.latency.trim() ? current.latency : fallback.latency,
      tags: Array.isArray(current?.tags) ? current.tags.filter(Boolean) : fallback.tags,
      pricingDate: typeof current?.pricingDate === "string" && current.pricingDate.trim() ? current.pricingDate : fallback.pricingDate,
      inputPer1MTokens:
        typeof current?.inputPer1MTokens === "number" && Number.isFinite(current.inputPer1MTokens)
          ? current.inputPer1MTokens
          : fallback.inputPer1MTokens,
      cachedInputPer1MTokens:
        typeof current?.cachedInputPer1MTokens === "number" && Number.isFinite(current.cachedInputPer1MTokens)
          ? current.cachedInputPer1MTokens
          : fallback.cachedInputPer1MTokens,
      outputPer1MTokens:
        typeof current?.outputPer1MTokens === "number" && Number.isFinite(current.outputPer1MTokens)
          ? current.outputPer1MTokens
          : fallback.outputPer1MTokens,
    };
  });

  const hasOnlyCurrentTranscriptionModels = Boolean(
    snapshot.transcriptionModels?.length
      && snapshot.transcriptionModels.every((entry) => CURRENT_TRANSCRIPTION_MODEL_IDS.has(entry?.id as TranscriptionModelId)),
  );
  const savedTranscriptionModelIds = new Set(
    (snapshot.transcriptionModels || []).map((entry) => normalizeTranscriptionModelId(entry?.id)),
  );
  const transcriptionFallbacks = hasOnlyCurrentTranscriptionModels
    ? DEFAULT_TRANSCRIPTION_MODEL_PRICING.filter((entry) => savedTranscriptionModelIds.has(entry.id))
    : DEFAULT_TRANSCRIPTION_MODEL_PRICING;
  const transcriptionModels = transcriptionFallbacks.map((fallback) => {
    const current = snapshot.transcriptionModels?.find((entry) => entry?.id === fallback.id);
    return {
      ...fallback,
      ...current,
      id: fallback.id,
      label: fallback.label,
      summary: typeof current?.summary === "string" && current.summary.trim() ? current.summary : fallback.summary,
      recommendedFor:
        typeof current?.recommendedFor === "string" && current.recommendedFor.trim()
          ? current.recommendedFor
          : fallback.recommendedFor,
      recommendation:
        typeof current?.recommendation === "string" && current.recommendation.trim()
          ? current.recommendation
          : fallback.recommendation,
      latency: typeof current?.latency === "string" && current.latency.trim() ? current.latency : fallback.latency,
      tags: Array.isArray(current?.tags) ? current.tags.filter(Boolean) : fallback.tags,
      pricingDate: typeof current?.pricingDate === "string" && current.pricingDate.trim() ? current.pricingDate : fallback.pricingDate,
      tokenPer1MTokens:
        typeof current?.tokenPer1MTokens === "number" && Number.isFinite(current.tokenPer1MTokens)
          ? current.tokenPer1MTokens
          : fallback.tokenPer1MTokens,
      perMinute:
        typeof current?.perMinute === "number" && Number.isFinite(current.perMinute)
          ? current.perMinute
          : fallback.perMinute,
    };
  });

  return {
    source: typeof snapshot.source === "string" && snapshot.source.trim() ? snapshot.source : defaultSnapshot.source,
    sourceUrls: Array.isArray(snapshot.sourceUrls) && snapshot.sourceUrls.length ? snapshot.sourceUrls.filter(Boolean) : defaultSnapshot.sourceUrls,
    refreshedAt:
      typeof snapshot.refreshedAt === "string" && snapshot.refreshedAt.trim() ? snapshot.refreshedAt : defaultSnapshot.refreshedAt,
    refreshDay:
      typeof snapshot.refreshDay === "string" && snapshot.refreshDay.trim() ? snapshot.refreshDay : defaultSnapshot.refreshDay,
    textModels,
    transcriptionModels,
  };
};

export const resolveAvailableTextModelId = (
  value: string | null | undefined,
  snapshot: AIModelPricingSnapshot,
): TextModelId => {
  const normalized = normalizeTextModelId(value);
  return snapshot.textModels.some((entry) => entry.id === normalized)
    ? normalized
    : snapshot.textModels.find((entry) => entry.id === DEFAULT_TEXT_MODEL_ID)?.id
      || snapshot.textModels[0]?.id
      || DEFAULT_TEXT_MODEL_ID;
};

export const resolveAvailableTranscriptionModelId = (
  value: string | null | undefined,
  snapshot: AIModelPricingSnapshot,
): TranscriptionModelId => {
  const normalized = normalizeTranscriptionModelId(value);
  return snapshot.transcriptionModels.some((entry) => entry.id === normalized)
    ? normalized
    : snapshot.transcriptionModels.find((entry) => entry.id === DEFAULT_TRANSCRIPTION_MODEL_ID)?.id
      || snapshot.transcriptionModels[0]?.id
      || DEFAULT_TRANSCRIPTION_MODEL_ID;
};

const parseTextModelPricing = (pageText: string, fallback: TextModelPricingEntry, pricingDate: string): TextModelPricingEntry => {
  const pattern = new RegExp(
    `${escapeRegExp(fallback.label)}[\\s\\S]*?Per 1M tokens[\\s\\S]*?Input\\s+\\$([0-9.]+)[\\s\\S]*?Cached Input\\s+\\$([0-9.]+)[\\s\\S]*?Output\\s+\\$([0-9.]+)`,
    "i",
  );
  const match = pageText.match(pattern);
  if (!match) {
    return fallback;
  }

  return {
    ...fallback,
    inputPer1MTokens: Number(match[1]),
    cachedInputPer1MTokens: Number(match[2]),
    outputPer1MTokens: Number(match[3]),
    pricingDate,
  };
};

const parseTranscriptionModelPricing = (
  pageText: string,
  fallback: TranscriptionModelPricingEntry,
  pricingDate: string,
): TranscriptionModelPricingEntry => {
  const perMinuteMatch = pageText.match(/Per minute\s+Price\s+\$([0-9.]+)/i);
  const tokenMatch = pageText.match(/Per 1M tokens\s+Input\s+\$([0-9.]+)(?:[\s\S]*?Output\s+\$([0-9.]+))?/i);

  if (!perMinuteMatch && !tokenMatch) {
    return fallback;
  }

  return {
    ...fallback,
    tokenPer1MTokens: tokenMatch?.[1] ? Number(tokenMatch[1]) : fallback.tokenPer1MTokens,
    perMinute: perMinuteMatch?.[1] ? Number(perMinuteMatch[1]) : fallback.perMinute,
    pricingDate,
  };
};

const parseTextModelRecommendation = (docsText: string, fallback: TextModelPricingEntry): TextModelPricingEntry => {
  const summaryById: Record<TextModelId, string | null> = {
    "gpt-5.6-sol": findFirstMatch(docsText, [/GPT-5\.6 Sol ([^.]+?) Model ID gpt-5\.6-sol/i]),
    "gpt-5.6-terra": findFirstMatch(docsText, [/GPT-5\.6 Terra ([^.]+?) Model ID gpt-5\.6-terra/i]),
    "gpt-5.6-luna": findFirstMatch(docsText, [/GPT-5\.6 Luna ([^.]+?) Model ID gpt-5\.6-luna/i]),
  };

  const recommendedForById: Record<TextModelId, string | null> = {
    "gpt-5.6-sol": findFirstSentence(docsText, [/If you're not sure where to start, use GPT-5\.6 Sol[^.]*\./i]),
    "gpt-5.6-terra": findFirstSentence(docsText, [/Choose GPT-5\.6 Terra[^.]*\./i]),
    "gpt-5.6-luna": findFirstSentence(docsText, [/Use `gpt-5\.6-luna`[^.]*\./i, /Choose GPT-5\.6 Luna[^.]*\./i]),
  };

  const normalizedSummary = summaryById[fallback.id];
  const normalizedRecommendation = recommendedForById[fallback.id];

  return {
    ...fallback,
    summary: normalizedSummary ? `${normalizedSummary}.` : fallback.summary,
    recommendedFor: normalizedRecommendation || fallback.recommendedFor,
    recommendation:
      fallback.id === "gpt-5.6-sol"
        ? "Use this when you want OpenAI's current flagship GPT-5.6 tier for the strongest professional output."
        : fallback.id === "gpt-5.6-terra"
          ? "Use this as the best balance of current GPT-5.6 quality and cost for most daily note work."
          : "Use this for cost-sensitive, high-volume work where you still want a current GPT-5.6 family model.",
  };
};

const parseTranscriptionModelRecommendation = (
  pageText: string,
  fallback: TranscriptionModelPricingEntry,
): TranscriptionModelPricingEntry => {
  const summary =
    findFirstSentence(pageText, [/High-accuracy speech-to-text model for file and Realtime input transcription\./i]) ||
    findFirstSentence(pageText, [/Speech-to-text model powered by GPT-4o mini\./i]) ||
    findFirstSentence(pageText, [/Speech-to-text model powered by GPT-4o\./i]);

  return {
    ...fallback,
    summary: summary || fallback.summary,
    recommendation:
      fallback.id === "gpt-transcribe"
        ? "Use this as the main default when you want OpenAI's current transcription model and do not need diarization."
        : fallback.id === "gpt-4o-transcribe"
          ? "Choose this when you intentionally want the GPT-4o transcription profile rather than the newer default."
          : "Choose this when you want a lower-cost GPT-4o-family transcription option for routine audio.",
  };
};

export const parseModelPricingPage = ({
  pageText,
  fetchedAt,
  currentSnapshot,
  modelsPageText = "",
  latestModelPageText = "",
  availabilityPageText = "",
  speechPageTexts = {},
}: {
  pageText: string;
  fetchedAt: string;
  currentSnapshot?: AIModelPricingSnapshot | null;
  modelsPageText?: string;
  latestModelPageText?: string;
  availabilityPageText?: string;
  speechPageTexts?: Partial<Record<TranscriptionModelId, string>>;
}): AIModelPricingSnapshot => {
  const normalizedPricingText = normalizePageText(pageText);
  const normalizedDocsText = normalizePageText(`${modelsPageText} ${latestModelPageText}`);
  const normalizedAvailabilityText = normalizePageText(availabilityPageText).toLowerCase();
  const pricingDate = fetchedAt.slice(0, 10);
  const currentTextModels = new Map((currentSnapshot?.textModels || []).map((model) => [model.id, model]));
  const currentTranscriptionModels = new Map((currentSnapshot?.transcriptionModels || []).map((model) => [model.id, model]));

  const advertisedTextModels = normalizedAvailabilityText
    ? DEFAULT_TEXT_MODEL_PRICING.filter((entry) => normalizedAvailabilityText.includes(entry.id))
    : DEFAULT_TEXT_MODEL_PRICING;
  const advertisedTranscriptionModels = normalizedAvailabilityText
    ? DEFAULT_TRANSCRIPTION_MODEL_PRICING.filter((entry) => normalizedAvailabilityText.includes(entry.id))
    : DEFAULT_TRANSCRIPTION_MODEL_PRICING;
  const textModels = (advertisedTextModels.length ? advertisedTextModels : DEFAULT_TEXT_MODEL_PRICING).map((fallback) => {
    const withPricing = parseTextModelPricing(normalizedPricingText, currentTextModels.get(fallback.id) || fallback, pricingDate);
    return parseTextModelRecommendation(normalizedDocsText, withPricing);
  });

  const transcriptionModels = (advertisedTranscriptionModels.length
    ? advertisedTranscriptionModels
    : DEFAULT_TRANSCRIPTION_MODEL_PRICING
  ).map((fallback) => {
    const speechText = normalizePageText(speechPageTexts[fallback.id] || "");
    const withPricing = parseTranscriptionModelPricing(speechText, currentTranscriptionModels.get(fallback.id) || fallback, pricingDate);
    return parseTranscriptionModelRecommendation(speechText, withPricing);
  });

  return {
    source: "OpenAI model, compare, and transcription docs",
    sourceUrls: [...OPENAI_DOC_URLS],
    refreshedAt: fetchedAt,
    refreshDay: getPricingRefreshDay(new Date(fetchedAt)),
    textModels,
    transcriptionModels,
  };
};

const loadOfficialModelDocument = async (url: string) => {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("load_openai_model_document", { url });
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`OpenAI model metadata refresh failed with HTTP ${response.status}.`);
  }
  return response.text();
};

export const fetchLatestModelPricingSnapshot = async ({
  currentSnapshot,
  documentLoader = loadOfficialModelDocument,
}: {
  currentSnapshot?: AIModelPricingSnapshot | null;
  documentLoader?: (url: string) => Promise<string>;
} = {}) => {
  const results = await Promise.allSettled(
    OPENAI_DOC_URLS.map(async (url) => [url, await documentLoader(url)] as const),
  );
  const documents = new Map(
    results
      .filter((result): result is PromiseFulfilledResult<readonly [string, string]> => result.status === "fulfilled")
      .map((result) => result.value),
  );
  if (!documents.size) {
    throw new Error("OpenAI model metadata refresh could not load any official documentation pages.");
  }

  const parseHtmlText = (html: string) => {
    if (typeof DOMParser !== "undefined") {
      return new DOMParser().parseFromString(html, "text/html").body.textContent || "";
    }
    return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  };

  return parseModelPricingPage({
    pageText: parseHtmlText(documents.get(OPENAI_COMPARE_MODELS_URL) || ""),
    modelsPageText: parseHtmlText(documents.get(OPENAI_MODELS_URL) || ""),
    latestModelPageText: parseHtmlText(documents.get(OPENAI_LATEST_MODEL_URL) || ""),
    availabilityPageText: parseHtmlText(
      `${documents.get(OPENAI_ALL_MODELS_URL) || ""} ${documents.get(OPENAI_MODEL_CATALOG_URL) || ""}`,
    ),
    speechPageTexts: {
      "gpt-transcribe": parseHtmlText(documents.get(OPENAI_GPT_TRANSCRIBE_URL) || ""),
      "gpt-4o-transcribe": parseHtmlText(documents.get(OPENAI_GPT_4O_TRANSCRIBE_URL) || ""),
      "gpt-4o-mini-transcribe": parseHtmlText(documents.get(OPENAI_GPT_4O_MINI_TRANSCRIBE_URL) || ""),
    },
    fetchedAt: new Date().toISOString(),
    currentSnapshot,
  });
};

export const formatPricingDate = (value: string) => getDateFormatter().format(new Date(value));

export const formatPricingRefreshDateTime = (value: string) => `${getDateTimeFormatter().format(new Date(value))} CET`;

export const buildTextModelOption = (entry: TextModelPricingEntry): SelectModelOption => ({
  id: entry.id,
  label: entry.label,
  summary: entry.summary || entry.label,
  recommendedFor: entry.recommendedFor || "General use.",
  recommendation: entry.recommendation || "Use the model that best matches your quality and cost target.",
  pricingDate: entry.pricingDate,
  pricingLines: [
    `Input ${formatUsdPerToken(entry.inputPer1MTokens)}/token (${formatUsdPer1KWords(entry.inputPer1MTokens)} per 1,000 words)`,
    ...(typeof entry.cachedInputPer1MTokens === "number"
      ? [`Cached input ${formatUsdPerToken(entry.cachedInputPer1MTokens)}/token (${formatUsdPer1KWords(entry.cachedInputPer1MTokens)} per 1,000 words)`]
      : []),
    `Output ${formatUsdPerToken(entry.outputPer1MTokens)}/token (${formatUsdPer1KWords(entry.outputPer1MTokens)} per 1,000 words)`,
    `Pricing dated ${formatPricingDate(entry.pricingDate)}`,
  ],
  metadataLines: [`Latency: ${entry.latency}`, `Context window: ${entry.contextWindow}`],
  tags: entry.tags || [],
});

export const buildTranscriptionModelOption = (entry: TranscriptionModelPricingEntry): SelectModelOption => ({
  id: entry.id,
  label: entry.label,
  summary: entry.summary || entry.label,
  recommendedFor: entry.recommendedFor || "General transcription use.",
  recommendation: entry.recommendation || "Use the model that best matches your transcript quality and structure needs.",
  pricingDate: entry.pricingDate,
  pricingLines: [
    ...(entry.tokenPer1MTokens > 0 ? [`${formatUsdPerToken(entry.tokenPer1MTokens)}/token`] : []),
    `${formatUsdPerMinute(entry.perMinute)} per minute`,
    `Pricing dated ${formatPricingDate(entry.pricingDate)}`,
  ],
  metadataLines: [`Latency: ${entry.latency}`],
  tags: entry.tags || [],
});

export const buildModelPricingStatus = (snapshot: AIModelPricingSnapshot) =>
  `Pricing and model guidance are sourced from OpenAI and refreshed on app start plus daily at 05:00 Stockholm time. Last refresh: ${formatPricingRefreshDateTime(snapshot.refreshedAt)}.`;
