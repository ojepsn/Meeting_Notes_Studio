import type { DeletedEntityRecord, DesktopAppSnapshot, EntityLinkRecord, LocalAppSettings } from "@notesmith/domain";
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

export interface LocalBackupInfo {
  path: string;
  modifiedMs: number;
}

interface LocalBackupFile {
  path: string;
  modifiedMs: number;
  bytes: number[];
}

export interface LocalSnapshotBackup {
  path: string;
  modifiedMs: number;
  snapshot: DesktopAppSnapshot;
}

export interface ImportedSnapshotResult {
  kind: "desktop-backup" | "pwa-export";
  snapshot: DesktopAppSnapshot;
  aiTextCache?: Array<{ key: string; value: string; createdAt: number; expiresAt: number }>;
  aiRequestHistory?: AIRequestHistoryEntry[];
  aiModelPricing?: AIModelPricingSnapshot | null;
  attachmentFiles?: DesktopBackupAttachmentFile[];
}

export interface DesktopBackupAttachmentFile {
  attachmentId: string;
  filename: string;
  base64: string;
}

export interface DesktopBackupBundle {
  kind: "notesmith-desktop-backup";
  version: 3;
  exportedAt: string;
  snapshot: DesktopAppSnapshot;
  aiTextCache: Array<{ key: string; value: string; createdAt: number; expiresAt: number }>;
  aiRequestHistory: AIRequestHistoryEntry[];
  aiModelPricing: AIModelPricingSnapshot | null;
  attachmentFiles?: DesktopBackupAttachmentFile[];
}

const joinPath = (base: string, child: string) => `${base.replace(/[\\\/]+$/, "")}/${child}`;
let desktopStorageInfoPromise: Promise<DesktopStorageInfo | null> | null = null;
const DEFAULT_PROMPT_PROFILE = resolvePromptProfile(undefined).profile;
const ZIP_BACKUP_JSON_NAME = "notesmith-backup.json";
let zipCrcTable: Uint32Array | null = null;

export const buildSnapshotBackupFilename = (date = new Date()) => {
  const datePart = date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `notesmith-desktop-backup-${datePart}.zip`;
};

export const buildSnapshotBackupJsonFilename = (date = new Date()) => buildSnapshotBackupFilename(date).replace(/\.zip$/, ".json");

const encodeBytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const uniqueBy = <T,>(items: T[], getKey: (item: T) => string) => {
  const map = new Map<string, T>();
  items.forEach((item) => map.set(getKey(item), item));
  return Array.from(map.values());
};

const compareTimestamps = (left: string | undefined | null, right: string | undefined | null) =>
  (left || "").localeCompare(right || "");

const mergeByIdWithUpdatedAt = <T extends { id: string; updatedAt?: string; createdAt?: string }>(current: T[], imported: T[]) => {
  const merged = new Map(current.map((item) => [item.id, item] as const));
  imported.forEach((item) => {
    const existing = merged.get(item.id);
    const itemTimestamp = item.updatedAt || item.createdAt || "";
    const existingTimestamp = existing?.updatedAt || existing?.createdAt || "";
    if (!existing || compareTimestamps(itemTimestamp, existingTimestamp) >= 0) {
      merged.set(item.id, item);
    }
  });
  return Array.from(merged.values());
};

const mergeDeletedEntities = (current: DeletedEntityRecord[], imported: DeletedEntityRecord[]) => {
  const merged = new Map<string, DeletedEntityRecord>(current.map((entry) => [`${entry.entityType}::${entry.entityId}`, entry] as const));
  imported.forEach((entry) => {
    const key = `${entry.entityType}::${entry.entityId}`;
    const existing = merged.get(key);
    if (!existing || compareTimestamps(entry.deletedAt, existing.deletedAt) >= 0) {
      merged.set(key, entry);
    }
  });
  return Array.from(merged.values());
};

const mergeArchivedTasks = (current: DesktopAppSnapshot["archivedTasks"], imported: DesktopAppSnapshot["archivedTasks"]) => {
  const merged = new Map(current.map((item) => [item.id, item] as const));
  imported.forEach((item) => {
    const existing = merged.get(item.id);
    if (!existing || compareTimestamps(item.deletedAt, existing.deletedAt) >= 0) {
      merged.set(item.id, item);
    }
  });
  return Array.from(merged.values());
};

const mergeEntityLinks = (current: EntityLinkRecord[], imported: EntityLinkRecord[]) => {
  const merged = new Map<string, EntityLinkRecord>();
  [...current, ...imported].forEach((link) => {
    const key = `${link.fromType}::${link.fromId}::${link.toType}::${link.toId}::${link.relation}`;
    const existing = merged.get(key);
    if (!existing || compareTimestamps(link.updatedAt, existing.updatedAt) >= 0) {
      merged.set(key, link);
    }
  });
  return Array.from(merged.values());
};

const mergeTemplates = (current: DesktopAppSnapshot["templates"], imported: DesktopAppSnapshot["templates"]) => {
  const merged = new Map(current.map((template) => [template.id, template] as const));
  imported.forEach((template) => merged.set(template.id, template));
  return Array.from(merged.values());
};

const mergeSettings = (current: LocalAppSettings, imported: LocalAppSettings): LocalAppSettings => ({
  ...current,
  apiKey: current.apiKey || imported.apiKey,
  outputLanguage: current.outputLanguage || imported.outputLanguage,
  preferredDesktopTemplateId: current.preferredDesktopTemplateId || imported.preferredDesktopTemplateId,
  textModel: current.textModel || imported.textModel,
  transcriptionModel: current.transcriptionModel || imported.transcriptionModel,
  savedParticipants: Array.from(new Set([...(current.savedParticipants || []), ...(imported.savedParticipants || [])])).sort(),
  savedProjects: Array.from(new Set([...(current.savedProjects || []), ...(imported.savedProjects || [])])).sort(),
  savedDomains: Array.from(new Set([...(current.savedDomains || []), ...(imported.savedDomains || [])])).sort(),
  savedActivities: Array.from(new Set([...(current.savedActivities || []), ...(imported.savedActivities || [])])).sort(),
  savedTags: Array.from(new Set([...(current.savedTags || []), ...(imported.savedTags || [])])).sort(),
  projectLinks: uniqueBy([...(current.projectLinks || []), ...(imported.projectLinks || [])], (entry) => `${entry.project}::${entry.domain}`),
  timeReportPresets: uniqueBy([...(current.timeReportPresets || []), ...(imported.timeReportPresets || [])], (entry) => entry.id),
  abbreviations: uniqueBy([...(current.abbreviations || []), ...(imported.abbreviations || [])], (entry) => entry.id || `${entry.shortForm}::${entry.fullForm}`),
  preferredParticipantNames: uniqueBy(
    [...(current.preferredParticipantNames || []), ...(imported.preferredParticipantNames || [])],
    (entry) => entry.id || `${entry.shortForm}::${entry.fullName}`,
  ),
  ruleSuggestions: uniqueBy([...(current.ruleSuggestions || []), ...(imported.ruleSuggestions || [])], (entry) => entry.id),
  assistantQueryMemories: uniqueBy([...(current.assistantQueryMemories || []), ...(imported.assistantQueryMemories || [])], (entry) => entry.id),
  promptProfile: imported.promptProfile ?? current.promptProfile,
});

const applyDeletedEntities = (snapshot: DesktopAppSnapshot) => {
  const deletedEntities = snapshot.deletedEntities ?? [];
  const deletedMap = new Map<string, DeletedEntityRecord>(deletedEntities.map((entry) => [`${entry.entityType}::${entry.entityId}`, entry] as const));
  const shouldKeepUpdatedRecord = (entityType: DeletedEntityRecord["entityType"], entityId: string, updatedAt?: string) => {
    const deleted = deletedMap.get(`${entityType}::${entityId}`);
    return !deleted || compareTimestamps(updatedAt || "", deleted.deletedAt) > 0;
  };

  const sessions = snapshot.sessions.filter((entry) => shouldKeepUpdatedRecord("session", entry.id, entry.updatedAt));
  const todos = snapshot.todos.filter((entry) => shouldKeepUpdatedRecord("todo", entry.id, entry.updatedAt));
  const activities = snapshot.activities.filter((entry) => shouldKeepUpdatedRecord("activity", entry.id, entry.updatedAt));
  const timelogs = snapshot.timelogs.filter((entry) => shouldKeepUpdatedRecord("timelog", entry.id, entry.updatedAt));
  const calendarItems = snapshot.calendarItems.filter((entry) => shouldKeepUpdatedRecord("calendarItem", entry.id, entry.updatedAt));
  const checklists = snapshot.checklists.filter((entry) => shouldKeepUpdatedRecord("checklist", entry.id, entry.updatedAt));
  const checklistTemplates = snapshot.checklistTemplates.filter((entry) => shouldKeepUpdatedRecord("checklistTemplate", entry.id, entry.updatedAt));
  const checklistRecurrences = snapshot.checklistRecurrences.filter((entry) => shouldKeepUpdatedRecord("checklistRecurrence", entry.id, entry.updatedAt));
  const entityLinks = snapshot.entityLinks.filter((entry) => shouldKeepUpdatedRecord("entityLink", entry.id, entry.updatedAt));
  const attachments = snapshot.attachments.filter((entry) => shouldKeepUpdatedRecord("attachment", entry.id, entry.updatedAt));

  const existingSessionIds = new Set(sessions.map((entry) => entry.id));
  const existingTodoIds = new Set(todos.map((entry) => entry.id));
  const existingActivityIds = new Set(activities.map((entry) => entry.id));
  const existingChecklistTemplateIds = new Set(checklistTemplates.map((entry) => entry.id));

  const cleanedCalendarItems = calendarItems.filter((entry) =>
    entry.targetType === "todo" ? existingTodoIds.has(entry.targetId) : existingActivityIds.has(entry.targetId),
  );
  const cleanedChecklists = checklists.filter((entry) =>
    entry.ownerType === "project" ? true : existingTodoIds.has(entry.ownerId),
  );
  const cleanedChecklistRecurrences = checklistRecurrences.filter((entry) =>
    (entry.ownerType === "project" || existingTodoIds.has(entry.ownerId)) && existingChecklistTemplateIds.has(entry.templateId),
  );
  const cleanedEntityLinks = entityLinks.filter((entry) => {
    const fromExists =
      entry.fromType === "session" ? existingSessionIds.has(entry.fromId) : entry.fromType === "todo" ? existingTodoIds.has(entry.fromId) : existingActivityIds.has(entry.fromId);
    const toExists =
      entry.toType === "session" ? existingSessionIds.has(entry.toId) : entry.toType === "todo" ? existingTodoIds.has(entry.toId) : existingActivityIds.has(entry.toId);
    return fromExists && toExists;
  });
  const cleanedAttachments = attachments.filter((entry) => existingSessionIds.has(entry.sessionId));

  const survivingDeletionKeys = new Set<string>();
  const markSurvivingDeletion = (entityType: DeletedEntityRecord["entityType"], entityId: string, updatedAt?: string) => {
    const deleted = deletedMap.get(`${entityType}::${entityId}`);
    if (deleted && compareTimestamps(updatedAt || "", deleted.deletedAt) > 0) {
      survivingDeletionKeys.add(`${entityType}::${entityId}`);
    }
  };
  sessions.forEach((entry) => markSurvivingDeletion("session", entry.id, entry.updatedAt));
  todos.forEach((entry) => markSurvivingDeletion("todo", entry.id, entry.updatedAt));
  activities.forEach((entry) => markSurvivingDeletion("activity", entry.id, entry.updatedAt));
  timelogs.forEach((entry) => markSurvivingDeletion("timelog", entry.id, entry.updatedAt));
  calendarItems.forEach((entry) => markSurvivingDeletion("calendarItem", entry.id, entry.updatedAt));
  checklists.forEach((entry) => markSurvivingDeletion("checklist", entry.id, entry.updatedAt));
  checklistTemplates.forEach((entry) => markSurvivingDeletion("checklistTemplate", entry.id, entry.updatedAt));
  checklistRecurrences.forEach((entry) => markSurvivingDeletion("checklistRecurrence", entry.id, entry.updatedAt));
  entityLinks.forEach((entry) => markSurvivingDeletion("entityLink", entry.id, entry.updatedAt));
  attachments.forEach((entry) => markSurvivingDeletion("attachment", entry.id, entry.updatedAt));

  return {
    ...snapshot,
    sessions,
    todos,
    activities,
    timelogs,
    calendarItems: cleanedCalendarItems,
    checklists: cleanedChecklists,
    checklistTemplates,
    checklistRecurrences: cleanedChecklistRecurrences,
    entityLinks: cleanedEntityLinks,
    attachments: cleanedAttachments,
    deletedEntities: deletedEntities.filter(
      (entry) => !survivingDeletionKeys.has(`${entry.entityType}::${entry.entityId}`),
    ),
  };
};

const getZipCrcTable = () => {
  if (zipCrcTable) {
    return zipCrcTable;
  }
  zipCrcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    zipCrcTable[index] = value >>> 0;
  }
  return zipCrcTable;
};

const calculateZipCrc32 = (bytes: Uint8Array) => {
  const table = getZipCrcTable();
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};

const writeZipUint16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const writeZipUint32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);

const concatZipBytes = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
};

const deflateRawZipBytes = async (bytes: Uint8Array) => {
  if (typeof CompressionStream !== "function") {
    return null;
  }
  try {
    const stream = new CompressionStream("deflate-raw" as CompressionFormat);
    const writer = stream.writable.getWriter();
    await writer.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    await writer.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  } catch {
    return null;
  }
};

const inflateRawZipBytes = async (bytes: Uint8Array) => {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This environment cannot read compressed ZIP backups. Import the unzipped JSON file instead.");
  }
  const stream = new DecompressionStream("deflate-raw" as CompressionFormat);
  const writer = stream.writable.getWriter();
  await writer.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
};

export const createSingleJsonZip = async (jsonText: string, filename = ZIP_BACKUP_JSON_NAME) => {
  const filenameBytes = new TextEncoder().encode(filename);
  const originalBytes = new TextEncoder().encode(jsonText);
  const compressedBytes = await deflateRawZipBytes(originalBytes);
  const payloadBytes = compressedBytes ?? originalBytes;
  const method = compressedBytes ? 8 : 0;
  const crc = calculateZipCrc32(originalBytes);

  const localHeader = new Uint8Array(30 + filenameBytes.length);
  const localView = new DataView(localHeader.buffer);
  writeZipUint32(localView, 0, 0x04034b50);
  writeZipUint16(localView, 4, 20);
  writeZipUint16(localView, 6, 0x0800);
  writeZipUint16(localView, 8, method);
  writeZipUint16(localView, 10, 0);
  writeZipUint16(localView, 12, 0);
  writeZipUint32(localView, 14, crc);
  writeZipUint32(localView, 18, payloadBytes.length);
  writeZipUint32(localView, 22, originalBytes.length);
  writeZipUint16(localView, 26, filenameBytes.length);
  writeZipUint16(localView, 28, 0);
  localHeader.set(filenameBytes, 30);

  const centralHeader = new Uint8Array(46 + filenameBytes.length);
  const centralView = new DataView(centralHeader.buffer);
  writeZipUint32(centralView, 0, 0x02014b50);
  writeZipUint16(centralView, 4, 20);
  writeZipUint16(centralView, 6, 20);
  writeZipUint16(centralView, 8, 0x0800);
  writeZipUint16(centralView, 10, method);
  writeZipUint16(centralView, 12, 0);
  writeZipUint16(centralView, 14, 0);
  writeZipUint32(centralView, 16, crc);
  writeZipUint32(centralView, 20, payloadBytes.length);
  writeZipUint32(centralView, 24, originalBytes.length);
  writeZipUint16(centralView, 28, filenameBytes.length);
  writeZipUint16(centralView, 30, 0);
  writeZipUint16(centralView, 32, 0);
  writeZipUint16(centralView, 34, 0);
  writeZipUint16(centralView, 36, 0);
  writeZipUint32(centralView, 38, 0);
  writeZipUint32(centralView, 42, 0);
  centralHeader.set(filenameBytes, 46);

  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  writeZipUint32(endView, 0, 0x06054b50);
  writeZipUint16(endView, 4, 0);
  writeZipUint16(endView, 6, 0);
  writeZipUint16(endView, 8, 1);
  writeZipUint16(endView, 10, 1);
  writeZipUint32(endView, 12, centralHeader.length);
  writeZipUint32(endView, 16, localHeader.length + payloadBytes.length);
  writeZipUint16(endView, 20, 0);

  return concatZipBytes([localHeader, payloadBytes, centralHeader, endHeader]);
};

export const extractJsonFromZipBytes = async (zipBytes: Uint8Array) => {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  let eocdOffset = -1;
  for (let offset = zipBytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("No ZIP directory was found in that backup file.");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder();
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error("The ZIP backup directory is not readable.");
    }
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const filenameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const filename = decoder.decode(zipBytes.slice(centralOffset + 46, centralOffset + 46 + filenameLength));
    if (filename === ZIP_BACKUP_JSON_NAME || filename.toLowerCase().endsWith(".json")) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const payload = zipBytes.slice(dataStart, dataStart + compressedSize);
      const jsonBytes = method === 0 ? payload : method === 8 ? await inflateRawZipBytes(payload) : null;
      if (!jsonBytes) {
        throw new Error("The ZIP backup uses an unsupported compression method.");
      }
      return decoder.decode(jsonBytes);
    }
    centralOffset += 46 + filenameLength + extraLength + commentLength;
  }
  throw new Error("The ZIP backup did not contain a JSON backup file.");
};

const decodeBackupBytes = async (bytes: Uint8Array, filename = "") => {
  const isZip = filename.toLowerCase().endsWith(".zip") || (bytes[0] === 0x50 && bytes[1] === 0x4b);
  return isZip ? extractJsonFromZipBytes(bytes) : new TextDecoder().decode(bytes);
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

export const revealDesktopPath = async (path: string) => {
  if (!isTauriRuntime() || !path) {
    return;
  }

  await invoke("reveal_path_in_file_manager", { path });
};

export const openDesktopUrl = async (url: string) => {
  if (!url) {
    return;
  }

  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await invoke("open_url_in_default_browser", { url });
};

const getFilenameFromUrl = (url: string, fallback: string) => {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split("/").filter(Boolean).pop();
    return filename || fallback;
  } catch {
    return fallback;
  }
};

export const downloadInstallerToDownloads = async (url: string, version: string) => {
  if (!isTauriRuntime()) {
    await openDesktopUrl(url);
    return { path: url };
  }

  const filename = getFilenameFromUrl(url, `NoteSmith.Desktop_${version}_x64-setup.exe`);
  const destinationPath = joinPath(await downloadDir(), filename);
  const downloadedPath = await invoke<string>("download_url_to_path", {
    url,
    path: destinationPath,
  });
  return { path: downloadedPath };
};

export const downloadInstallerToDownloadsAndOpen = async (url: string, version: string) => {
  const downloaded = await downloadInstallerToDownloads(url, version);
  if (!isTauriRuntime()) {
    return downloaded;
  }

  if (downloaded.path.toLocaleLowerCase().endsWith(".exe")) {
    await invoke("launch_installer_file", { path: downloaded.path });
    return downloaded;
  }

  await revealDesktopPath(downloaded.path);
  return downloaded;
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

export const withDesktopBackupAttachmentFiles = async (bundle: DesktopBackupBundle) => {
  if (!isTauriRuntime()) {
    return bundle;
  }

  const attachmentFiles = await Promise.all(
    (bundle.snapshot.attachments || []).map(async (attachment) => {
      if (!attachment.filePath) {
        return null;
      }
      try {
        const bytes = await invoke<number[]>("read_file_bytes", { path: attachment.filePath });
        return {
          attachmentId: attachment.id,
          filename: attachment.filename,
          base64: encodeBytesToBase64(Uint8Array.from(bytes)),
        } satisfies DesktopBackupAttachmentFile;
      } catch {
        return null;
      }
    }),
  );

  return {
    ...bundle,
    attachmentFiles: attachmentFiles.filter((entry): entry is DesktopBackupAttachmentFile => Boolean(entry)),
  };
};

export const mergeDesktopSnapshot = (
  current: DesktopAppSnapshot,
  imported: DesktopAppSnapshot,
): DesktopAppSnapshot => {
  const mergedSnapshot: DesktopAppSnapshot = {
    ...current,
    sessions: mergeByIdWithUpdatedAt(current.sessions, imported.sessions).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    templates: mergeTemplates(current.templates, imported.templates),
    todos: mergeByIdWithUpdatedAt(current.todos, imported.todos).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    checklists: mergeByIdWithUpdatedAt(current.checklists, imported.checklists).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    checklistTemplates: mergeByIdWithUpdatedAt(current.checklistTemplates, imported.checklistTemplates).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    checklistRecurrences: mergeByIdWithUpdatedAt(current.checklistRecurrences, imported.checklistRecurrences).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    archivedTasks: mergeArchivedTasks(current.archivedTasks, imported.archivedTasks).sort((left, right) =>
      (right.deletedAt || "").localeCompare(left.deletedAt || ""),
    ),
    activities: mergeByIdWithUpdatedAt(current.activities, imported.activities).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    timelogs: mergeByIdWithUpdatedAt(current.timelogs, imported.timelogs).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    calendarItems: mergeByIdWithUpdatedAt(current.calendarItems, imported.calendarItems).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    entityLinks: mergeEntityLinks(current.entityLinks, imported.entityLinks).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    attachments: mergeByIdWithUpdatedAt(current.attachments, imported.attachments).sort((left, right) =>
      (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""),
    ),
    deletedEntities: mergeDeletedEntities(current.deletedEntities || [], imported.deletedEntities || []).sort((left, right) =>
      (right.deletedAt || "").localeCompare(left.deletedAt || ""),
    ),
    settings: mergeSettings(current.settings, imported.settings),
  };

  return applyDeletedEntities(mergedSnapshot);
};

export const exportSnapshotBackup = async (bundle: DesktopBackupBundle) => {
  const content = JSON.stringify(bundle, null, 2);

  if (!isTauriRuntime()) {
    const zipBytes = await createSingleJsonZip(content);
    const blob = new Blob([zipBytes], { type: "application/zip" });
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
    filters: [{ name: "ZIP backup", extensions: ["zip"] }],
  });

  if (!selectedPath) {
    return null;
  }

  await invoke("write_backup_zip_to_path_command", {
    path: selectedPath,
    content,
  });

  return { path: selectedPath, savedOutsideAppData: true };
};

export const exportSnapshotBackupToDownloads = async (bundle: DesktopBackupBundle) => {
  const content = JSON.stringify(bundle, null, 2);

  if (!isTauriRuntime()) {
    const zipBytes = await createSingleJsonZip(content);
    const filename = buildSnapshotBackupFilename();
    const blob = new Blob([zipBytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { path: filename, savedOutsideAppData: true };
  }

  const filename = buildSnapshotBackupFilename();
  const destinationPath = joinPath(await downloadDir(), filename);
  await invoke("write_backup_zip_to_path_command", {
    path: destinationPath,
    content,
  });

  return { path: destinationPath, savedOutsideAppData: true };
};

export const createLocalSnapshotBackup = async (bundle: DesktopBackupBundle) => {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<string>("write_backup_snapshot_zip", {
    filename: buildSnapshotBackupFilename(),
    content: JSON.stringify(bundle, null, 2),
  });
};

export const getLatestLocalBackupInfo = async (): Promise<LocalBackupInfo | null> => {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<LocalBackupInfo | null>("get_latest_local_backup_info");
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
    Number(candidate.version) >= 2 &&
    isDesktopSnapshotLike(candidate.snapshot)
  );
};

const parseLocalSnapshotBackupContent = (content: string): DesktopAppSnapshot | null => {
  const parsed = JSON.parse(content) as unknown;
  if (isDesktopBackupBundle(parsed)) {
    return parsed.snapshot;
  }
  if (isDesktopSnapshotLike(parsed)) {
    return parsed;
  }
  return null;
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
    filters: [{ name: "Backup files", extensions: ["zip", "json"] }],
  });

  if (!selectedPath || Array.isArray(selectedPath)) {
    return null;
  }

  let content = "";
  if (isTauriRuntime()) {
    const bytes = await invoke<number[]>("read_file_bytes", {
      path: selectedPath,
    });
    content = await decodeBackupBytes(new Uint8Array(bytes), selectedPath);
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
      attachmentFiles: Array.isArray(parsed.attachmentFiles) ? parsed.attachmentFiles : [],
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

  const bytes = await invoke<number[] | null>("load_latest_local_backup");
  if (!bytes) {
    return null;
  }

  const content = await decodeBackupBytes(new Uint8Array(bytes));
  return parseLocalSnapshotBackupContent(content);
};

export const loadRecentLocalSnapshotBackups = async (limit = 10): Promise<LocalSnapshotBackup[]> => {
  if (!isTauriRuntime()) {
    return [];
  }

  const files = await invoke<LocalBackupFile[]>("load_recent_local_backups", { limit });
  const parsedBackups = await Promise.all(
    files.map(async (file) => {
      const content = await decodeBackupBytes(new Uint8Array(file.bytes));
      const parsed = parseLocalSnapshotBackupContent(content);
      if (!parsed) {
        return null;
      }
      return {
        path: file.path,
        modifiedMs: file.modifiedMs,
        snapshot: parsed,
      } satisfies LocalSnapshotBackup;
    }),
  );

  return parsedBackups
    .filter((entry): entry is LocalSnapshotBackup => Boolean(entry))
    .sort((left, right) => right.modifiedMs - left.modifiedMs);
};
