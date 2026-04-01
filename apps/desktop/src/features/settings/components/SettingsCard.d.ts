import type { LocalAppSettings, TemplateDefinition } from "@notesmith/domain";
interface SettingsCardProps {
    settings: LocalAppSettings;
    templates: TemplateDefinition[];
    onChange: (settings: LocalAppSettings) => void;
    onSaveTemplate: (template: TemplateDefinition) => void;
    onImportLegacy: () => Promise<void>;
    onCheckForUpdates: () => Promise<void>;
    updateStatusNote?: string | null;
}
export declare const SettingsCard: ({ settings, templates, onChange, onSaveTemplate, onImportLegacy, onCheckForUpdates, updateStatusNote, }: SettingsCardProps) => import("react/jsx-runtime").JSX.Element;
export {};
