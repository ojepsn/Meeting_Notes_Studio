import type { LocalAppSettings } from "@notesmith/domain";
export declare const reviseOutput: ({ currentOutput, instructions, settings, }: {
    currentOutput: string;
    instructions: string;
    settings: LocalAppSettings;
}) => Promise<any>;
