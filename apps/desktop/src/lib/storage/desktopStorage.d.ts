import type { DesktopAppSnapshot } from "@notesmith/domain";
export interface DesktopStorageInfo {
    appConfigDir: string;
    appDataDir: string;
    databasePath: string;
    attachmentsDir: string;
    backupsDir: string;
}
export declare const buildSnapshotBackupFilename: (date?: Date) => string;
export declare const getDesktopStorageInfo: () => Promise<DesktopStorageInfo | null>;
export declare const openDesktopPath: (path: string) => Promise<void>;
export declare const getDesktopAppVersion: () => Promise<string | null>;
export declare const exportSnapshotBackup: (snapshot: DesktopAppSnapshot) => Promise<{
    path: string;
    savedOutsideAppData: boolean;
} | null>;
export declare const createLocalSnapshotBackup: (snapshot: DesktopAppSnapshot) => Promise<string | null>;
export declare const importSnapshotBackup: () => Promise<DesktopAppSnapshot | null>;
