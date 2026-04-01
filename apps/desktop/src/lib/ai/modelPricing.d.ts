export type TextModelId = "gpt-5.4" | "gpt-5.4-mini" | "gpt-5.4-nano" | "gpt-5.4-pro";
export type TranscriptionModelId = "gpt-4o-mini-transcribe" | "gpt-4o-transcribe" | "gpt-4o-transcribe-diarize";
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
type PartialTextModelPricingEntry = Partial<TextModelPricingEntry> & {
    id?: string | null;
};
type PartialTranscriptionModelPricingEntry = Partial<TranscriptionModelPricingEntry> & {
    id?: string | null;
};
type PartialAIModelPricingSnapshot = Partial<AIModelPricingSnapshot> & {
    textModels?: PartialTextModelPricingEntry[] | null;
    transcriptionModels?: PartialTranscriptionModelPricingEntry[] | null;
};
export declare const normalizeTextModelId: (value: string | null | undefined) => TextModelId;
export declare const normalizeTranscriptionModelId: (value: string | null | undefined) => TranscriptionModelId;
export declare const getPricingRefreshDay: (date: Date) => string;
export declare const isPricingRefreshDue: ({ snapshot, now, }: {
    snapshot: AIModelPricingSnapshot | null;
    now?: Date;
}) => boolean;
export declare const msUntilNextPricingCheck: (now?: Date) => number;
export declare const createDefaultModelPricingSnapshot: () => AIModelPricingSnapshot;
export declare const normalizeAIModelPricingSnapshot: (snapshot: PartialAIModelPricingSnapshot | null | undefined) => AIModelPricingSnapshot | null;
export declare const parseModelPricingPage: ({ pageText, fetchedAt, currentSnapshot, modelsPageText, latestModelPageText, speechPageText, }: {
    pageText: string;
    fetchedAt: string;
    currentSnapshot?: AIModelPricingSnapshot | null;
    modelsPageText?: string;
    latestModelPageText?: string;
    speechPageText?: string;
}) => AIModelPricingSnapshot;
export declare const fetchLatestModelPricingSnapshot: ({ currentSnapshot, }?: {
    currentSnapshot?: AIModelPricingSnapshot | null;
}) => Promise<AIModelPricingSnapshot>;
export declare const formatPricingDate: (value: string) => string;
export declare const formatPricingRefreshDateTime: (value: string) => string;
export declare const buildTextModelOption: (entry: TextModelPricingEntry) => SelectModelOption;
export declare const buildTranscriptionModelOption: (entry: TranscriptionModelPricingEntry) => SelectModelOption;
export declare const buildModelPricingStatus: (snapshot: AIModelPricingSnapshot) => string;
export {};
