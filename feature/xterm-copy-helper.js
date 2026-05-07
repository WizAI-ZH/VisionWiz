const { clipboard } = require("electron");

function getTerminalBufferText(xtermInstance) {
  if (!xtermInstance || !xtermInstance.buffer || !xtermInstance.buffer.active) {
    return "";
  }

  const lines = [];
  const activeBuffer = xtermInstance.buffer.active;
  for (let index = 0; index < activeBuffer.length; index += 1) {
    const line = activeBuffer.getLine(index);
    if (!line) {
      continue;
    }
    lines.push(line.translateToString(true));
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

function createContextMenu(getLocales) {
  const menu = document.createElement("div");
  menu.style.position = "fixed";
  menu.style.display = "none";
  menu.style.minWidth = "140px";
  menu.style.padding = "6px";
  menu.style.background = "#20232d";
  menu.style.border = "1px solid rgba(255, 255, 255, 0.12)";
  menu.style.borderRadius = "8px";
  menu.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.28)";
  menu.style.zIndex = "99999";

  const createItem = () => {
    const item = document.createElement("button");
    item.type = "button";
    item.style.width = "100%";
    item.style.padding = "8px 10px";
    item.style.margin = "0";
    item.style.border = "0";
    item.style.borderRadius = "6px";
    item.style.background = "transparent";
    item.style.color = "#f5f7fb";
    item.style.fontSize = "13px";
    item.style.textAlign = "left";
    item.style.cursor = "pointer";
    item.onmouseenter = () => {
      if (!item.disabled) {
        item.style.background = "rgba(255, 255, 255, 0.1)";
      }
    };
    item.onmouseleave = () => {
      item.style.background = "transparent";
    };
    return item;
  };

  const copySelectionItem = createItem();
  const copyAllItem = createItem();

  menu.appendChild(copySelectionItem);
  menu.appendChild(copyAllItem);
  document.body.appendChild(menu);

  function hide() {
    menu.style.display = "none";
  }

  function show(x, y, hasSelection, onCopySelection, onCopyAll) {
    const locales = getLocales ? getLocales() || {} : {};
    copySelectionItem.textContent =
      locales.terminal_copy_selection || "Copy Selection";
    copyAllItem.textContent = locales.terminal_copy_all || "Copy All";

    copySelectionItem.disabled = !hasSelection;
    copySelectionItem.style.opacity = hasSelection ? "1" : "0.45";
    copySelectionItem.style.cursor = hasSelection ? "pointer" : "not-allowed";

    copySelectionItem.onclick = () => {
      if (hasSelection) {
        onCopySelection();
      }
      hide();
    };
    copyAllItem.onclick = () => {
      onCopyAll();
      hide();
    };

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = "block";

    const bounds = menu.getBoundingClientRect();
    if (bounds.right > window.innerWidth - 8) {
      menu.style.left = `${Math.max(8, window.innerWidth - bounds.width - 8)}px`;
    }
    if (bounds.bottom > window.innerHeight - 8) {
      menu.style.top = `${Math.max(8, window.innerHeight - bounds.height - 8)}px`;
    }
  }

  return { show, hide };
}

function setupXtermCopyBehavior(xtermInstance, container, getLocales) {
  if (!xtermInstance || !container) {
    return;
  }

  const contextMenu = createContextMenu(getLocales);

  function copySelection() {
    const selection = xtermInstance.getSelection();
    if (!selection) {
      return false;
    }
    clipboard.writeText(selection);
    return true;
  }

  function copyAll() {
    const fullText = getTerminalBufferText(xtermInstance);
    if (!fullText) {
      return false;
    }
    clipboard.writeText(fullText);
    return true;
  }

  xtermInstance.attachCustomKeyEventHandler((event) => {
    if (
      event.type === "keydown" &&
      event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      String(event.key || "").toLowerCase() === "c" &&
      xtermInstance.hasSelection()
    ) {
      copySelection();
      event.preventDefault();
      return false;
    }
    return true;
  });

  container.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    contextMenu.show(
      event.clientX,
      event.clientY,
      xtermInstance.hasSelection(),
      copySelection,
      copyAll
    );
  });

  document.addEventListener("click", () => {
    contextMenu.hide();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      contextMenu.hide();
    }
  });
}

module.exports = {
  getTerminalBufferText,
  setupXtermCopyBehavior,
};
