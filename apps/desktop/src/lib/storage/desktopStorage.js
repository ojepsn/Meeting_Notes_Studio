import { invoke } from "@tauri-apps/api/core";
import { appConfigDir, appDataDir, downloadDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "./environment";
const joinPath = (base, child) => `${base.replace(/[\\\/]+$/, "")}/${child}`;
export const buildSnapshotBackupFilename = (date = new Date()) => {
    const datePart = date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `notesmith-desktop-backup-${datePart}.json`;
};
export const getDesktopStorageInfo = async () => {
    if (!isTauriRuntime()) {
        return null;
    }
    const [configDir, dataDir] = await Promise.all([appConfigDir(), appDataDir()]);
    return {
        appConfigDir: configDir,
        appDataDir: dataDir,
        databasePath: joinPath(configDir, "notesmith.db"),
        attachmentsDir: joinPath(dataDir, "attachments"),
        backupsDir: joinPath(dataDir, "backups"),
    };
};
export const openDesktopPath = async (path) => {
    if (!isTauriRuntime() || !path) {
        return;
    }
    await invoke("open_path_in_file_manager", { path });
};
export const exportSnapshotBackup = async (snapshot) => {
    const content = JSON.stringify(snapshot, null, 2);
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
export const createLocalSnapshotBackup = async (snapshot) => {
    if (!isTauriRuntime()) {
        return null;
    }
    const bytes = Array.from(new TextEncoder().encode(JSON.stringify(snapshot, null, 2)));
    return invoke("write_backup_snapshot", {
        filename: buildSnapshotBackupFilename(),
        bytes,
    });
};
