const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(repoRoot, "package.json"));

function readArgValue(name) {
  const prefix = `${name}=`;
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

function findLatestInstaller() {
  const outDir = path.join(repoRoot, "out");
  if (!fs.existsSync(outDir)) {
    return "";
  }

  const candidates = fs.readdirSync(outDir)
    .filter((name) => /^VisionWiz.*Setup.*\.exe$/i.test(name))
    .map((name) => {
      const fullPath = path.join(outDir, name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates.length > 0 ? candidates[0].fullPath : "";
}

const installer = path.resolve(
  readArgValue("--installer") ||
  process.env.VISIONWIZ_UPDATE_TEST_INSTALLER ||
  findLatestInstaller()
);
const updateUrl = readArgValue("--url") || process.env.VISIONWIZ_UPDATE_TEST_URL || "";
const targetVersion = readArgValue("--version") ||
  process.env.VISIONWIZ_UPDATE_TEST_VERSION ||
  `${packageJson.version}.99`;
const dryRun = !hasFlag("--install") && process.env.VISIONWIZ_UPDATE_TEST_DRY_RUN !== "0";

if (!updateUrl && (!installer || !fs.existsSync(installer))) {
  console.error("[update-test] No installer found.");
  console.error("[update-test] Build once first, or pass --installer=C:\\path\\VisionWiz...Setup.exe");
  process.exit(1);
}

const env = {
  ...process.env,
  VISIONWIZ_UPDATE_TEST: "1",
  VISIONWIZ_FORCE_PROTECTED: "1",
  VISIONWIZ_UPDATE_TEST_VERSION: targetVersion,
  VISIONWIZ_UPDATE_TEST_DRY_RUN: dryRun ? "1" : "0",
};

if (updateUrl) {
  env.VISIONWIZ_UPDATE_TEST_URL = updateUrl;
  delete env.VISIONWIZ_UPDATE_TEST_INSTALLER;
} else {
  env.VISIONWIZ_UPDATE_TEST_INSTALLER = installer;
  delete env.VISIONWIZ_UPDATE_TEST_URL;
}

console.log("[update-test] Starting VisionWiz internal update test");
console.log(`[update-test] version: ${targetVersion}`);
console.log(`[update-test] source: ${updateUrl || installer}`);
console.log(`[update-test] dry run: ${dryRun ? "yes" : "no"}`);
console.log("[update-test] entry: compiled main_protected.jsc");

const electronBin = process.platform === "win32"
  ? path.join(repoRoot, "node_modules", ".bin", "electron.cmd")
  : path.join(repoRoot, "node_modules", ".bin", "electron");

const child = spawn(electronBin, ["."], {
  cwd: repoRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
  windowsVerbatimArguments: false,
});

child.on("error", (error) => {
  console.error(`[update-test] Failed to start Electron: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
