import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appCss = readFileSync(resolve(process.cwd(), "src/styles/app.css"), "utf8");
const settingsCard = readFileSync(resolve(process.cwd(), "src/features/settings/components/SettingsCard.tsx"), "utf8");

describe("desktop theme settings", () => {
  const themeFamilies = ["fluent-slate", "atlas-blue", "graphite-forest", "stone-olive", "nordic-teal", "copper-ink"];

  it("keeps each theme family available in settings with light and dark shell styles", () => {
    themeFamilies.forEach((family) => {
      expect(settingsCard).toContain(`id: "${family}"`);
      expect(appCss).toMatch(new RegExp(`\\.app-shell\\[data-theme="${family}-light"\\] \\{[\\s\\S]*?--app-bg-start:`));
      expect(appCss).toMatch(new RegExp(`\\.app-shell\\[data-theme="${family}-dark"\\] \\{[\\s\\S]*?--app-bg-start:`));
    });
  });
});
