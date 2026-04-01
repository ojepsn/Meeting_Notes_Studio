import type { LocalAppSettings } from "@notesmith/domain";
import type { AIRuntimeEvent } from "../runtime";
export declare const reviseOutput: ({ currentOutput, instructions, detailLevel, settings, onEvent, }: {
    currentOutput: string;
    instructions: string;
    detailLevel: number;
    settings: LocalAppSettings;
    onEvent?: (event: AIRuntimeEvent) => void;
}) => Promise<string>;
