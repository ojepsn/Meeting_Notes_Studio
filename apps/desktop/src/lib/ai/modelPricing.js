const OPENAI_PRICING_URL = "https://developers.openai.com/api/docs/pricing";
const OPENAI_MODELS_URL = "https://developers.openai.com/api/docs/models";
const OPENAI_LATEST_MODEL_URL = "https://developers.openai.com/api/docs/guides/latest-model";
const OPENAI_SPEECH_TO_TEXT_URL = "https://developers.openai.com/api/docs/guides/speech-to-text";
const OPENAI_DOC_URLS = [OPENAI_PRICING_URL, OPENAI_MODELS_URL, OPENAI_LATEST_MODEL_URL, OPENAI_SPEECH_TO_TEXT_URL];
const STOCKHOLM_TIMEZONE = "Europe/Stockholm";
const TOKENS_PER_1000_WORDS = 1_500;
const PRICING_REFRESH_HOUR = 5;
const DEFAULT_TEXT_MODEL_ID = "gpt-5.4-mini";
const DEFAULT_TRANSCRIPTION_MODEL_ID = "gpt-4o-mini-transcribe";
const CURRENT_TEXT_MODEL_IDS = new Set(["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.4-pro"]);
const CURRENT_TRANSCRIPTION_MODEL_IDS = new Set([
    "gpt-4o-mini-transcribe",
    "gpt-4o-transcribe",
    "gpt-4o-transcribe-diarize",
]);
const DEFAULT_TEXT_MODEL_PRICING = [
    {
        id: "gpt-5.4",
        label: "GPT-5.4",
        inputPer1MTokens: 2.5,
        cachedInputPer1MTokens: 0.25,
        outputPer1MTokens: 15,
        pricingDate: "2026-04-01",
        summary: "OpenAI's flagship default for complex reasoning, coding, and professional writing workflows.",
        recommendedFor: "Your most important note generation, revision, and translation work when quality matters more than raw throughput.",
        recommendation: "Start here if you want one model that reliably handles planning, drafting, rewriting, and complex instructions.",
        contextWindow: "1M context",
        latency: "Fast",
        tags: ["OpenAI default", "Best quality", "Long context"],
    },
    {
        id: "gpt-5.4-mini",
        label: "GPT-5.4 mini",
        inputPer1MTokens: 0.75,
        cachedInputPer1MTokens: 0.075,
        outputPer1MTokens: 4.5,
        pricingDate: "2026-04-01",
        summary: "The strongest lower-cost GPT-5.4 variant for high-volume text work that still needs solid reasoning.",
        recommendedFor: "Default day-to-day drafting, note cleanup, and frequent revisions when you want good quality without flagship cost.",
        recommendation: "Use this when speed and budget matter, but you still want a modern reasoning model rather than a legacy fallback.",
        contextWindow: "400K context",
        latency: "Faster",
        tags: ["Balanced", "High volume", "Cost-aware"],
    },
    {
        id: "gpt-5.4-nano",
        label: "GPT-5.4 nano",
        inputPer1MTokens: 0.2,
        cachedInputPer1MTokens: 0.02,
        outputPer1MTokens: 1.25,
        pricingDate: "2026-04-01",
        summary: "The cheapest GPT-5.4-class text model for simple, high-throughput tasks.",
        recommendedFor: "Bulk cleanup, lightweight transformations, and simple formatting where low cost and low latency matter most.",
        recommendation: "Choose this for basic transformations and short outputs, not for your hardest reasoning or highest-stakes notes.",
        contextWindow: "400K context",
        latency: "Faster",
        tags: ["Lowest cost", "Fastest", "Simple tasks"],
    },
    {
        id: "gpt-5.4-pro",
        label: "GPT-5.4 pro",
        inputPer1MTokens: 30,
        outputPer1MTokens: 180,
        pricingDate: "2026-04-01",
        summary: "The highest-compute GPT-5.4 variant for difficult problems that benefit from deeper reasoning.",
        recommendedFor: "Rare high-stakes note synthesis, difficult restructuring, and prompts where extra compute is worth materially better answers.",
        recommendation: "Reserve this for demanding edge cases. It is not the economical default for routine note workflows.",
        contextWindow: "1M context",
        latency: "Slower",
        tags: ["Deep reasoning", "Premium", "Edge cases"],
    },
];
const DEFAULT_TRANSCRIPTION_MODEL_PRICING = [
    {
        id: "gpt-4o-mini-transcribe",
        label: "GPT-4o mini transcribe",
        tokenPer1MTokens: 1.25,
        perMinute: 0.003,
        pricingDate: "2026-04-01",
        summary: "The cost-efficient transcription model for routine recordings and higher-volume audio capture.",
        recommendedFor: "Default transcription for interviews, calls, and meeting notes when price and turnaround matter.",
        recommendation: "Use this for most recordings unless you specifically need maximum transcript fidelity or speaker diarization.",
        latency: "Faster",
        tags: ["Default", "Cost-aware", "Streaming-friendly"],
    },
    {
        id: "gpt-4o-transcribe",
        label: "GPT-4o transcribe",
        tokenPer1MTokens: 2.5,
        perMinute: 0.006,
        pricingDate: "2026-04-01",
        summary: "Higher-quality transcription with support for prompts and logprobs.",
        recommendedFor: "Important recordings where transcript quality matters more than the lowest possible cost.",
        recommendation: "Choose this when domain vocabulary, prompting support, or confidence analysis are more important than throughput.",
        latency: "Fast",
        tags: ["Higher accuracy", "Prompt support", "Logprobs"],
    },
    {
        id: "gpt-4o-transcribe-diarize",
        label: "GPT-4o transcribe diarize",
        tokenPer1MTokens: 3.75,
        perMinute: 0.009,
        pricingDate: "2026-04-01",
        summary: "Speaker-aware transcription for meetings and multi-person recordings.",
        recommendedFor: "Meeting recordings where you need speaker labels instead of a flat transcript.",
        recommendation: "Use this when identifying who said what matters. It adds speaker segmentation and requires chunking for longer audio.",
        latency: "Fast",
        tags: ["Speaker labels", "Meetings", "Structured output"],
    },
];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const formatUsd = (value, maximumFractionDigits = 6) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 6 : 2,
    maximumFractionDigits,
}).format(value);
const formatUsdPerToken = (per1MTokens) => formatUsd(per1MTokens / 1_000_000, 8);
const formatUsdPer1KWords = (per1MTokens) => formatUsd((per1MTokens / 1_000_000) * TOKENS_PER_1000_WORDS, 6);
const formatUsdPerMinute = (value) => formatUsd(value, 6);
const getDateFormatter = () => new Intl.DateTimeFormat("en-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: STOCKHOLM_TIMEZONE,
});
const getDateTimeFormatter = () => new Intl.DateTimeFormat("en-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STOCKHOLM_TIMEZONE,
});
const getZonedParts = (date) => {
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
    const getPart = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
    return {
        year: getPart("year"),
        month: getPart("month"),
        day: getPart("day"),
        hour: getPart("hour"),
        minute: getPart("minute"),
        second: getPart("second"),
    };
};
const zonedDateTimeToUtc = ({ year, month, day, hour, minute, second, }) => {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const zonedGuess = getZonedParts(utcGuess);
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const guessedMs = Date.UTC(zonedGuess.year, zonedGuess.month - 1, zonedGuess.day, zonedGuess.hour, zonedGuess.minute, zonedGuess.second);
    return new Date(utcGuess.getTime() + (desiredMs - guessedMs));
};
const normalizePageText = (text) => text.replace(/\s+/g, " ").trim();
const sanitizeSentence = (value) => (value || "").replace(/`/g, "").replace(/\s+/g, " ").trim();
const findFirstMatch = (text, patterns) => {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            return sanitizeSentence(match[1]);
        }
    }
    return null;
};
const findFirstSentence = (text, patterns) => {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[0]) {
            return sanitizeSentence(match[0]);
        }
    }
    return null;
};
export const normalizeTextModelId = (value) => {
    if (value && CURRENT_TEXT_MODEL_IDS.has(value)) {
        return value;
    }
    switch (value) {
        case "gpt-5":
        case "gpt-4.1":
            return "gpt-5.4";
        case "gpt-5-mini":
            return "gpt-5.4-mini";
        default:
            return DEFAULT_TEXT_MODEL_ID;
    }
};
export const normalizeTranscriptionModelId = (value) => {
    if (value && CURRENT_TRANSCRIPTION_MODEL_IDS.has(value)) {
        return value;
    }
    return DEFAULT_TRANSCRIPTION_MODEL_ID;
};
export const getPricingRefreshDay = (date) => {
    const zoned = getZonedParts(date);
    const refreshDate = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day));
    if (zoned.hour < PRICING_REFRESH_HOUR) {
        refreshDate.setUTCDate(refreshDate.getUTCDate() - 1);
    }
    return refreshDate.toISOString().slice(0, 10);
};
export const isPricingRefreshDue = ({ snapshot, now = new Date(), }) => {
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
export const createDefaultModelPricingSnapshot = () => ({
    source: "OpenAI model, pricing, and speech docs",
    sourceUrls: [...OPENAI_DOC_URLS],
    refreshedAt: `${DEFAULT_TEXT_MODEL_PRICING[0].pricingDate}T05:00:00.000Z`,
    refreshDay: DEFAULT_TEXT_MODEL_PRICING[0].pricingDate,
    textModels: DEFAULT_TEXT_MODEL_PRICING.map((model) => ({ ...model })),
    transcriptionModels: DEFAULT_TRANSCRIPTION_MODEL_PRICING.map((model) => ({ ...model })),
});
export const normalizeAIModelPricingSnapshot = (snapshot) => {
    if (!snapshot) {
        return null;
    }
    const defaultSnapshot = createDefaultModelPricingSnapshot();
    const textModels = DEFAULT_TEXT_MODEL_PRICING.map((fallback) => {
        const current = snapshot.textModels?.find((entry) => normalizeTextModelId(entry?.id) === fallback.id);
        return {
            ...fallback,
            ...current,
            id: fallback.id,
            label: typeof current?.label === "string" && current.label.trim() ? current.label : fallback.label,
            summary: typeof current?.summary === "string" && current.summary.trim() ? current.summary : fallback.summary,
            recommendedFor: typeof current?.recommendedFor === "string" && current.recommendedFor.trim()
                ? current.recommendedFor
                : fallback.recommendedFor,
            recommendation: typeof current?.recommendation === "string" && current.recommendation.trim()
                ? current.recommendation
                : fallback.recommendation,
            contextWindow: typeof current?.contextWindow === "string" && current.contextWindow.trim()
                ? current.contextWindow
                : fallback.contextWindow,
            latency: typeof current?.latency === "string" && current.latency.trim() ? current.latency : fallback.latency,
            tags: Array.isArray(current?.tags) ? current.tags.filter(Boolean) : fallback.tags,
            pricingDate: typeof current?.pricingDate === "string" && current.pricingDate.trim() ? current.pricingDate : fallback.pricingDate,
            inputPer1MTokens: typeof current?.inputPer1MTokens === "number" && Number.isFinite(current.inputPer1MTokens)
                ? current.inputPer1MTokens
                : fallback.inputPer1MTokens,
            cachedInputPer1MTokens: typeof current?.cachedInputPer1MTokens === "number" && Number.isFinite(current.cachedInputPer1MTokens)
                ? current.cachedInputPer1MTokens
                : fallback.cachedInputPer1MTokens,
            outputPer1MTokens: typeof current?.outputPer1MTokens === "number" && Number.isFinite(current.outputPer1MTokens)
                ? current.outputPer1MTokens
                : fallback.outputPer1MTokens,
        };
    });
    const transcriptionModels = DEFAULT_TRANSCRIPTION_MODEL_PRICING.map((fallback) => {
        const current = snapshot.transcriptionModels?.find((entry) => normalizeTranscriptionModelId(entry?.id) === fallback.id);
        return {
            ...fallback,
            ...current,
            id: fallback.id,
            label: typeof current?.label === "string" && current.label.trim() ? current.label : fallback.label,
            summary: typeof current?.summary === "string" && current.summary.trim() ? current.summary : fallback.summary,
            recommendedFor: typeof current?.recommendedFor === "string" && current.recommendedFor.trim()
                ? current.recommendedFor
                : fallback.recommendedFor,
            recommendation: typeof current?.recommendation === "string" && current.recommendation.trim()
                ? current.recommendation
                : fallback.recommendation,
            latency: typeof current?.latency === "string" && current.latency.trim() ? current.latency : fallback.latency,
            tags: Array.isArray(current?.tags) ? current.tags.filter(Boolean) : fallback.tags,
            pricingDate: typeof current?.pricingDate === "string" && current.pricingDate.trim() ? current.pricingDate : fallback.pricingDate,
            tokenPer1MTokens: typeof current?.tokenPer1MTokens === "number" && Number.isFinite(current.tokenPer1MTokens)
                ? current.tokenPer1MTokens
                : fallback.tokenPer1MTokens,
            perMinute: typeof current?.perMinute === "number" && Number.isFinite(current.perMinute)
                ? current.perMinute
                : fallback.perMinute,
        };
    });
    return {
        source: typeof snapshot.source === "string" && snapshot.source.trim() ? snapshot.source : defaultSnapshot.source,
        sourceUrls: Array.isArray(snapshot.sourceUrls) && snapshot.sourceUrls.length ? snapshot.sourceUrls.filter(Boolean) : defaultSnapshot.sourceUrls,
        refreshedAt: typeof snapshot.refreshedAt === "string" && snapshot.refreshedAt.trim() ? snapshot.refreshedAt : defaultSnapshot.refreshedAt,
        refreshDay: typeof snapshot.refreshDay === "string" && snapshot.refreshDay.trim() ? snapshot.refreshDay : defaultSnapshot.refreshDay,
        textModels,
        transcriptionModels,
    };
};
const parseTextModelPricing = (pageText, fallback, pricingDate) => {
    const pattern = new RegExp(`${escapeRegExp(fallback.id)}\\s+\\$([0-9.]+)\\s+(?:\\$([0-9.]+)|-)\\s+\\$([0-9.]+)`, "i");
    const match = pageText.match(pattern);
    if (!match) {
        return fallback;
    }
    return {
        ...fallback,
        inputPer1MTokens: Number(match[1]),
        cachedInputPer1MTokens: match[2] ? Number(match[2]) : undefined,
        outputPer1MTokens: Number(match[3]),
        pricingDate,
    };
};
const parseTranscriptionModelPricing = (pageText, fallback, pricingDate) => {
    const pattern = fallback.id === "gpt-4o-transcribe-diarize"
        ? null
        : new RegExp(`${escapeRegExp(fallback.id)}\\s+Transcription\\s+\\$([0-9.]+)\\s+\\$([0-9.]+)\\s+\\$([0-9.]+)\\s*\\/\\s*minute`, "i");
    if (!pattern) {
        return {
            ...fallback,
            pricingDate,
        };
    }
    const match = pageText.match(pattern);
    if (!match) {
        return fallback;
    }
    return {
        ...fallback,
        tokenPer1MTokens: Number(match[1]),
        perMinute: Number(match[3]),
        pricingDate,
    };
};
const parseTextModelRecommendation = (docsText, fallback) => {
    const summaryById = {
        "gpt-5.4": findFirstMatch(docsText, [/GPT-5\.4 New ([^.]+?) Model ID gpt-5\.4/i]),
        "gpt-5.4-mini": findFirstMatch(docsText, [/GPT-5\.4 mini New ([^.]+?) Model ID gpt-5\.4-mini/i]),
        "gpt-5.4-nano": findFirstMatch(docsText, [/GPT-5\.4 nano New ([^.]+?) Model ID gpt-5\.4-nano/i]),
        "gpt-5.4-pro": findFirstMatch(docsText, [/For more difficult problems, gpt-5\.4-pro ([^.]+)\./i]),
    };
    const recommendedForById = {
        "gpt-5.4": findFirstSentence(docsText, [/In general, gpt-5\.4 is the default model[^.]*\./i]),
        "gpt-5.4-mini": findFirstMatch(docsText, [/gpt-5\.4-mini \| ([^|]+?) \| gpt-5\.4-nano/i]),
        "gpt-5.4-nano": findFirstMatch(docsText, [/gpt-5\.4-nano \| ([^|]+?)\s*(?:###|For|Use|Prompting|$)/i]),
        "gpt-5.4-pro": findFirstMatch(docsText, [/gpt-5\.4-pro \| ([^|]+?) \| gpt-5\.4-mini/i, /For more difficult problems, gpt-5\.4-pro ([^.]+)\./i]),
    };
    const normalizedSummary = summaryById[fallback.id];
    const normalizedRecommendation = recommendedForById[fallback.id];
    return {
        ...fallback,
        summary: normalizedSummary ? `${normalizedSummary}.` : fallback.summary,
        recommendedFor: normalizedRecommendation || fallback.recommendedFor,
        recommendation: fallback.id === "gpt-5.4"
            ? "Use this when you want OpenAI's current general starting point for higher-quality work."
            : fallback.id === "gpt-5.4-mini"
                ? "Use this when you want the best cost-to-quality balance for frequent note operations."
                : fallback.id === "gpt-5.4-nano"
                    ? "Use this for simpler bulk transformations where low cost outweighs deeper reasoning."
                    : "Use this selectively for the hardest prompts where extra compute is justified.",
    };
};
const parseTranscriptionModelRecommendation = (speechDocsText, fallback) => {
    const diarizeSentence = findFirstSentence(speechDocsText, [/gpt-4o-transcribe-diarize produces speaker-aware transcripts\./i]);
    const sharedSupportSentence = findFirstSentence(speechDocsText, [/gpt-4o-transcribe and gpt-4o-mini-transcribe support json or text responses and allow prompts and logprobs\./i]);
    if (fallback.id === "gpt-4o-transcribe-diarize") {
        return {
            ...fallback,
            summary: diarizeSentence || fallback.summary,
            recommendation: "Use this when speaker attribution is more important than prompt support or the absolute lowest cost.",
        };
    }
    return {
        ...fallback,
        summary: sharedSupportSentence || fallback.summary,
        recommendation: fallback.id === "gpt-4o-transcribe"
            ? "Choose this when transcript fidelity, prompting, or confidence analysis matters more than cost."
            : "Choose this for the default balance of cost, speed, and modern transcription quality.",
    };
};
export const parseModelPricingPage = ({ pageText, fetchedAt, currentSnapshot, modelsPageText = "", latestModelPageText = "", speechPageText = "", }) => {
    const normalizedPricingText = normalizePageText(pageText);
    const normalizedDocsText = normalizePageText(`${modelsPageText} ${latestModelPageText}`);
    const normalizedSpeechText = normalizePageText(speechPageText);
    const pricingDate = fetchedAt.slice(0, 10);
    const currentTextModels = new Map((currentSnapshot?.textModels || []).map((model) => [model.id, model]));
    const currentTranscriptionModels = new Map((currentSnapshot?.transcriptionModels || []).map((model) => [model.id, model]));
    const textModels = DEFAULT_TEXT_MODEL_PRICING.map((fallback) => {
        const withPricing = parseTextModelPricing(normalizedPricingText, currentTextModels.get(fallback.id) || fallback, pricingDate);
        return parseTextModelRecommendation(normalizedDocsText, withPricing);
    });
    const transcriptionModels = DEFAULT_TRANSCRIPTION_MODEL_PRICING.map((fallback) => {
        const withPricing = parseTranscriptionModelPricing(normalizedPricingText, currentTranscriptionModels.get(fallback.id) || fallback, pricingDate);
        return parseTranscriptionModelRecommendation(normalizedSpeechText, withPricing);
    });
    return {
        source: "OpenAI model, pricing, and speech docs",
        sourceUrls: [...OPENAI_DOC_URLS],
        refreshedAt: fetchedAt,
        refreshDay: getPricingRefreshDay(new Date(fetchedAt)),
        textModels,
        transcriptionModels,
    };
};
export const fetchLatestModelPricingSnapshot = async ({ currentSnapshot, } = {}) => {
    const [pricingResponse, modelsResponse, latestModelResponse, speechResponse] = await Promise.all(OPENAI_DOC_URLS.map((url) => fetch(url, { cache: "no-store" })));
    const failedResponse = [pricingResponse, modelsResponse, latestModelResponse, speechResponse].find((response) => !response.ok);
    if (failedResponse) {
        throw new Error(`OpenAI model metadata refresh failed with HTTP ${failedResponse.status}.`);
    }
    const [pricingHtml, modelsHtml, latestModelHtml, speechHtml] = await Promise.all([
        pricingResponse.text(),
        modelsResponse.text(),
        latestModelResponse.text(),
        speechResponse.text(),
    ]);
    const parseHtmlText = (html) => new DOMParser().parseFromString(html, "text/html").body.textContent || "";
    return parseModelPricingPage({
        pageText: parseHtmlText(pricingHtml),
        modelsPageText: parseHtmlText(modelsHtml),
        latestModelPageText: parseHtmlText(latestModelHtml),
        speechPageText: parseHtmlText(speechHtml),
        fetchedAt: new Date().toISOString(),
        currentSnapshot,
    });
};
export const formatPricingDate = (value) => getDateFormatter().format(new Date(value));
export const formatPricingRefreshDateTime = (value) => `${getDateTimeFormatter().format(new Date(value))} CET`;
export const buildTextModelOption = (entry) => ({
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
export const buildTranscriptionModelOption = (entry) => ({
    id: entry.id,
    label: entry.label,
    summary: entry.summary || entry.label,
    recommendedFor: entry.recommendedFor || "General transcription use.",
    recommendation: entry.recommendation || "Use the model that best matches your transcript quality and structure needs.",
    pricingDate: entry.pricingDate,
    pricingLines: [
        `${formatUsdPerToken(entry.tokenPer1MTokens)}/token`,
        `${formatUsdPerMinute(entry.perMinute)} per minute`,
        `Pricing dated ${formatPricingDate(entry.pricingDate)}`,
    ],
    metadataLines: [`Latency: ${entry.latency}`],
    tags: entry.tags || [],
});
export const buildModelPricingStatus = (snapshot) => `Pricing and model guidance are sourced from OpenAI and refreshed daily at 05:00 Stockholm time or on app open when due. Last refresh: ${formatPricingRefreshDateTime(snapshot.refreshedAt)}.`;
