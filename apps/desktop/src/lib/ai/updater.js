import { isTauriRuntime } from "../storage/environment";
const UPDATE_MANIFEST_URL = "https://github.com/ojepsn/Meeting_Notes_Studio/releases/latest/download/latest-native.json";
export const normalizeVersion = (value) => value.trim().replace(/^v/i, "");
const normalizeBundleType = (value) => value?.trim().toLowerCase() ?? "";
const isMsiBundle = (value) => normalizeBundleType(value).includes("msi");
export const compareVersions = (left, right) => {
    const leftParts = normalizeVersion(left).split(".").map((entry) => Number(entry) || 0);
    const rightParts = normalizeVersion(right).split(".").map((entry) => Number(entry) || 0);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const leftValue = leftParts[index] ?? 0;
        const rightValue = rightParts[index] ?? 0;
        if (leftValue !== rightValue) {
            return leftValue - rightValue;
        }
    }
    return 0;
};
const parseManifest = (raw) => {
    const manifest = JSON.parse(raw);
    if (!manifest.version) {
        throw new Error("Published update manifest did not include a version.");
    }
    return manifest;
};
const loadPublishedManifestViaFetch = async () => {
    const response = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Could not load the published update manifest (${response.status}).`);
    }
    return parseManifest(await response.text());
};
const loadPublishedManifestViaTauri = async () => {
    const core = await import("@tauri-apps/api/core");
    const rawManifest = await core.invoke("load_update_manifest", {
        url: UPDATE_MANIFEST_URL,
    });
    return parseManifest(rawManifest);
};
export const loadPublishedManifest = async () => {
    if (isTauriRuntime()) {
        try {
            return await loadPublishedManifestViaTauri();
        }
        catch {
            return await loadPublishedManifestViaFetch();
        }
    }
    return loadPublishedManifestViaFetch();
};
export const loadPublishedVersion = async () => {
    const manifest = await loadPublishedManifest();
    return normalizeVersion(manifest.version ?? "");
};
export const checkForDesktopUpdates = async () => {
    if (!isTauriRuntime()) {
        return { available: false, note: "Desktop updates are only available in the installed app." };
    }
    const app = await import("@tauri-apps/api/app");
    const currentVersion = normalizeVersion(await app.getVersion());
    const bundleType = await app.getBundleType().catch(() => null);
    let nativeErrorMessage = null;
    let publishedManifest = null;
    const getPublishedManifest = async () => {
        if (!publishedManifest) {
            publishedManifest = await loadPublishedManifest();
        }
        return publishedManifest;
    };
    try {
        const updater = await import("@tauri-apps/plugin-updater");
        const update = await updater.check();
        if (update) {
            const manifest = await getPublishedManifest().catch(() => null);
            return {
                available: true,
                version: normalizeVersion(update.version),
                currentVersion,
                bundleType,
                source: "native",
                downloadUrl: manifest?.manual_url ||
                    manifest?.platforms?.["windows-x86_64"]?.url ||
                    "https://github.com/ojepsn/Meeting_Notes_Studio/releases/latest",
                install: async () => {
                    await update.downloadAndInstall();
                },
            };
        }
    }
    catch (error) {
        nativeErrorMessage = error instanceof Error ? error.message : "Could not check for updates.";
    }
    try {
        const manifest = await getPublishedManifest();
        const publishedVersion = normalizeVersion(manifest.version ?? "");
        const platformDownloadUrl = manifest.manual_url ||
            manifest.platforms?.["windows-x86_64"]?.url ||
            "https://github.com/ojepsn/Meeting_Notes_Studio/releases/latest";
        if (compareVersions(publishedVersion, currentVersion) > 0) {
            const manualReason = isMsiBundle(bundleType)
                ? "This installed MSI build cannot self-update in place. Install the published setup.exe once to move onto the self-updating desktop channel."
                : nativeErrorMessage || "A newer version is published, but automatic install is not available in this check.";
            return {
                available: false,
                currentVersion,
                bundleType,
                source: "manifest",
                publishedVersion,
                downloadUrl: platformDownloadUrl,
                note: `Version ${publishedVersion} is published on GitHub. ${manualReason}`,
            };
        }
    }
    catch (error) {
        if (nativeErrorMessage) {
            return {
                available: false,
                currentVersion,
                bundleType,
                note: nativeErrorMessage,
            };
        }
        return {
            available: false,
            currentVersion,
            bundleType,
            note: error instanceof Error ? error.message : "Could not check for updates.",
        };
    }
    return {
        available: false,
        currentVersion,
        bundleType,
        note: nativeErrorMessage || "Desktop app is already up to date.",
    };
};
