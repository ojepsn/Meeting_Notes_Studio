import type { AttachmentRecord, LocalAppSettings, SessionRecord, TemplateDefinition } from "@notesmith/domain";
import type { AIRuntimeEvent } from "../runtime";
export declare const generateNotes: ({ session, settings, template, attachments, onEvent, }: {
    session: SessionRecord;
    settings: LocalAppSettings;
    template: TemplateDefinition;
    attachments?: AttachmentRecord[];
    onEvent?: (event: AIRuntimeEvent) => void;
}) => Promise<string>;
