import type { CaptureMode, DesktopAppSnapshot } from "@notesmith/domain";
import { createAppRepository } from "../lib/db/repository";
type DesktopView = "capture" | "output";
type SaveState = "saved" | "saving" | "error";
interface DesktopState {
    snapshot: DesktopAppSnapshot | null;
    activeSessionId: string | null;
    activeView: DesktopView;
    saveState: SaveState;
    lastSavedAt: string | null;
    isLoaded: boolean;
    loadError: string | null;
    repository: ReturnType<typeof createAppRepository>;
    load: () => Promise<void>;
    setActiveView: (view: DesktopView) => void;
    setActiveSessionId: (id: string) => void;
    saveSession: (payload: DesktopAppSnapshot["sessions"][number]) => Promise<void>;
    createNewSession: (options?: {
        templateId?: string;
        captureMode?: CaptureMode;
    }) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    restoreSession: (id: string) => Promise<void>;
    permanentlyDeleteSession: (id: string) => Promise<void>;
    saveTodo: (todo: DesktopAppSnapshot["todos"][number]) => Promise<void>;
    addTodo: (description: string) => Promise<void>;
    deleteTodo: (id: string) => Promise<void>;
    saveActivity: (activity: DesktopAppSnapshot["activities"][number]) => Promise<void>;
    addActivity: (description: string, type?: DesktopAppSnapshot["activities"][number]["type"]) => Promise<void>;
    deleteActivity: (id: string) => Promise<void>;
    createCalendarEntryFromText: (date: string, startSlot: number, value: string) => Promise<void>;
    moveCalendarItem: (id: string, date: string, startSlot: number) => Promise<void>;
    updateCalendarItem: (id: string, updates: {
        date: string;
        startSlot: number;
        durationSlots: number;
    }) => Promise<void>;
    convertTodoToActivity: (todo: DesktopAppSnapshot["todos"][number], options?: {
        type?: DesktopAppSnapshot["activities"][number]["type"];
        date?: string;
        startTime?: string;
        endTime?: string;
    }) => Promise<string | null>;
    ensureSessionForActivity: (activityId: string) => Promise<string | null>;
    saveSettings: (settings: DesktopAppSnapshot["settings"]) => Promise<void>;
    saveTemplate: (template: DesktopAppSnapshot["templates"][number]) => Promise<void>;
    resetTemplates: () => Promise<void>;
    importLegacyBrowserData: () => Promise<"imported" | "missing">;
    importBackupSnapshot: (snapshot: DesktopAppSnapshot) => Promise<void>;
    saveAttachments: (attachments: DesktopAppSnapshot["attachments"]) => Promise<void>;
}
export declare const useDesktopStore: import("zustand").UseBoundStore<import("zustand").StoreApi<DesktopState>>;
export {};
