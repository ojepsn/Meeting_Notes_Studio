import type { DesktopAppSnapshot } from "@notesmith/domain";
import type { AIRequestHistoryEntry } from "../ai/history";
import type { AIModelPricingSnapshot } from "../ai/modelPricing";
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
    aiTextCache?: Array<{
        key: string;
        value: string;
        createdAt: number;
        expiresAt: number;
    }>;
    aiRequestHistory?: AIRequestHistoryEntry[];
    aiModelPricing?: AIModelPricingSnapshot | null;
}
export interface DesktopBackupBundle {
    kind: "notesmith-desktop-backup";
    version: 2;
    exportedAt: string;
    snapshot: DesktopAppSnapshot;
    aiTextCache: Array<{
        key: string;
        value: string;
        createdAt: number;
        expiresAt: number;
    }>;
    aiRequestHistory: AIRequestHistoryEntry[];
    aiModelPricing: AIModelPricingSnapshot | null;
}
export declare const buildSnapshotBackupFilename: (date?: Date) => string;
export declare const buildSnapshotBackupJsonFilename: (date?: Date) => string;
export declare const createSingleJsonZip: (jsonText: string, filename?: string) => Promise<Uint8Array<ArrayBuffer>>;
export declare const extractJsonFromZipBytes: (zipBytes: Uint8Array) => Promise<string>;
export declare const saveTextFile: ({ content, defaultFilename, filters, }: {
    content: string;
    defaultFilename: string;
    filters: Array<{
        name: string;
        extensions: string[];
    }>;
}) => Promise<{
    path: string;
    savedOutsideAppData: boolean;
} | null>;
export declare const getDesktopStorageInfo: () => Promise<DesktopStorageInfo | null>;
export declare const openDesktopPath: (path: string) => Promise<void>;
export declare const getDesktopAppVersion: () => Promise<string | null>;
export declare const getDesktopBundleType: () => Promise<import("@tauri-apps/api/app").BundleType | null>;
export declare const exportSnapshotBackup: (bundle: DesktopBackupBundle) => Promise<{
    path: string;
    savedOutsideAppData: boolean;
} | null>;
export declare const createLocalSnapshotBackup: (bundle: DesktopBackupBundle) => Promise<string | null>;
export declare const mergeImportedPwaSnapshot: (current: DesktopAppSnapshot, imported: DesktopAppSnapshot) => DesktopAppSnapshot;
export declare const importSnapshotBackup: () => Promise<ImportedSnapshotResult | null>;
export declare const loadLatestLocalSnapshotBackup: () => Promise<DesktopAppSnapshot | null>;
