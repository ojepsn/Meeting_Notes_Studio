import type { LocalAppSettings } from "@notesmith/domain";
interface SettingsCardProps {
    settings: LocalAppSettings;
    onChange: (settings: LocalAppSettings) => void;
    onImportLegacy: () => Promise<void>;
}
export declare const SettingsCard: ({ settings, onChange, onImportLegacy }: SettingsCardProps) => import("react/jsx-runtime").JSX.Element;
export {};
