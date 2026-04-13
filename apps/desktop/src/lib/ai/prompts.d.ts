import type { PromptBlock, PromptProfile } from "@notesmith/domain";
export declare const AI_PROMPT_PROFILE_VERSION = "2026-04-13";
export interface ResolvedPromptProfile {
    profile: PromptProfile;
    version: string;
}
type LegacyCompatiblePromptProfile = Partial<PromptProfile> & {
    generationSystem?: string;
    generationRules?: string;
};
export declare const resolvePromptProfile: (promptProfile: LegacyCompatiblePromptProfile | undefined) => ResolvedPromptProfile;
export declare const formatEnabledPromptBlocks: (blocks: PromptBlock[]) => string;
export {};
