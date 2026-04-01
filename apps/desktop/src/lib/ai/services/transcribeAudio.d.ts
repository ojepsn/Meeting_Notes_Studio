import type { LocalAppSettings } from "@notesmith/domain";
import type { AIRuntimeEvent } from "../runtime";
export declare const transcribeAudio: ({ file, settings, onEvent, }: {
    file: File;
    settings: LocalAppSettings;
    onEvent?: (event: AIRuntimeEvent) => void;
}) => Promise<string>;
