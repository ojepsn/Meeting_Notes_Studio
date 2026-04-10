import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const versionMatch = appJs.match(/const APP_VERSION = "(v[^"]+)";/);

assert.ok(versionMatch, "Expected app.js to expose APP_VERSION.");
const appVersion = versionMatch[1];

[
  'id="open-sessions-main"',
  'id="open-backup-panel"',
  'id="open-settings"',
  'id="output-resize-handle"',
  'id="session-item-template"',
  'class="session-preview"',
].forEach((needle) => {
  assert.ok(html.includes(needle), `Expected HTML to contain ${needle}`);
});

assert.ok(html.includes(`href="styles.css?${`v=${appVersion.slice(1)}`}"`) || html.includes(`href="styles.css?v=${appVersion.slice(1)}"`));
assert.ok(html.includes(`src="app.js?v=${appVersion.slice(1)}"`));

const queriedIds = [...appJs.matchAll(/querySelector\("#([A-Za-z0-9_-]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(queriedIds.filter((id) => !html.includes(`id="${id}"`)))].sort();

assert.deepEqual(missingIds, [
  "mobile-open-todo",
  "open-backup-output",
  "open-settings-output",
  "open-todo-main",
  "open-todo-output",
  "toggle-sessions-panel",
]);

console.log("PWA smoke checks passed.");
