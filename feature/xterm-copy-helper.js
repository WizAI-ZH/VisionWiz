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

function createSearchBar(xtermInstance, container, getLocales) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "none";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "6px";
  wrapper.style.padding = "8px";
  wrapper.style.background = "#20232d";
  wrapper.style.border = "1px solid rgba(255, 255, 255, 0.12)";
  wrapper.style.borderRadius = "8px 8px 0 0";
  wrapper.style.marginBottom = "4px";

  const input = document.createElement("input");
  input.type = "search";
  input.style.flex = "1 1 auto";
  input.style.minWidth = "120px";
  input.style.padding = "6px 8px";
  input.style.border = "1px solid rgba(255, 255, 255, 0.18)";
  input.style.borderRadius = "6px";
  input.style.background = "#111827";
  input.style.color = "#f5f7fb";
  input.style.outline = "none";

  const counter = document.createElement("span");
  counter.style.minWidth = "52px";
  counter.style.color = "#cfd6e4";
  counter.style.fontSize = "12px";
  counter.style.textAlign = "center";

  const createButton = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.padding = "6px 8px";
    button.style.border = "1px solid rgba(255, 255, 255, 0.14)";
    button.style.borderRadius = "6px";
    button.style.background = "#2b3342";
    button.style.color = "#f5f7fb";
    button.style.cursor = "pointer";
    button.style.fontSize = "12px";
    return button;
  };

  const previousButton = createButton();
  const nextButton = createButton();
  const closeButton = createButton();
  wrapper.appendChild(input);
  wrapper.appendChild(counter);
  wrapper.appendChild(previousButton);
  wrapper.appendChild(nextButton);
  wrapper.appendChild(closeButton);

  container.parentNode.insertBefore(wrapper, container);

  let matches = [];
  let activeIndex = -1;

  function trimRightWithMap(text, stringIndexToColumn) {
    let end = text.length;
    while (end > 0 && text[end - 1] === " ") {
      end -= 1;
    }
    return {
      text: text.slice(0, end),
      stringIndexToColumn: stringIndexToColumn.slice(0, end),
    };
  }

  function getLineSearchData(row) {
    const line = xtermInstance.buffer.active.getLine(row);
    if (!line) {
      return { text: "", stringIndexToColumn: [] };
    }

    const stringIndexToColumn = [];
    let text = "";
    const cell = xtermInstance.buffer.active.getNullCell
      ? xtermInstance.buffer.active.getNullCell()
      : null;
    for (let column = 0; column < line.length; column += 1) {
      const currentCell = line.getCell(column, cell || undefined);
      if (!currentCell || currentCell.getWidth() === 0) {
        continue;
      }
      const chars = currentCell.getChars() || " ";
      for (let index = 0; index < chars.length; index += 1) {
        stringIndexToColumn[text.length + index] = column;
      }
      text += chars;
    }
    return trimRightWithMap(text, stringIndexToColumn);
  }

  function getEndColumn(line, matchStartIndex, matchEndIndex) {
    const map = line.stringIndexToColumn;
    const startColumn = map[matchStartIndex] || 0;
    if (map[matchEndIndex] !== undefined) {
      return map[matchEndIndex];
    }
    const lastColumn = map[matchEndIndex - 1];
    if (lastColumn === undefined) {
      return startColumn + 1;
    }
    const bufferLine = xtermInstance.buffer.active.getLine(line.row);
    const lastCell = bufferLine ? bufferLine.getCell(lastColumn) : null;
    return lastColumn + Math.max(1, lastCell ? lastCell.getWidth() : 1);
  }

  function findMatches(query) {
    const found = [];
    const needle = String(query || "").toLowerCase();
    if (!needle) {
      return found;
    }
    const activeBuffer = xtermInstance.buffer.active;
    for (let row = 0; row < activeBuffer.length; row += 1) {
      const line = getLineSearchData(row);
      line.row = row;
      const lowerText = line.text.toLowerCase();
      let stringIndex = lowerText.indexOf(needle);
      while (stringIndex !== -1) {
        const column = line.stringIndexToColumn[stringIndex];
        if (column !== undefined) {
          const endColumn = getEndColumn(line, stringIndex, stringIndex + query.length);
          found.push({
            row,
            column,
            length: Math.max(1, endColumn - column),
          });
        }
        stringIndex = lowerText.indexOf(needle, stringIndex + Math.max(1, needle.length));
      }
    }
    return found;
  }

  function updateLabels() {
    const locales = getLocales ? getLocales() || {} : {};
    input.placeholder = locales.terminal_search_placeholder || "Search logs";
    previousButton.textContent = locales.terminal_search_previous || "Previous";
    nextButton.textContent = locales.terminal_search_next || "Next";
    closeButton.textContent = locales.terminal_search_close || "Close";
    if (matches.length === 0) {
      counter.textContent = input.value
        ? locales.terminal_search_no_results || "0/0"
        : "0/0";
    } else {
      counter.textContent = `${activeIndex + 1}/${matches.length}`;
    }
  }

  function selectActive() {
    if (activeIndex < 0 || !matches[activeIndex]) {
      xtermInstance.clearSelection();
      updateLabels();
      return;
    }
    const match = matches[activeIndex];
    xtermInstance.scrollToLine(match.row);
    xtermInstance.select(match.column, match.row, match.length);
    updateLabels();
  }

  function refresh(keepPosition) {
    const previousMatch = matches[activeIndex];
    matches = findMatches(input.value);
    if (matches.length === 0) {
      activeIndex = -1;
      selectActive();
      return;
    }
    if (keepPosition && previousMatch) {
      const sameIndex = matches.findIndex(
        (item) => item.row === previousMatch.row && item.column === previousMatch.column
      );
      activeIndex = sameIndex >= 0 ? sameIndex : Math.min(activeIndex, matches.length - 1);
    } else {
      activeIndex = 0;
    }
    selectActive();
  }

  function open() {
    wrapper.style.display = "flex";
    updateLabels();
    input.focus();
    input.select();
    refresh(true);
  }

  function close() {
    wrapper.style.display = "none";
    xtermInstance.clearSelection();
    xtermInstance.focus();
  }

  function next() {
    if (matches.length === 0) {
      refresh(false);
      return;
    }
    activeIndex = (activeIndex + 1) % matches.length;
    selectActive();
  }

  function previous() {
    if (matches.length === 0) {
      refresh(false);
      return;
    }
    activeIndex = (activeIndex - 1 + matches.length) % matches.length;
    selectActive();
  }

  input.addEventListener("input", () => refresh(false));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        previous();
      } else {
        next();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
  previousButton.addEventListener("click", previous);
  nextButton.addEventListener("click", next);
  closeButton.addEventListener("click", close);

  return {
    open,
    close,
    refresh: () => {
      if (wrapper.style.display !== "none") {
        refresh(true);
      }
    },
  };
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
  const searchItem = createItem();
  const clearItem = createItem();

  menu.appendChild(copySelectionItem);
  menu.appendChild(copyAllItem);
  menu.appendChild(searchItem);
  menu.appendChild(clearItem);
  document.body.appendChild(menu);

  function hide() {
    menu.style.display = "none";
  }

  function show(x, y, hasSelection, onCopySelection, onCopyAll, onSearch, onClear) {
    const locales = getLocales ? getLocales() || {} : {};
    copySelectionItem.textContent =
      locales.terminal_copy_selection || "Copy Selection";
    copyAllItem.textContent = locales.terminal_copy_all || "Copy All";
    searchItem.textContent = locales.terminal_search || "Search";
    clearItem.textContent = locales.terminal_clear || "Clear";

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
    searchItem.onclick = () => {
      onSearch();
      hide();
    };
    clearItem.onclick = () => {
      onClear();
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
  const searchBar = createSearchBar(xtermInstance, container, getLocales);

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

  function clearTerminal() {
    xtermInstance.clearSelection();
    xtermInstance.clear();
    searchBar.refresh();
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
    if (
      event.type === "keydown" &&
      event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      String(event.key || "").toLowerCase() === "f"
    ) {
      searchBar.open();
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
      copyAll,
      searchBar.open,
      clearTerminal
    );
  });

  document.addEventListener("click", () => {
    contextMenu.hide();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      contextMenu.hide();
    }
    if (
      event.type === "keydown" &&
      event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      String(event.key || "").toLowerCase() === "f"
    ) {
      event.preventDefault();
      searchBar.open();
    }
  });

  return {
    refreshSearch: searchBar.refresh,
    openSearch: searchBar.open,
  };
}

module.exports = {
  getTerminalBufferText,
  setupXtermCopyBehavior,
};
