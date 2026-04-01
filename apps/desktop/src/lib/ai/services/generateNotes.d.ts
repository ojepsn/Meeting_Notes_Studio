import type { AttachmentRecord, LocalAppSettings, SessionRecord, TemplateDefinition } from "@notesmith/domain";
export declare const generateNotes: ({ session, settings, template, attachments, }: {
    session: SessionRecord;
    settings: LocalAppSettings;
    template: TemplateDefinition;
    attachments?: AttachmentRecord[];
}) => Promise<any>;
