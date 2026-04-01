import type { DesktopAppSnapshot } from "@notesmith/domain";
import { createAppRepository } from "../lib/db/repository";
type DesktopView = "capture" | "output";
interface DesktopState {
    snapshot: DesktopAppSnapshot | null;
    activeSessionId: string | null;
    activeView: DesktopView;
    isLoaded: boolean;
    loadError: string | null;
    repository: ReturnType<typeof createAppRepository>;
    load: () => Promise<void>;
    setActiveView: (view: DesktopView) => void;
    setActiveSessionId: (id: string) => void;
    saveSession: (payload: DesktopAppSnapshot["sessions"][number]) => Promise<void>;
    createNewSession: (templateId?: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    saveTodo: (todo: DesktopAppSnapshot["todos"][number]) => Promise<void>;
    addTodo: (description: string) => Promise<void>;
    deleteTodo: (id: string) => Promise<void>;
    saveSettings: (settings: DesktopAppSnapshot["settings"]) => Promise<void>;
    saveTemplate: (template: DesktopAppSnapshot["templates"][number]) => Promise<void>;
    importLegacyBrowserData: () => Promise<"imported" | "missing">;
    saveAttachments: (attachments: DesktopAppSnapshot["attachments"]) => Promise<void>;
}
export declare const useDesktopStore: import("zustand").UseBoundStore<import("zustand").StoreApi<DesktopState>>;
export {};
