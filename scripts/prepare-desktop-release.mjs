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

function findRequiredFile(files, matcher, description, options = {}) {
  const match = files.find(matcher);
  if (!match) {
    if (options.optional) {
      return null;
    }
    throw new Error(`Could not find ${description}.`);
  }
  return match;
}

function normalizeAssetName(name) {
  return name.replaceAll(" ", ".");
}

async function listFiles(dir) {
  const fs = await import("node:fs/promises");
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
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
  { optional: true },
);
const msiSig = msiInstaller
  ? msiFiles.find((entry) => entry.isFile() && entry.name.endsWith(".msi.sig"))
  : null;

const normalizedNsisExe = normalizeAssetName(nsisExe);
const normalizedNsisExeSig = normalizeAssetName(nsisExeSig);
const normalizedMsi = msiInstaller ? normalizeAssetName(msiInstaller.name) : null;
const normalizedMsiSig = msiSig ? normalizeAssetName(msiSig.name) : null;
const optionalNsisZip = nsisFiles.find(
  (entry) => entry.isFile() && entry.name.endsWith(".nsis.zip"),
)?.name;
const normalizedNsisZip = optionalNsisZip ? normalizeAssetName(optionalNsisZip) : null;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await cp(path.join(nsisDir, nsisExe), path.join(outputDir, normalizedNsisExe));
await cp(path.join(nsisDir, nsisExeSig), path.join(outputDir, normalizedNsisExeSig));
if (msiInstaller && normalizedMsi) {
  await cp(path.join(msiDir, msiInstaller.name), path.join(outputDir, normalizedMsi));
}
if (msiSig && normalizedMsiSig) {
  await cp(path.join(msiDir, msiSig.name), path.join(outputDir, normalizedMsiSig));
}
if (optionalNsisZip && normalizedNsisZip) {
  await cp(path.join(nsisDir, optionalNsisZip), path.join(outputDir, normalizedNsisZip));
}

const signature = (await readFile(path.join(nsisDir, nsisExeSig), "utf8")).trim();
const latestManifest = {
  version,
  notes: releaseNotes,
  pub_date: new Date().toISOString(),
  manual_url: `https://github.com/${repository}/releases/download/${tag}/${normalizedNsisExe}`,
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repository}/releases/download/${tag}/${normalizedNsisExe}`,
    },
  },
};

const legacyManualManifest = {
  version,
  notes: `${releaseNotes} Download and run the installer manually from GitHub Releases.`,
  pub_date: latestManifest.pub_date,
  manual_url: `https://github.com/${repository}/releases/download/${tag}/${normalizedNsisExe}`,
  platforms: {},
};

await writeFile(
  path.join(outputDir, "latest.json"),
  `${JSON.stringify(legacyManualManifest, null, 2)}\n`,
  "utf8",
);

await writeFile(
  path.join(outputDir, "latest-native.json"),
  `${JSON.stringify(latestManifest, null, 2)}\n`,
  "utf8",
);

const assetList = [
  "latest.json",
  "latest-native.json",
  normalizedNsisExe,
  normalizedNsisExeSig,
];
if (normalizedMsi) {
  assetList.push(normalizedMsi);
}
if (normalizedMsiSig) {
  assetList.push(normalizedMsiSig);
}
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
