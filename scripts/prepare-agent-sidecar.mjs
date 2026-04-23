import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const srcTauriDir = path.join(repoRoot, "apps", "desktop", "src-tauri");
const buildDir = path.join(srcTauriDir, "sidecar-build");
const binariesDir = path.join(srcTauriDir, "binaries");
const launcherPath = path.join(buildDir, "agent_sidecar_launcher.py");
const vendoredAgentPlatformSource = path.join(repoRoot, "third_party", "agent_platform");
const agentPlatformSource = process.env.AGENT_PLATFORM_REPO_PATH?.trim() || vendoredAgentPlatformSource;

const log = (message) => console.log(`[agent-sidecar] ${message}`);

const run = (command, args, options = {}) => {
  log(`${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: "inherit",
  });
};

const getPythonCommand = () => process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

const getVenvPython = () => {
  const executable = process.platform === "win32" ? "python.exe" : "python";
  const subdir = process.platform === "win32" ? "Scripts" : "bin";
  return path.join(buildDir, ".venv", subdir, executable);
};

const getTargetTriple = () => {
  if (process.env.TAURI_BUILD_TARGET?.trim()) {
    return process.env.TAURI_BUILD_TARGET.trim();
  }
  try {
    return execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
  } catch {
    const verbose = execFileSync("rustc", ["-Vv"], { encoding: "utf8" });
    const hostLine = verbose.split(/\r?\n/).find((line) => line.startsWith("host:"));
    if (!hostLine) {
      throw new Error("Could not determine Rust target triple for the Tauri sidecar binary.");
    }
    return hostLine.split("host:")[1].trim();
  }
};

const python = getPythonCommand();
const venvPython = getVenvPython();
const targetTriple = getTargetTriple();
const binaryExtension = process.platform === "win32" ? ".exe" : "";
const pyInstallerOutput = path.join(buildDir, "dist", `agent-sidecar${binaryExtension}`);
const targetBinary = path.join(binariesDir, `agent-sidecar-${targetTriple}${binaryExtension}`);

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
mkdirSync(binariesDir, { recursive: true });

run(python, ["-m", "venv", path.join(buildDir, ".venv")]);
run(venvPython, ["-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools"]);
const agentPlatformRequirement = `agent-platform[langgraph,openai,ollama,mcp] @ file:///${path
  .resolve(agentPlatformSource)
  .replace(/\\/g, "/")}`;

if (!existsSync(path.resolve(agentPlatformSource, "pyproject.toml"))) {
  throw new Error(`AGENT_PLATFORM_REPO_PATH does not look like an agent_platform checkout: ${agentPlatformSource}`);
}

run(venvPython, [
  "-m",
  "pip",
  "install",
  "--upgrade",
  "pyinstaller",
  agentPlatformRequirement,
]);

writeFileSync(
  launcherPath,
  [
    "from agent_platform.apps.sidecar import main",
    "",
    'if __name__ == "__main__":',
    "    main()",
    "",
  ].join("\n"),
);

run(venvPython, [
  "-m",
  "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onefile",
  "--name",
  "agent-sidecar",
  "--distpath",
  path.join(buildDir, "dist"),
  "--workpath",
  path.join(buildDir, "work"),
  "--specpath",
  buildDir,
  "--collect-all",
  "agent_platform",
  "--collect-all",
  "dependency_injector",
  "--collect-all",
  "langgraph",
  "--collect-all",
  "langgraph_checkpoint",
  "--collect-all",
  "langgraph_checkpoint_sqlite",
  "--collect-all",
  "langchain_core",
  "--collect-all",
  "mcp",
  "--collect-all",
  "uvicorn",
  "--collect-all",
  "sse_starlette",
  "--hidden-import",
  "dependency_injector.errors",
  "--hidden-import",
  "agent_platform.adapters.llm.openai_adapter",
  "--hidden-import",
  "agent_platform.adapters.llm.ollama_adapter",
  "--hidden-import",
  "agent_platform.adapters.workflow.langgraph_adapter",
  "--hidden-import",
  "agent_platform.adapters.memory.sqlite_fts_adapter",
  "--hidden-import",
  "agent_platform.adapters.auth.local_single_user",
  "--hidden-import",
  "agent_platform.adapters.observability.null_adapter",
  launcherPath,
]);

if (!existsSync(pyInstallerOutput)) {
  throw new Error(`PyInstaller did not create the expected sidecar binary: ${pyInstallerOutput}`);
}

copyFileSync(pyInstallerOutput, targetBinary);
log(`Prepared ${targetBinary}`);

if (process.env.AGENT_SIDECAR_KEEP_BUILD_DIR !== "1") {
  rmSync(buildDir, { recursive: true, force: true });
}
