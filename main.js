// 原始版权所有 (C) [2020] [Sipeed]
// 版权所有 (C) [2024] [珠海威智人工智能有限公司]
// 根据GPLv3或更高版本的条款进行许可
// 请参阅LICENSE文件以获取详细信息
// main.js
console.log('[MAIN] marker', new Date().toISOString());
const packageJson = require("./package.json");
const VisionWiz_version = `V${packageJson.version}`;
// process.on('uncaughtException', e => console.error('[FATAL] uncaughtException:', e));
// process.on('unhandledRejection', r => console.error('[FATAL] unhandledRejection:', r));
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  dialog,
  globalShortcut,
  shell: electronShell,
} = require("electron");
const { exec, spawn } = require("child_process");
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const dns = require("dns");
const process = require("process");
const image = require("imageinfo");
const Store = require("electron-store");
const {
  sendMessageToView,
  sendMessageToAllViews,
} = require("./utils_protected/ipc_commu_loader");
const {
  findFilesWithSubstring,
  delDirRecurse,
  delDirContents,
} = require("./utils_protected/file_process_loader");
console.log('[MAIN] before language-manager');
const languageManager = require("./utils_protected/language-manager_loader")
console.log('[MAIN] after language-manager');
const path_utils = require("./utils_protected/path_utils_loader")
const { initSerialManager, connectPort } = require("./utils_protected/serialManager_loader");
console.log('[MAIN] after serialManager');
console.log('[MAIN] before cryptoservice');
const { validateKey } = require("./cryptoservice_critical_loader");
console.log('[MAIN] after cryptoservice');
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline"); // 新增解析器包

//判断是否打包
if (app.isPackaged) {
  process.env.NODE_ENV = "production";
} else {
  process.env.NODE_ENV = "development";
}

// 设备热插拔监听
SerialPort.list().then((initialPorts) => {
  let lastPorts = initialPorts;

  setInterval(async () => {
    const currentPorts = await SerialPort.list();
    if (currentPorts.length !== lastPorts.length) {
      ipcMain.emit("port-list-updated");
      lastPorts = currentPorts;
    }
  }, 2000); // 每2秒检测一次
});

// 本地数据
let current_locales;
let store;
let config_store = {};
const MANUAL_UPDATE_URL = "https://vesibit.yuque.com/ednd8n/visionwiz/intro";
const UPDATE_REPO_OWNER = "WizAI-ZH";
const UPDATE_REPO_NAME = "VisionWiz";
const UPDATE_RELEASE_API = `https://api.github.com/repos/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest`;
let hasCheckedForUpdates = false;
let updatePromptWindow = null;
let updateProgressWindow = null;
let updateDownloadInProgress = false;
let activeUpdateRelease = null;
let activeInstallerAsset = null;
let activeInstallerPath = "";
let latestUpdateProgressState = {
  currentVersion: packageJson.version,
  latestVersion: "",
  percent: 0,
  statusText: "",
  speedText: "--",
  etaText: "--",
  transferredText: "--",
  errorText: "",
  canResume: false,
  canRestart: false,
  isFailed: false,
  manualUrl: MANUAL_UPDATE_URL,
};
let latestUpdatePromptState = {
  currentVersion: packageJson.version,
  latestVersion: "",
  releaseTitle: "",
  releaseBody: "",
  manualUrl: MANUAL_UPDATE_URL,
};

function normalizeVersion(versionValue) {
  return String(versionValue || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];
}

function compareVersions(leftVersion, rightVersion) {
  const left = normalizeVersion(leftVersion).split(".").map((item) => parseInt(item, 10) || 0);
  const right = normalizeVersion(rightVersion).split(".").map((item) => parseInt(item, 10) || 0);
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }
  return 0;
}

function formatByteSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatSpeedText(bytesPerSecond) {
  const value = Number(bytesPerSecond) || 0;
  return value > 0 ? `${formatByteSize(value)}/s` : "--";
}

function formatEtaText(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (!seconds) {
    return "--";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(remainSeconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(remainSeconds).padStart(2, "0")}s`;
  }
  return `${remainSeconds}s`;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildGitHubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "VisionWiz-Updater",
  };
}

function getCurrentAppVersion() {
  try {
    return normalizeVersion(app.getVersion());
  } catch (error) {
    return normalizeVersion(packageJson.version);
  }
}

function setUpdatePromptState(patch = {}) {
  latestUpdatePromptState = {
    ...latestUpdatePromptState,
    ...patch,
  };
  if (updatePromptWindow && !updatePromptWindow.isDestroyed()) {
    updatePromptWindow.webContents.send("update-prompt-state", latestUpdatePromptState);
  }
}

function setUpdateProgressState(patch = {}) {
  latestUpdateProgressState = {
    ...latestUpdateProgressState,
    ...patch,
  };
  if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
    updateProgressWindow.webContents.send("update-progress-state", latestUpdateProgressState);
  }
}

function closeUpdatePromptWindow() {
  if (updatePromptWindow && !updatePromptWindow.isDestroyed()) {
    updatePromptWindow.close();
  }
  updatePromptWindow = null;
}

function createUpdatePromptWindow() {
  if (updatePromptWindow && !updatePromptWindow.isDestroyed()) {
    updatePromptWindow.focus();
    return updatePromptWindow;
  }

  updatePromptWindow = new BrowserWindow({
    width: 760,
    height: 660,
    minWidth: 760,
    minHeight: 660,
    parent: mainWindow || null,
    modal: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    show: false,
    title: current_locales?.update_available_title || "Update Available",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  updatePromptWindow.loadFile(path.join(__dirname, "feature", "update-available.html"));
  updatePromptWindow.once("ready-to-show", () => {
    if (updatePromptWindow && !updatePromptWindow.isDestroyed()) {
      updatePromptWindow.show();
      updatePromptWindow.webContents.send("update-prompt-state", latestUpdatePromptState);
    }
  });
  updatePromptWindow.webContents.on("did-finish-load", () => {
    if (updatePromptWindow && !updatePromptWindow.isDestroyed()) {
      updatePromptWindow.webContents.send("update-prompt-state", latestUpdatePromptState);
    }
  });
  updatePromptWindow.on("closed", () => {
    updatePromptWindow = null;
  });

  return updatePromptWindow;
}

function createUpdateProgressWindow() {
  if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
    updateProgressWindow.focus();
    return updateProgressWindow;
  }

  updateProgressWindow = new BrowserWindow({
    width: 620,
    height: 430,
    minWidth: 620,
    minHeight: 430,
    parent: mainWindow || null,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    show: false,
    title: "VisionWiz Update",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  updateProgressWindow.loadFile(path.join(__dirname, "feature", "update-progress.html"));
  updateProgressWindow.once("ready-to-show", () => {
    if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
      updateProgressWindow.show();
      updateProgressWindow.webContents.send("update-progress-state", latestUpdateProgressState);
    }
  });
  updateProgressWindow.webContents.on("did-finish-load", () => {
    if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
      updateProgressWindow.webContents.send("update-progress-state", latestUpdateProgressState);
    }
  });
  updateProgressWindow.on("closed", () => {
    updateProgressWindow = null;
  });

  return updateProgressWindow;
}

function closeUpdateProgressWindow() {
  if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
    updateProgressWindow.close();
  }
  updateProgressWindow = null;
}

async function fetchLatestGitHubRelease() {
  try {
    const response = await axios.get(UPDATE_RELEASE_API, {
      headers: buildGitHubHeaders(),
      timeout: 6000,
      maxRedirects: 5,
    });
    const release = response.data;
    if (!release || release.draft || release.prerelease) {
      return null;
    }
    return release;
  } catch (error) {
    console.warn("[UPDATE] latest release check skipped:", error.message);
    return null;
  }
}

function extractReleaseNotes(release) {
  return String(release && release.body ? release.body : "").trim();
}

function translateReleaseLineToChinese(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return "";
  }
  const prefix = trimmed.match(/^([-*]\s+)(.*)$/);
  const bullet = prefix ? prefix[1] : "";
  const raw = prefix ? prefix[2] : trimmed;

  const replacements = [
    [/^Release version:\s*/i, "发布版本："],
    [/^Release date:\s*/i, "发布时间："],
    [/^Manual update guide:\s*/i, "手动更新说明："],
    [/^Highlights$/i, "更新亮点"],
    [/^English$/i, "英文"],
    [/^Chinese$/i, "中文"],
    [/^Recent commits$/i, "最近提交"],
    [/^Maintenance release$/i, "维护版本更新"],
    [/^release:\s+prepare\s+/i, "发布准备："],
    [/^fix:\s+/i, "修复："],
    [/^feat:\s+/i, "功能："],
    [/^chore:\s+/i, "维护："],
    [/^docs:\s+/i, "文档："],
    [/^refactor:\s+/i, "重构："],
  ];

  let translated = raw;
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(raw)) {
      translated = raw.replace(pattern, replacement);
      break;
    }
  }

  if (translated === raw && /^VisionWiz\s+/i.test(raw)) {
    translated = raw;
  }

  return `${bullet}${translated}`;
}

function buildBilingualReleaseNotes(release) {
  const body = extractReleaseNotes(release);
  if (!body) {
    return "";
  }
  if (/[一-龥]/.test(body) && /(###\s*中文|###\s*English|###\s*英文)/i.test(body)) {
    return body;
  }

  const lines = body.split(/\r?\n/);
  const zhLines = lines.map((line) => {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      return `${heading[1]} ${translateReleaseLineToChinese(heading[2])}`;
    }
    return translateReleaseLineToChinese(line);
  });

  return [
    "### English",
    body,
    "",
    "### 中文",
    zhLines.join("\n"),
  ]
    .join("\n")
    .trim();
}

function pickWindowsInstallerAsset(release) {
  const assets = Array.isArray(release && release.assets) ? release.assets.slice() : [];
  if (assets.length === 0) {
    return null;
  }
  const setupAsset = assets.find((asset) => /\.exe$/i.test(asset.name || "") && /setup/i.test(asset.name || ""));
  if (setupAsset) {
    return setupAsset;
  }
  return assets.find((asset) => /\.exe$/i.test(asset.name || "")) || null;
}

async function promptForUpdate(release) {
  if (!mainWindow || !release) {
    return;
  }

  const latestVersion = normalizeVersion(release.tag_name || release.name || "");
  const currentVersion = getCurrentAppVersion();
  activeUpdateRelease = release;
  setUpdatePromptState({
    currentVersion,
    latestVersion,
    releaseTitle: release.name || `VisionWiz ${latestVersion}`,
    releaseBody: buildBilingualReleaseNotes(release),
    manualUrl: MANUAL_UPDATE_URL,
  });
  createUpdatePromptWindow();
}

function buildInstallerTempPath(targetVersion) {
  return path.join(
    app.getPath("temp"),
    `VisionWiz-Setup-${normalizeVersion(targetVersion)}.exe`
  );
}

async function downloadReleaseAssetToTemp(asset, targetVersion, options = {}) {
  const shouldResume = Boolean(options.resume);
  const tempInstallerPath = buildInstallerTempPath(targetVersion);
  let downloadedBytes = 0;

  if (shouldResume && fs.existsSync(tempInstallerPath)) {
    downloadedBytes = fs.statSync(tempInstallerPath).size;
  } else if (fs.existsSync(tempInstallerPath)) {
    fs.rmSync(tempInstallerPath, { force: true });
  }

  const headers = buildGitHubHeaders();
  if (shouldResume && downloadedBytes > 0) {
    headers.Range = `bytes=${downloadedBytes}-`;
  }

  const response = await axios({
    method: "get",
    url: asset.browser_download_url,
    headers,
    responseType: "stream",
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: (status) => [200, 206].includes(status),
  });

  const appendMode = shouldResume && downloadedBytes > 0 && response.status === 206;
  if (!appendMode && downloadedBytes > 0) {
    fs.rmSync(tempInstallerPath, { force: true });
    downloadedBytes = 0;
  }

  const totalBytes = (() => {
    const contentRange = String(response.headers["content-range"] || "");
    const rangeMatch = contentRange.match(/\/(\d+)$/);
    if (rangeMatch) {
      return Number(rangeMatch[1]) || 0;
    }
    const contentLength = Number(response.headers["content-length"] || 0);
    return appendMode ? downloadedBytes + contentLength : contentLength;
  })();

  const writer = fs.createWriteStream(tempInstallerPath, {
    flags: appendMode ? "a" : "w",
  });
  let lastProgressTick = 0;
  const startedAt = Date.now();
  let lastSampleTime = startedAt;
  let lastSampleBytes = downloadedBytes;
  let smoothSpeed = 0;

  response.data.on("data", (chunk) => {
    downloadedBytes += chunk.length;
    const now = Date.now();
    const elapsedChunkSeconds = Math.max((now - lastSampleTime) / 1000, 0.001);
    const chunkBytes = downloadedBytes - lastSampleBytes;
    const instantSpeed = chunkBytes / elapsedChunkSeconds;
    smoothSpeed = smoothSpeed > 0 ? smoothSpeed * 0.72 + instantSpeed * 0.28 : instantSpeed;
    lastSampleTime = now;
    lastSampleBytes = downloadedBytes;

    if (now - lastProgressTick < 180 && downloadedBytes < totalBytes) {
      return;
    }
    lastProgressTick = now;
    const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
    const remainingBytes = Math.max(totalBytes - downloadedBytes, 0);
    const etaSeconds = smoothSpeed > 0 ? remainingBytes / smoothSpeed : 0;
    setUpdateProgressState({
      percent,
      statusText:
        current_locales?.update_downloading_status ||
        "Downloading the latest installer...",
      speedText: formatSpeedText(smoothSpeed),
      etaText: formatEtaText(etaSeconds),
      transferredText: `${formatByteSize(downloadedBytes)}${
        totalBytes > 0 ? ` / ${formatByteSize(totalBytes)}` : ""
      }`,
      isFailed: false,
      canResume: false,
      canRestart: false,
      errorText: "",
    });
  });

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
    response.data.on("error", reject);
    response.data.pipe(writer);
  });

  return tempInstallerPath;
}

function launchInstallerAndQuit(installerPath) {
  const silentArgs = ["/S"];
  app.once("will-quit", () => {
    try {
      const child = spawn(installerPath, silentArgs, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch (error) {
      console.warn("[UPDATE] silent installer launch failed, fallback to normal launch:", error.message);
      try {
        const child = spawn(installerPath, [], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
      } catch (fallbackError) {
        console.error("[UPDATE] installer launch failed:", fallbackError);
      }
    }
  });

  closeUpdateProgressWindow();
  app.quit();
}

async function downloadAndInstallRelease(release, options = {}) {
  const asset = pickWindowsInstallerAsset(release);
  if (!asset) {
    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: [current_locales?.confirm || "OK"],
      defaultId: 0,
      title: current_locales?.update_download_failed_title || "Update Download Failed",
      message:
        current_locales?.update_missing_asset_message ||
        "No Windows installer was found in the latest release.",
      detail: MANUAL_UPDATE_URL,
    });
    electronShell.openExternal(MANUAL_UPDATE_URL);
    return;
  }

  if (updateDownloadInProgress) {
    createUpdateProgressWindow();
    return;
  }

  updateDownloadInProgress = true;
  activeUpdateRelease = release;
  activeInstallerAsset = asset;
  const latestVersion = normalizeVersion(release.tag_name || release.name || "");
  const resumePath = buildInstallerTempPath(latestVersion);
  const hasPartial = fs.existsSync(resumePath) && fs.statSync(resumePath).size > 0;
  setUpdateProgressState({
    currentVersion: getCurrentAppVersion(),
    latestVersion,
    percent: 0,
    statusText:
      current_locales?.update_download_starting ||
      "Preparing the update download...",
    speedText: "--",
    etaText: "--",
    transferredText: hasPartial && options.resume
      ? `${formatByteSize(fs.statSync(resumePath).size)} / --`
      : "--",
    isFailed: false,
    canResume: false,
    canRestart: false,
    errorText: "",
    manualUrl: MANUAL_UPDATE_URL,
  });
  closeUpdatePromptWindow();
  createUpdateProgressWindow();

  try {
    const installerPath = await downloadReleaseAssetToTemp(asset, latestVersion, options);
    activeInstallerPath = installerPath;
    setUpdateProgressState({
      percent: 100,
      statusText:
        current_locales?.update_installing_status ||
        "Download complete. Starting installer...",
      speedText:
        current_locales?.update_installing_speed || "Launching installer...",
      etaText: current_locales?.update_eta_ready || "--",
      transferredText: current_locales?.update_download_completed || "Download completed",
      isFailed: false,
      canResume: false,
      canRestart: false,
      errorText: "",
    });
    await timeout(800);
    launchInstallerAndQuit(installerPath);
  } catch (error) {
    updateDownloadInProgress = false;
    const partialExists = fs.existsSync(resumePath) && fs.statSync(resumePath).size > 0;
    setUpdateProgressState({
      statusText:
        current_locales?.update_download_failed_status ||
        "Failed to download the latest installer.",
      speedText: "--",
      etaText: "--",
      isFailed: true,
      canResume: partialExists,
      canRestart: true,
      errorText: String(error && error.message ? error.message : error),
    });
  }
}

async function checkForUpdatesOnce() {
  if (hasCheckedForUpdates) {
    return;
  }
  hasCheckedForUpdates = true;

  const latestRelease = await fetchLatestGitHubRelease();
  if (!latestRelease) {
    return;
  }

  const currentVersion = getCurrentAppVersion();
  const latestVersion = normalizeVersion(latestRelease.tag_name || latestRelease.name || "");
  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return;
  }

  await promptForUpdate(latestRelease);
}

async function initStoreAfterReady() {
  console.log('[STORE] init - before app.whenReady()');
  return app.whenReady().then(() => {
    console.log('[STORE] init - app ready');
    let userDataPath;
    try {
      console.log('[STORE] before app.getPath(userData)');
      userDataPath = app.getPath('userData');
      console.log('[STORE] userDataPath =', userDataPath);
    } catch (e) {
      console.error('[STORE] app.getPath("userData") failed:', e);
    }

    try {
      console.log('[STORE] before new Store()');
      store = new Store({
        cwd: userDataPath,
        name: 'settings'
      });
      console.log('[STORE] new Store OK, file =', store.path);
    } catch (e) {
      console.error('[STORE] new Store failed:', e);
      // 兜底：如果配置可能损坏，先尝试备份并重建
      try {
        const p = path.join(userDataPath || '', 'settings.json');
        if (fs.existsSync(p)) {
          fs.renameSync(p, p + '.bak-' + Date.now());
          console.warn('[STORE] corrupted config backed up:', p);
        }
        store = new Store({
          cwd: userDataPath,
          name: 'settings'
        });
        console.log('[STORE] new Store OK after reset, file =', store.path);
      } catch (e2) {
        console.error('[STORE] new Store still failed after reset:', e2);
      }
    }
  });
}

async function bootstrap() {
  console.log('[BOOTSTRAP] start');
  await initStoreAfterReady();
  console.log('[BOOTSTRAP] store init done');

  const cfg = read_config();
  languageManager.updateLocales(get_store_value("current_lang") || "zh");
  current_locales = languageManager.getLocales();
  console.log('[BOOTSTRAP] read_config done');
}
console.log('Start Store Setup')

let cmd = process.platform === "win32" ? "tasklist" : "ps aux";
const rex = new RegExp("pattern");
const setupWindowManager = require("./windowmanger_loader");
const { setAppMenu, getCurrentView } = require("./menu_loader");

let childWindow;
let mainWindow;
let mainWindow_views = {};



const createWindow = () => {
  childWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"),
  });
  // Create the browser window.
  mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    // fullscreen: true,
    maximize: true,
    resizable: true,
    transparent: false, // 是否透明
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true, // 是否显示窗口边框
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  childWindow.loadFile("loading.html");
  // 加载 所有窗口，之后显示主页html内容
  mainWindow_views["Wizhome"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["dataCollect"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["objectDetection"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["imgCls"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["toolSet"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // mainWindow.addBrowserView(mainWindow_views['Wizhome']);
  // mainWindow_views['Wizhome'].setBounds({ x: 0, y: 0, width: 800, height: 600 });

  // 加载不同的页面到不同的 BrowserView
  const loadViews = async () => {
    try {
      await Promise.all([
        loadHtmlWithOnlineCheck(
          "Wizhome",
          "https://vesibit.yuque.com/r/organizations/homepage",
          "./feature/offline.html"
        ),
        loadFileWithFallback("dataCollect", "./feature/data-collection.html"),
        loadFileWithFallback(
          "objectDetection",
          "./feature/target-detection.html"
        ),
        loadFileWithFallback("imgCls", "./feature/image-classification.html"),
        loadFileWithFallback("toolSet", "./feature/tool-set.html"),
      ]);
    } catch (err) {
      console.error("Error loading views:", err);
    }
  };

  const checkInternetConnection = () => {
    return new Promise((resolve) => {
      dns.resolve("www.google.com", (err) => {
        resolve(!err); // Resolve true if no error, false otherwise
      });
    });
  };

  const loadHtmlWithOnlineCheck = async (
    viewName,
    urlLink,
    offlineFilePath
  ) => {
    // 根据网络情况加载主页
    const isOnline = await checkInternetConnection();
    console.log(`isOnline = ${isOnline}`);
    if (isOnline) {
      try {
        mainWindow_views[viewName].webContents.loadURL(urlLink);
        console.log(`${viewName} loaded`);
      } catch (err) {
        console.error(`Failed to load ${viewName}:`, err);
      }
    } else {
      console.log("Network unavailable, loading Offline.");
      loadFileWithFallback(viewName, offlineFilePath);
    }
  };

  const loadFileWithFallback = (viewName, filePath) => {
    // mainWindow.addBrowserView(mainWindow_views[viewName]);
    // mainWindow_views[viewName].setBounds({ x: 0, y: 0, width: mainWindow.getBounds().width, height: mainWindow.getBounds().height });
    // mainWindow_views[viewName].webContents.openDevTools({ mode: 'detach' })
    //加载页面并返回回应消息
    return mainWindow_views[viewName].webContents
      .loadFile(path.join(__dirname, filePath))
      .then(() => {
        console.log(`${viewName} loaded from file`);
      })
      .catch((err) => {
        console.error(`Failed to load ${viewName} from file:`, err);
      });
  };

  loadViews().then(() => {
    console.log("All views loaded");
    mainWindow.addBrowserView(mainWindow_views["Wizhome"]);
    mainWindow_views["Wizhome"].setBounds({
      x: 0,
      y: 0,
      width: mainWindow.getBounds().width,
      height: mainWindow.getBounds().height,
    });
    // mainWindow_views['Wizhome'].webContents.openDevTools({ mode: 'detach' })

    // TODO: 调整 Splash → Main → Auth 的顺序控制
    // 延迟 3 秒（Splash 停留时间），销毁 childWindow 后显示主窗口，再创建验证窗口
    setTimeout(() => {
      if (childWindow && !childWindow.isDestroyed()) {
        childWindow.destroy();
        childWindow = null; // ← 可选：释放引用
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        // 先展示主窗口
        mainWindow.show();

        // 再创建验证窗口，确保以 mainWindow 为父且 modal
        // TODO: 将 createAuthWindow 的调用移动到这里
        createAuthWindow();

        // 确保 authWindow 在前台并获取焦点
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.focus();
        }
      }
    }, 1500); // 需要更短可改为 1000~1500ms
  });



  // mainWindow.loadFile('mainpage.html')
  childWindow.show();
  console.log('setAppMenu')
  // 设置应用菜单，并传递主窗口的引用
  setAppMenu(
    mainWindow,
    mainWindow_views,
    get_store_value("current_lang") || "zh"
  );
  console.log("finished setAppMenu");

  // mainWindow.once("ready-to-show", () => {
  //   mainWindow.maximize();
  // });

  mainWindow.webContents.on("close", () => {
    console.log("8--->this window is closed");
    mainWindow = null;
  });

  const handleResize = () => {
    const [width, height] = mainWindow.getSize();
    // console.log('resize to width:',width,'height:',height)
    mainWindow_views[getCurrentView()].setBounds({ x: 0, y: 0, width, height });
    // 发送消息到 BrowserView
    sendMessageToAllViews(mainWindow_views, "window-resize", { width, height });
  };

  //主窗口事件处理
  mainWindow.on("resize", handleResize);
  mainWindow.on("maximize", handleResize);
  mainWindow.on("unmaximize", handleResize);

  // 打开开发工具
  // mainWindow.webContents.openDevTools()
};

function createAuthWindow() {
  authWindow = new BrowserWindow({
    width: 500,
    height: 350,
    parent: mainWindow,       // ← 关键：指定父窗  
    modal: true,             // ← 关键：Modal
    autoHideMenuBar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "authpreload.js"),
      backgroundThrottling: false // 防止被后台挂起
    },
  });
  authWindow.loadFile("auth.html");
  authWindow.setMenuBarVisibility(false);        // 阻断 Ctrl+W / Alt 键菜单
  // authWindow.openDevTools({ mode: "detach" });

  authWindow.on('close', e => {
    app.quit();
  });

  authWindow.webContents.on('render-process-gone', (_e, details) => { // ★★  
    console.warn('[SEC] auth renderer gone:', details);
    app.quit();                      // ★★ 立即退出  
  });
}

// IPC 事件处理
ipcMain.handle("get-language", () => {
  return get_store_value("current_lang") || "zh";
});

ipcMain.handle("get-app-version", () => {
  return getCurrentAppVersion();
});

ipcMain.handle("get-current-locales", () => {
  console.log('[MAIN] get-current-locales invoked');
  return current_locales;
});

ipcMain.handle("get-update-prompt-state", () => {
  return latestUpdatePromptState;
});

ipcMain.handle("get-update-progress-state", () => {
  return latestUpdateProgressState;
});

ipcMain.on("update-window-action", async (_event, payload = {}) => {
  const action = payload.action;
  if (action === "auto-update" && activeUpdateRelease) {
    await downloadAndInstallRelease(activeUpdateRelease, { resume: true });
    return;
  }
  if (action === "manual-download") {
    closeUpdatePromptWindow();
    electronShell.openExternal(MANUAL_UPDATE_URL);
    return;
  }
  if (action === "later") {
    closeUpdatePromptWindow();
    return;
  }
  if (action === "resume-download" && activeUpdateRelease) {
    await downloadAndInstallRelease(activeUpdateRelease, { resume: true });
    return;
  }
  if (action === "restart-download" && activeUpdateRelease) {
    await downloadAndInstallRelease(activeUpdateRelease, { resume: false });
    return;
  }
  if (action === "close-download-window") {
    closeUpdateProgressWindow();
  }
});

ipcMain.handle("set-language", async (event, language) => {
  try {
    console.log(`[MAIN] set-language requested: ${language}`);
    set_store_value("current_lang", language);
    languageManager.updateLocales(language);
    current_locales = languageManager.getLocales();
  } catch (error) {
    console.error("Error occurred:", error);
  }
  // 可以在此添加更新UI的逻辑, 比如发送事件让窗口刷新语言
});

// 处理端口列表请求
ipcMain.handle("get-ports", () => initSerialManager());

// 处理连接请求
ipcMain.handle("connect-port", (_, path) => connectPort(path));

function afterAuthSuccess() {
  if (authWindow) {
    authWindow.webContents.send("auth-success", "");
    setTimeout(() => {
      authWindow.hide();
    }, 1000);
  }
  if (mainWindow) mainWindow.setEnabled(true);
  if (!hasCheckedForUpdates) {
    setTimeout(() => {
      checkForUpdatesOnce().catch((error) => {
        console.warn("[UPDATE] check failed silently:", error.message);
      });
    }, 1800);
  }
}

// 这段程序将会在 Electron 结束初始化
// 和创建浏览器窗口的时候调用
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(async () => {
  await bootstrap();
  createWindow();
  // createAuthWindow();
  initSerialManager();
  globalShortcut.register("Control+Shift+I", () => {
    try {
      mainWindow_views[getCurrentView()].webContents.openDevTools({
        mode: "detach",
      });
    } catch {
      console.log("Main window not found or not loaded.");
    }
  });
  globalShortcut.register("F5", () => {
    try {
      var current_view = getCurrentView();
      if (current_view == "Wizhome") {
        mainWindow_views[current_view].webContents.reload();
      }
    } catch {
      console.log("Main pages not loaded.");
    }
  });
  // app.on('activate', () => {
  //   // 在 macOS 系统内, 如果没有已开启的应用窗口
  //   // 点击托盘图标时通常会重新创建一个新窗口
  //   if (BrowserWindow.getAllWindows().length === 0) createWindow()
  // })
});

// 除了 macOS 外，当所有窗口都被关闭的时候退出程序。 因此, 通常
// 对应用程序和它们的菜单栏来说应该时刻保持激活状态,
// 直到用户使用 Cmd + Q 明确退出
app.on("window-all-closed", () => {
  console.log("9---->window-all-closed");
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  console.log("10--->before quit");
});

app.on("will-quit", () => {
  console.log("11--->will quit");
  globalShortcut.unregisterAll();
});

function timeout(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms, "done");
  });
}

ipcMain.on("auth-success", afterAuthSuccess);
ipcMain.on("auth-failure", (arg) => {
  if (authWindow) {
    console.log('[AUTH] failure:', arg.error);
    authWindow.webContents.send("auth-failure", arg.error);
    authWindow.focus();
  }
})
ipcMain.on("disconnected", () => {
  if (mainWindow) mainWindow.setEnabled(false);
  if (authWindow) {
    authWindow.webContents.send("disconnected");
    authWindow.show();
    authWindow.focus();
  }
});

//使用系统默认图片查看器打开图片
ipcMain.on("open_image", (event, imagePath) => {
  const fullPath = path.normalize(imagePath);
  console.log(fullPath);
  exec(`start "" "${fullPath}"`, (error) => {
    if (error) {
      console.error("Error opening image:", error);
    }
  });
});

ipcMain.on("open_tool", function (event, arg) {
  const toolPath = path.resolve(__dirname, "tools", arg); // 转换为绝对路径
  const toolDir = path.dirname(toolPath); // 获取工具所在目录
  console.log("Tool Path:", toolPath);

  // 启动子进程
  const childSpawn = spawn(toolPath, [], {
    cwd: toolDir, // 设置工作目录
  });

  // 捕获错误
  childSpawn.on("error", (err) => {
    console.error("Failed to start process:", err);
  });

  sendMessageToView(mainWindow_views, "toolSet", "reply_open_tool", toolPath);
});

//获取当前app根目录
ipcMain.on("get_app_path", (event, viewName) => {
  // event.reply('get_app_path_reply', path_utils.getAppResourcePath('.', 'resources'));
  sendMessageToView(
    mainWindow_views,
    viewName,
    "get_app_path_reply",
    path_utils.getAppResourcePath(".", "resources")
  );
  console.log(viewName, "reply finished");
});

//以下是工具调用相关进程函数
ipcMain.on("open_website", (event, arg) => {
  if (!arg || typeof arg !== "string") {
    console.error("Invalid URL:", arg);
    return;
  }

  console.log("Opening website:", arg);

  // 根据操作系统选择命令
  const platform = process.platform;
  let command;

  if (platform === "win32") {
    // Windows 使用 'start'
    command = "start";
  } else if (platform === "darwin") {
    // macOS 使用 'open'
    command = "open";
  } else {
    // Linux 使用 'xdg-open'
    command = "xdg-open";
  }

  // 使用 spawn 调用系统命令
  const child = spawn(command, [arg], { shell: true });

  // 捕获错误
  child.on("error", (err) => {
    console.error("Failed to open website:", err);
  });

  child.on("close", (code) => {
    console.log(`Child process exited with code ${code}`);
  });
});

ipcMain.on("open_make_sense", () => {
  //打开make-sense软件，并且设定make-sense语言
  setupWindowManager.createMakeSenseWindow(get_store_value("current_lang") || "zh");
});

ipcMain.on("openfile", function (event, arg) {
  //打开窗口选择要保存拍摄图片的文件夹
  dialog
    .showOpenDialog({
      title: current_locales.choose_save_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("save-dir", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_dataset_dir_yolo", function (event, arg) {
  //打开窗口选择目标检测数据集目录
  dialog
    .showOpenDialog({
      title: current_locales.choose_dataset_save_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_dataset_dir_yolo", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_train_xml_dir_yolo", function (event, arg) {
  //收到窗口信息后打开窗口选择目标检测标签集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_dataset_xml_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_xml_dir_yolo", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_test_img_dir_yolo", function (event, arg) {
  //收到窗口信息后打开窗口选择目标检测测试集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_dataset_xml_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_test_img_dir_yolo", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_dataset_dir_cls", function (event, arg) {
  //收到窗口信息后打开窗口选择图像分类训练集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_cls_dataset_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_dataset_dir_cls", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_test_img_dir_cls", function (event, arg) {
  //收到窗口信息后打开窗口选择图像分类测试集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_cls_testset_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_test_img_dir_cls", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

let paths = "";
ipcMain.on("imgbase64", function (event, arg) {
  let base64 = arg.replace(/^data:image\/\w+;base64,/, "");
  let dataBuffer = Buffer(base64, "base64");
  // 利用nodejs的fs文件系统功能进行保存图片，需要先将base64头去掉
  fs.writeFile(paths, dataBuffer, (err) => {
    if (err) {
      event.sender.send("imgsavemsgerr", err);
    } else {
      event.sender.send("imgsavemsgok", current_locales.save_succeed);
    }
  });
});

ipcMain.on("savedir", function (event, arg) {
  paths = arg;
});

let pty;
if (app.isPackaged) {
  // pty = require(path.resolve(process.cwd(),'resources','app.asar.unpacked', 'node_modules', 'node-pty'))
  pty = require(path.resolve(__dirname, "node_modules", "node-pty"));
} else {
  // pty = require(path.resolve(__dirname,'node_modules','node-pty'));
  pty = require(path.resolve(__dirname, "node_modules", "node-pty"));
}
const { main } = require("@popperjs/core");
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
const ptyProcess_yolo = pty.spawn(shell, [], {
  name: "xterm-color",
  cols: 500,
  rows: 20,
  cwd: process.env.PWD,
  env: process.env,
});

const ptyProcess_cls = pty.spawn(shell, [], {
  name: "xterm_cls",
  cols: 500,
  rows: 20,
  cwd: process.env.PWD,
  env: process.env,
});

const TRAIN_ERROR_PREFIX = "VW_TRAIN_ERROR::";
const trainStreamState = {
  imgCls: { buffer: "", lastError: null },
  objectDetection: { buffer: "", lastError: null },
};

function buildFallbackTrainError(rawText) {
  const text = String(rawText || "");
  const normalized = text.toLowerCase();
  const payload = {
    code: "unknown_error",
    title: "未知训练错误 / Unknown training error",
    summary:
      "训练过程中发生了未分类错误，请结合下方原始日志继续排查。/ An uncategorized error occurred during training. Please inspect the raw log below.",
    suggestions: [
      "检查数据集路径、标注文件和图片尺寸是否正确。/ Check dataset paths, label files, and image sizes.",
      "确认 Python、TensorFlow、权重文件和转换工具依赖完整。/ Confirm Python, TensorFlow, weight files, and conversion tools are available.",
      "如仍失败，请保留完整日志继续定位。/ If it still fails, keep the full log for further debugging.",
    ],
    raw_error: text,
  };

  if (
    normalized.includes("datasets not valid") ||
    normalized.includes("dataset invalid")
  ) {
    payload.code = "dataset_invalid";
    payload.title = "Dataset invalid / Invalid dataset";
    payload.summary =
      "训练数据集未通过校验，可能是目录、标注或样本数量不符合要求。/ The dataset did not pass validation. The folder layout, annotations, or sample counts may be invalid.";
    payload.suggestions = [
      "确认图片目录与标注目录存在且内容完整。/ Make sure image and label folders exist and are complete.",
      "检查图片与 XML 是否一一对应。/ Check whether images and XML files match one to one.",
      "检查每个类别的样本数量是否达到最低要求。/ Verify each class meets the minimum sample requirement.",
    ];
  } else if (
    normalized.includes("input shape") ||
    normalized.includes("输入形状") ||
    normalized.includes("not supported input size") ||
    normalized.includes("shape not valid")
  ) {
    payload.code = "input_size_mismatch";
    payload.title = "输入尺寸不匹配 / Input size mismatch";
    payload.summary =
      "数据集图片尺寸与当前模型输入分辨率不一致，或所选分辨率不受支持。/ Dataset image sizes do not match the selected model input resolution, or the resolution is unsupported.";
    payload.suggestions = [
      "确认训练窗口选择的输入分辨率与数据集图片尺寸一致。/ Ensure the selected input resolution matches dataset image sizes.",
      "K210 当前建议使用 224x224、240x240 或 320x224。320x240 已暂时禁用，以避免 KPU 内存不足导致转换失败。/ K210 currently recommends 224x224, 240x240, or 320x224. The 320x240 option is temporarily disabled to avoid KPU out-of-memory conversion failures.",
      "必要时先批量调整数据集尺寸。/ Resize the dataset beforehand if needed.",
    ];
  } else if (
    normalized.includes("gpu") ||
    normalized.includes("显存") ||
    normalized.includes("no free gpu") ||
    normalized.includes("insufficient gpu")
  ) {
    payload.code = "gpu_memory";
    payload.title = "GPU/显存不足 / GPU or memory unavailable";
    payload.summary =
      "当前环境没有可用 GPU，或显存不足以完成训练。/ No GPU is available, or GPU memory is insufficient for training.";
    payload.suggestions = [
      "关闭其它占用显存的程序后重试。/ Close other GPU-intensive programs and retry.",
      "适当减小 batch size。/ Reduce the batch size.",
      "如环境允许，可改用 CPU 训练。/ Use CPU training if the environment allows it.",
    ];
  } else if (
    normalized.includes("load") && normalized.includes("weight") ||
    normalized.includes("权重")
  ) {
    payload.code = "weights_error";
    payload.title = "权重加载失败 / Weight loading failed";
    payload.summary =
      "预训练权重文件不存在、损坏，或与当前模型配置不匹配。/ The pretrained weight file is missing, corrupted, or incompatible with the current model configuration.";
    payload.suggestions = [
      "确认权重文件存在且未损坏。/ Confirm the weight file exists and is intact.",
      "确认 alpha 和输入尺寸与权重兼容。/ Ensure alpha and input size are compatible with the weights.",
      "必要时重新准备权重文件。/ Re-prepare the weight file if necessary.",
    ];
  } else if (
    normalized.includes("tensorflow") ||
    normalized.includes("modulenotfounderror") ||
    normalized.includes("importerror")
  ) {
    payload.code = "dependency_error";
    payload.title = "依赖或 TensorFlow 异常 / Dependency or TensorFlow error";
    payload.summary =
      "训练环境缺少依赖，或 TensorFlow 运行异常。/ Training dependencies are missing, or TensorFlow failed at runtime.";
    payload.suggestions = [
      "检查 Python 运行环境与依赖安装是否完整。/ Check the Python environment and installed dependencies.",
      "确认 TensorFlow 与当前系统兼容。/ Ensure TensorFlow is compatible with the current system.",
      "查看完整 traceback 进一步定位。/ Review the full traceback for more detail.",
    ];
  } else if (
    normalized.includes("kmodel") ||
    normalized.includes("ncc") ||
    normalized.includes("convert")
  ) {
    payload.code = "kmodel_convert_error";
    payload.title = "KModel 转换失败 / KModel conversion failed";
    payload.summary =
      "训练完成后模型转换为 KModel 的阶段失败。/ The post-training conversion to KModel failed.";
    payload.suggestions = [
      "确认转换工具与模型文件存在。/ Confirm the converter tool and model files exist.",
      "检查 sample_images 和 tflite 输出是否正常生成。/ Check whether sample_images and the TFLite output were generated correctly.",
      "查看转换阶段日志中的具体报错。/ Review the converter-stage log for the exact error.",
    ];
  } else if (
    normalized.includes("xml") ||
    normalized.includes("parse") ||
    normalized.includes("annotation")
  ) {
    payload.code = "xml_annotation_error";
    payload.title = "标注文件异常 / Annotation file error";
    payload.summary =
      "XML 标注文件解析失败，或标注格式不符合训练要求。/ XML annotations could not be parsed, or their format is invalid for training.";
    payload.suggestions = [
      "检查 XML 是否损坏、缺字段或编码异常。/ Check whether XML files are corrupted, missing fields, or encoded incorrectly.",
      "确认标签文件与图片名称一一对应。/ Ensure label files map one to one with image names.",
      "用标注工具重新导出异常样本。/ Re-export problematic samples with the annotation tool.",
    ];
  }
  return payload;
}

function parseTrainErrorPayloadFromText(text) {
  const value = String(text || "");
  const regex = new RegExp(`${TRAIN_ERROR_PREFIX}(\\{.*\\})`, "g");
  let match = null;
  let lastPayload = null;
  while ((match = regex.exec(value)) !== null) {
    try {
      lastPayload = JSON.parse(match[1]);
    } catch (error) {
      console.warn("[TRAIN] failed to parse structured error payload:", error);
    }
  }
  if (lastPayload) {
    return lastPayload;
  }
  if (
    value.includes("训练错误:") ||
    value.includes("Train error:") ||
    value.includes("Datasets not valid") ||
    value.includes("dataset invalid")
  ) {
    return buildFallbackTrainError(value);
  }
  return null;
}

function ingestTrainStream(channel, data) {
  const state = trainStreamState[channel];
  if (!state) {
    return null;
  }
  state.buffer += String(data || "");
  const lines = state.buffer.split(/\r?\n/);
  state.buffer = lines.pop();
  for (const line of lines) {
    const payload = parseTrainErrorPayloadFromText(line);
    if (payload) {
      state.lastError = payload;
    }
  }
  const immediatePayload = parseTrainErrorPayloadFromText(data);
  if (immediatePayload) {
    state.lastError = immediatePayload;
  }
  return state.lastError;
}

function resetTrainStream(channel) {
  if (!trainStreamState[channel]) {
    return;
  }
  trainStreamState[channel].buffer = "";
  trainStreamState[channel].lastError = null;
}

function getTrainStreamError(channel) {
  return trainStreamState[channel] ? trainStreamState[channel].lastError : null;
}

function extractTrainErrorFromLog(logText) {
  const payload = parseTrainErrorPayloadFromText(logText);
  if (payload) {
    return payload;
  }
  const text = String(logText || "").trim();
  if (!text) {
    return null;
  }
  if (
    text.includes("训练错误:") ||
    text.includes("Train error:") ||
    text.includes("Datasets not valid")
  ) {
    return buildFallbackTrainError(text);
  }
  return null;
}

ipcMain.on("send_data_terminal_yolo", function (event, arg) {
  //输入信息到目标检测控制台中
  resetTrainStream("objectDetection");
  ptyProcess_yolo.write(arg);
});

ipcMain.on("send_data_terminal_cls", function (event, arg) {
  //输入信息到图像分类控制台中
  resetTrainStream("imgCls");
  ptyProcess_cls.write(arg);
});

ptyProcess_cls.onData((data) => {
  const errorPayload = ingestTrainStream("imgCls", data);
  var pattern = /Epoch [0-9.]+[/][0-9.]+/;
  var patterns = /[0-9.]+[/][0-9.]+/g;
  if (pattern.test(data)) {
    if (data.length > 1) {
      let num1 = data.split(" ")[1].split("/")[0];
      let num2 = data.split(" ")[1].split("/")[1];
      sendMessageToView(mainWindow_views, "imgCls", "update_progress_bar", [
        num1,
        num2,
      ]);
    }
  }
  if (patterns.test(data)) {
    let nums1 = data.match(patterns)[0].split(" ")[0].split("/")[0];
    let nums2 = data.match(patterns)[0].split(" ")[0].split("/")[1];
    sendMessageToView(mainWindow_views, "imgCls", "update_progress_bar_epoch", [
      nums1,
      nums2,
    ]);
  }
  if (data.indexOf("Training and testing success") != -1) {
    sendMessageToView(mainWindow_views, "imgCls", "show_train_succeed");
  }
  if (data.indexOf("Test succeed!") != -1) {
    sendMessageToView(mainWindow_views, "imgCls", "show_test_succeed");
  }
  if (errorPayload) {
    sendMessageToView(mainWindow_views, "imgCls", "show_train_failed", errorPayload);
  }
  if (data.indexOf("训练错误:") != -1 && !errorPayload) {
    sendMessageToView(mainWindow_views, "imgCls", "show_train_failed", buildFallbackTrainError(data));
  }
  sendMessageToView(
    mainWindow_views,
    "imgCls",
    "write_data_to_xterm_cls",
    data
  );
});

ptyProcess_yolo.onData((data) => {
  const errorPayload = ingestTrainStream("objectDetection", data);
  var pattern = /Epoch [0-9.]+[/][0-9.]+/;
  var patterns = /[0-9.]+[/][0-9.]+/g;
  if (pattern.test(data)) {
    if (data.length > 1) {
      let num1 = data.split(" ")[1].split("/")[0];
      let num2 = data.split(" ")[1].split("/")[1];
      sendMessageToView(
        mainWindow_views,
        "objectDetection",
        "update_progress_bar",
        [num1, num2]
      );
    }
  }
  if (patterns.test(data)) {
    let nums1 = data.match(patterns)[0].split(" ")[0].split("/")[0];
    let nums2 = data.match(patterns)[0].split(" ")[0].split("/")[1];
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "update_progress_bar_epoch",
      [nums1, nums2]
    );
  }
  if (data.indexOf("Training and testing success") != -1) {
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "show_train_succeed"
    );
  }
  if (data.indexOf("Test succeed!") != -1) {
    sendMessageToView(mainWindow_views, "objectDetection", "show_test_succeed");
  }
  if (errorPayload) {
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "show_train_failed",
      errorPayload
    );
  }
  if (data.indexOf("训练错误:") != -1 && !errorPayload) {
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "show_train_failed",
      buildFallbackTrainError(data)
    );
  }
  sendMessageToView(
    mainWindow_views,
    "objectDetection",
    "write_data_to_xterm_yolo",
    data
  );
});

ipcMain.on("stop_process", function (event, arg) {
  let qqname = "python";
  exec(cmd, function (err, stdout, stderr) {
    if (err) {
      return console.log(err);
    }
    let ok = stdout.split("\n");
    ok.some(function (line) {
      let p = line.trim().split(/\s+/),
        pname = p[0],
        pid = p[1];
      if (pname.toLowerCase().indexOf(qqname) >= 0 && parseInt(pid)) {
        try {
          process.kill(pid, "SIGTERM");
        } catch (e) {
          console.log(e);
        }
      }
    });
  });
});

ipcMain.on("update_train_history_list", function (event, arg) {
  const outDir = path.join(process.cwd(), "trainOutput");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  //读取并更新训练记录列表
  fs.readdir("trainOutput", function (err, stats) {
    const flist = new Array();

    for (f of stats) {
      //如果文件夹中有success文件，则代码训练成功并且训练成功
      let checkDir = fs.existsSync("trainOutput/" + f + "/success");
      if (checkDir) {
        op = { name: f, train_result: "success" };
      } else {
        op = { name: f, train_result: "danger" };
      }
      flist.push(op);
    }
    sendMessageToView(
      mainWindow_views,
      "imgCls",
      "update_train_history",
      flist
    );
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "update_train_history",
      flist
    );
  });
});

ipcMain.on("open_dir", function (event, arg) {
  const dirPath = path.join(process.cwd(), "trainOutput", arg);
  // 检查目录是否存在
  fs.access(dirPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error("Directory does not exist:", dirPath);
      return;
    }
    // 使用 exec 打开目录
    exec(`explorer.exe "${dirPath}"`, (error) => {
      if (error) {
        console.error("Error opening directory:", error);
      }
    });
  });
});

ipcMain.on("del_dir", function (event, arg) {
  //收到删除文件夹指令后进行文件夹及其内部所有内容的删除
  delDirRecurse(process.cwd() + "/trainOutput/" + arg);
  //更新删除后的记录列表
  sendMessageToView(
    mainWindow_views,
    "imgCls",
    "show_del_file_succeed",
    process.cwd() + "/trainOutput/" + arg
  );
  sendMessageToView(
    mainWindow_views,
    "objectDetection",
    "show_del_file_succeed",
    process.cwd() + "/trainOutput/" + arg
  );
});

ipcMain.on("clean_file", function (event, dir) {
  //删除dir目录内的所有内容
  delDirContents(dir);
});

ipcMain.on("readimgdir", function (event, arg) {
  //向dataCollect窗口发送读取文件夹指令
  let img_list = read_img_dir(arg);
  sendMessageToView(mainWindow_views, "dataCollect", "readimgdir", img_list);
});

ipcMain.on("update_test_result_cls", function (event, current_tab_dir) {
  //更新测试结果到详情窗口中
  let baseDir = process.cwd();
  let dir = `trainOutput/${current_tab_dir}`;
  let imgList = read_img_dir(`${dir}/test`);
  sendMessageToView(mainWindow_views, "imgCls", "show_test_result_img", {
    dir: `${baseDir}/${dir}/test`,
    list: imgList,
  });
});

ipcMain.on("update_test_result_yolo", function (event, current_tab_dir) {
  //更新测试结果到详情窗口中
  let baseDir = process.cwd();
  let dir = `trainOutput/${current_tab_dir}`;
  let imgList = read_img_dir(`${dir}/test`);
  sendMessageToView(
    mainWindow_views,
    "objectDetection",
    "show_test_result_img",
    { dir: `${baseDir}/${dir}/test`, list: imgList }
  );
});

function read_img_dir(path) {
  let imageList = [];
  getFileList(path).forEach((item) => {
    let ms = image(fs.readFileSync(item.path + "/" + item.filename));
    ms.mimeType && imageList.push(item.filename);
  });
  console.log(imageList);
  return imageList;
}

function getFileList(path) {
  let filesList = [];
  readFileList(path, filesList);
  return filesList;
}

function readFileList(path, filesList) {
  let files = fs.readdirSync(path);
  files.forEach(function (itm, index) {
    let stat = fs.statSync(path + "/" + itm);
    if (stat.isDirectory()) {
      //递归读取文件
      readFileList(path + itm + "/", filesList);
    } else {
      let obj = {}; //定义一个对象存放文件的路径和名字
      obj.path = path; //路径
      obj.filename = itm; //名字
      filesList.push(obj);
    }
  });
}

function set_store_value(name, root) {
  //设定指定本地数据的储存值
  store.set(name, root);
}

function get_store_value(name) {
  //获取指定本地数据的储存值
  return store.get(name);
}

// function read_config() {
//   let config = {
//     save_img: get_store_value("save_img") || "",
//     save_img_name: get_store_value("save_img_name") || "",
//     yolo_img: get_store_value("yolo_img") || "",
//     yolo_xml: get_store_value("yolo_xml") || "",
//     yolo_epoch: get_store_value("yolo_epoch") || 25,
//     yolo_alpha: get_store_value("yolo_alpha") || 0,
//     yolo_batch_size: get_store_value("yolo_batch_size") || 8,
//     yolo_data_aug: get_store_value("yolo_data_aug") || 0,
//     cls_img: get_store_value("cls_img") || "",
//     cls_epoch: get_store_value("cls_epoch") || 25,
//     cls_alpha: get_store_value("cls_alpha") || 0,
//     cls_batch_size: get_store_value("cls_batch_size") || 8,
//     cls_data_aug: get_store_value("cls_data_aug") || 0,
//     test_img_dir_cls: get_store_value("test_img_dir_cls") || "",
//     test_img_dir_yolo: get_store_value("test_img_dir_yolo") || "",
//     current_lang: get_store_value("current_lang") || "zh",
//   };
// }

function read_config() {
  console.log('[CFG] read_config start');

  function safeGet(key, def) {
    // console.log(`[CFG] get "${key}" - start`);
    try {
      const v = get_store_value(key);
      // console.log(`[CFG] get "${key}" - end`);
      return (v === undefined || v === null || v === '') ? def : v;
    } catch (e) {
      console.error(`[CFG] get "${key}" failed:`, e);
      return def;
    }
  }

  config_store = {
    save_img: safeGet("save_img", ""),
    save_img_name: safeGet("save_img_name", ""),
    yolo_img: safeGet("yolo_img", ""),
    yolo_xml: safeGet("yolo_xml", ""),
    yolo_epoch: safeGet("yolo_epoch", 25),
    yolo_alpha: safeGet("yolo_alpha", 0),
    yolo_batch_size: safeGet("yolo_batch_size", 8),
    yolo_data_aug: safeGet("yolo_data_aug", 0),
    cls_img: safeGet("cls_img", ""),
    cls_epoch: safeGet("cls_epoch", 25),
    cls_alpha: safeGet("cls_alpha", 0),
    cls_batch_size: safeGet("cls_batch_size", 8),
    cls_data_aug: safeGet("cls_data_aug", 0),
    cls_input_size: safeGet("cls_input_size", "224x224"),
    test_img_dir_cls: safeGet("test_img_dir_cls", ""),
    test_img_dir_yolo: safeGet("test_img_dir_yolo", ""),
    current_lang: safeGet("current_lang", "zh"),
  };
  console.log('[CFG] config ready');
  return config_store;
}

ipcMain.on("config", function (event, arg) {
  //用本地数据初始化所有页面的参数数值
  console.log('[ipcMain] read: "config"')
  console.log('[CFG] read_config request', arg);
  let result = read_config();
  sendMessageToAllViews(mainWindow_views, "config", result);
});


ipcMain.on("config_save_img_name", function (event, arg) {
  //接收到通信信息后进行拍摄保存图片文的更新
  set_store_value("save_img_name", arg);
});

ipcMain.on("config_save_img", function (event, arg) {
  //接收到通信信息后进行拍摄图片存放目录的文件夹路的更新
  set_store_value("save_img", arg);
});

ipcMain.on("config_cls_img", function (event, arg) {
  set_store_value("cls_img", arg);
});

ipcMain.on("config_yolo_img", function (event, arg) {
  set_store_value("yolo_img", arg);
});

ipcMain.on("config_epoch_cls", function (event, arg) {
  set_store_value("cls_epoch", arg);
});

ipcMain.on("config_yolo_xml", function (event, arg) {
  set_store_value("yolo_xml", arg);
});

ipcMain.on("config_epoch_yolo", function (event, arg) {
  set_store_value("yolo_epoch", arg);
});

ipcMain.on("config_alpha_cls", function (event, arg) {
  set_store_value("cls_alpha", arg);
});

ipcMain.on("config_alpha_yolo", function (event, arg) {
  set_store_value("yolo_alpha", arg);
});

ipcMain.on("config_batch_size_cls", function (event, arg) {
  set_store_value("cls_batch_size", arg);
});

ipcMain.on("config_input_size_cls", function (event, arg) {
  set_store_value("cls_input_size", arg);
});

ipcMain.on("config_batch_size_yolo", function (event, arg) {
  set_store_value("yolo_batch_size", arg);
});

ipcMain.on("config_test_img_dir_cls", function (event, arg) {
  set_store_value("test_img_dir_cls", arg);
});

ipcMain.on("config_test_img_dir_yolo", function (event, arg) {
  set_store_value("test_img_dir_yolo", arg);
});

ipcMain.on("config_data_aug_cls", function (event, arg) {
  set_store_value("cls_data_aug", arg);
});

ipcMain.on("config_data_aug_yolo", function (event, arg) {
  set_store_value("yolo_data_aug", arg);
});

ipcMain.on("read_model_detail_and_show", function (event, arg) {
  //读取并显示当前选择的模型训练详情
  const dir = `trainOutput/${arg}`;
  const modelInfoPath = `${dir}/info.json`;
  const trainLogPath = `${dir}/train_log.log`;
  const baseDir = process.cwd();

  // Helper function to read file and handle errors
  const readFileWithHandling = (path, callback) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading file at ${path}:`, err);
        return;
      }
      callback(data);
    });
  };

  readFileWithHandling(modelInfoPath, (data) => {
    const modelInfo = JSON.parse(data);
    const isClassifier = modelInfo["type"] === "classifier";
    const resultDir = `${dir}/result_root_dir/${isClassifier ? "classifier_result" : "detector_result"
      }`;
    const viewChannel = isClassifier ? "imgCls" : "objectDetection";
    const labelFileName = findFilesWithSubstring(resultDir, "labels.txt");
    // 更新模型信息到详情窗口
    sendMessageToView(mainWindow_views, viewChannel, "update_model_param", [
      data,
    ]);

    const labelsFilePath = `${resultDir}/${labelFileName}`;
    readFileWithHandling(labelsFilePath, (labelData) => {
      sendMessageToView(mainWindow_views, viewChannel, "update_model_labels", [
        labelData,
      ]);
    });

    if (!isClassifier) {
      //如果模型是目标检测，则再读取anchors参数
      const anchorsFileName = findFilesWithSubstring(resultDir, "anchors.txt");
      const anchorsFilePath = `${resultDir}/${anchorsFileName}`;
      readFileWithHandling(anchorsFilePath, (anchorsData) => {
        sendMessageToView(
          mainWindow_views,
          viewChannel,
          "update_model_anchors",
          [anchorsData]
        );
      });
    }

    const trainDataPath = `${resultDir}/train_data.json`;
    readFileWithHandling(trainDataPath, (trainData) => {
      sendMessageToView(
        mainWindow_views,
        viewChannel,
        "update_model_train_graph",
        [trainData]
      );

      if (isClassifier) {
        const confusionMatrixPath = path.join(
          baseDir,
          dir,
          "result_root_dir",
          "classifier_result",
          "confusion_matrix.png"
        );
        sendMessageToView(
          mainWindow_views,
          viewChannel,
          "show_train_graph",
          confusionMatrixPath
        );
      }
    });
    // 更新训练日志到详情窗口
    readFileWithHandling(trainLogPath, (trainLogData) => {
      sendMessageToView(
        mainWindow_views,
        viewChannel,
        "update_model_train_log",
        [trainLogData]
      );
    });
    // 更新测试结果图片到详情窗口
    const imgList = read_img_dir(`${dir}/test`);
    sendMessageToView(mainWindow_views, viewChannel, "show_test_result_img", {
      dir: `${baseDir}/${dir}/test`,
      list: imgList,
    });
  });
});

ipcMain.on("read_model_detail_and_show_err", function (event, arg) {
  //读取并显示当前选择的模型(训练失败的)训练详情
  const dir = `trainOutput/${arg}`;
  const modelInfoPath = `${dir}/info.json`;
  const trainLogPath = `${dir}/train_log.log`;
  // Helper function to read file and handle errors
  const readFileWithHandling = (path, callback) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading file at ${path}:`, err);
        return;
      }
      callback(data);
    });
  };

  readFileWithHandling(modelInfoPath, (data) => {
    const modelInfo = JSON.parse(data);
    const isClassifier = modelInfo["type"] === "classifier";
    const viewChannel = isClassifier ? "imgCls" : "objectDetection";
    // 更新模型信息到详情窗口
    sendMessageToView(mainWindow_views, viewChannel, "update_model_param_err", [
      data,
    ]);

    // 更新训练日志到详情窗口
    readFileWithHandling(trainLogPath, (trainLogData) => {
      sendMessageToView(
        mainWindow_views,
        viewChannel,
        "update_model_train_log_err",
        [trainLogData]
      );
    });
  });
});

ipcMain.on("export_model", function (event, arg) {
  dialog
    .showSaveDialog({
      title: current_locales.choose_export_path,
      defaultPath: arg + "_model.zip",
      filters: [{ name: "zip", extensions: ["zip"] }],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log("Export to:" + result.filePaths);
        if (arg.split("_")[0] == "classifer") {
          file_dir =
            process.cwd() + "/trainOutput/" + arg + "/classifier_result.zip";
          save_dir = result.filePath;
          fs.cp(file_dir, save_dir, (err) => {
            if (err) {
              event.sender.send("show_export_reuslt_failed", err);
            } else {
              event.sender.send("show_export_reuslt_succeed", save_dir);
            }
          });
        } else {
          file_dir =
            process.cwd() + "/trainOutput/" + arg + "/detector_result.zip";
          save_dir = result.filePath;
          fs.cp(file_dir, save_dir, (err) => {
            if (err) {
              event.sender.send("show_export_reuslt_failed", save_dir);
            } else {
              event.sender.send("show_export_reuslt_succeed", save_dir);
            }
          });
        }
      }
    })
    .catch((error) => {
      console.log(error);
    });
});
