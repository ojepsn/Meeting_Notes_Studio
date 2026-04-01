import { describe, expect, it } from "vitest";
import {
  buildTextModelOption,
  buildTranscriptionModelOption,
  createDefaultModelPricingSnapshot,
  getPricingRefreshDay,
  isPricingRefreshDue,
  normalizeAIModelPricingSnapshot,
  normalizeTextModelId,
  normalizeTranscriptionModelId,
  parseModelPricingPage,
} from "./modelPricing";

describe("modelPricing", () => {
  it("computes the pricing refresh day around the 05:00 Stockholm cutoff", () => {
    expect(getPricingRefreshDay(new Date("2026-04-01T02:30:00.000Z"))).toBe("2026-03-31");
    expect(getPricingRefreshDay(new Date("2026-04-02T01:30:00.000Z"))).toBe("2026-04-01");
  });

  it("marks snapshots due when the pricing refresh day changes", () => {
    const snapshot = createDefaultModelPricingSnapshot();
    expect(isPricingRefreshDue({ snapshot, now: new Date("2026-04-01T20:00:00.000Z") })).toBe(false);
    expect(isPricingRefreshDue({ snapshot, now: new Date("2026-04-02T04:30:00.000Z") })).toBe(true);
  });

  it("parses pricing rows from the OpenAI pricing page text", () => {
    const snapshot = parseModelPricingPage({
      pageText: `gpt-5.4 $2.50 $0.25 $15.00 gpt-5.4-mini $0.75 $0.075 $4.50 gpt-5.4-nano $0.20 $0.02 $1.25 gpt-5.4-pro $30.00 - $180.00 gpt-4o-transcribe Transcription $2.50 $10.00 $0.006 / minute gpt-4o-mini-transcribe Transcription $1.25 $5.00 $0.003 / minute`,
      modelsPageText: `GPT-5.4 New Best intelligence at scale for agentic, coding, and professional workflows Model ID gpt-5.4 GPT-5.4 mini New Our strongest mini model yet for coding, computer use, and subagents Model ID gpt-5.4-mini GPT-5.4 nano New Our cheapest GPT-5.4-class model for simple high-volume tasks Model ID gpt-5.4-nano`,
      latestModelPageText: `In general, gpt-5.4 is the default model for both broad general-purpose work and most coding tasks. gpt-5.4-pro | Tough problems that may take longer to solve and need deeper reasoning | gpt-5.4-mini | High-volume coding, computer use, and agent workflows that still need strong reasoning | gpt-5.4-nano | Simple high-throughput tasks where speed and cost matter most`,
      speechPageText: `gpt-4o-transcribe and gpt-4o-mini-transcribe support json or text responses and allow prompts and logprobs. gpt-4o-transcribe-diarize produces speaker-aware transcripts.`,
      fetchedAt: "2026-04-01T04:00:00.000Z",
    });

    expect(snapshot.textModels.find((model) => model.id === "gpt-5.4-mini")).toMatchObject({ inputPer1MTokens: 0.75, outputPer1MTokens: 4.5 });
    expect(snapshot.textModels.find((model) => model.id === "gpt-5.4-pro")).toMatchObject({ inputPer1MTokens: 30, outputPer1MTokens: 180 });
    expect(snapshot.transcriptionModels.find((model) => model.id === "gpt-4o-transcribe")).toMatchObject({ tokenPer1MTokens: 2.5, perMinute: 0.006 });
    expect(snapshot.textModels.find((model) => model.id === "gpt-5.4")?.recommendedFor).toContain("default model");
    expect(snapshot.transcriptionModels.find((model) => model.id === "gpt-4o-transcribe-diarize")?.summary).toContain("speaker-aware transcripts");
  });

  it("builds option data with recommendations and human-readable pricing", () => {
    const snapshot = createDefaultModelPricingSnapshot();
    expect(buildTextModelOption(snapshot.textModels[0]).pricingLines.join(" ")).toContain("1,000 words");
    expect(buildTextModelOption(snapshot.textModels[0]).recommendation.length).toBeGreaterThan(10);
    expect(buildTranscriptionModelOption(snapshot.transcriptionModels[0]).pricingLines.join(" ")).toContain("per minute");
  });

  it("normalizes legacy saved model ids to the current catalog", () => {
    expect(normalizeTextModelId("gpt-5-mini")).toBe("gpt-5.4-mini");
    expect(normalizeTextModelId("gpt-5")).toBe("gpt-5.4");
    expect(normalizeTextModelId("gpt-4.1")).toBe("gpt-5.4");
    expect(normalizeTranscriptionModelId("gpt-4o-transcribe")).toBe("gpt-4o-transcribe");
    expect(normalizeTranscriptionModelId("unknown-model")).toBe("gpt-4o-mini-transcribe");
  });

  it("normalizes older persisted snapshots to the current card schema", () => {
    const snapshot = normalizeAIModelPricingSnapshot({
      source: "legacy",
      refreshedAt: "2026-03-30T05:00:00.000Z",
      refreshDay: "2026-03-30",
      textModels: [
        {
          id: "gpt-5-mini",
          label: "GPT-5 mini",
          inputPer1MTokens: 0.25,
          outputPer1MTokens: 2,
          pricingDate: "2026-03-30",
        },
      ],
      transcriptionModels: [
        {
          id: "gpt-4o-mini-transcribe",
          label: "GPT-4o mini transcribe",
          tokenPer1MTokens: 1.25,
          perMinute: 0.003,
          pricingDate: "2026-03-30",
        },
      ],
    } as unknown as Parameters<typeof normalizeAIModelPricingSnapshot>[0]);

    expect(snapshot?.textModels.find((model) => model.id === "gpt-5.4-mini")?.tags.length).toBeGreaterThan(0);
    expect(snapshot?.textModels.find((model) => model.id === "gpt-5.4-mini")?.summary).toBeTruthy();
    expect(snapshot?.transcriptionModels.find((model) => model.id === "gpt-4o-mini-transcribe")?.recommendation).toBeTruthy();
  });
});