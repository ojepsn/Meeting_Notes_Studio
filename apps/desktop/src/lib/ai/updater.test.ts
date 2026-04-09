import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkForDesktopUpdates, compareVersions, loadPublishedVersion, normalizeVersion } from "./updater";

vi.mock("../storage/environment", () => ({
  isTauriRuntime: vi.fn(),
}));

const getVersion = vi.fn();
const getBundleType = vi.fn();
const updaterCheck = vi.fn();

vi.mock("@tauri-apps/api/app", () => ({
  getVersion,
  getBundleType,
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "v0.1.19" }),
      }),
    );

    await expect(loadPublishedVersion()).resolves.toBe("0.1.19");
  });

  it("fails when the manifest does not include a version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
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
  });

  it("returns a native install path when the updater plugin finds an update", async () => {
    const downloadAndInstall = vi.fn();
    updaterCheck.mockResolvedValue({
      version: "0.1.19",
      downloadAndInstall,
    });

    const result = await checkForDesktopUpdates();

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.version).toBe("0.1.19");
      expect(result.source).toBe("native");
      await result.install();
      expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    }
  });

  it("falls back to the published manifest when no native install is available", async () => {
    updaterCheck.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "0.1.19" }),
      }),
    );

    const result = await checkForDesktopUpdates();

    expect(result.available).toBe(false);
    expect(result.source).toBe("manifest");
    expect(result.publishedVersion).toBe("0.1.19");
    expect(result.downloadUrl).toContain("/releases/latest");
    expect(result.note).toContain("manual reinstall");
  });

  it("reports the app as current when neither native nor manifest checks find a newer version", async () => {
    updaterCheck.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "0.1.18" }),
      }),
    );

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
