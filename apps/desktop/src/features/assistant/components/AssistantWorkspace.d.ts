import type { DesktopAppSnapshot } from "@notesmith/domain";
interface AssistantWorkspaceProps {
    snapshot: DesktopAppSnapshot;
    onOpenSettings: () => void;
}
export declare const AssistantWorkspace: ({ snapshot, onOpenSettings }: AssistantWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
