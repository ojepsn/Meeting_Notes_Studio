import type { LocalAppSettings, TemplateDefinition } from "@notesmith/domain";
import type { AIRequestHistoryEntry } from "../../../lib/ai/history";
import type { AIDiagnosticsItem } from "../../../lib/ai/metrics";
import type { SelectModelOption } from "../../../lib/ai/modelPricing";
export type SettingsSection = "ai" | "diagnostics" | "themes" | "output" | "people" | "prompts" | "templates" | "other";
interface SettingsCardProps {
    settings: LocalAppSettings;
    templates: TemplateDefinition[];
    initialSection?: SettingsSection;
    onChange: (settings: LocalAppSettings) => void;
    onSaveTemplate: (template: TemplateDefinition) => void;
    onImportLegacy: () => Promise<void>;
    onCheckForUpdates: () => Promise<void>;
    onRefreshModelPricing: () => Promise<void> | void;
    updateStatusNote?: string | null;
    aiDiagnostics: AIDiagnosticsItem[];
    aiRequestHistory: AIRequestHistoryEntry[];
    textModelOptions: SelectModelOption[];
    transcriptionModelOptions: SelectModelOption[];
    modelPricingStatus: string;
    isRefreshingModelPricing: boolean;
}
export declare const SettingsCard: ({ settings, templates, initialSection, onChange, onSaveTemplate, onImportLegacy, onCheckForUpdates, onRefreshModelPricing, updateStatusNote, aiDiagnostics, aiRequestHistory, textModelOptions, transcriptionModelOptions, modelPricingStatus, isRefreshingModelPricing, }: SettingsCardProps) => import("react/jsx-runtime").JSX.Element;
export {};
