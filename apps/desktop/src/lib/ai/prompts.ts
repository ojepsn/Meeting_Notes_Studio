import type { PromptBlock, PromptProfile } from "@notesmith/domain";
import {
  DEFAULT_MEETING_MINUTES_RULES,
  DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
  DEFAULT_PERSONAL_NOTES_RULES,
  DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
  DEFAULT_REVISION_RULES,
  DEFAULT_TRANSLATION_RULES,
} from "@notesmith/prompts";

export const AI_PROMPT_PROFILE_VERSION = "2026-04-17";

export interface ResolvedPromptProfile {
  profile: PromptProfile;
  version: string;
}

const LEGACY_MEETING_MINUTES_SYSTEM_PROMPTS = new Set([
  "You are an executive note assistant. Convert rough notes and transcripts into structured professional notes. Synthesize spoken content instead of reproducing it line by line.",
]);

const LEGACY_MEETING_MINUTES_RULES = new Set([
  "Prefer concise business language, preserve important decisions and action items, remove filler and repeated phrasing, and organize the output under clear sections.",
  "- For each discussion point heading, provide 2-5 crisp bullets that capture the substance of the discussion.",
]);

const LEGACY_REVISION_RULES = new Set([
  "Apply only the requested improvements, keep the existing structure, and avoid unnecessary rewrites.",
]);

const LEGACY_TRANSLATION_RULES = new Set([
  "Translate the current output faithfully while preserving the same structure, tone, and action items.",
]);

const migrateMeetingMinutesRules = (value: string) => {
  const legacyBulletRule =
    "- For each discussion point heading, provide 2-5 crisp bullets that capture the substance of the discussion.";
  const previousProseRules = [
    "- For each discussion point heading, prefer flowing text that captures the substance of the discussion.",
    "- Use bullets only when they materially improve scanability, such as for decisions or action items.",
  ];
  const currentProseRules = [
    "- For each discussion point heading, use flowing text that captures the substance of the discussion.",
    "- Use bullets only for agenda, decisions or action items.",
  ];
  return value.includes(legacyBulletRule)
    ? value.replace(
        legacyBulletRule,
        currentProseRules.join("\n"),
      )
    : value.includes(previousProseRules[0])
      ? value
          .replace(previousProseRules[0], currentProseRules[0])
          .replace(previousProseRules[1], currentProseRules[1])
    : value;
};

const resolvePromptText = (value: string | undefined, fallback: string, legacyDefaults: Set<string> = new Set()) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return fallback;
  if (legacyDefaults.has(trimmedValue)) return fallback;
  return trimmedValue;
};

const normalizePromptBlocks = (blocks: PromptBlock[] | undefined) =>
  Array.isArray(blocks)
    ? blocks.map((block) => ({
        ...block,
        label: block.label.trim() || "Extra prompt",
        body: block.body.trim(),
        enabled: Boolean(block.enabled),
      }))
    : [];

type LegacyCompatiblePromptProfile = Partial<PromptProfile> & {
  generationSystem?: string;
  generationRules?: string;
};

export const resolvePromptProfile = (promptProfile: LegacyCompatiblePromptProfile | undefined): ResolvedPromptProfile => ({
  version: AI_PROMPT_PROFILE_VERSION,
  profile: {
    meetingMinutesSystem: resolvePromptText(
      promptProfile?.meetingMinutesSystem || promptProfile?.generationSystem,
      DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
      LEGACY_MEETING_MINUTES_SYSTEM_PROMPTS,
    ),
    meetingMinutesRules: migrateMeetingMinutesRules(
      resolvePromptText(
        promptProfile?.meetingMinutesRules || promptProfile?.generationRules,
        DEFAULT_MEETING_MINUTES_RULES,
        LEGACY_MEETING_MINUTES_RULES,
      ),
    ),
    personalNotesSystem: resolvePromptText(promptProfile?.personalNotesSystem, DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT),
    personalNotesRules: resolvePromptText(promptProfile?.personalNotesRules, DEFAULT_PERSONAL_NOTES_RULES),
    revisionRules: resolvePromptText(promptProfile?.revisionRules, DEFAULT_REVISION_RULES, LEGACY_REVISION_RULES),
    translationRules: resolvePromptText(
      promptProfile?.translationRules,
      DEFAULT_TRANSLATION_RULES,
      LEGACY_TRANSLATION_RULES,
    ),
    extraBlocks: normalizePromptBlocks(promptProfile?.extraBlocks),
  },
});

export const formatEnabledPromptBlocks = (blocks: PromptBlock[]) =>
  blocks
    .filter((block) => block.enabled && block.body)
    .map((block) => `${block.label}:\n${block.body}`)
    .join("\n\n");
