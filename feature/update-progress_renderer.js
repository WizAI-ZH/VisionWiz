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
  setText(
    "update_speed_label",
    current_locales.update_speed_label || "Download speed"
  );
  setText(
    "update_eta_label",
    current_locales.update_eta_label || "Estimated time remaining"
  );
  setText(
    "update_stage_label",
    current_locales.update_stage_label || "Current stage"
  );
  setText(
    "resume_button",
    current_locales.update_resume_button || "Resume"
  );
  setText(
    "restart_button",
    current_locales.update_restart_button || "Restart Download"
  );
  setText(
    "manual_button",
    current_locales.update_manual_button || "Manual Download"
  );
  setText(
    "close_button",
    current_locales.update_close_button || "Close"
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
  if (payload.etaText !== undefined) {
    setText("update_eta_text", payload.etaText || "--");
  }
  if (payload.transferredText !== undefined) {
    setText("update_transfer_text", payload.transferredText || "--");
  }
  setText(
    "update_stage_text",
    payload.isFailed
      ? current_locales.update_stage_failed || "Failed"
      : payload.percent >= 100
        ? current_locales.update_stage_installing || "Installing"
        : current_locales.update_stage_downloading || "Downloading"
  );
  const errorPanel = document.getElementById("update_error_panel");
  if (errorPanel) {
    if (payload.errorText) {
      errorPanel.textContent = payload.errorText;
      errorPanel.classList.add("show");
    } else {
      errorPanel.textContent = "";
      errorPanel.classList.remove("show");
    }
  }
  const resumeButton = document.getElementById("resume_button");
  if (resumeButton) {
    resumeButton.hidden = !payload.canResume;
  }
  const restartButton = document.getElementById("restart_button");
  if (restartButton) {
    restartButton.hidden = !payload.canRestart;
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

document.getElementById("resume_button").addEventListener("click", () => {
  ipcRenderer.send("update-window-action", { action: "resume-download" });
});

document.getElementById("restart_button").addEventListener("click", () => {
  ipcRenderer.send("update-window-action", { action: "restart-download" });
});

document.getElementById("manual_button").addEventListener("click", () => {
  ipcRenderer.send("update-window-action", { action: "manual-download" });
});

document.getElementById("close_button").addEventListener("click", () => {
  ipcRenderer.send("update-window-action", { action: "close-download-window" });
});

init();
