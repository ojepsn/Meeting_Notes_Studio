import { isTauriRuntime } from "../storage/environment";

const UPDATE_MANIFEST_URL =
  "https://github.com/ojepsn/Meeting_Notes_Studio/releases/latest/download/latest.json";

type UpdateManifest = {
  version?: string;
};

export const normalizeVersion = (value: string) =>
  value.trim().replace(/^v/i, "");

export const compareVersions = (left: string, right: string) => {
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

export const loadPublishedVersion = async () => {
  const response = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load the published update manifest (${response.status}).`);
  }
  const manifest = (await response.json()) as UpdateManifest;
  if (!manifest.version) {
    throw new Error("Published update manifest did not include a version.");
  }
  return normalizeVersion(manifest.version);
};

export const checkForDesktopUpdates = async () => {
  if (!isTauriRuntime()) {
    return { available: false as const, note: "Desktop updates are only available in the installed app." };
  }

  const app = await import("@tauri-apps/api/app");
  const currentVersion = normalizeVersion(await app.getVersion());
  const bundleType = await app.getBundleType().catch(() => null);

  let nativeErrorMessage: string | null = null;

  try {
    const updater = await import("@tauri-apps/plugin-updater");
    const update = await updater.check();

    if (update) {
      return {
        available: true as const,
        version: normalizeVersion(update.version),
        currentVersion,
        bundleType,
        source: "native" as const,
        install: async () => {
          await update.downloadAndInstall();
        },
      };
    }
  } catch (error) {
    nativeErrorMessage = error instanceof Error ? error.message : "Could not check for updates.";
  }

  try {
    const publishedVersion = await loadPublishedVersion();
    if (compareVersions(publishedVersion, currentVersion) > 0) {
      const manualReason =
        bundleType === "msi"
          ? "This installed MSI build may require one manual reinstall using the setup.exe installer before future in-place self-updates work."
          : nativeErrorMessage || "A newer version is published, but automatic install is not available in this check.";
      return {
        available: false as const,
        currentVersion,
        bundleType,
        source: "manifest" as const,
        publishedVersion,
        downloadUrl: "https://github.com/ojepsn/Meeting_Notes_Studio/releases/latest",
        note: `Version ${publishedVersion} is published on GitHub. ${manualReason}`,
      };
    }
  } catch (error) {
    if (nativeErrorMessage) {
      return {
        available: false as const,
        currentVersion,
        bundleType,
        note: nativeErrorMessage,
      };
    }
    return {
      available: false as const,
      currentVersion,
      bundleType,
      note: error instanceof Error ? error.message : "Could not check for updates.",
    };
  }

  return {
    available: false as const,
    currentVersion,
    bundleType,
    note: nativeErrorMessage || "Desktop app is already up to date.",
  };
};
