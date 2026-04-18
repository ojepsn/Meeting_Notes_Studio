import type { LocalAppSettings } from "@notesmith/domain";
import type { AIRuntimeEvent } from "../runtime";
export declare const reviseOutput: ({ currentOutput, instructions, detailLevel, outputLanguage, additionalInstructions, settings, onEvent, }: {
    currentOutput: string;
    instructions: string;
    detailLevel: number;
    outputLanguage: "same" | "sv" | "en";
    additionalInstructions?: string;
    settings: LocalAppSettings;
    onEvent?: (event: AIRuntimeEvent) => void;
}) => Promise<string>;
