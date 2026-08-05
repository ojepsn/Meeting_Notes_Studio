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
    expect(isPricingRefreshDue({ snapshot, now: new Date("2026-08-05T20:00:00.000Z") })).toBe(false);
    expect(isPricingRefreshDue({ snapshot, now: new Date("2026-08-06T04:30:00.000Z") })).toBe(true);
  });

  it("parses pricing rows from the OpenAI pricing page text", () => {
    const snapshot = parseModelPricingPage({
      pageText: `GPT-5.6 Sol Pricing Per 1M tokens Input $5.00 Cached Input $0.50 Output $30.00 GPT-5.6 Terra Pricing Per 1M tokens Input $2.50 Cached Input $0.25 Output $15.00 GPT-5.6 Luna Pricing Per 1M tokens Input $1.00 Cached Input $0.10 Output $6.00`,
      modelsPageText: `If you're not sure where to start, use GPT-5.6 Sol, our flagship model for complex reasoning and coding. Choose GPT-5.6 Terra to balance intelligence and cost, or GPT-5.6 Luna for cost-sensitive, high-volume workloads. GPT-5.6 Sol Frontier model for complex professional work Model ID gpt-5.6-sol GPT-5.6 Terra GPT-5.6 model that balances intelligence and cost Model ID gpt-5.6-terra GPT-5.6 Luna GPT-5.6 model optimized for cost-sensitive workloads Model ID gpt-5.6-luna`,
      latestModelPageText: `GPT-5.6 sets a new quality and efficiency baseline for complex production workflows. The gpt-5.6 alias routes requests to gpt-5.6-sol, the model for flagship capability. Use gpt-5.6-terra for strong performance at a lower price and gpt-5.6-luna for efficient, high-volume workloads.`,
      speechPageTexts: {
        "gpt-transcribe": `GPT Transcribe High-accuracy speech-to-text model for file and Realtime input transcription Pricing Transcription audio duration Per minute Price $0.0045`,
        "gpt-4o-transcribe": `GPT-4o Transcribe Speech-to-text model powered by GPT-4o Pricing Audio tokens Per 1M tokens Input $2.50 Output $10.00`,
        "gpt-4o-mini-transcribe": `GPT-4o mini Transcribe Speech-to-text model powered by GPT-4o mini Pricing Audio tokens Per 1M tokens Input $1.25 Output $5.00`,
      },
      fetchedAt: "2026-08-05T04:00:00.000Z",
    });

    expect(snapshot.textModels.find((model) => model.id === "gpt-5.6-terra")).toMatchObject({ inputPer1MTokens: 2.5, outputPer1MTokens: 15 });
    expect(snapshot.textModels.find((model) => model.id === "gpt-5.6-sol")).toMatchObject({ inputPer1MTokens: 5, outputPer1MTokens: 30 });
    expect(snapshot.transcriptionModels.find((model) => model.id === "gpt-4o-transcribe")).toMatchObject({ tokenPer1MTokens: 2.5, perMinute: 0.006 });
    expect(snapshot.transcriptionModels.find((model) => model.id === "gpt-transcribe")).toMatchObject({ perMinute: 0.0045 });
    expect(snapshot.textModels.find((model) => model.id === "gpt-5.6-sol")?.recommendedFor).toContain("GPT-5.6 Sol");
    expect(snapshot.transcriptionModels.find((model) => model.id === "gpt-transcribe")?.summary).toContain("High-accuracy speech-to-text");
  });

  it("builds option data with recommendations and human-readable pricing", () => {
    const snapshot = createDefaultModelPricingSnapshot();
    expect(buildTextModelOption(snapshot.textModels[0]).pricingLines.join(" ")).toContain("1,000 words");
    expect(buildTextModelOption(snapshot.textModels[0]).recommendation.length).toBeGreaterThan(10);
    expect(buildTranscriptionModelOption(snapshot.transcriptionModels[0]).pricingLines.join(" ")).toContain("per minute");
  });

  it("normalizes legacy saved model ids to the current catalog", () => {
    expect(normalizeTextModelId("gpt-5-mini")).toBe("gpt-5.6-terra");
    expect(normalizeTextModelId("gpt-5")).toBe("gpt-5.6-sol");
    expect(normalizeTextModelId("gpt-4.1")).toBe("gpt-5.6-sol");
    expect(normalizeTranscriptionModelId("gpt-4o-transcribe")).toBe("gpt-4o-transcribe");
    expect(normalizeTranscriptionModelId("gpt-4o-transcribe-diarize")).toBe("gpt-4o-transcribe");
    expect(normalizeTranscriptionModelId("unknown-model")).toBe("gpt-transcribe");
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

    expect(snapshot?.textModels.find((model) => model.id === "gpt-5.6-terra")?.tags.length).toBeGreaterThan(0);
    expect(snapshot?.textModels.find((model) => model.id === "gpt-5.6-terra")?.summary).toBeTruthy();
    expect(snapshot?.transcriptionModels.find((model) => model.id === "gpt-4o-mini-transcribe")?.recommendation).toBeTruthy();
  });
});
