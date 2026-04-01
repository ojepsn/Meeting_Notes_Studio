import type { LocalAppSettings } from "@notesmith/domain";
import type { AIRuntimeEvent } from "../runtime";
export declare const translateOutput: ({ currentOutput, settings, targetLanguage, onEvent, }: {
    currentOutput: string;
    settings: LocalAppSettings;
    targetLanguage: "English" | "Swedish";
    onEvent?: (event: AIRuntimeEvent) => void;
}) => Promise<string>;
