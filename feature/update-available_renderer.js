const { ipcRenderer } = require("electron");

let current_locales = {};

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkify(text) {
  return escapeHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  );
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let listBuffer = [];

  function flushList() {
    if (listBuffer.length > 0) {
      html.push(`<ul>${listBuffer.join("")}</ul>`);
      listBuffer = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = Math.min(4, heading[1].length);
      html.push(`<h${level}>${linkify(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      listBuffer.push(`<li>${linkify(bullet[1])}</li>`);
      continue;
    }

    flushList();
    html.push(`<p>${linkify(line)}</p>`);
  }

  flushList();
  return html.join("") || `<p>${escapeHtml(current_locales.update_notes_empty || "No release notes were provided for this update.")}</p>`;
}

function applyLocaleTexts() {
  setText(
    "update_title",
    current_locales.update_available_message ||
      "A new version of VisionWiz is available."
  );
  setText(
    "update_summary",
    current_locales.update_available_summary ||
      "You can read the full release notes below and choose how to update."
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
    "release_notes_label",
    current_locales.update_release_notes_label || "Release notes"
  );
  setText(
    "auto_update_button",
    current_locales.update_auto_button || "Auto Update"
  );
  setText(
    "manual_update_button",
    current_locales.update_manual_button || "Manual Download"
  );
  setText(
    "later_button",
    current_locales.update_cancel_button || "Later"
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
  const notesPanel = document.getElementById("release_notes_panel");
  if (notesPanel) {
    notesPanel.innerHTML = renderMarkdown(payload.releaseBody || "");
    notesPanel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        ipcRenderer.send("open_website", link.href);
      });
    });
  }
}

async function init() {
  try {
    current_locales = (await ipcRenderer.invoke("get-current-locales")) || {};
  } catch (error) {
    console.error("Failed to load locales for update available window:", error);
  }

  applyLocaleTexts();

  try {
    const initialState = await ipcRenderer.invoke("get-update-prompt-state");
    applyState(initialState);
  } catch (error) {
    console.error("Failed to load initial update prompt state:", error);
  }
}

document.getElementById("auto_update_button").addEventListener("click", () => {
  ipcRenderer.send("update-window-action", { action: "auto-update" });
});

document.getElementById("manual_update_button").addEventListener("click", () => {
  ipcRenderer.send("update-window-action", { action: "manual-download" });
});

document.getElementById("later_button").addEventListener("click", () => {
  ipcRenderer.send("update-window-action", { action: "later" });
});

ipcRenderer.on("update-prompt-state", (_event, payload) => {
  applyState(payload);
});

init();
