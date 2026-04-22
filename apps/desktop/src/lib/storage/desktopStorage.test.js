import { describe, expect, it } from "vitest";
import { createDefaultSnapshot } from "../db/repository";
import { buildSnapshotBackupFilename, createSingleJsonZip, extractJsonFromZipBytes, mergeImportedPwaSnapshot } from "./desktopStorage";
describe("buildSnapshotBackupFilename", () => {
    it("creates a stable timestamped backup filename", () => {
        expect(buildSnapshotBackupFilename(new Date("2026-04-02T14:30:45Z"))).toBe("notesmith-desktop-backup-2026-04-02-14-30-45.zip");
    });
});
describe("backup ZIP packaging", () => {
    it("round-trips the JSON backup payload inside a ZIP file", async () => {
        const payload = JSON.stringify({ kind: "notesmith-test", sessions: [{ id: "session-1" }] }, null, 2);
        const zipBytes = await createSingleJsonZip(payload);
        const extracted = await extractJsonFromZipBytes(zipBytes);
        expect(extracted).toBe(payload);
        expect(zipBytes[0]).toBe(0x50);
        expect(zipBytes[1]).toBe(0x4b);
    });
});
describe("mergeImportedPwaSnapshot", () => {
    it("merges imported sessions and safe settings without replacing unrelated desktop data", () => {
        const current = createDefaultSnapshot();
        current.todos = [
            {
                id: "todo-1",
                description: "Keep me",
                isDone: false,
                isPrivate: false,
                comments: "",
                activityId: "",
                domain: "",
                project: "",
                activity: "",
                doOn: "",
                dueDate: "",
                detailsHtml: "",
                createdAt: "2026-04-18T08:00:00.000Z",
                sessionIds: [],
            },
        ];
        current.settings.savedParticipants = ["Existing Person"];
        current.settings.abbreviations = [{ id: "abbr-1", shortForm: "eta", fullForm: "estimated time of arrival" }];
        const imported = createDefaultSnapshot();
        imported.sessions = [
            {
                ...imported.sessions[0],
                id: "pwa-session-1",
                title: "Imported PWA meeting",
                updatedAt: "2026-04-18T09:00:00.000Z",
            },
        ];
        imported.settings.savedParticipants = ["Ola Jeppsson"];
        imported.settings.abbreviations = [{ id: "abbr-2", shortForm: "mtg", fullForm: "meeting" }];
        const merged = mergeImportedPwaSnapshot(current, imported);
        expect(merged.todos).toHaveLength(1);
        expect(merged.todos[0]?.description).toBe("Keep me");
        expect(merged.sessions.some((session) => session.id === "pwa-session-1")).toBe(true);
        expect(merged.settings.savedParticipants).toEqual(expect.arrayContaining(["Existing Person", "Ola Jeppsson"]));
        expect(merged.settings.abbreviations.map((entry) => entry.shortForm)).toEqual(expect.arrayContaining(["eta", "mtg"]));
    });
    it("skips imported sessions when date and title already exist in the desktop database", () => {
        const current = createDefaultSnapshot();
        current.sessions = [
            {
                ...current.sessions[0],
                id: "desktop-session-1",
                title: "Weekly team sync",
                date: "2026-04-18",
            },
        ];
        const imported = createDefaultSnapshot();
        imported.sessions = [
            {
                ...imported.sessions[0],
                id: "pwa-session-1",
                title: "Weekly team sync",
                date: "2026-04-18",
            },
        ];
        const merged = mergeImportedPwaSnapshot(current, imported);
        expect(merged.sessions).toHaveLength(1);
        expect(merged.sessions[0]?.id).toBe("desktop-session-1");
    });
    it("never overwrites an existing desktop session even when an imported unique session reuses the same id", () => {
        const current = createDefaultSnapshot();
        current.sessions = [
            {
                ...current.sessions[0],
                id: "shared-id",
                title: "Desktop session",
                date: "2026-04-18",
            },
        ];
        const imported = createDefaultSnapshot();
        imported.sessions = [
            {
                ...imported.sessions[0],
                id: "shared-id",
                title: "Imported unique session",
                date: "2026-04-19",
            },
        ];
        const merged = mergeImportedPwaSnapshot(current, imported);
        const importedSession = merged.sessions.find((session) => session.title === "Imported unique session");
        expect(merged.sessions).toHaveLength(2);
        expect(importedSession).toBeTruthy();
        expect(importedSession?.id).not.toBe("shared-id");
        expect(merged.sessions.find((session) => session.title === "Desktop session")?.id).toBe("shared-id");
    });
    it("adopts imported prompt defaults only when desktop is still using defaults, while preserving existing custom desktop prompt text", () => {
        const current = createDefaultSnapshot();
        const imported = createDefaultSnapshot();
        imported.settings.promptProfile.meetingMinutesRules = "Use flowing text.";
        imported.settings.promptProfile.extraBlocks = [
            {
                id: "extra-1",
                label: "Client tone",
                body: "Keep the wording client-ready.",
                enabled: true,
            },
        ];
        const mergedDefault = mergeImportedPwaSnapshot(current, imported);
        expect(mergedDefault.settings.promptProfile.meetingMinutesRules).toBe("Use flowing text.");
        expect(mergedDefault.settings.promptProfile.extraBlocks).toHaveLength(1);
        current.settings.promptProfile.meetingMinutesRules = "Keep my desktop custom rule.";
        const mergedCustomized = mergeImportedPwaSnapshot(current, imported);
        expect(mergedCustomized.settings.promptProfile.meetingMinutesRules).toBe("Keep my desktop custom rule.");
        expect(mergedCustomized.settings.promptProfile.extraBlocks).toHaveLength(1);
    });
    it("keeps desktop-only app data outside the main snapshot path available for backup bundles", () => {
        const current = createDefaultSnapshot();
        const imported = createDefaultSnapshot();
        imported.settings.savedParticipants = ["Ola Jeppsson"];
        const merged = mergeImportedPwaSnapshot(current, imported);
        expect("settings" in merged).toBe(true);
        expect("sessions" in merged).toBe(true);
        expect(merged.settings.savedParticipants).toContain("Ola Jeppsson");
    });
});
