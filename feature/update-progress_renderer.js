const { ipcRenderer } = require("electron");

let current_locales = {};

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setProgress(percent) {
  const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
  const progressBar = document.getElementById("update_progress_bar");
  if (progressBar) {
    progressBar.style.width = `${normalized}%`;
  }
  setText("update_progress_text", `${normalized.toFixed(0)}%`);
}

function applyLocaleTexts() {
  setText(
    "update_title",
    current_locales.update_downloading_title || "Downloading update"
  );
  setText(
    "update_summary",
    current_locales.update_downloading_summary ||
      "Please keep VisionWiz open while the new version is being prepared."
  );
  setText(
    "current_version_label",
    current_locales.update_current_version_label || "Current version"
  );
  setText(
    "latest_version_label",
    current_locales.update_latest_version_label || "Latest version"
  );
}

function applyState(payload) {
  if (!payload) {
    return;
  }
  if (payload.currentVersion) {
    setText("current_version_value", payload.currentVersion);
  }
  if (payload.latestVersion) {
    setText("latest_version_value", payload.latestVersion);
  }
  if (payload.statusText) {
    setText("update_status", payload.statusText);
  }
  if (payload.speedText) {
    setText("update_speed_text", payload.speedText);
  }
  if (payload.percent !== undefined) {
    setProgress(payload.percent);
  }
}

async function init() {
  try {
    current_locales = (await ipcRenderer.invoke("get-current-locales")) || {};
  } catch (error) {
    console.error("Failed to load locales for update window:", error);
  }

  applyLocaleTexts();

  try {
    const initialState = await ipcRenderer.invoke("get-update-progress-state");
    applyState(initialState);
  } catch (error) {
    console.error("Failed to load initial update state:", error);
  }
}

ipcRenderer.on("update-progress-state", (_event, payload) => {
  applyState(payload);
});

init();
