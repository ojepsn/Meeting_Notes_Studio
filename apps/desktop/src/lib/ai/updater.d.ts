type UpdateManifest = {
    version?: string;
    platforms?: Record<string, {
        url?: string;
    }>;
    manual_url?: string;
};
export type DesktopUpdateInstallEvent = {
    event: "Started";
    data: {
        contentLength?: number;
    };
} | {
    event: "Progress";
    data: {
        chunkLength: number;
    };
} | {
    event: "Finished";
} | {
    event: "Installing";
};
export declare const normalizeVersion: (value: string) => string;
export declare const compareVersions: (left: string, right: string) => number;
export declare const loadPublishedManifest: () => Promise<UpdateManifest>;
export declare const loadPublishedVersion: () => Promise<string>;
export declare const checkForDesktopUpdates: () => Promise<{
    available: false;
    note: string;
    version?: undefined;
    currentVersion?: undefined;
    bundleType?: undefined;
    source?: undefined;
    downloadUrl?: undefined;
    install?: undefined;
    publishedVersion?: undefined;
} | {
    available: true;
    version: string;
    currentVersion: string;
    bundleType: import("@tauri-apps/api/app").BundleType | null;
    source: "native";
    downloadUrl: string;
    install: () => Promise<never>;
    note?: undefined;
    publishedVersion?: undefined;
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
    downloadUrl?: undefined;
    install?: undefined;
    publishedVersion?: undefined;
}>;
export {};
