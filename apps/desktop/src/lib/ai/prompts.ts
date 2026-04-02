import type { PromptBlock, PromptProfile } from "@notesmith/domain";
import {
  DEFAULT_MEETING_MINUTES_RULES,
  DEFAULT_MEETING_MINUTES_SYSTEM_PROMPT,
  DEFAULT_PERSONAL_NOTES_RULES,
  DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT,
  DEFAULT_REVISION_RULES,
  DEFAULT_TRANSLATION_RULES,
} from "@notesmith/prompts";

export const AI_PROMPT_PROFILE_VERSION = "2026-04-02";

export interface ResolvedPromptProfile {
  profile: PromptProfile;
  version: string;
}

const resolvePromptText = (value: string | undefined, fallback: string) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : fallback;
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
    ),
    meetingMinutesRules: resolvePromptText(
      promptProfile?.meetingMinutesRules || promptProfile?.generationRules,
      DEFAULT_MEETING_MINUTES_RULES,
    ),
    personalNotesSystem: resolvePromptText(promptProfile?.personalNotesSystem, DEFAULT_PERSONAL_NOTES_SYSTEM_PROMPT),
    personalNotesRules: resolvePromptText(promptProfile?.personalNotesRules, DEFAULT_PERSONAL_NOTES_RULES),
    revisionRules: resolvePromptText(promptProfile?.revisionRules, DEFAULT_REVISION_RULES),
    translationRules: resolvePromptText(promptProfile?.translationRules, DEFAULT_TRANSLATION_RULES),
    extraBlocks: normalizePromptBlocks(promptProfile?.extraBlocks),
  },
});

export const formatEnabledPromptBlocks = (blocks: PromptBlock[]) =>
  blocks
    .filter((block) => block.enabled && block.body)
    .map((block) => `${block.label}:\n${block.body}`)
    .join("\n\n");
