import type { DesktopAppSnapshot } from "@notesmith/domain";
import { invoke } from "@tauri-apps/api/core";
import { appConfigDir, appDataDir, downloadDir } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "./environment";

export interface DesktopStorageInfo {
  appConfigDir: string;
  appDataDir: string;
  databasePath: string;
  attachmentsDir: string;
  backupsDir: string;
}

const joinPath = (base: string, child: string) => `${base.replace(/[\\\/]+$/, "")}/${child}`;

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

  const [configDir, dataDir] = await Promise.all([appConfigDir(), appDataDir()]);
  return {
    appConfigDir: configDir,
    appDataDir: dataDir,
    databasePath: joinPath(configDir, "notesmith.db"),
    attachmentsDir: joinPath(dataDir, "attachments"),
    backupsDir: joinPath(dataDir, "backups"),
  };
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

export const exportSnapshotBackup = async (snapshot: DesktopAppSnapshot) => {
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

export const createLocalSnapshotBackup = async (snapshot: DesktopAppSnapshot) => {
  if (!isTauriRuntime()) {
    return null;
  }

  const bytes = Array.from(new TextEncoder().encode(JSON.stringify(snapshot, null, 2)));
  return invoke<string>("write_backup_snapshot", {
    filename: buildSnapshotBackupFilename(),
    bytes,
  });
};

export const importSnapshotBackup = async (): Promise<DesktopAppSnapshot | null> => {
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

  return JSON.parse(content) as DesktopAppSnapshot;
};
