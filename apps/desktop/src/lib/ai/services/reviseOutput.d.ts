import type { LocalAppSettings } from "@notesmith/domain";
export declare const reviseOutput: ({ currentOutput, instructions, detailLevel, settings, }: {
    currentOutput: string;
    instructions: string;
    detailLevel: number;
    settings: LocalAppSettings;
}) => Promise<any>;
