import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForDesktopUpdates,
  compareVersions,
  loadPublishedManifest,
  loadPublishedVersion,
  normalizeVersion,
} from "./updater";

vi.mock("../storage/environment", () => ({
  isTauriRuntime: vi.fn(),
}));

const getVersion = vi.fn();
const getBundleType = vi.fn();
const updaterCheck = vi.fn();
const invoke = vi.fn();

vi.mock("@tauri-apps/api/app", () => ({
  getVersion,
  getBundleType,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: updaterCheck,
}));

describe("updater helpers", () => {
  it("normalizes versions with or without a v prefix", () => {
    expect(normalizeVersion("v0.1.19")).toBe("0.1.19");
    expect(normalizeVersion(" 0.1.19 ")).toBe("0.1.19");
  });

  it("compares semantic version segments numerically", () => {
    expect(compareVersions("0.1.20", "0.1.19")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0", "0.10.0")).toBeLessThan(0);
    expect(compareVersions("v1.0", "1.0.0")).toBe(0);
  });
});

describe("loadPublishedVersion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and normalizes the published manifest version", async () => {
    const environment = await import("../storage/environment");
    vi.mocked(environment.isTauriRuntime).mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ version: "v0.1.19" }),
      }),
    );

    await expect(loadPublishedVersion()).resolves.toBe("0.1.19");
  });

  it("uses the native manifest loader in the Tauri runtime", async () => {
    const environment = await import("../storage/environment");
    vi.mocked(environment.isTauriRuntime).mockReturnValue(true);
    invoke.mockResolvedValue(JSON.stringify({ version: "0.1.21" }));

    await expect(loadPublishedManifest()).resolves.toMatchObject({ version: "0.1.21" });
    expect(invoke).toHaveBeenCalledWith("load_update_manifest", expect.any(Object));
  });

  it("fails when the manifest does not include a version", async () => {
    const environment = await import("../storage/environment");
    vi.mocked(environment.isTauriRuntime).mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({}),
      }),
    );

    await expect(loadPublishedVersion()).rejects.toThrow("Published update manifest did not include a version.");
  });
});

describe("checkForDesktopUpdates", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    const environment = await import("../storage/environment");
    vi.mocked(environment.isTauriRuntime).mockReturnValue(true);
    getVersion.mockResolvedValue("0.1.18");
    getBundleType.mockResolvedValue("msi");
    updaterCheck.mockReset();
    invoke.mockReset();
  });

  it("returns the signed installer URL when the updater plugin finds an update", async () => {
    const download = vi.fn();
    const install = vi.fn();
    updaterCheck.mockResolvedValue({
      version: "0.1.19",
      download,
      install,
    });
    invoke.mockResolvedValue(
      JSON.stringify({
        version: "0.1.19",
        manual_url: "https://example.com/NoteSmith.Desktop_0.1.19_x64-setup.exe",
        platforms: {},
      }),
    );

    const result = await checkForDesktopUpdates();

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.version).toBe("0.1.19");
      expect(result.source).toBe("native");
      expect(result.downloadUrl).toContain("setup.exe");
      await expect(result.install()).rejects.toThrow("signed installer download");
      expect(download).not.toHaveBeenCalled();
      expect(install).not.toHaveBeenCalled();
    }
  });

  it("falls back to the published manifest when no native install is available", async () => {
    updaterCheck.mockResolvedValue(null);
    invoke.mockResolvedValue(
      JSON.stringify({
        version: "0.1.19",
        platforms: {
          "windows-x86_64": {
            url: "https://example.com/NoteSmith.Desktop_0.1.19_x64-setup.exe",
          },
        },
      }),
    );

    const result = await checkForDesktopUpdates();

    expect(result.available).toBe(false);
    expect(result.source).toBe("manifest");
    expect(result.publishedVersion).toBe("0.1.19");
    expect(result.downloadUrl).toContain("setup.exe");
    expect(result.note).toContain("cannot self-update in place");
  });

  it("reports the app as current when neither native nor manifest checks find a newer version", async () => {
    updaterCheck.mockResolvedValue(null);
    invoke.mockResolvedValue(JSON.stringify({ version: "0.1.18" }));

    const result = await checkForDesktopUpdates();

    expect(result.available).toBe(false);
    expect(result.note).toContain("already up to date");
  });

  it("returns the desktop-only note outside the Tauri runtime", async () => {
    const environment = await import("../storage/environment");
    vi.mocked(environment.isTauriRuntime).mockReturnValue(false);

    const result = await checkForDesktopUpdates();

    expect(result.available).toBe(false);
    expect(result.note).toContain("installed app");
  });
});
