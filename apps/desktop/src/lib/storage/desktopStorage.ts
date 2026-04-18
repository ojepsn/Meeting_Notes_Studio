import type { DesktopAppSnapshot } from "@notesmith/domain";
import { invoke } from "@tauri-apps/api/core";
import { downloadDir } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { AIRequestHistoryEntry } from "../ai/history";
import type { AIModelPricingSnapshot } from "../ai/modelPricing";
import { resolvePromptProfile } from "../ai/prompts";
import { isTauriRuntime } from "./environment";
import { parseLegacyImportSnapshot } from "./migrateLegacy";

export interface DesktopStorageInfo {
  appConfigDir: string;
  appDataDir: string;
  databasePath: string;
  attachmentsDir: string;
  backupsDir: string;
}

export interface ImportedSnapshotResult {
  kind: "desktop-backup" | "pwa-export";
  snapshot: DesktopAppSnapshot;
  aiTextCache?: Array<{ key: string; value: string; createdAt: number; expiresAt: number }>;
  aiRequestHistory?: AIRequestHistoryEntry[];
  aiModelPricing?: AIModelPricingSnapshot | null;
}

export interface DesktopBackupBundle {
  kind: "notesmith-desktop-backup";
  version: 2;
  exportedAt: string;
  snapshot: DesktopAppSnapshot;
  aiTextCache: Array<{ key: string; value: string; createdAt: number; expiresAt: number }>;
  aiRequestHistory: AIRequestHistoryEntry[];
  aiModelPricing: AIModelPricingSnapshot | null;
}

const joinPath = (base: string, child: string) => `${base.replace(/[\\\/]+$/, "")}/${child}`;
let desktopStorageInfoPromise: Promise<DesktopStorageInfo | null> | null = null;
const DEFAULT_PROMPT_PROFILE = resolvePromptProfile(undefined).profile;

export const buildSnapshotBackupFilename = (date = new Date()) => {
  const datePart = date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `notesmith-desktop-backup-${datePart}.json`;
};

export const saveTextFile = async ({
  content,
  defaultFilename,
  filters,
}: {
  content: string;
  defaultFilename: string;
  filters: Array<{ name: string; extensions: string[] }>;
}) => {
  if (!isTauriRuntime()) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = defaultFilename;
    link.click();
    URL.revokeObjectURL(url);
    return { path: link.download, savedOutsideAppData: true };
  }

  const suggestedPath = joinPath(await downloadDir(), defaultFilename);
  const selectedPath = await save({
    defaultPath: suggestedPath,
    filters,
  });

  if (!selectedPath) {
    return null;
  }

  const bytes = Array.from(new TextEncoder().encode(content));
  await invoke("write_bytes_to_path", {
    path: selectedPath,
    bytes,
  });

  return { path: selectedPath, savedOutsideAppData: true };
};

export const getDesktopStorageInfo = async (): Promise<DesktopStorageInfo | null> => {
  if (!isTauriRuntime()) {
    return null;
  }

  if (!desktopStorageInfoPromise) {
    desktopStorageInfoPromise = invoke<DesktopStorageInfo>("get_desktop_storage_info").catch((error) => {
      desktopStorageInfoPromise = null;
      throw error;
    });
  }

  return desktopStorageInfoPromise;
};

export const openDesktopPath = async (path: string) => {
  if (!isTauriRuntime() || !path) {
    return;
  }

  await invoke("open_path_in_file_manager", { path });
};

export const getDesktopAppVersion = async () => {
  if (!isTauriRuntime()) {
    return null;
  }

  const app = await import("@tauri-apps/api/app");
  return app.getVersion();
};

export const getDesktopBundleType = async () => {
  if (!isTauriRuntime()) {
    return null;
  }

  const app = await import("@tauri-apps/api/app");
  return app.getBundleType();
};

export const exportSnapshotBackup = async (bundle: DesktopBackupBundle) => {
  const content = JSON.stringify(bundle, null, 2);

  if (!isTauriRuntime()) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildSnapshotBackupFilename();
    link.click();
    URL.revokeObjectURL(url);
    return { path: link.download, savedOutsideAppData: true };
  }

  const suggestedPath = joinPath(await downloadDir(), buildSnapshotBackupFilename());
  const selectedPath = await save({
    defaultPath: suggestedPath,
    filters: [{ name: "JSON backup", extensions: ["json"] }],
  });

  if (!selectedPath) {
    return null;
  }

  const bytes = Array.from(new TextEncoder().encode(content));
  await invoke("write_bytes_to_path", {
    path: selectedPath,
    bytes,
  });

  return { path: selectedPath, savedOutsideAppData: true };
};

export const createLocalSnapshotBackup = async (bundle: DesktopBackupBundle) => {
  if (!isTauriRuntime()) {
    return null;
  }

  const bytes = Array.from(new TextEncoder().encode(JSON.stringify(bundle, null, 2)));
  return invoke<string>("write_backup_snapshot", {
    filename: buildSnapshotBackupFilename(),
    bytes,
  });
};

const isDesktopSnapshotLike = (value: unknown): value is DesktopAppSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.sessions) &&
    Array.isArray(candidate.templates) &&
    Array.isArray(candidate.todos) &&
    Array.isArray(candidate.activities) &&
    Array.isArray(candidate.timelogs) &&
    Array.isArray(candidate.calendarItems) &&
    Array.isArray(candidate.entityLinks) &&
    Array.isArray(candidate.attachments) &&
    Boolean(candidate.settings && typeof candidate.settings === "object")
  );
};

const isDesktopBackupBundle = (value: unknown): value is DesktopBackupBundle => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.kind === "notesmith-desktop-backup" &&
    Number(candidate.version) === 2 &&
    isDesktopSnapshotLike(candidate.snapshot)
  );
};

export const mergeImportedPwaSnapshot = (
  current: DesktopAppSnapshot,
  imported: DesktopAppSnapshot,
): DesktopAppSnapshot => {
  const makeSessionIdentity = (session: DesktopAppSnapshot["sessions"][number]) =>
    `${(session.date || "").trim()}::${(session.title || "").trim().toLocaleLowerCase()}`;

  const existingIds = new Set(current.sessions.map((session) => session.id));
  const existingSessionKeys = new Set(current.sessions.map(makeSessionIdentity));
  const nextImportedSessions = imported.sessions.reduce<DesktopAppSnapshot["sessions"]>((acc, session) => {
    const identityKey = makeSessionIdentity(session);
    if (existingSessionKeys.has(identityKey)) {
      return acc;
    }

    let nextId = session.id;
    while (existingIds.has(nextId)) {
      nextId = crypto.randomUUID();
    }

    existingIds.add(nextId);
    existingSessionKeys.add(identityKey);
    acc.push(nextId === session.id ? session : { ...session, id: nextId });
    return acc;
  }, []);

  const mergedSessions = [...current.sessions, ...nextImportedSessions].sort((left, right) =>
    (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
  );

  const mergedTemplateMap = new Map(current.templates.map((template) => [template.id, template]));
  imported.templates.forEach((template) => mergedTemplateMap.set(template.id, template));

  const abbreviationMap = new Map(
    current.settings.abbreviations.map((entry) => [entry.shortForm.trim().toLowerCase(), entry]),
  );
  imported.settings.abbreviations.forEach((entry) => {
    const key = entry.shortForm.trim().toLowerCase();
    if (!abbreviationMap.has(key)) {
      abbreviationMap.set(key, entry);
    }
  });

  const participantSet = new Set(current.settings.savedParticipants.map((entry) => entry.trim()).filter(Boolean));
  imported.settings.savedParticipants.forEach((entry) => {
    const trimmed = entry.trim();
    if (trimmed) {
      participantSet.add(trimmed);
    }
  });

  const preferredNameMap = new Map(
    current.settings.preferredParticipantNames.map((entry) => [
      `${entry.shortForm.trim().toLowerCase()}::${entry.fullName.trim().toLowerCase()}`,
      entry,
    ]),
  );
  imported.settings.preferredParticipantNames.forEach((entry) => {
    const key = `${entry.shortForm.trim().toLowerCase()}::${entry.fullName.trim().toLowerCase()}`;
    if (!preferredNameMap.has(key)) {
      preferredNameMap.set(key, entry);
    }
  });

  const ruleSuggestionMap = new Map(
    current.settings.ruleSuggestions.map((entry) => [
      `${entry.type}::${entry.sourceValue.trim().toLowerCase()}::${entry.suggestedValue.trim().toLowerCase()}`,
      entry,
    ]),
  );
  imported.settings.ruleSuggestions.forEach((entry) => {
    const key = `${entry.type}::${entry.sourceValue.trim().toLowerCase()}::${entry.suggestedValue.trim().toLowerCase()}`;
    if (!ruleSuggestionMap.has(key)) {
      ruleSuggestionMap.set(key, entry);
    }
  });

  const promptFieldKeys = [
    "meetingMinutesSystem",
    "meetingMinutesRules",
    "personalNotesSystem",
    "personalNotesRules",
    "revisionRules",
    "translationRules",
  ] as const;
  const mergedPromptProfile = { ...current.settings.promptProfile };
  promptFieldKeys.forEach((key) => {
    if (
      mergedPromptProfile[key] === DEFAULT_PROMPT_PROFILE[key] &&
      imported.settings.promptProfile[key] !== DEFAULT_PROMPT_PROFILE[key]
    ) {
      mergedPromptProfile[key] = imported.settings.promptProfile[key];
    }
  });

  const extraBlockMap = new Map(
    current.settings.promptProfile.extraBlocks.map((entry) => [
      `${entry.label.trim().toLowerCase()}::${entry.body.trim().toLowerCase()}`,
      entry,
    ]),
  );
  imported.settings.promptProfile.extraBlocks.forEach((entry) => {
    const key = `${entry.label.trim().toLowerCase()}::${entry.body.trim().toLowerCase()}`;
    if (!extraBlockMap.has(key)) {
      extraBlockMap.set(key, entry);
    }
  });
  mergedPromptProfile.extraBlocks = Array.from(extraBlockMap.values());

  return {
    ...current,
    sessions: mergedSessions,
    templates: Array.from(mergedTemplateMap.values()),
    settings: {
      ...current.settings,
      savedParticipants: Array.from(participantSet),
      abbreviations: Array.from(abbreviationMap.values()),
      preferredParticipantNames: Array.from(preferredNameMap.values()),
      ruleSuggestions: Array.from(ruleSuggestionMap.values()),
      promptProfile: mergedPromptProfile,
    },
  };
};

export const importSnapshotBackup = async (): Promise<ImportedSnapshotResult | null> => {
  const selectedPath = await open({
    multiple: false,
    filters: [{ name: "JSON backup", extensions: ["json"] }],
  });

  if (!selectedPath || Array.isArray(selectedPath)) {
    return null;
  }

  let content = "";
  if (isTauriRuntime()) {
    const bytes = await invoke<number[]>("read_file_bytes", {
      path: selectedPath,
    });
    content = new TextDecoder().decode(new Uint8Array(bytes));
  } else {
    content = await fetch(selectedPath).then((response) => response.text());
  }

  const parsed = JSON.parse(content) as unknown;
  const legacySnapshot = parseLegacyImportSnapshot(parsed);
  if (legacySnapshot) {
    return { kind: "pwa-export", snapshot: legacySnapshot };
  }

  if (isDesktopBackupBundle(parsed)) {
    return {
      kind: "desktop-backup",
      snapshot: parsed.snapshot,
      aiTextCache: Array.isArray(parsed.aiTextCache) ? parsed.aiTextCache : [],
      aiRequestHistory: Array.isArray(parsed.aiRequestHistory) ? parsed.aiRequestHistory : [],
      aiModelPricing: parsed.aiModelPricing ?? null,
    };
  }

  if (isDesktopSnapshotLike(parsed)) {
    return { kind: "desktop-backup", snapshot: parsed };
  }

  throw new Error("The selected file is not a supported desktop backup or PWA session export.");
};

export const loadLatestLocalSnapshotBackup = async (): Promise<DesktopAppSnapshot | null> => {
  if (!isTauriRuntime()) {
    return null;
  }

  const content = await invoke<string | null>("load_latest_local_backup");
  if (!content) {
    return null;
  }

  return JSON.parse(content) as DesktopAppSnapshot;
};
