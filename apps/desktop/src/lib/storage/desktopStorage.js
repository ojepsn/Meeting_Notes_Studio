import { invoke } from "@tauri-apps/api/core";
import { downloadDir } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { resolvePromptProfile } from "../ai/prompts";
import { isTauriRuntime } from "./environment";
import { parseLegacyImportSnapshot } from "./migrateLegacy";
const joinPath = (base, child) => `${base.replace(/[\\\/]+$/, "")}/${child}`;
let desktopStorageInfoPromise = null;
const DEFAULT_PROMPT_PROFILE = resolvePromptProfile(undefined).profile;
const ZIP_BACKUP_JSON_NAME = "notesmith-backup.json";
let zipCrcTable = null;
export const buildSnapshotBackupFilename = (date = new Date()) => {
    const datePart = date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `notesmith-desktop-backup-${datePart}.zip`;
};
export const buildSnapshotBackupJsonFilename = (date = new Date()) => buildSnapshotBackupFilename(date).replace(/\.zip$/, ".json");
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
const calculateZipCrc32 = (bytes) => {
    const table = getZipCrcTable();
    let crc = 0xffffffff;
    bytes.forEach((byte) => {
        crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    });
    return (crc ^ 0xffffffff) >>> 0;
};
const writeZipUint16 = (view, offset, value) => view.setUint16(offset, value, true);
const writeZipUint32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
const concatZipBytes = (chunks) => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
        output.set(chunk, offset);
        offset += chunk.length;
    });
    return output;
};
const deflateRawZipBytes = async (bytes) => {
    if (typeof CompressionStream !== "function") {
        return null;
    }
    try {
        const stream = new CompressionStream("deflate-raw");
        const writer = stream.writable.getWriter();
        await writer.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        await writer.close();
        return new Uint8Array(await new Response(stream.readable).arrayBuffer());
    }
    catch {
        return null;
    }
};
const inflateRawZipBytes = async (bytes) => {
    if (typeof DecompressionStream !== "function") {
        throw new Error("This environment cannot read compressed ZIP backups. Import the unzipped JSON file instead.");
    }
    const stream = new DecompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    await writer.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    await writer.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
};
export const createSingleJsonZip = async (jsonText, filename = ZIP_BACKUP_JSON_NAME) => {
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
export const extractJsonFromZipBytes = async (zipBytes) => {
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
const decodeBackupBytes = async (bytes, filename = "") => {
    const isZip = filename.toLowerCase().endsWith(".zip") || (bytes[0] === 0x50 && bytes[1] === 0x4b);
    return isZip ? extractJsonFromZipBytes(bytes) : new TextDecoder().decode(bytes);
};
export const saveTextFile = async ({ content, defaultFilename, filters, }) => {
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
export const getDesktopStorageInfo = async () => {
    if (!isTauriRuntime()) {
        return null;
    }
    if (!desktopStorageInfoPromise) {
        desktopStorageInfoPromise = invoke("get_desktop_storage_info").catch((error) => {
            desktopStorageInfoPromise = null;
            throw error;
        });
    }
    return desktopStorageInfoPromise;
};
export const openDesktopPath = async (path) => {
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
export const exportSnapshotBackup = async (bundle) => {
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
    const suggestedPath = joinPath(await downloadDir(), buildSnapshotBackupJsonFilename());
    const selectedPath = await save({
        defaultPath: suggestedPath,
        filters: [{ name: "JSON backup", extensions: ["json"] }],
    });
    if (!selectedPath) {
        return null;
    }
    await invoke("write_text_to_path", {
        path: selectedPath,
        content,
    });
    return { path: selectedPath, savedOutsideAppData: true };
};
export const exportSnapshotBackupToDownloads = async (bundle) => {
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
    const filename = buildSnapshotBackupJsonFilename();
    const destinationPath = joinPath(await downloadDir(), filename);
    await invoke("write_text_to_path", {
        path: destinationPath,
        content,
    });
    return { path: destinationPath, savedOutsideAppData: true };
};
export const createLocalSnapshotBackup = async (bundle) => {
    if (!isTauriRuntime()) {
        return null;
    }
    return invoke("write_backup_snapshot_text", {
        filename: buildSnapshotBackupJsonFilename(),
        content: JSON.stringify(bundle, null, 2),
    });
};
export const getLatestLocalBackupInfo = async () => {
    if (!isTauriRuntime()) {
        return null;
    }
    return invoke("get_latest_local_backup_info");
};
const isDesktopSnapshotLike = (value) => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return (Array.isArray(candidate.sessions) &&
        Array.isArray(candidate.templates) &&
        Array.isArray(candidate.todos) &&
        Array.isArray(candidate.activities) &&
        Array.isArray(candidate.timelogs) &&
        Array.isArray(candidate.calendarItems) &&
        Array.isArray(candidate.entityLinks) &&
        Array.isArray(candidate.attachments) &&
        Boolean(candidate.settings && typeof candidate.settings === "object"));
};
const isDesktopBackupBundle = (value) => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return (candidate.kind === "notesmith-desktop-backup" &&
        Number(candidate.version) === 2 &&
        isDesktopSnapshotLike(candidate.snapshot));
};
export const mergeImportedPwaSnapshot = (current, imported) => {
    const makeSessionIdentity = (session) => `${(session.date || "").trim()}::${(session.title || "").trim().toLocaleLowerCase()}`;
    const existingIds = new Set(current.sessions.map((session) => session.id));
    const existingSessionKeys = new Set(current.sessions.map(makeSessionIdentity));
    const nextImportedSessions = imported.sessions.reduce((acc, session) => {
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
    const mergedSessions = [...current.sessions, ...nextImportedSessions].sort((left, right) => (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || ""));
    const mergedTemplateMap = new Map(current.templates.map((template) => [template.id, template]));
    imported.templates.forEach((template) => mergedTemplateMap.set(template.id, template));
    const abbreviationMap = new Map(current.settings.abbreviations.map((entry) => [entry.shortForm.trim().toLowerCase(), entry]));
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
    const preferredNameMap = new Map(current.settings.preferredParticipantNames.map((entry) => [
        `${entry.shortForm.trim().toLowerCase()}::${entry.fullName.trim().toLowerCase()}`,
        entry,
    ]));
    imported.settings.preferredParticipantNames.forEach((entry) => {
        const key = `${entry.shortForm.trim().toLowerCase()}::${entry.fullName.trim().toLowerCase()}`;
        if (!preferredNameMap.has(key)) {
            preferredNameMap.set(key, entry);
        }
    });
    const ruleSuggestionMap = new Map(current.settings.ruleSuggestions.map((entry) => [
        `${entry.type}::${entry.sourceValue.trim().toLowerCase()}::${entry.suggestedValue.trim().toLowerCase()}`,
        entry,
    ]));
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
    ];
    const mergedPromptProfile = { ...current.settings.promptProfile };
    promptFieldKeys.forEach((key) => {
        if (mergedPromptProfile[key] === DEFAULT_PROMPT_PROFILE[key] &&
            imported.settings.promptProfile[key] !== DEFAULT_PROMPT_PROFILE[key]) {
            mergedPromptProfile[key] = imported.settings.promptProfile[key];
        }
    });
    const extraBlockMap = new Map(current.settings.promptProfile.extraBlocks.map((entry) => [
        `${entry.label.trim().toLowerCase()}::${entry.body.trim().toLowerCase()}`,
        entry,
    ]));
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
export const importSnapshotBackup = async () => {
    const selectedPath = await open({
        multiple: false,
        filters: [{ name: "Backup files", extensions: ["zip", "json"] }],
    });
    if (!selectedPath || Array.isArray(selectedPath)) {
        return null;
    }
    let content = "";
    if (isTauriRuntime()) {
        const bytes = await invoke("read_file_bytes", {
            path: selectedPath,
        });
        content = await decodeBackupBytes(new Uint8Array(bytes), selectedPath);
    }
    else {
        content = await fetch(selectedPath).then((response) => response.text());
    }
    const parsed = JSON.parse(content);
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
export const loadLatestLocalSnapshotBackup = async () => {
    if (!isTauriRuntime()) {
        return null;
    }
    const bytes = await invoke("load_latest_local_backup");
    if (!bytes) {
        return null;
    }
    const content = await decodeBackupBytes(new Uint8Array(bytes));
    return JSON.parse(content);
};
