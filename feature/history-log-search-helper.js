function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createButton(text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-sm btn-secondary";
  button.textContent = text;
  return button;
}

function setupHistoryLogSearch(logIds, getLocales) {
  const states = {};
  let activeLogId = logIds[0];

  function locales() {
    return (typeof getLocales === "function" && getLocales()) || {};
  }

  function label(key, fallback) {
    return locales()[key] || fallback;
  }

  function findMatches(text, query) {
    if (!query) {
      return [];
    }
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    const matches = [];
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      matches.push(index);
      index = haystack.indexOf(needle, index + Math.max(needle.length, 1));
    }
    return matches;
  }

  function render(logId) {
    const state = states[logId];
    if (!state) {
      return;
    }
    const { logEl, input, counter } = state;
    const query = input.value;
    state.matches = findMatches(state.rawText, query);
    if (state.activeIndex >= state.matches.length) {
      state.activeIndex = 0;
    }
    if (state.activeIndex < 0 && state.matches.length > 0) {
      state.activeIndex = state.matches.length - 1;
    }

    if (!query || state.matches.length === 0) {
      logEl.textContent = state.rawText;
      counter.textContent = query
        ? label("terminal_search_no_results", "0/0")
        : "0/0";
      return;
    }

    const matchStart = state.matches[state.activeIndex];
    const matchEnd = matchStart + query.length;
    logEl.innerHTML =
      escapeHtml(state.rawText.slice(0, matchStart)) +
      `<mark class="history-log-search-hit">${escapeHtml(
        state.rawText.slice(matchStart, matchEnd)
      )}</mark>` +
      escapeHtml(state.rawText.slice(matchEnd));
    counter.textContent = `${state.activeIndex + 1}/${state.matches.length}`;

    const hit = logEl.querySelector(".history-log-search-hit");
    if (hit) {
      hit.scrollIntoView({ block: "center" });
    }
  }

  function open(logId) {
    const state = states[logId || activeLogId];
    if (!state) {
      return;
    }
    activeLogId = state.logId;
    state.input.placeholder = label("terminal_search_placeholder", "Search logs");
    state.previousButton.textContent = label("terminal_search_previous", "Previous");
    state.nextButton.textContent = label("terminal_search_next", "Next");
    state.closeButton.textContent = label("terminal_search_close", "Close");
    state.toolbar.style.display = "flex";
    state.input.focus();
    state.input.select();
    render(state.logId);
  }

  function close(logId) {
    const state = states[logId || activeLogId];
    if (!state) {
      return;
    }
    state.toolbar.style.display = "none";
    state.input.value = "";
    state.activeIndex = 0;
    render(state.logId);
  }

  function next(logId) {
    const state = states[logId || activeLogId];
    if (!state || state.matches.length === 0) {
      return;
    }
    state.activeIndex = (state.activeIndex + 1) % state.matches.length;
    render(state.logId);
  }

  function previous(logId) {
    const state = states[logId || activeLogId];
    if (!state || state.matches.length === 0) {
      return;
    }
    state.activeIndex =
      (state.activeIndex - 1 + state.matches.length) % state.matches.length;
    render(state.logId);
  }

  function setText(logId, text) {
    const state = states[logId];
    if (!state) {
      const el = document.getElementById(logId);
      if (el) {
        el.textContent = text || "";
        el.style.whiteSpace = "pre-wrap";
      }
      return;
    }
    state.rawText = String(text || "");
    state.logEl.style.whiteSpace = "pre-wrap";
    render(logId);
  }

  function install(logId) {
    const logEl = document.getElementById(logId);
    if (!logEl || states[logId]) {
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "history-log-search-toolbar";
    toolbar.style.display = "none";
    toolbar.style.alignItems = "center";
    toolbar.style.gap = "8px";
    toolbar.style.margin = "0 0 8px";
    toolbar.style.padding = "8px 0";
    toolbar.style.flexWrap = "wrap";
    toolbar.style.position = "sticky";
    toolbar.style.top = "0";
    toolbar.style.zIndex = "20";
    toolbar.style.background = "#fff";
    toolbar.style.borderBottom = "1px solid #dee2e6";

    const input = document.createElement("input");
    input.type = "search";
    input.className = "form-control form-control-sm";
    input.style.maxWidth = "320px";
    input.placeholder = label("terminal_search_placeholder", "Search logs");

    const previousButton = createButton(label("terminal_search_previous", "Previous"));
    const nextButton = createButton(label("terminal_search_next", "Next"));
    const closeButton = createButton(label("terminal_search_close", "Close"));
    const counter = document.createElement("span");
    counter.style.minWidth = "48px";
    counter.style.color = "#444";
    counter.textContent = "0/0";

    toolbar.appendChild(input);
    toolbar.appendChild(previousButton);
    toolbar.appendChild(nextButton);
    toolbar.appendChild(counter);
    toolbar.appendChild(closeButton);
    logEl.parentNode.insertBefore(toolbar, logEl);

    states[logId] = {
      logId,
      logEl,
      toolbar,
      input,
      previousButton,
      nextButton,
      closeButton,
      counter,
      rawText: logEl.textContent || "",
      matches: [],
      activeIndex: 0,
    };

    input.addEventListener("input", () => {
      states[logId].activeIndex = 0;
      render(logId);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          previous(logId);
        } else {
          next(logId);
        }
      } else if (event.key === "Escape") {
        close(logId);
      }
    });
    previousButton.addEventListener("click", () => previous(logId));
    nextButton.addEventListener("click", () => next(logId));
    closeButton.addEventListener("click", () => close(logId));
    logEl.addEventListener("click", () => {
      activeLogId = logId;
    });
  }

  logIds.forEach(install);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      const visibleLog = logIds.find((logId) => {
        const el = document.getElementById(logId);
        return el && el.offsetParent !== null;
      });
      if (visibleLog) {
        event.preventDefault();
        open(visibleLog);
      }
    }
  });

  return {
    setText,
    open,
    close,
    next,
    previous,
  };
}

module.exports = { setupHistoryLogSearch };
