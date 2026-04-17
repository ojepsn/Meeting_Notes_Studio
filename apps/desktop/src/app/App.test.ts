import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "src/app/App.tsx"), "utf8");

describe("desktop notes suggestion flow", () => {
  it("keeps suggested-rule review attached to AI generation and create-output flows", () => {
    expect(appSource).toContain("await openMetadataReviewIfNeeded(sessionForGeneration);");
    expect(appSource).toContain("await openMetadataReviewIfNeeded(nextSession);");
    expect(appSource).toContain("await openMetadataReviewIfNeeded(activeSession);");
  });
});
