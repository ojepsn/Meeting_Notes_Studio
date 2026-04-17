import type { LocalAppSettings, RuleSuggestionRecord, SessionRecord } from "@notesmith/domain";
type SuggestionObservation = {
    type: RuleSuggestionRecord["type"];
    sourceValue: string;
    suggestedValue: string;
    confidence: number;
};
export declare const collectRuleSuggestionObservations: (session: SessionRecord, settings: LocalAppSettings, sourceText: string) => SuggestionObservation[];
export declare const mergeRuleSuggestionObservations: (settings: LocalAppSettings, sessionId: string, observations: SuggestionObservation[]) => {
    nextSettings: LocalAppSettings;
    visibleSuggestions: RuleSuggestionRecord[];
};
export declare const acceptRuleSuggestion: (settings: LocalAppSettings, suggestionId: string) => LocalAppSettings;
export declare const ignoreRuleSuggestion: (settings: LocalAppSettings, suggestionId: string, { forever }?: {
    forever?: boolean;
}) => LocalAppSettings;
export declare const restoreIgnoredRuleSuggestion: (settings: LocalAppSettings, suggestionId: string) => LocalAppSettings;
export {};
