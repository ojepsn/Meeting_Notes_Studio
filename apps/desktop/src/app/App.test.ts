import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "src/app/App.tsx"), "utf8");

describe("desktop notes suggestion flow", () => {
  it("keeps suggested-rule review attached to generation, non-AI polishing, and transcript imports", () => {
    expect(appSource).toContain("await openMetadataReviewIfNeeded(sessionForGeneration);");
    expect(appSource).toContain("Manual notes were transferred to Output without AI generation.");
    expect(appSource).toContain("const ruleObservations = session && snapshot");
  });
});
