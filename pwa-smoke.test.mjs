import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("./app.js", import.meta.url), "utf8");

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

assert.ok(html.includes('href="styles.css?v=0.10.6"'));
assert.ok(html.includes('src="app.js?v=0.10.6"'));

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
