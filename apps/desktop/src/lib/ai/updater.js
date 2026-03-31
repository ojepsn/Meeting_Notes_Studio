import { isTauriRuntime } from "../storage/environment";
export const checkForDesktopUpdates = async () => {
    if (!isTauriRuntime()) {
        return { available: false };
    }
    const updater = await import("@tauri-apps/plugin-updater");
    const update = await updater.check();
    if (!update) {
        return { available: false };
    }
    return {
        available: true,
        version: update.version,
        install: async () => {
            await update.downloadAndInstall();
        },
    };
};
