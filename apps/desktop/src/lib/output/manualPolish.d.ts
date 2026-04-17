import type { LocalAppSettings } from "@notesmith/domain";
type ManualPolishOptions = {
    abbreviations?: LocalAppSettings["abbreviations"];
    sessionParticipants?: string;
    savedParticipants?: string[];
};
export declare const polishNonAiNotesText: (text: string, options?: ManualPolishOptions) => string;
export {};
