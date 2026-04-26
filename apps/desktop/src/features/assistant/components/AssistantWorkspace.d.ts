import type { DesktopAppSnapshot } from "@notesmith/domain";
interface AssistantWorkspaceProps {
    snapshot: DesktopAppSnapshot;
    onOpenSettings: () => void;
    onSaveSettings: (settings: DesktopAppSnapshot["settings"]) => Promise<void>;
}
export declare const AssistantWorkspace: ({ snapshot, onOpenSettings, onSaveSettings }: AssistantWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
