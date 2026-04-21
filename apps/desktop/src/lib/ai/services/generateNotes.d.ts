import type { AttachmentRecord, LocalAppSettings, SessionRecord, TemplateDefinition } from "@notesmith/domain";
import type { AIRuntimeEvent } from "../runtime";
type GenerationDiagnosticLevel = "info" | "success" | "warning" | "error";
type GenerationDiagnosticHandler = (message: string, details?: string, level?: GenerationDiagnosticLevel) => void;
export declare const generateNotes: ({ session, settings, template, attachments, onEvent, onDiagnostic, }: {
    session: SessionRecord;
    settings: LocalAppSettings;
    template: TemplateDefinition;
    attachments?: AttachmentRecord[];
    onEvent?: (event: AIRuntimeEvent) => void;
    onDiagnostic?: GenerationDiagnosticHandler;
}) => Promise<string>;
export {};
