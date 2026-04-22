import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const desktopPackagePath = path.join(repoRoot, "apps", "desktop", "package.json");
const tauriConfigPath = path.join(repoRoot, "apps", "desktop", "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(repoRoot, "apps", "desktop", "src-tauri", "Cargo.toml");

const desktopPackage = JSON.parse(await readFile(desktopPackagePath, "utf8"));
const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
const cargoToml = await readFile(cargoTomlPath, "utf8");

const packageVersion = desktopPackage.version?.trim();
const tauriVersion = tauriConfig.version?.trim();
const cargoVersionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
const cargoVersion = cargoVersionMatch?.[1]?.trim();
const releaseTag = (process.env.GITHUB_REF_NAME || "").trim();

if (releaseTag && !/^v0\.1\.\d+$/.test(releaseTag)) {
  console.log(`Skipping desktop release version check for non-desktop tag ${releaseTag}.`);
  process.exit(0);
}

const mismatches = [];

if (!packageVersion) {
  mismatches.push("apps/desktop/package.json did not contain a version.");
}

if (!tauriVersion) {
  mismatches.push("apps/desktop/src-tauri/tauri.conf.json did not contain a version.");
}

if (!cargoVersion) {
  mismatches.push("apps/desktop/src-tauri/Cargo.toml did not contain a package version.");
}

if (packageVersion && tauriVersion && packageVersion !== tauriVersion) {
  mismatches.push(`package.json version ${packageVersion} does not match tauri.conf.json version ${tauriVersion}.`);
}

if (packageVersion && cargoVersion && packageVersion !== cargoVersion) {
  mismatches.push(`package.json version ${packageVersion} does not match Cargo.toml version ${cargoVersion}.`);
}

if (releaseTag && packageVersion && releaseTag !== `v${packageVersion}`) {
  mismatches.push(`Git tag ${releaseTag} does not match desktop version v${packageVersion}.`);
}

if (mismatches.length) {
  throw new Error(`Desktop release version check failed:\n- ${mismatches.join("\n- ")}`);
}

console.log(`Desktop release version verified for ${packageVersion}.`);
