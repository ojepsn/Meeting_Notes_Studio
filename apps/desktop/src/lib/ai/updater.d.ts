export declare const normalizeVersion: (value: string) => string;
export declare const compareVersions: (left: string, right: string) => number;
export declare const loadPublishedVersion: () => Promise<string>;
export declare const checkForDesktopUpdates: () => Promise<{
    available: false;
    note: string;
    version?: undefined;
    currentVersion?: undefined;
    bundleType?: undefined;
    source?: undefined;
    install?: undefined;
    publishedVersion?: undefined;
    downloadUrl?: undefined;
} | {
    available: true;
    version: string;
    currentVersion: string;
    bundleType: import("@tauri-apps/api/app").BundleType | null;
    source: "native";
    install: () => Promise<void>;
    note?: undefined;
    publishedVersion?: undefined;
    downloadUrl?: undefined;
} | {
    available: false;
    currentVersion: string;
    bundleType: import("@tauri-apps/api/app").BundleType | null;
    source: "manifest";
    publishedVersion: string;
    downloadUrl: string;
    note: string;
    version?: undefined;
    install?: undefined;
} | {
    available: false;
    currentVersion: string;
    bundleType: import("@tauri-apps/api/app").BundleType | null;
    note: string;
    version?: undefined;
    source?: undefined;
    install?: undefined;
    publishedVersion?: undefined;
    downloadUrl?: undefined;
}>;
