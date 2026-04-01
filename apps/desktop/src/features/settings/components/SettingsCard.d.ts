import type { LocalAppSettings } from "@notesmith/domain";
interface SettingsCardProps {
    settings: LocalAppSettings;
    onChange: (settings: LocalAppSettings) => void;
    onImportLegacy: () => Promise<void>;
    onCheckForUpdates: () => Promise<void>;
    updateStatusNote?: string | null;
}
export declare const SettingsCard: ({ settings, onChange, onImportLegacy, onCheckForUpdates, updateStatusNote, }: SettingsCardProps) => import("react/jsx-runtime").JSX.Element;
export {};
