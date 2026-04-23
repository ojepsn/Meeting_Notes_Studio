import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../storage/environment";
export const startAgentSidecar = async (env) => {
    if (!isTauriRuntime()) {
        throw new Error("The local Assistant runtime can only be started from the installed desktop app.");
    }
    return invoke("start_agent_sidecar", { env });
};
export const stopAgentSidecar = async () => {
    if (!isTauriRuntime()) {
        return;
    }
    await invoke("stop_agent_sidecar");
};
export const getAgentSidecarStatus = async () => {
    if (!isTauriRuntime()) {
        return null;
    }
    return invoke("get_agent_sidecar_status");
};
export const checkAgentSidecarHealth = async (baseUrl) => {
    const healthUrls = [`${baseUrl}/healthz`, `${baseUrl}/health`];
    for (const url of healthUrls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return { ok: true, status: response.status };
            }
            if (response.status !== 404) {
                return { ok: false, status: response.status };
            }
        }
        catch {
            // Try the next conventional health endpoint before surfacing failure.
        }
    }
    return { ok: false };
};
