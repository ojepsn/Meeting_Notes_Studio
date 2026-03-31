import { create } from "zustand";
import type { DesktopAppSnapshot } from "@notesmith/domain";
import {
  createAppRepository,
  createSessionRecord,
  upsertSession,
  upsertTemplate,
  upsertTodo,
} from "../lib/db/repository";
import { loadLegacyBrowserSnapshot } from "../lib/storage/migrateLegacy";

type DesktopView = "capture" | "output";

interface DesktopState {
  snapshot: DesktopAppSnapshot | null;
  activeSessionId: string | null;
  activeView: DesktopView;
  isLoaded: boolean;
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

export const useDesktopStore = create<DesktopState>((set, get) => ({
  snapshot: null,
  activeSessionId: null,
  activeView: "capture",
  isLoaded: false,
  repository: createAppRepository(),
  load: async () => {
    const snapshot = await get().repository.loadSnapshot();
    set({
      snapshot,
      activeSessionId: snapshot.sessions[0]?.id ?? null,
      isLoaded: true,
    });
  },
  setActiveView: (activeView) => set({ activeView }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  saveSession: async (payload) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const nextSnapshot = {
      ...snapshot,
      sessions: upsertSession(snapshot.sessions, {
        ...payload,
        updatedAt: new Date().toISOString(),
      }),
    };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot, activeSessionId: payload.id });
  },
  createNewSession: async (templateId = get().snapshot?.settings.preferredDesktopTemplateId ?? "meeting") => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const nextSession = createSessionRecord(templateId);
    const nextSnapshot = {
      ...snapshot,
      sessions: [nextSession, ...snapshot.sessions],
    };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot, activeSessionId: nextSession.id, activeView: "capture" });
  },
  deleteSession: async (id) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const remainingSessions = snapshot.sessions.filter((session) => session.id !== id);
    if (!remainingSessions.length) {
      const replacement = createSessionRecord(snapshot.settings.preferredDesktopTemplateId || "meeting");
      remainingSessions.push(replacement);
    }
    const nextSnapshot = { ...snapshot, sessions: remainingSessions };
    await get().repository.saveSnapshot(nextSnapshot);
    set({
      snapshot: nextSnapshot,
      activeSessionId: remainingSessions[0]?.id ?? null,
      activeView: get().activeView,
    });
  },
  saveTodo: async (todo) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const nextSnapshot = {
      ...snapshot,
      todos: upsertTodo(snapshot.todos, todo),
    };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot });
  },
  addTodo: async (description) => {
    const snapshot = get().snapshot;
    if (!snapshot || !description.trim()) return;
    const nextSnapshot = {
      ...snapshot,
      todos: [
        {
          id: crypto.randomUUID(),
          description: description.trim(),
          isDone: false,
          comments: "",
          createdAt: new Date().toISOString(),
          sessionIds: get().activeSessionId ? [get().activeSessionId].filter((value): value is string => Boolean(value)) : [],
        },
        ...snapshot.todos,
      ],
    };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot });
  },
  deleteTodo: async (id) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const nextSnapshot = { ...snapshot, todos: snapshot.todos.filter((todo) => todo.id !== id) };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot });
  },
  saveSettings: async (settings) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const nextSnapshot = { ...snapshot, settings };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot });
  },
  saveTemplate: async (template) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const nextSnapshot = {
      ...snapshot,
      templates: upsertTemplate(snapshot.templates, template),
    };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot });
  },
  saveAttachments: async (attachments) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    const nextSnapshot = { ...snapshot, attachments };
    await get().repository.saveSnapshot(nextSnapshot);
    set({ snapshot: nextSnapshot });
  },
  importLegacyBrowserData: async () => {
    const migrated = loadLegacyBrowserSnapshot();
    if (!migrated) {
      return "missing";
    }
    await get().repository.saveSnapshot(migrated);
    set({
      snapshot: migrated,
      activeSessionId: migrated.sessions[0]?.id ?? null,
      activeView: "capture",
    });
    return "imported";
  },
}));
