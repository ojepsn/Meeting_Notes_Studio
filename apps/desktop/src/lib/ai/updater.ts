import { isTauriRuntime } from "../storage/environment";

export const checkForDesktopUpdates = async () => {
  if (!isTauriRuntime()) {
    return { available: false as const };
  }

  const updater = await import("@tauri-apps/plugin-updater");
  const update = await updater.check();

  if (!update) {
    return { available: false as const };
  }

  return {
    available: true as const,
    version: update.version,
    install: async () => {
      await update.downloadAndInstall();
    },
  };
};
