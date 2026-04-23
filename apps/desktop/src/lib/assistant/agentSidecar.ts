import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../storage/environment";

export interface AgentSidecarReady {
  host: string;
  port: number;
  baseUrl: string;
}

export interface AgentSidecarHealth {
  ok: boolean;
  status?: number;
}

export const startAgentSidecar = async (env: Record<string, string>) => {
  if (!isTauriRuntime()) {
    throw new Error("The local Assistant runtime can only be started from the installed desktop app.");
  }
  return invoke<AgentSidecarReady>("start_agent_sidecar", { env });
};

export const stopAgentSidecar = async () => {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke<void>("stop_agent_sidecar");
};

export const getAgentSidecarStatus = async () => {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<AgentSidecarReady | null>("get_agent_sidecar_status");
};

export const checkAgentSidecarHealth = async (baseUrl: string): Promise<AgentSidecarHealth> => {
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
    } catch {
      // Try the next conventional health endpoint before surfacing failure.
    }
  }
  return { ok: false };
};
