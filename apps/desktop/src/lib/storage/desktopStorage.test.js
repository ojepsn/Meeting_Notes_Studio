import { describe, expect, it } from "vitest";
import { buildSnapshotBackupFilename } from "./desktopStorage";
describe("buildSnapshotBackupFilename", () => {
    it("creates a stable timestamped backup filename", () => {
        expect(buildSnapshotBackupFilename(new Date("2026-04-02T14:30:45Z"))).toBe("notesmith-desktop-backup-2026-04-02-14-30-45.json");
    });
});
