import type { LocalAppSettings, SessionRecord, TemplateDefinition } from "@notesmith/domain";
export declare const generateNotes: ({ session, settings, template, }: {
    session: SessionRecord;
    settings: LocalAppSettings;
    template: TemplateDefinition;
}) => Promise<any>;
