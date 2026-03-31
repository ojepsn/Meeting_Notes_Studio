import type { LocalAppSettings } from "@notesmith/domain";
export declare const transcribeAudio: ({ file, settings, }: {
    file: File;
    settings: LocalAppSettings;
}) => Promise<any>;
