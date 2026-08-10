import { describe, expect, it } from "vitest";
import { getPermanentSessionDeleteConfirmation } from "./SessionsSidebar";
describe("SessionsSidebar permanent deletion", () => {
    it("warns that permanent deletion cannot be undone and removes attachments", () => {
        expect(getPermanentSessionDeleteConfirmation("Planning notes")).toBe('Permanently delete "Planning notes"?\n\nThis cannot be undone. Attached recordings and files will also be deleted.');
    });
    it("uses a readable fallback for untitled sessions", () => {
        expect(getPermanentSessionDeleteConfirmation("")).toContain('"Untitled session"');
    });
});
