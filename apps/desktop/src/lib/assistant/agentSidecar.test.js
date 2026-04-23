import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAgentSidecarHealth, getAgentSidecarStatus, startAgentSidecar, stopAgentSidecar } from "./agentSidecar";
vi.mock("../storage/environment", () => ({
    isTauriRuntime: vi.fn(),
}));
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
    invoke,
}));
describe("agent sidecar helpers", () => {
    beforeEach(async () => {
        vi.restoreAllMocks();
        invoke.mockReset();
        const environment = await import("../storage/environment");
        vi.mocked(environment.isTauriRuntime).mockReturnValue(true);
    });
    it("starts the sidecar through the fixed native command", async () => {
        invoke.mockResolvedValue({ host: "127.0.0.1", port: 49152, baseUrl: "http://127.0.0.1:49152" });
        await expect(startAgentSidecar({ AGENT_PLATFORM_SERVER__PORT: "0" })).resolves.toMatchObject({
            baseUrl: "http://127.0.0.1:49152",
        });
        expect(invoke).toHaveBeenCalledWith("start_agent_sidecar", {
            env: { AGENT_PLATFORM_SERVER__PORT: "0" },
        });
    });
    it("does not start the sidecar outside the Tauri runtime", async () => {
        const environment = await import("../storage/environment");
        vi.mocked(environment.isTauriRuntime).mockReturnValue(false);
        await expect(startAgentSidecar({})).rejects.toThrow("installed desktop app");
        expect(invoke).not.toHaveBeenCalled();
    });
    it("reports and stops the running sidecar through native commands", async () => {
        invoke.mockResolvedValueOnce({ host: "127.0.0.1", port: 49152, baseUrl: "http://127.0.0.1:49152" });
        await expect(getAgentSidecarStatus()).resolves.toMatchObject({ port: 49152 });
        await expect(stopAgentSidecar()).resolves.toBeUndefined();
        expect(invoke).toHaveBeenNthCalledWith(1, "get_agent_sidecar_status");
        expect(invoke).toHaveBeenNthCalledWith(2, "stop_agent_sidecar");
    });
    it("checks conventional health endpoints", async () => {
        vi.stubGlobal("fetch", vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 404 })
            .mockResolvedValueOnce({ ok: true, status: 200 }));
        await expect(checkAgentSidecarHealth("http://127.0.0.1:49152")).resolves.toEqual({ ok: true, status: 200 });
    });
});
