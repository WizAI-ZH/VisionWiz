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
const {
  initSerialManager,
  connectPort,
  startK210Preview,
  stopK210Preview,
  getK210PreviewState,
  setK210ImageSyncParams,
  uploadImageSyncProgram,
  uploadK210ModelTestProgram,
} = require("./utils_protected/serialManager_loader");
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
let updateExitInProgress = false;
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

function getAppMetaPayload() {
  return {
    version: getCurrentAppVersion(),
    buildDate: packageJson.buildInfo?.date || new Date().toISOString().slice(0, 10),
    environment: app.isPackaged ? "Prod" : "Dev",
  };
}

function pushLoadingAppMeta() {
  const meta = getAppMetaPayload();
  if (!childWindow || childWindow.isDestroyed()) {
    return;
  }
  childWindow.webContents.send("loading-app-meta", meta);
  const encoded = JSON.stringify(meta).replace(/</g, "\\u003c");
  childWindow.webContents.executeJavaScript(
    `(function(){ if (typeof applyAppMeta === "function") { applyAppMeta(${encoded}); } })();`
  ).catch(() => {});
}

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

  const isInternalUpdateTest = getEnvFlag("VISIONWIZ_UPDATE_TEST");
  updatePromptWindow = new BrowserWindow({
    width: 760,
    height: 660,
    minWidth: 760,
    minHeight: 660,
    parent: isInternalUpdateTest ? null : mainWindow || null,
    modal: !isInternalUpdateTest,
    resizable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: isInternalUpdateTest,
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
      updatePromptWindow.focus();
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

function getReleaseLanguageHeading(line) {
  const text = String(line || "")
    .replace(/^#{0,6}\s*/, "")
    .replace(/[:：]\s*$/, "")
    .trim()
    .toLowerCase();
  if (text === "english" || text === "\u82f1\u6587" || text === "en") {
    return "en";
  }
  if (text === "\u4e2d\u6587" || text === "chinese" || text === "zh") {
    return "zh";
  }
  return "";
}

function collectBilingualReleaseSections(body) {
  const sections = { en: [], zh: [] };
  const seenSections = { en: false, zh: false };
  let currentLanguage = "";
  let hasLanguageHeading = false;

  for (const line of String(body || "").split(/\r?\n/)) {
    const language = getReleaseLanguageHeading(line);
    if (language) {
      hasLanguageHeading = true;
      currentLanguage = seenSections[language] ? "" : language;
      seenSections[language] = true;
      continue;
    }
    if (currentLanguage) {
      sections[currentLanguage].push(line);
    }
  }

  return {
    hasLanguageHeading,
    enBody: sections.en.join("\n").trim(),
    zhBody: sections.zh.join("\n").trim(),
  };
}

function normalizeBilingualReleaseNotes(body) {
  const text = String(body || "").trim();
  if (!text) {
    return "";
  }

  const { hasLanguageHeading, enBody, zhBody } = collectBilingualReleaseSections(text);
  if (hasLanguageHeading && enBody && zhBody) {
    return ["## \u4e2d\u6587", "", zhBody, "", "## English", "", enBody].join("\n").trim();
  }
  return text;
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
  const { hasLanguageHeading, enBody, zhBody } = collectBilingualReleaseSections(body);
  if (hasLanguageHeading && enBody && zhBody) {
    return normalizeBilingualReleaseNotes(body);
  }
  const normalizedBody = normalizeBilingualReleaseNotes(body);

  const lines = normalizedBody.split(/\r?\n/);
  const zhLines = lines.map((line) => {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      return `${heading[1]} ${translateReleaseLineToChinese(heading[2])}`;
    }
    return translateReleaseLineToChinese(line);
  });

  return [
    "## \u4e2d\u6587",
    zhLines.join("\n"),
    "",
    "## English",
    normalizedBody,
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

function getEnvFlag(name) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

function buildTestUpdateRelease() {
  if (!getEnvFlag("VISIONWIZ_UPDATE_TEST")) {
    return null;
  }

  const localInstaller = String(process.env.VISIONWIZ_UPDATE_TEST_INSTALLER || "").trim();
  const downloadUrl = String(process.env.VISIONWIZ_UPDATE_TEST_URL || "").trim();
  const source = localInstaller || downloadUrl;
  if (!source) {
    console.warn("[UPDATE] VISIONWIZ_UPDATE_TEST is enabled but no installer source was provided.");
    return null;
  }

  const latestVersion = normalizeVersion(
    process.env.VISIONWIZ_UPDATE_TEST_VERSION ||
      `${getCurrentAppVersion()}.test`
  );
  const assetName = path.basename(localInstaller || downloadUrl) || `VisionWiz${latestVersion}-Setup.exe`;
  const assetSize = localInstaller ? getFileSizeIfExists(localInstaller) : 0;

  return {
    tag_name: `v${latestVersion}`,
    name: `VisionWiz ${latestVersion} Internal Update Test`,
    draft: false,
    prerelease: false,
    body: [
      "### 中文",
      "- 自动更新内测版本。",
      "- 使用环境变量指定的本地安装包或自定义下载链接。",
      "- 只有设置 VISIONWIZ_UPDATE_TEST=1 时才会显示这个测试更新。",
      "",
      "### English",
      "- Internal automatic update test release.",
      "- Uses a local installer or custom download URL from environment variables.",
      "- This release is only visible when VISIONWIZ_UPDATE_TEST=1 is set.",
    ].join("\n"),
    assets: [
      {
        name: assetName,
        size: assetSize,
        browser_download_url: downloadUrl || localInstaller,
        local_path: localInstaller,
        dry_run: getEnvFlag("VISIONWIZ_UPDATE_TEST_DRY_RUN"),
      },
    ],
  };
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

function ensureUpdateCacheDir() {
  const cacheDir = path.join(app.getPath("userData"), "updates");
  fs.mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

function buildInstallerTempPath(targetVersion) {
  return path.join(
    ensureUpdateCacheDir(),
    `VisionWiz-Setup-${normalizeVersion(targetVersion)}.exe`
  );
}

function getFileSizeIfExists(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  } catch (_error) {
    return 0;
  }
}

function removeFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  } catch (error) {
    console.warn("[UPDATE] failed to remove cached installer:", error.message);
  }
}

function getExpectedInstallerSize(asset) {
  return Number(asset && asset.size ? asset.size : 0);
}

function getCurrentInstallDir() {
  try {
    if (app.isPackaged && process.execPath) {
      return path.dirname(process.execPath);
    }
  } catch (_error) {
    // Fall through to the app directory for development builds.
  }
  return app.getAppPath ? app.getAppPath() : process.cwd();
}

function quotePowerShellString(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function quotePowerShellUtf8(value) {
  const encoded = Buffer.from(String(value || ""), "utf8").toString("base64");
  return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encoded}'))`;
}

function getCurrentLanguageCode() {
  const lang = String(get_store_value("current_lang") || "zh").toLowerCase();
  if (["en", "zh", "zht"].includes(lang)) {
    return lang;
  }
  return "zh";
}

function getUpdateHelperLocale() {
  const bundles = {
    en: {
      title: "VisionWiz Update Installer",
      close: "Close",
      preparing: "Preparing update...",
      preparingLocal: "Preparing local installer...",
      usingCached: "Using cached installer...",
      usingCachedLocal: "Using cached local test installer: ",
      copyingLocal: "Copying local test installer: ",
      copyingLocalStatus: "Copying local installer...",
      installerReady: "Installer is ready.",
      downloadingTo: "Downloading update to: ",
      resumingFrom: "Resuming from: ",
      downloadingActivity: "Downloading VisionWiz update",
      downloadProgress: "Download progress: ",
      sizeMismatch: "Downloaded installer size mismatch: ",
      helperRunning: "VisionWiz update helper is running.",
      targetVersion: "Target version: ",
      waitingStatus: "Waiting for VisionWiz to close...",
      waitingForClose: "Waiting for VisionWiz to close completely, PID: ",
      dryRunStatus: "Dry run complete. Installer launch skipped.",
      dryRunSkipped: "Dry run enabled. Installer launch is skipped.",
      cachedInstallerPath: "Cached installer path: ",
      closeTestWindow: "Press Enter to close this test helper window",
      installingStatus: "Installing update...",
      installingTo: "Installing update to: ",
      silentInstall: "The installer will run silently. Please wait...",
      installerCode: "Installer finished with code ",
      installCompleted: "Installation completed.",
      startingApp: "Starting VisionWiz...",
      updateFailed: "Update failed: ",
      failurePrompt: "Press R to retry/resume, O to open installer folder, or Enter to close",
      uiShown: "Update helper UI shown.",
    },
    zh: {
      title: "VisionWiz 更新安装助手",
      close: "关闭",
      preparing: "正在准备更新...",
      preparingLocal: "正在准备本地安装包...",
      usingCached: "正在使用已缓存的安装包...",
      usingCachedLocal: "正在使用已缓存的本地测试安装包：",
      copyingLocal: "正在复制本地测试安装包：",
      copyingLocalStatus: "正在复制本地安装包...",
      installerReady: "安装包已准备完成。",
      downloadingTo: "正在下载更新到：",
      resumingFrom: "从断点继续下载：",
      downloadingActivity: "正在下载 VisionWiz 更新",
      downloadProgress: "下载进度：",
      sizeMismatch: "下载的安装包大小不匹配：",
      helperRunning: "VisionWiz 更新助手正在运行。",
      targetVersion: "目标版本：",
      waitingStatus: "正在等待 VisionWiz 关闭...",
      waitingForClose: "正在等待 VisionWiz 完全关闭，进程 PID：",
      dryRunStatus: "内测流程完成，已跳过安装器启动。",
      dryRunSkipped: "当前为内测模式，已跳过安装器启动。",
      cachedInstallerPath: "缓存安装包路径：",
      closeTestWindow: "按回车关闭这个测试助手窗口",
      installingStatus: "正在安装更新...",
      installingTo: "正在安装更新到：",
      silentInstall: "安装器将静默运行，请稍候...",
      installerCode: "安装器结束，退出码：",
      installCompleted: "安装完成。",
      startingApp: "正在启动 VisionWiz...",
      updateFailed: "更新失败：",
      failurePrompt: "按 R 重试/继续下载，按 O 打开安装包文件夹，或按回车关闭",
      uiShown: "更新助手窗口已显示。",
    },
    zht: {
      title: "VisionWiz 更新安裝助手",
      close: "關閉",
      preparing: "正在準備更新...",
      preparingLocal: "正在準備本機安裝包...",
      usingCached: "正在使用已快取的安裝包...",
      usingCachedLocal: "正在使用已快取的本機測試安裝包：",
      copyingLocal: "正在複製本機測試安裝包：",
      copyingLocalStatus: "正在複製本機安裝包...",
      installerReady: "安裝包已準備完成。",
      downloadingTo: "正在下載更新到：",
      resumingFrom: "從中斷點繼續下載：",
      downloadingActivity: "正在下載 VisionWiz 更新",
      downloadProgress: "下載進度：",
      sizeMismatch: "下載的安裝包大小不相符：",
      helperRunning: "VisionWiz 更新助手正在執行。",
      targetVersion: "目標版本：",
      waitingStatus: "正在等待 VisionWiz 關閉...",
      waitingForClose: "正在等待 VisionWiz 完全關閉，程序 PID：",
      dryRunStatus: "內測流程完成，已略過安裝器啟動。",
      dryRunSkipped: "目前為內測模式，已略過安裝器啟動。",
      cachedInstallerPath: "快取安裝包路徑：",
      closeTestWindow: "按 Enter 關閉這個測試助手視窗",
      installingStatus: "正在安裝更新...",
      installingTo: "正在安裝更新到：",
      silentInstall: "安裝器將靜默執行，請稍候...",
      installerCode: "安裝器結束，退出碼：",
      installCompleted: "安裝完成。",
      startingApp: "正在啟動 VisionWiz...",
      updateFailed: "更新失敗：",
      failurePrompt: "按 R 重試/繼續下載，按 O 開啟安裝包資料夾，或按 Enter 關閉",
      uiShown: "更新助手視窗已顯示。",
    },
  };
  return bundles[getCurrentLanguageCode()] || bundles.zh;
}

function launchPowerShellHelper(helperPath) {
  const timestamp = Date.now();
  const launcherLogPath = path.join(
    ensureUpdateCacheDir(),
    `VisionWiz-update-launcher-${timestamp}.log`
  );
  const powershellArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
    helperPath,
  ];
  fs.writeFileSync(
    launcherLogPath,
    `[${new Date().toISOString()}] launching helper\r\nhelper=${helperPath}\r\nargs=${powershellArgs.join(" ")}\r\n`,
    "utf8"
  );
  const child = spawn("cmd.exe", [
    "/d",
    "/s",
    "/c",
    "start",
    '""',
    "/min",
    "powershell.exe",
    ...powershellArgs,
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.on("error", (error) => {
    try {
      fs.appendFileSync(launcherLogPath, `error=${error.message}\r\n`, "utf8");
    } catch (_appendError) {
      // Ignore logging failures during shutdown.
    }
  });
  child.unref();
}

function exitAppForUpdate() {
  updateExitInProgress = true;
  closeUpdatePromptWindow();
  closeUpdateProgressWindow();
  setTimeout(() => {
    app.exit(0);
  }, 500);
}

async function downloadReleaseAssetToTemp(asset, targetVersion, options = {}) {
  const shouldResume = Boolean(options.resume);
  const tempInstallerPath = buildInstallerTempPath(targetVersion);
  const expectedBytes = getExpectedInstallerSize(asset);
  let downloadedBytes = getFileSizeIfExists(tempInstallerPath);

  if (!shouldResume && downloadedBytes > 0) {
    removeFileIfExists(tempInstallerPath);
    downloadedBytes = 0;
  }

  if (expectedBytes > 0 && downloadedBytes === expectedBytes) {
    setUpdateProgressState({
      percent: 100,
      statusText:
        current_locales?.update_download_completed ||
        "Download completed",
      speedText: current_locales?.update_cache_ready || "Using cached installer",
      etaText: current_locales?.update_eta_ready || "--",
      transferredText: `${formatByteSize(downloadedBytes)} / ${formatByteSize(expectedBytes)}`,
      isFailed: false,
      canResume: false,
      canRestart: false,
      errorText: "",
    });
    return tempInstallerPath;
  }

  if (expectedBytes > 0 && downloadedBytes > expectedBytes) {
    removeFileIfExists(tempInstallerPath);
    downloadedBytes = 0;
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
    removeFileIfExists(tempInstallerPath);
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

  const finalBytes = getFileSizeIfExists(tempInstallerPath);
  if (expectedBytes > 0 && finalBytes !== expectedBytes) {
    throw new Error(
      `Downloaded installer size mismatch: ${formatByteSize(finalBytes)} / ${formatByteSize(expectedBytes)}`
    );
  }

  return tempInstallerPath;
}

function launchInstallerAndQuit(installerPath) {
  const installerAbsolutePath = path.resolve(installerPath);
  const installDir = path.resolve(getCurrentInstallDir());
  const appExePath = app.isPackaged && process.execPath
    ? path.resolve(process.execPath)
    : path.join(installDir, "VisionWiz.exe");
  const helperPath = path.join(
    ensureUpdateCacheDir(),
    `VisionWiz-update-helper-${Date.now()}.ps1`
  );
  const helperScript = [
    "$Host.UI.RawUI.WindowTitle = 'VisionWiz Update Installer'",
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    `$pidToWait = ${process.pid}`,
    `$installer = ${quotePowerShellString(installerAbsolutePath)}`,
    `$installDir = ${quotePowerShellString(installDir)}`,
    `$appExe = ${quotePowerShellString(appExePath)}`,
    `$helperPath = ${quotePowerShellString(helperPath)}`,
    "Write-Host 'VisionWiz update is ready.'",
    "Write-Host ''",
    "Write-Host ('Waiting for VisionWiz to close completely, PID: ' + $pidToWait)",
    "try { Wait-Process -Id $pidToWait -Timeout 120 } catch { }",
    "Start-Sleep -Seconds 1",
    "Write-Host 'VisionWiz has closed.'",
    "Write-Host ('Installing update to: ' + $installDir)",
    "Write-Host 'The installer will run silently. Please wait...'",
    "Write-Host ''",
    "$arguments = @('/S', ('/D=' + $installDir))",
    "$process = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru",
    "$exitCode = if ($null -eq $process.ExitCode) { 0 } else { $process.ExitCode }",
    "Write-Host ''",
    "if ($exitCode -ne 0) {",
    "  Write-Host ('Installer finished with code ' + $exitCode + '.')",
    "  Write-Host 'If VisionWiz was not updated, please run the downloaded installer manually:'",
    "  Write-Host $installer",
    "  Read-Host 'Press Enter to close this window'",
    "  exit $exitCode",
    "}",
    "Write-Host 'Installation completed.'",
    "if (Test-Path $appExe) {",
    "  Write-Host 'Starting VisionWiz...'",
    "  Start-Process -FilePath $appExe",
    "}",
    "Start-Sleep -Seconds 2",
    "Remove-Item -LiteralPath $helperPath -Force -ErrorAction SilentlyContinue",
    "exit 0",
    "",
  ].join("\r\n");

  try {
    fs.writeFileSync(helperPath, helperScript, "utf8");
    launchPowerShellHelper(helperPath);
  } catch (error) {
    console.error("[UPDATE] update helper launch failed:", error);
    electronShell.openPath(installerAbsolutePath);
  }

  exitAppForUpdate();
}

function launchUpdateHelperAndQuit(release, options = {}) {
  const asset = pickWindowsInstallerAsset(release);
  if (!asset) {
    dialog.showMessageBox(mainWindow, {
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

  const latestVersion = normalizeVersion(release.tag_name || release.name || "");
  const installerPath = buildInstallerTempPath(latestVersion);
  const expectedBytes = getExpectedInstallerSize(asset);
  const localInstallerPath = String(asset.local_path || "").trim();
  const dryRun = Boolean(asset.dry_run || getEnvFlag("VISIONWIZ_UPDATE_TEST_DRY_RUN"));
  const installDir = path.resolve(getCurrentInstallDir());
  const appExePath = app.isPackaged && process.execPath
    ? path.resolve(process.execPath)
    : path.join(installDir, "VisionWiz.exe");
  const helperPath = path.join(
    ensureUpdateCacheDir(),
    `VisionWiz-update-helper-${Date.now()}.ps1`
  );
  const shouldResume = options.resume !== false;
  const helperLocale = getUpdateHelperLocale();
  const helperScript = [
    `$t_title = ${quotePowerShellUtf8(helperLocale.title)}`,
    `$t_close = ${quotePowerShellUtf8(helperLocale.close)}`,
    `$t_preparing = ${quotePowerShellUtf8(helperLocale.preparing)}`,
    `$t_preparingLocal = ${quotePowerShellUtf8(helperLocale.preparingLocal)}`,
    `$t_usingCached = ${quotePowerShellUtf8(helperLocale.usingCached)}`,
    `$t_usingCachedLocal = ${quotePowerShellUtf8(helperLocale.usingCachedLocal)}`,
    `$t_copyingLocal = ${quotePowerShellUtf8(helperLocale.copyingLocal)}`,
    `$t_copyingLocalStatus = ${quotePowerShellUtf8(helperLocale.copyingLocalStatus)}`,
    `$t_installerReady = ${quotePowerShellUtf8(helperLocale.installerReady)}`,
    `$t_downloadingTo = ${quotePowerShellUtf8(helperLocale.downloadingTo)}`,
    `$t_resumingFrom = ${quotePowerShellUtf8(helperLocale.resumingFrom)}`,
    `$t_downloadingActivity = ${quotePowerShellUtf8(helperLocale.downloadingActivity)}`,
    `$t_downloadProgress = ${quotePowerShellUtf8(helperLocale.downloadProgress)}`,
    `$t_sizeMismatch = ${quotePowerShellUtf8(helperLocale.sizeMismatch)}`,
    `$t_helperRunning = ${quotePowerShellUtf8(helperLocale.helperRunning)}`,
    `$t_targetVersion = ${quotePowerShellUtf8(helperLocale.targetVersion)}`,
    `$t_waitingStatus = ${quotePowerShellUtf8(helperLocale.waitingStatus)}`,
    `$t_waitingForClose = ${quotePowerShellUtf8(helperLocale.waitingForClose)}`,
    `$t_dryRunStatus = ${quotePowerShellUtf8(helperLocale.dryRunStatus)}`,
    `$t_dryRunSkipped = ${quotePowerShellUtf8(helperLocale.dryRunSkipped)}`,
    `$t_cachedInstallerPath = ${quotePowerShellUtf8(helperLocale.cachedInstallerPath)}`,
    `$t_closeTestWindow = ${quotePowerShellUtf8(helperLocale.closeTestWindow)}`,
    `$t_installingStatus = ${quotePowerShellUtf8(helperLocale.installingStatus)}`,
    `$t_installingTo = ${quotePowerShellUtf8(helperLocale.installingTo)}`,
    `$t_silentInstall = ${quotePowerShellUtf8(helperLocale.silentInstall)}`,
    `$t_installerCode = ${quotePowerShellUtf8(helperLocale.installerCode)}`,
    `$t_installCompleted = ${quotePowerShellUtf8(helperLocale.installCompleted)}`,
    `$t_startingApp = ${quotePowerShellUtf8(helperLocale.startingApp)}`,
    `$t_updateFailed = ${quotePowerShellUtf8(helperLocale.updateFailed)}`,
    `$t_failurePrompt = ${quotePowerShellUtf8(helperLocale.failurePrompt)}`,
    `$t_uiShown = ${quotePowerShellUtf8(helperLocale.uiShown)}`,
    "$Host.UI.RawUI.WindowTitle = $t_title",
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'Continue'",
    "Add-Type -AssemblyName System.Net.Http",
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    `$pidToWait = ${process.pid}`,
    `$downloadUrl = ${quotePowerShellString(asset.browser_download_url)}`,
    `$localInstaller = ${quotePowerShellString(localInstallerPath)}`,
    `$installer = ${quotePowerShellString(installerPath)}`,
    `$expectedBytes = ${expectedBytes}`,
    `$dryRun = $${dryRun ? "true" : "false"}`,
    `$installDir = ${quotePowerShellString(installDir)}`,
    `$appExe = ${quotePowerShellString(appExePath)}`,
    `$helperPath = ${quotePowerShellString(helperPath)}`,
    `$script:resumeDownload = $${shouldResume ? "true" : "false"}`,
    `$uiLogPath = ${quotePowerShellString(path.join(ensureUpdateCacheDir(), `VisionWiz-update-helper-${Date.now()}.log`))}`,
    "",
    "try {",
    "  Add-Type @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class VisionWizNativeWindow {",
    "  [DllImport(\"kernel32.dll\")] public static extern IntPtr GetConsoleWindow();",
    "  [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);",
    "  [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);",
    "}",
    "'@",
    "  $consoleHandle = [VisionWizNativeWindow]::GetConsoleWindow()",
    "  if ($consoleHandle -ne [IntPtr]::Zero) { [VisionWizNativeWindow]::ShowWindow($consoleHandle, 0) | Out-Null }",
    "} catch { }",
    "",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$script:closeRequested = $false",
    "$form = New-Object System.Windows.Forms.Form",
    "$form.Text = $t_title",
    "$form.StartPosition = 'CenterScreen'",
    "$form.Size = New-Object System.Drawing.Size(640, 430)",
    "$form.MinimumSize = New-Object System.Drawing.Size(560, 380)",
    "$form.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)",
    "$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 9)",
    "$form.ShowInTaskbar = $true",
    "$form.TopMost = $true",
    "$titleLabel = New-Object System.Windows.Forms.Label",
    "$titleLabel.Text = $t_title",
    "$titleLabel.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 16, [System.Drawing.FontStyle]::Bold)",
    "$titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(15, 23, 42)",
    "$titleLabel.Location = New-Object System.Drawing.Point(24, 22)",
    "$titleLabel.Size = New-Object System.Drawing.Size(560, 34)",
    "$form.Controls.Add($titleLabel)",
    "$statusLabel = New-Object System.Windows.Forms.Label",
    "$statusLabel.Text = $t_preparing",
    "$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)",
    "$statusLabel.Location = New-Object System.Drawing.Point(26, 68)",
    "$statusLabel.Size = New-Object System.Drawing.Size(570, 24)",
    "$form.Controls.Add($statusLabel)",
    "$progressBar = New-Object System.Windows.Forms.ProgressBar",
    "$progressBar.Location = New-Object System.Drawing.Point(28, 104)",
    "$progressBar.Size = New-Object System.Drawing.Size(568, 18)",
    "$progressBar.Style = 'Continuous'",
    "$progressBar.Minimum = 0",
    "$progressBar.Maximum = 100",
    "$form.Controls.Add($progressBar)",
    "$logBox = New-Object System.Windows.Forms.TextBox",
    "$logBox.Location = New-Object System.Drawing.Point(28, 144)",
    "$logBox.Size = New-Object System.Drawing.Size(568, 178)",
    "$logBox.Anchor = 'Top,Bottom,Left,Right'",
    "$logBox.Multiline = $true",
    "$logBox.ReadOnly = $true",
    "$logBox.ScrollBars = 'Vertical'",
    "$logBox.BackColor = [System.Drawing.Color]::White",
    "$logBox.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)",
    "$form.Controls.Add($logBox)",
    "$closeButton = New-Object System.Windows.Forms.Button",
    "$closeButton.Text = $t_close",
    "$closeButton.Enabled = $false",
    "$closeButton.Location = New-Object System.Drawing.Point(496, 340)",
    "$closeButton.Size = New-Object System.Drawing.Size(100, 34)",
    "$closeButton.Anchor = 'Bottom,Right'",
    "$closeButton.Add_Click({ $script:closeRequested = $true; $form.Close() })",
    "$form.Controls.Add($closeButton)",
    "$form.Add_FormClosing({ $script:closeRequested = $true })",
    "$form.Show() | Out-Null",
    "$form.Activate()",
    "$form.BringToFront()",
    "try { [VisionWizNativeWindow]::SetForegroundWindow($form.Handle) | Out-Null } catch { }",
    "Start-Sleep -Milliseconds 300",
    "$form.TopMost = $false",
    "[System.Windows.Forms.Application]::DoEvents()",
    "try { Add-Content -LiteralPath $uiLogPath -Value $t_uiShown -Encoding UTF8 } catch { }",
    "function Set-UpdateStatus([string]$message, [int]$percent = -1) {",
    "  if ($statusLabel -and -not $statusLabel.IsDisposed) { $statusLabel.Text = $message }",
    "  if ($percent -ge 0 -and $progressBar -and -not $progressBar.IsDisposed) { $progressBar.Value = [Math]::Max(0, [Math]::Min(100, $percent)) }",
    "  [System.Windows.Forms.Application]::DoEvents()",
    "}",
    "function Write-Host {",
    "  param([Parameter(ValueFromRemainingArguments=$true)] [object[]] $Object)",
    "  $text = ($Object | ForEach-Object { [string]$_ }) -join ' '",
    "  if ($text.Length -eq 0) { $text = '' }",
    "  try { Add-Content -LiteralPath $uiLogPath -Value $text -Encoding UTF8 } catch { }",
    "  if ($logBox -and -not $logBox.IsDisposed) {",
    "    $logBox.AppendText($text + [Environment]::NewLine)",
    "    $logBox.SelectionStart = $logBox.TextLength",
    "    $logBox.ScrollToCaret()",
    "  }",
    "  [System.Windows.Forms.Application]::DoEvents()",
    "}",
    "function Write-Progress {",
    "  param([string]$Activity, [string]$Status, [int]$PercentComplete, [switch]$Completed)",
    "  if ($Completed) { Set-UpdateStatus $Activity 100; return }",
    "  $label = if ($Status) { $Activity + ' - ' + $Status } else { $Activity }",
    "  Set-UpdateStatus $label $PercentComplete",
    "}",
    "function Read-Host {",
    "  param([string]$Prompt)",
    "  Write-Host $Prompt",
    "  Set-UpdateStatus $Prompt",
    "  $closeButton.Enabled = $true",
    "  while (-not $script:closeRequested -and $form.Visible) {",
    "    [System.Windows.Forms.Application]::DoEvents()",
    "    Start-Sleep -Milliseconds 80",
    "  }",
    "  return ''",
    "}",
    "Set-UpdateStatus $t_preparing 3",
    "",
    "function Format-Bytes([double]$bytes) {",
    "  if ($bytes -ge 1GB) { return ('{0:N2} GB' -f ($bytes / 1GB)) }",
    "  if ($bytes -ge 1MB) { return ('{0:N2} MB' -f ($bytes / 1MB)) }",
    "  if ($bytes -ge 1KB) { return ('{0:N2} KB' -f ($bytes / 1KB)) }",
    "  return ('{0:N0} B' -f $bytes)",
    "}",
    "",
    "function Get-Size([string]$path) {",
    "  if (Test-Path -LiteralPath $path) { return (Get-Item -LiteralPath $path).Length }",
    "  return 0",
    "}",
    "",
    "function Download-Installer {",
    "  $parent = Split-Path -Parent $installer",
    "  New-Item -ItemType Directory -Force -Path $parent | Out-Null",
    "  if ($localInstaller -and (Test-Path -LiteralPath $localInstaller)) {",
    "    Set-UpdateStatus $t_preparingLocal 12",
    "    $sourceSize = (Get-Item -LiteralPath $localInstaller).Length",
    "    if ((Test-Path -LiteralPath $installer) -and ((Get-Item -LiteralPath $installer).Length -eq $sourceSize)) {",
    "      Set-UpdateStatus $t_usingCached 100",
    "      Write-Host ($t_usingCachedLocal + $installer)",
    "      return",
    "    }",
    "    Write-Host ($t_copyingLocal + $localInstaller)",
    "    Set-UpdateStatus $t_copyingLocalStatus 30",
    "    Copy-Item -LiteralPath $localInstaller -Destination $installer -Force",
    "    Set-UpdateStatus $t_installerReady 100",
    "    return",
    "  }",
    "  $downloaded = Get-Size $installer",
    "  if (-not $script:resumeDownload -and $downloaded -gt 0) {",
    "    Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue",
    "    $downloaded = 0",
    "  }",
    "  if ($expectedBytes -gt 0 -and $downloaded -eq $expectedBytes) {",
    "    Write-Host ($t_usingCached + ' ' + $installer)",
    "    return",
    "  }",
    "  if ($expectedBytes -gt 0 -and $downloaded -gt $expectedBytes) {",
    "    Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue",
    "    $downloaded = 0",
    "  }",
    "  Write-Host ($t_downloadingTo + $installer)",
    "  $client = [System.Net.Http.HttpClient]::new()",
    "  try {",
    "    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $downloadUrl)",
    "    $request.Headers.UserAgent.ParseAdd('VisionWiz-Updater')",
    "    if ($script:resumeDownload -and $downloaded -gt 0) {",
    "      $request.Headers.Range = [System.Net.Http.Headers.RangeHeaderValue]::new($downloaded, $null)",
    "      Write-Host ($t_resumingFrom + (Format-Bytes $downloaded))",
    "    }",
    "    $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()",
    "    $status = [int]$response.StatusCode",
    "    if ($status -eq 416) {",
    "      Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue",
    "      $downloaded = 0",
    "      $script:resumeDownload = $false",
    "      Download-Installer",
    "      return",
    "    }",
    "    if ($status -ne 200 -and $status -ne 206) { throw ('Download failed with HTTP status ' + $status) }",
    "    $append = $script:resumeDownload -and $downloaded -gt 0 -and $status -eq 206",
    "    if (-not $append -and $downloaded -gt 0) {",
    "      Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue",
    "      $downloaded = 0",
    "    }",
    "    $contentLength = $response.Content.Headers.ContentLength",
    "    $totalBytes = if ($expectedBytes -gt 0) { $expectedBytes } elseif ($contentLength) { $downloaded + [int64]$contentLength } else { 0 }",
    "    $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()",
    "    $mode = if ($append) { [System.IO.FileMode]::Append } else { [System.IO.FileMode]::Create }",
    "    $outputStream = [System.IO.FileStream]::new($installer, $mode, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)",
    "    try {",
    "      $buffer = New-Object byte[] 1048576",
    "      $lastTick = Get-Date",
    "      while (($read = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {",
    "        $outputStream.Write($buffer, 0, $read)",
    "        $downloaded += $read",
    "        $now = Get-Date",
    "        if (($now - $lastTick).TotalMilliseconds -ge 500 -or ($totalBytes -gt 0 -and $downloaded -ge $totalBytes)) {",
    "          $percent = if ($totalBytes -gt 0) { [Math]::Min(100, [Math]::Round(($downloaded / $totalBytes) * 100, 1)) } else { 0 }",
    "          $statusText = if ($totalBytes -gt 0) { ((Format-Bytes $downloaded) + ' / ' + (Format-Bytes $totalBytes)) } else { Format-Bytes $downloaded }",
    "          Write-Progress -Activity $t_downloadingActivity -Status $statusText -PercentComplete $percent",
    "          Write-Host ($t_downloadProgress + $percent + '%  ' + $statusText)",
    "          $lastTick = $now",
    "        }",
    "      }",
    "    } finally {",
    "      $outputStream.Close()",
    "      $inputStream.Close()",
    "    }",
    "  } finally {",
    "    $client.Dispose()",
    "  }",
    "  Write-Progress -Activity $t_downloadingActivity -Completed",
    "  $finalBytes = Get-Size $installer",
    "  if ($expectedBytes -gt 0 -and $finalBytes -ne $expectedBytes) {",
    "    throw ($t_sizeMismatch + (Format-Bytes $finalBytes) + ' / ' + (Format-Bytes $expectedBytes))",
    "  }",
    "}",
    "",
    "while ($true) {",
    "  try {",
    "    Set-UpdateStatus $t_preparing 5",
    "    Write-Host $t_helperRunning",
    "    Write-Host ($t_targetVersion + " + quotePowerShellString(latestVersion) + ")",
    "    Write-Host ''",
    "    Download-Installer",
    "    Write-Host ''",
    "    Set-UpdateStatus $t_waitingStatus 100",
    "    Write-Host ($t_waitingForClose + $pidToWait)",
    "    try { Wait-Process -Id $pidToWait -Timeout 120 } catch { }",
    "    Start-Sleep -Seconds 1",
    "    if ($dryRun) {",
    "      Write-Host ''",
    "      Set-UpdateStatus $t_dryRunStatus 100",
    "      Write-Host $t_dryRunSkipped",
    "      Write-Host ($t_cachedInstallerPath + $installer)",
    "      Read-Host $t_closeTestWindow",
    "      Remove-Item -LiteralPath $helperPath -Force -ErrorAction SilentlyContinue",
    "      exit 0",
    "    }",
    "    Set-UpdateStatus $t_installingStatus 100",
    "    Write-Host ($t_installingTo + $installDir)",
    "    Write-Host $t_silentInstall",
    "    $arguments = @('/S', ('/D=' + $installDir))",
    "    $process = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru",
    "    $exitCode = if ($null -eq $process.ExitCode) { 0 } else { $process.ExitCode }",
    "    if ($exitCode -ne 0) { throw ($t_installerCode + $exitCode) }",
    "    Set-UpdateStatus $t_installCompleted 100",
    "    Write-Host $t_installCompleted",
    "    if (Test-Path $appExe) {",
    "      Write-Host $t_startingApp",
    "      Start-Process -FilePath $appExe",
    "    }",
    "    Start-Sleep -Seconds 2",
    "    Remove-Item -LiteralPath $helperPath -Force -ErrorAction SilentlyContinue",
    "    exit 0",
    "  } catch {",
    "    Write-Host ''",
    "    Write-Host ($t_updateFailed + $_.Exception.Message)",
    "    Write-Host ($t_cachedInstallerPath + $installer)",
    "    $choice = Read-Host $t_failurePrompt",
    "    if ($choice -match '^[Rr]$') { $script:resumeDownload = $true; continue }",
    "    if ($choice -match '^[Oo]$') { explorer.exe /select, $installer; continue }",
    "    exit 1",
    "  }",
    "}",
    "",
  ].join("\r\n");

  try {
    fs.writeFileSync(helperPath, helperScript, "utf8");
    launchPowerShellHelper(helperPath);
  } catch (error) {
    console.error("[UPDATE] update helper launch failed:", error);
    electronShell.openExternal(asset.browser_download_url || MANUAL_UPDATE_URL);
    return;
  }

  exitAppForUpdate();
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
  const expectedBytes = getExpectedInstallerSize(asset);
  const cachedBytes = getFileSizeIfExists(resumePath);
  const hasCompleteCache = expectedBytes > 0 && cachedBytes === expectedBytes;
  const hasPartial = cachedBytes > 0 && !hasCompleteCache;
  setUpdateProgressState({
    currentVersion: getCurrentAppVersion(),
    latestVersion,
    percent: hasCompleteCache ? 100 : 0,
    statusText:
      hasCompleteCache
        ? current_locales?.update_download_completed || "Download completed"
        : current_locales?.update_download_starting ||
          "Preparing the update download...",
    speedText: "--",
    etaText: "--",
    transferredText:
      (hasPartial || hasCompleteCache) && options.resume
        ? `${formatByteSize(cachedBytes)}${
            expectedBytes > 0 ? ` / ${formatByteSize(expectedBytes)}` : " / --"
          }`
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
    setUpdateProgressState({
      statusText:
        current_locales?.update_download_failed_status ||
        "Failed to download the latest installer.",
      speedText: "--",
      etaText: "--",
      isFailed: true,
      canResume: true,
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

  const testRelease = buildTestUpdateRelease();
  if (testRelease) {
    console.log("[UPDATE TEST] internal update prompt requested");
    await promptForUpdate(testRelease);
    return;
  }

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
let allowStartupWindowsToShow = false;
let isStartupRevealComplete = false;



const createWindow = () => {
  childWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"),
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: false,
      contextIsolation: false,
    },
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
    opacity: 0,
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
  mainWindow.setSkipTaskbar(true);
  mainWindow.maximize();
  mainWindow.on("show", () => {
    if (!allowStartupWindowsToShow && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });

  childWindow.loadFile("loading.html");
  childWindow.once("ready-to-show", () => {
    if (childWindow && !childWindow.isDestroyed()) {
      childWindow.show();
      pushLoadingAppMeta();
    }
  });
  childWindow.webContents.on("did-finish-load", () => {
    if (childWindow && !childWindow.isDestroyed()) {
      pushLoadingAppMeta();
    }
  });
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
    const revealMainExperience = () => {
      if (isStartupRevealComplete) {
        return;
      }
      isStartupRevealComplete = true;
      allowStartupWindowsToShow = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSkipTaskbar(false);
        mainWindow.setOpacity(1);
        mainWindow.show();
      }
      createAuthWindow();
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.show();
        authWindow.focus();
      }
    };

    setTimeout(() => {
      if (childWindow && !childWindow.isDestroyed()) {
        childWindow.once("closed", () => {
          childWindow = null;
          setTimeout(revealMainExperience, 60);
        });
        childWindow.close();
      } else {
        revealMainExperience();
      }
    }, 1500);
  });



  // mainWindow.loadFile('mainpage.html')
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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "authpreload.js"),
      backgroundThrottling: false // 防止被后台挂起
    },
  });
  authWindow.on("show", () => {
    if (!allowStartupWindowsToShow && authWindow && !authWindow.isDestroyed()) {
      authWindow.hide();
    }
  });
  authWindow.loadFile("auth.html");
  authWindow.setMenuBarVisibility(false);        // 阻断 Ctrl+W / Alt 键菜单
  // authWindow.openDevTools({ mode: "detach" });

  authWindow.on('close', e => {
    if (updateExitInProgress) {
      return;
    }
    app.quit();
  });

  authWindow.webContents.on('render-process-gone', (_e, details) => { // ★★  
    console.warn('[SEC] auth renderer gone:', details);
    if (updateExitInProgress) {
      return;
    }
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

ipcMain.handle("get-app-meta", () => {
  return getAppMetaPayload();
});

ipcMain.handle("get-current-locales", () => {
  console.log('[MAIN] get-current-locales invoked');
  return current_locales;
});

ipcMain.handle("make-sense-select-export-directory", async () => {
  const result = await dialog.showOpenDialog({
    title: (current_locales && current_locales.choose_save_path) || "Select export folder",
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("make-sense-open-directory", async (_event, directoryPath) => {
  if (!directoryPath) {
    return false;
  }
  await electronShell.openPath(directoryPath);
  return true;
});

ipcMain.handle("make-sense-save-export-file", async (_event, payload = {}) => {
  const fileName = payload.fileName || "labels.zip";
  const result = await dialog.showSaveDialog({
    title: (current_locales && current_locales.choose_save_path) || "Save export file",
    defaultPath: path.join(app.getPath("downloads"), fileName),
  });
  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, Buffer.from(payload.data || []));
  electronShell.showItemInFolder(result.filePath);
  return result.filePath;
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
    launchUpdateHelperAndQuit(activeUpdateRelease, { resume: true });
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
    launchUpdateHelperAndQuit(activeUpdateRelease, { resume: true });
    return;
  }
  if (action === "restart-download" && activeUpdateRelease) {
    launchUpdateHelperAndQuit(activeUpdateRelease, { resume: false });
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
ipcMain.handle("disconnect-port", () => require("./utils_protected/serialManager_loader").disconnectPort());
ipcMain.handle("start-k210-preview", () => startK210Preview());
ipcMain.handle("stop-k210-preview", () => stopK210Preview());
ipcMain.handle("get-k210-preview-state", () => getK210PreviewState());
ipcMain.handle("set-k210-image-sync-params", (_event, options) => setK210ImageSyncParams(options));
ipcMain.handle("upload-k210-image-sync-program", (_event, options) => uploadImageSyncProgram(options));
ipcMain.handle("upload-k210-model-test-program", (_event, options) => uploadK210ModelTestProgram(options));

function afterAuthSuccess() {
  if (authWindow) {
    authWindow.webContents.send("auth-success", "");
    setTimeout(() => {
      authWindow.hide();
    }, 1000);
  }
  if (mainWindow) mainWindow.setEnabled(true);
  sendMessageToView(mainWindow_views, "dataCollect", "k210-preview-status", {
    authenticated: true,
    previewActive: false,
    error: "",
  });
  if (!hasCheckedForUpdates) {
    setTimeout(() => {
      checkForUpdatesOnce().catch((error) => {
        console.warn("[UPDATE] check failed silently:", error.message);
      });
    }, 1800);
  }
}

function scheduleInternalUpdateTestPrompt() {
  if (!getEnvFlag("VISIONWIZ_UPDATE_TEST")) {
    return;
  }
  console.log("[UPDATE TEST] scheduling internal update prompt");
  setTimeout(() => {
    checkForUpdatesOnce().catch((error) => {
      console.warn("[UPDATE TEST] check failed:", error.message);
    });
  }, 2600);
}

// 这段程序将会在 Electron 结束初始化
// 和创建浏览器窗口的时候调用
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(async () => {
  await bootstrap();
  createWindow();
  scheduleInternalUpdateTestPrompt();
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
  if (updateExitInProgress) {
    return;
  }
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
  sendMessageToView(mainWindow_views, "dataCollect", "k210-preview-error", {
    error: arg.error,
    authenticated: false,
    previewActive: false,
  });
})
ipcMain.on("disconnected", () => {
  if (mainWindow) mainWindow.setEnabled(false);
  if (authWindow) {
    authWindow.webContents.send("disconnected");
    authWindow.show();
    authWindow.focus();
  }
  sendMessageToView(mainWindow_views, "dataCollect", "k210-preview-status", {
    authenticated: false,
    previewActive: false,
    error: "",
  });
});

ipcMain.on("k210-preview-frame-internal", (eventOrPayload, payloadMaybe) => {
  const payload = payloadMaybe || eventOrPayload;
  const view = mainWindow_views?.dataCollect;
  if (payload && view?.webContents && !view.webContents.isDestroyed()) {
    sendMessageToView(mainWindow_views, "dataCollect", "k210-preview-frame", payload);
  } else {
    console.warn("[K210 PREVIEW] dataCollect view unavailable for frame event");
  }
});

ipcMain.on("k210-preview-status-internal", (eventOrPayload, payloadMaybe) => {
  const payload = payloadMaybe || eventOrPayload;
  const view = mainWindow_views?.dataCollect;
  if (payload && view?.webContents && !view.webContents.isDestroyed()) {
    sendMessageToView(mainWindow_views, "dataCollect", "k210-preview-status", payload);
  } else {
    console.warn("[K210 PREVIEW] dataCollect view unavailable for status event");
  }
  for (const viewName of ["imgCls", "objectDetection"]) {
    const trainView = mainWindow_views?.[viewName];
    if (payload && trainView?.webContents && !trainView.webContents.isDestroyed()) {
      sendMessageToView(mainWindow_views, viewName, "k210-preview-status", payload);
    }
  }
});

ipcMain.on("k210-preview-error-internal", (eventOrPayload, payloadMaybe) => {
  const payload = payloadMaybe || eventOrPayload;
  const view = mainWindow_views?.dataCollect;
  if (payload && view?.webContents && !view.webContents.isDestroyed()) {
    sendMessageToView(mainWindow_views, "dataCollect", "k210-preview-error", payload);
  } else {
    console.warn("[K210 PREVIEW] dataCollect view unavailable for error event");
  }
});

ipcMain.on("k210-image-sync-upload-progress-internal", (eventOrPayload, payloadMaybe) => {
  const payload = payloadMaybe || eventOrPayload;
  const view = mainWindow_views?.dataCollect;
  if (payload && view?.webContents && !view.webContents.isDestroyed()) {
    sendMessageToView(mainWindow_views, "dataCollect", "k210-image-sync-upload-progress", payload);
  } else {
    console.warn("[K210 IMAGE SYNC] dataCollect view unavailable for upload progress event");
  }
});

//使用系统默认图片查看器打开图片
ipcMain.on("k210-model-test-upload-progress-internal", (eventOrPayload, payloadMaybe) => {
  const payload = payloadMaybe || eventOrPayload;
  for (const viewName of ["imgCls", "objectDetection"]) {
    const view = mainWindow_views?.[viewName];
    if (payload && view?.webContents && !view.webContents.isDestroyed()) {
      sendMessageToView(mainWindow_views, viewName, "k210-model-test-upload-progress", payload);
    }
  }
});

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
  cols: 120,
  rows: 20,
  cwd: process.env.PWD,
  env: process.env,
});

const ptyProcess_cls = pty.spawn(shell, [], {
  name: "xterm_cls",
  cols: 120,
  rows: 20,
  cwd: process.env.PWD,
  env: process.env,
});

const TRAIN_ERROR_PREFIX = "VW_TRAIN_ERROR::";
const trainStreamState = {
  imgCls: { buffer: "", lastError: null, trainSuccessNotified: false, trainFailureNotified: false, testSuccessNotified: false },
  objectDetection: { buffer: "", lastError: null, trainSuccessNotified: false, trainFailureNotified: false, testSuccessNotified: false },
};
const TRAIN_TRANSCRIPT_MAX_BUFFER = 2 * 1024 * 1024;
const trainTranscriptState = {
  imgCls: { active: false, pending: "", logPath: "", currentEpoch: 0, totalEpochs: 0 },
  objectDetection: { active: false, pending: "", logPath: "", currentEpoch: 0, totalEpochs: 0 },
};

function isTrainCommand(command) {
  const text = String(command || "");
  return /train\.py/i.test(text) && /\btrain\s*$/i.test(text.trim());
}

function trimTranscriptPending(state) {
  if (state.pending.length > TRAIN_TRANSCRIPT_MAX_BUFFER) {
    state.pending = state.pending.slice(-TRAIN_TRANSCRIPT_MAX_BUFFER);
  }
}

function resolveTrainTranscriptPath(text) {
  const match = String(text || "").match(/(?:\(Train info\)|Train info):\s*(.+?info\.json)/);
  if (!match) {
    return "";
  }
  return path.join(path.dirname(path.normalize(match[1].trim())), "terminal_output.log");
}

function parseEpochCountFromCommand(command) {
  const match = String(command || "").match(/(?:^|\s)-(?:ep|epochs?)\s+(\d+)/i);
  return match ? Number(match[1]) || 0 : 0;
}

function updateTranscriptEpochState(state, line) {
  const startMatch = String(line || "").match(/Epoch\s+(\d+)\s+start/i);
  if (startMatch) {
    state.currentEpoch = (Number(startMatch[1]) || 0) + 1;
  }
}

function formatCompactKerasProgressLine(state, line) {
  const match = String(line || "").match(/^\s*(\d+)\/(\d+)\s+(\[[=>.]+\]\s+-\s+.*)$/);
  if (!match) {
    return null;
  }

  const currentStep = Number(match[1]) || 0;
  const totalSteps = Number(match[2]) || 0;
  if (!totalSteps || currentStep < totalSteps) {
    return "";
  }

  if (state && state.currentEpoch && state.totalEpochs) {
    return `${state.currentEpoch}/${state.totalEpochs} epoch ${match[3]}`;
  }
  return line.trim();
}

function normalizeTrainTranscriptText(data, state = {}) {
  let text = String(data || "");
  text = text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b[()][A-Za-z0-9]/g, "")
    .replace(/\x1bc/g, "");

  const lines = [];
  let current = "";
  for (const char of text) {
    if (char === "\r") {
      if (current.trim()) {
        lines.push(current.replace(/[ \t]+$/g, ""));
      }
      current = "";
      continue;
    }
    if (char === "\n") {
      lines.push(current.replace(/[ \t]+$/g, ""));
      current = "";
      continue;
    }
    if (char >= " " || char === "\t") {
      current += char;
    }
  }
  if (current.trim()) {
    lines.push(current.replace(/[ \t]+$/g, ""));
  }

  const normalizedLines = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.toLowerCase() === "cls") {
      continue;
    }
    updateTranscriptEpochState(state, trimmedLine);
    const compactProgressLine = formatCompactKerasProgressLine(state, trimmedLine);
    if (compactProgressLine === "") {
      continue;
    }
    normalizedLines.push(compactProgressLine || line);
  }

  return normalizedLines.join("\n").replace(/\n{3,}/g, "\n\n") +
    (normalizedLines.length ? "\n" : "");
}

function normalizeStoredTrainLogForDisplay(data) {
  const text = String(data || "");
  const state = {
    currentEpoch: 0,
    totalEpochs: parseEpochCountFromCommand(text.split(/\r?\n/, 1)[0] || ""),
  };
  return normalizeTrainTranscriptText(text, state);
}

function startTrainTranscript(channel, command) {
  const state = trainTranscriptState[channel];
  if (!state) {
    return;
  }
  state.active = true;
  state.pending = `$ ${String(command || "").replace(/\r?\n$/, "")}\n`;
  state.logPath = "";
  state.currentEpoch = 0;
  state.totalEpochs = parseEpochCountFromCommand(command);
  trimTranscriptPending(state);
}

function appendTrainTranscript(channel, data) {
  const state = trainTranscriptState[channel];
  if (!state || !state.active) {
    return;
  }

  const text = normalizeTrainTranscriptText(data, state);
  if (!text) {
    return;
  }
  if (!state.logPath) {
    state.logPath = resolveTrainTranscriptPath(text);
    if (state.logPath) {
      try {
        fs.mkdirSync(path.dirname(state.logPath), { recursive: true });
        fs.writeFileSync(state.logPath, state.pending, "utf8");
        state.pending = "";
      } catch (error) {
        console.warn("[TRAIN] failed to initialize terminal transcript:", error);
        state.logPath = "";
      }
    }
  }

  if (state.logPath) {
    try {
      fs.appendFileSync(state.logPath, text, "utf8");
    } catch (error) {
      console.warn("[TRAIN] failed to append terminal transcript:", error);
    }
  } else {
    state.pending += text;
    trimTranscriptPending(state);
  }

  if (
    text.includes("Training and testing success") ||
    text.includes(TRAIN_ERROR_PREFIX) ||
    text.includes("训练错误:") ||
    text.includes("Train error:")
  ) {
    state.active = false;
  }
}

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
  trainStreamState[channel].trainSuccessNotified = false;
  trainStreamState[channel].trainFailureNotified = false;
  trainStreamState[channel].testSuccessNotified = false;
}

function getTrainStreamError(channel) {
  return trainStreamState[channel] ? trainStreamState[channel].lastError : null;
}

function shouldNotifyTrainEvent(channel, eventName) {
  const state = trainStreamState[channel];
  if (!state) {
    return false;
  }
  if (state[eventName]) {
    return false;
  }
  state[eventName] = true;
  return true;
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
  if (isTrainCommand(arg)) {
    resetTrainStream("objectDetection");
    startTrainTranscript("objectDetection", arg);
  }
  ptyProcess_yolo.write(arg);
});

ipcMain.on("send_data_terminal_cls", function (event, arg) {
  //输入信息到图像分类控制台中
  resetTrainStream("imgCls");
  if (isTrainCommand(arg)) {
    resetTrainStream("imgCls");
    startTrainTranscript("imgCls", arg);
  }
  ptyProcess_cls.write(arg);
});

function resizePtyProcess(ptyProcess, size) {
  if (!ptyProcess || typeof ptyProcess.resize !== "function") {
    return;
  }
  const cols = Math.max(80, Math.min(300, Number(size && size.cols) || 120));
  const rows = Math.max(10, Math.min(80, Number(size && size.rows) || 20));
  try {
    ptyProcess.resize(cols, rows);
  } catch (error) {
    console.warn("[PTY] resize failed:", error);
  }
}

ipcMain.on("resize_terminal_yolo", function (event, size) {
  resizePtyProcess(ptyProcess_yolo, size);
});

ipcMain.on("resize_terminal_cls", function (event, size) {
  resizePtyProcess(ptyProcess_cls, size);
});

ptyProcess_cls.onData((data) => {
  appendTrainTranscript("imgCls", data);
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
  if (
    data.indexOf("Training and testing success") != -1 &&
    shouldNotifyTrainEvent("imgCls", "trainSuccessNotified")
  ) {
    sendMessageToView(mainWindow_views, "imgCls", "show_train_succeed");
  }
  if (
    data.indexOf("Test succeed!") != -1 &&
    shouldNotifyTrainEvent("imgCls", "testSuccessNotified")
  ) {
    sendMessageToView(mainWindow_views, "imgCls", "show_test_succeed");
  }
  if (errorPayload && shouldNotifyTrainEvent("imgCls", "trainFailureNotified")) {
    sendMessageToView(mainWindow_views, "imgCls", "show_train_failed", errorPayload);
  }
  if (
    data.indexOf("训练错误:") != -1 &&
    !errorPayload &&
    shouldNotifyTrainEvent("imgCls", "trainFailureNotified")
  ) {
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
  appendTrainTranscript("objectDetection", data);
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
  if (
    data.indexOf("Training and testing success") != -1 &&
    shouldNotifyTrainEvent("objectDetection", "trainSuccessNotified")
  ) {
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "show_train_succeed"
    );
  }
  if (
    data.indexOf("Test succeed!") != -1 &&
    shouldNotifyTrainEvent("objectDetection", "testSuccessNotified")
  ) {
    sendMessageToView(mainWindow_views, "objectDetection", "show_test_succeed");
  }
  if (errorPayload && shouldNotifyTrainEvent("objectDetection", "trainFailureNotified")) {
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "show_train_failed",
      errorPayload
    );
  }
  if (
    data.indexOf("训练错误:") != -1 &&
    !errorPayload &&
    shouldNotifyTrainEvent("objectDetection", "trainFailureNotified")
  ) {
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

function getTrainRunDir(runName) {
  return path.join(process.cwd(), "trainOutput", path.basename(String(runName || "")));
}

function getTrainDisplayName(runName) {
  const metaPath = path.join(getTrainRunDir(runName), "display_name.json");
  try {
    if (!fs.existsSync(metaPath)) return "";
    const data = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return String(data.displayName || "").trim();
  } catch (error) {
    console.warn("[TRAIN HISTORY] read display name failed:", runName, error.message);
    return "";
  }
}

ipcMain.handle("rename-train-history", async (_event, payload = {}) => {
  const runName = path.basename(String(payload.dir || ""));
  const displayName = String(payload.displayName || "").trim();
  if (!runName || !displayName) {
    throw new Error("Invalid training record name.");
  }
  const runDir = getTrainRunDir(runName);
  if (!fs.existsSync(runDir)) {
    throw new Error("Training record does not exist.");
  }
  fs.writeFileSync(
    path.join(runDir, "display_name.json"),
    JSON.stringify({ displayName, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
  return { ok: true, dir: runName, displayName };
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
        op = { name: f, displayName: getTrainDisplayName(f), train_result: "success" };
      } else {
        op = { name: f, displayName: getTrainDisplayName(f), train_result: "danger" };
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

ipcMain.on("open-path", function (_event, targetPath) {
  const normalizedPath = path.normalize(String(targetPath || ""));
  if (!normalizedPath) {
    return;
  }
  fs.access(normalizedPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error("Path does not exist:", normalizedPath);
      return;
    }
    exec(`explorer.exe "${normalizedPath}"`, (error) => {
      if (error) {
        console.error("Error opening path:", error);
      }
    });
  });
});

function isSupportedImageFile(filePath) {
  return IMAGE_FILE_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

function getCaptureTrashDir(filePath) {
  return path.join(path.dirname(filePath), ".visionwiz_capture_trash");
}

function buildCaptureTrashPath(filePath) {
  const trashDir = getCaptureTrashDir(filePath);
  fs.mkdirSync(trashDir, { recursive: true });
  return path.join(trashDir, `${Date.now()}_${path.basename(filePath)}`);
}

function moveCaptureFile(sourcePath, targetPath) {
  if (!isSupportedImageFile(sourcePath) || !isSupportedImageFile(targetPath)) {
    throw new Error("Unsupported image file.");
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    throw new Error("Target image already exists.");
  }
  fs.renameSync(sourcePath, targetPath);
}

function buildCaptureRenameTarget(sourcePath, rawName) {
  const sourceExt = path.extname(sourcePath);
  const trimmedName = String(rawName || "").trim();
  if (!trimmedName) {
    throw new Error("Invalid image name.");
  }
  const sanitizedName = path.basename(trimmedName);
  if (sanitizedName !== trimmedName || sanitizedName === "." || sanitizedName === "..") {
    throw new Error("Invalid image name.");
  }
  const targetName = path.extname(sanitizedName) ? sanitizedName : `${sanitizedName}${sourceExt}`;
  if (!isSupportedImageFile(targetName)) {
    throw new Error("Unsupported image file extension.");
  }
  return {
    targetName,
    targetPath: path.join(path.dirname(sourcePath), targetName),
  };
}

ipcMain.handle("capture-images-delete", async (_event, payload = {}) => {
  const targetPaths = Array.isArray(payload.paths) ? payload.paths : [];
  const entries = [];
  for (const targetPath of targetPaths) {
    const resolvedPath = path.resolve(String(targetPath || ""));
    if (!isSupportedImageFile(resolvedPath)) {
      continue;
    }
    try {
      const stat = fs.statSync(resolvedPath);
      if (!stat.isFile()) {
        continue;
      }
      const trashPath = buildCaptureTrashPath(resolvedPath);
      fs.renameSync(resolvedPath, trashPath);
      entries.push({
        originalPath: resolvedPath,
        trashPath,
      });
    } catch (error) {
      console.warn("[IMG] delete image failed:", resolvedPath, error.message);
    }
  }
  return {
    deleted: entries.length,
    operation: {
      type: "delete",
      entries,
    },
  };
});

ipcMain.handle("capture-image-rename", async (_event, payload = {}) => {
  const sourcePath = path.resolve(String(payload.path || ""));
  if (!isSupportedImageFile(sourcePath)) {
    throw new Error("Unsupported image file.");
  }
  const { targetName, targetPath } = buildCaptureRenameTarget(sourcePath, payload.newName);
  if (path.resolve(targetPath) === sourcePath) {
    return { path: sourcePath };
  }
  if (fs.existsSync(targetPath)) {
    throw new Error("A file with this name already exists.");
  }
  fs.renameSync(sourcePath, targetPath);
  return {
    path: targetPath,
    name: targetName,
    operation: {
      type: "rename",
      oldPath: sourcePath,
      newPath: targetPath,
    },
  };
});

ipcMain.handle("capture-images-rename", async (_event, payload = {}) => {
  const sourcePaths = Array.isArray(payload.paths)
    ? payload.paths.map((item) => path.resolve(String(item || ""))).filter(Boolean)
    : [];
  const baseName = String(payload.baseName || "").trim();
  if (!sourcePaths.length || !baseName) {
    throw new Error("Invalid image name.");
  }

  const renamePlan = sourcePaths.map((sourcePath, index) => {
    if (!isSupportedImageFile(sourcePath)) {
      throw new Error("Unsupported image file.");
    }
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile()) {
      throw new Error("Invalid image file.");
    }
    const indexedName = sourcePaths.length === 1 ? baseName : `${baseName}(${index + 1})`;
    const { targetName, targetPath } = buildCaptureRenameTarget(sourcePath, indexedName);
    return {
      oldPath: sourcePath,
      newPath: path.resolve(targetPath),
      name: targetName,
    };
  });

  const targetSet = new Set();
  for (const item of renamePlan) {
    if (item.oldPath === item.newPath) {
      continue;
    }
    if (targetSet.has(item.newPath)) {
      throw new Error("Duplicate target image name.");
    }
    targetSet.add(item.newPath);
    const occupyingEntry = renamePlan.find((entry) => entry.oldPath === item.newPath);
    if (fs.existsSync(item.newPath) && (!occupyingEntry || occupyingEntry.oldPath === occupyingEntry.newPath)) {
      throw new Error("A file with this name already exists.");
    }
  }

  const entries = [];
  const tempEntries = [];
  try {
    for (const item of renamePlan) {
      if (item.oldPath === item.newPath) {
        continue;
      }
      const tempPath = path.join(path.dirname(item.oldPath), `.visionwiz_rename_${Date.now()}_${Math.random().toString(16).slice(2)}${path.extname(item.oldPath)}`);
      fs.renameSync(item.oldPath, tempPath);
      tempEntries.push({ ...item, tempPath });
    }
    for (const item of tempEntries) {
      fs.renameSync(item.tempPath, item.newPath);
      entries.push({
        oldPath: item.oldPath,
        newPath: item.newPath,
        name: item.name,
      });
    }
  } catch (error) {
    for (const item of tempEntries.reverse()) {
      if (fs.existsSync(item.tempPath) && !fs.existsSync(item.oldPath)) {
        try {
          fs.renameSync(item.tempPath, item.oldPath);
        } catch (rollbackError) {
          console.warn("[IMG] rollback rename failed:", rollbackError.message);
        }
      }
    }
    throw error;
  }

  return {
    renamed: entries.length,
    entries,
    operation: {
      type: "rename",
      entries,
    },
  };
});

ipcMain.handle("capture-images-undo", async (_event, operation = {}) => {
  if (operation.type === "delete") {
    const entries = Array.isArray(operation.entries) ? operation.entries : [];
    for (const entry of entries) {
      moveCaptureFile(path.resolve(entry.trashPath), path.resolve(entry.originalPath));
    }
    return { ok: true };
  }
  if (operation.type === "rename") {
    const entries = Array.isArray(operation.entries) ? operation.entries : [operation];
    for (const entry of entries.slice().reverse()) {
      moveCaptureFile(path.resolve(entry.newPath), path.resolve(entry.oldPath));
    }
    return { ok: true };
  }
  throw new Error("Unsupported undo operation.");
});

ipcMain.handle("capture-images-redo", async (_event, operation = {}) => {
  if (operation.type === "delete") {
    const entries = Array.isArray(operation.entries) ? operation.entries : [];
    for (const entry of entries) {
      moveCaptureFile(path.resolve(entry.originalPath), path.resolve(entry.trashPath));
    }
    return { ok: true };
  }
  if (operation.type === "rename") {
    const entries = Array.isArray(operation.entries) ? operation.entries : [operation];
    for (const entry of entries) {
      moveCaptureFile(path.resolve(entry.oldPath), path.resolve(entry.newPath));
    }
    return { ok: true };
  }
  throw new Error("Unsupported redo operation.");
});

ipcMain.handle("capture-image-show-in-folder", async (_event, targetPath) => {
  const resolvedPath = path.resolve(String(targetPath || ""));
  if (!isSupportedImageFile(resolvedPath) || !fs.existsSync(resolvedPath)) {
    return false;
  }
  electronShell.showItemInFolder(resolvedPath);
  return true;
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
  let img_list = read_img_dir_detail(arg);
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

const IMAGE_FILE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".bmp",
  ".gif",
  ".webp",
]);

function read_img_dir(path) {
  let imageList = [];
  getFileList(path).forEach((item) => {
    try {
      let ms = image(fs.readFileSync(item.fullPath));
      ms.mimeType && imageList.push(item.filename);
    } catch (error) {
      console.warn("[IMG] skip unreadable image:", item.fullPath, error.message);
    }
  });
  console.log(imageList);
  return imageList;
}

function read_img_dir_detail(dirPath) {
  let imageList = [];
  getFileList(dirPath).forEach((item) => {
    try {
      let ms = image(fs.readFileSync(item.fullPath));
      if (!ms.mimeType) return;
      const stat = fs.statSync(item.fullPath);
      imageList.push({
        filename: item.filename,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        ext: path.extname(item.filename).toLowerCase(),
      });
    } catch (error) {
      console.warn("[IMG] skip unreadable image:", item.fullPath, error.message);
    }
  });
  console.log(imageList);
  return imageList;
}

function getFileList(dirPath) {
  let filesList = [];
  readFileList(dirPath, filesList);
  return filesList;
}

function readFileList(dirPath, filesList) {
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    console.warn("[IMG] read image directory failed:", dirPath, error.message);
    return;
  }

  entries.forEach(function (entry) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      console.warn("[IMG] skip sub directory in image list:", fullPath);
      return;
    }
    if (!entry.isFile()) {
      console.warn("[IMG] skip non-file entry in image list:", fullPath);
      return;
    }
    if (!IMAGE_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      console.warn("[IMG] skip non-image file in image list:", fullPath);
      return;
    }
    filesList.push({
      path: dirPath,
      fullPath,
      filename: entry.name,
    });
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
    yolo_input_size: safeGet("yolo_input_size", "224x224"),
    cls_img: safeGet("cls_img", ""),
    cls_epoch: safeGet("cls_epoch", 25),
    cls_alpha: safeGet("cls_alpha", 0),
    cls_batch_size: safeGet("cls_batch_size", 8),
    cls_data_aug: safeGet("cls_data_aug", 0),
    cls_input_size: safeGet("cls_input_size", "224x224"),
    burst_mode: safeGet("burst_mode", false),
    burst_count: safeGet("burst_count", 10),
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

ipcMain.on("config_input_size_yolo", function (event, arg) {
  set_store_value("yolo_input_size", arg);
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

ipcMain.on("config_burst_mode", function (event, arg) {
  set_store_value("burst_mode", !!arg);
});

ipcMain.on("config_burst_count", function (event, arg) {
  set_store_value("burst_count", Math.max(1, parseInt(arg, 10) || 10));
});

ipcMain.on("read_model_detail_and_show", function (event, arg) {
  //读取并显示当前选择的模型训练详情
  const dir = `trainOutput/${arg}`;
  const modelInfoPath = `${dir}/info.json`;
  const trainLogPath = fs.existsSync(`${dir}/terminal_output.log`)
    ? `${dir}/terminal_output.log`
    : `${dir}/train_log.log`;
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
        [normalizeStoredTrainLogForDisplay(trainLogData)]
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
  const trainLogPath = fs.existsSync(`${dir}/terminal_output.log`)
    ? `${dir}/terminal_output.log`
    : `${dir}/train_log.log`;
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
        [normalizeStoredTrainLogForDisplay(trainLogData)]
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
