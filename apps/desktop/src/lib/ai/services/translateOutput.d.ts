import type { LocalAppSettings } from "@notesmith/domain";
export declare const translateOutput: ({ currentOutput, settings, targetLanguage, }: {
    currentOutput: string;
    settings: LocalAppSettings;
    targetLanguage: "English" | "Swedish";
}) => Promise<any>;
