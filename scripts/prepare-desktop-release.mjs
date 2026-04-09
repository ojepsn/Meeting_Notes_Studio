import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const desktopPackagePath = path.join(repoRoot, "apps", "desktop", "package.json");
const releaseRoot = path.join(
  repoRoot,
  "apps",
  "desktop",
  "src-tauri",
  "target",
  "release",
);
const nsisDir = path.join(releaseRoot, "bundle", "nsis");
const msiDir = path.join(releaseRoot, "bundle", "msi");
const outputDir = path.join(releaseRoot, "release-assets");

const repository = process.env.GITHUB_REPOSITORY ?? "ojepsn/Meeting_Notes_Studio";
const version = JSON.parse(await readFile(desktopPackagePath, "utf8")).version;
const tag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME ?? `v${version}`;
const releaseNotes =
  process.env.RELEASE_NOTES?.trim() || `Desktop release ${version}.`;

function findRequiredFile(files, matcher, description) {
  const match = files.find(matcher);
  if (!match) {
    throw new Error(`Could not find ${description}.`);
  }
  return match;
}

function normalizeAssetName(name) {
  return name.replaceAll(" ", ".");
}

async function listFiles(dir) {
  const fs = await import("node:fs/promises");
  return fs.readdir(dir, { withFileTypes: true });
}

const nsisFiles = await listFiles(nsisDir);
const msiFiles = await listFiles(msiDir);

const nsisExe = findRequiredFile(
  nsisFiles,
  (entry) => entry.isFile() && entry.name.endsWith("-setup.exe"),
  "NSIS installer executable",
).name;
const nsisExeSig = findRequiredFile(
  nsisFiles,
  (entry) => entry.isFile() && entry.name.endsWith("-setup.exe.sig"),
  "NSIS installer signature",
).name;
const msiInstaller = findRequiredFile(
  msiFiles,
  (entry) => entry.isFile() && entry.name.endsWith(".msi") && !entry.name.endsWith(".msi.zip"),
  "MSI installer",
).name;
const msiSig = findRequiredFile(
  msiFiles,
  (entry) => entry.isFile() && entry.name.endsWith(".msi.sig"),
  "MSI installer signature",
).name;

const normalizedNsisExe = normalizeAssetName(nsisExe);
const normalizedNsisExeSig = normalizeAssetName(nsisExeSig);
const normalizedMsi = normalizeAssetName(msiInstaller);
const normalizedMsiSig = normalizeAssetName(msiSig);
const optionalNsisZip = nsisFiles.find(
  (entry) => entry.isFile() && entry.name.endsWith(".nsis.zip"),
)?.name;
const normalizedNsisZip = optionalNsisZip ? normalizeAssetName(optionalNsisZip) : null;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await cp(path.join(nsisDir, nsisExe), path.join(outputDir, normalizedNsisExe));
await cp(path.join(nsisDir, nsisExeSig), path.join(outputDir, normalizedNsisExeSig));
await cp(path.join(msiDir, msiInstaller), path.join(outputDir, normalizedMsi));
await cp(path.join(msiDir, msiSig), path.join(outputDir, normalizedMsiSig));
if (optionalNsisZip && normalizedNsisZip) {
  await cp(path.join(nsisDir, optionalNsisZip), path.join(outputDir, normalizedNsisZip));
}

const signature = (await readFile(path.join(nsisDir, nsisExeSig), "utf8")).trim();
const latestManifest = {
  version,
  notes: releaseNotes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repository}/releases/download/${tag}/${normalizedNsisExe}`,
    },
  },
};

await writeFile(
  path.join(outputDir, "latest.json"),
  `${JSON.stringify(latestManifest, null, 2)}\n`,
  "utf8",
);

const assetList = [
  "latest.json",
  normalizedNsisExe,
  normalizedNsisExeSig,
  normalizedMsi,
  normalizedMsiSig,
];
if (normalizedNsisZip) {
  assetList.push(normalizedNsisZip);
}

await writeFile(
  path.join(outputDir, "release-assets.txt"),
  `${assetList.join("\n")}\n`,
  "utf8",
);

console.log(`Prepared release assets in ${outputDir}`);
for (const asset of assetList) {
  console.log(` - ${asset}`);
}
