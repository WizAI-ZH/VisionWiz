"use strict";

// Public, unauthenticated fallback for the update prompt. Shared network
// exits can exhaust GitHub's anonymous REST API quota even though the public
// Release page and download links remain available.
const REPO_PATH = "/WizAI-ZH/VisionWiz";
const LATEST_PAGE = "https://github.com" + REPO_PATH + "/releases/latest";
const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;
const WEBSITE_TIMEOUT_MS = 10000;
const MAX_PAGE_BYTES = 1024 * 1024;

function parseLatestTagFromRedirect(location) {
  if (!location || typeof location !== "string") {
    return null;
  }
  try {
    const target = new URL(location, LATEST_PAGE);
    if (target.origin !== "https://github.com" || target.search || target.hash) {
      return null;
    }
    const match = target.pathname.match(
      /^\/WizAI-ZH\/VisionWiz\/releases\/tag\/(v\d+\.\d+\.\d+)\/?$/
    );
    return match && RELEASE_TAG_PATTERN.test(match[1]) ? match[1] : null;
  } catch (_error) {
    return null;
  }
}

function findPublishedInstaller(html, tag) {
  if (typeof html !== "string" || !RELEASE_TAG_PATTERN.test(tag)) {
    return null;
  }
  const prefix = REPO_PATH + "/releases/download/" + tag + "/";
  const version = tag.slice(1).replace(/\./g, "\\.");
  const installerNamePattern = new RegExp(
    "^VisionWiz" + version + "-win32-x64-Setup.*\\.exe$",
    "i"
  );
  const results = new Map();
  const links = /<a\b[^>]*\bhref="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = links.exec(html))) {
    const href = match[1];
    if (!href.startsWith(prefix) || href.includes("?") || href.includes("#")) {
      continue;
    }
    let filename;
    try {
      filename = decodeURIComponent(href.slice(prefix.length));
    } catch (_error) {
      continue;
    }
    if (!installerNamePattern.test(filename) || filename.includes("/")) {
      continue;
    }
    results.set(filename, {
      name: filename,
      size: 0, // The streaming download obtains the actual Content-Length.
      browser_download_url: "https://github.com" + href,
    });
  }
  // Never silently choose between two different installer assets.
  return results.size === 1 ? Array.from(results.values())[0] : null;
}

async function fetchLatestGitHubWebsiteRelease(httpClient) {
  if (!httpClient || typeof httpClient.get !== "function") {
    throw new Error("GitHub update fallback requires an HTTP client.");
  }
  const options = {
    timeout: WEBSITE_TIMEOUT_MS,
    headers: { "User-Agent": "VisionWiz-Updater" },
    maxContentLength: MAX_PAGE_BYTES,
  };
  const redirect = await httpClient.get(LATEST_PAGE, {
    ...options,
    maxRedirects: 0,
    validateStatus: (status) => status >= 300 && status < 400,
  });
  const tag = parseLatestTagFromRedirect(redirect.headers?.location);
  if (!tag) {
    throw new Error("GitHub latest Release did not redirect to an official stable version.");
  }
  const assetsResponse = await httpClient.get(
    "https://github.com" + REPO_PATH + "/releases/expanded_assets/" + encodeURIComponent(tag),
    { ...options, maxRedirects: 2, responseType: "text" }
  );
  if (assetsResponse.status !== 200) {
    throw new Error("GitHub public Release assets could not be loaded.");
  }
  const installer = findPublishedInstaller(assetsResponse.data, tag);
  if (!installer) {
    throw new Error("No unambiguous Windows installer was found on the public Release page.");
  }
  return {
    tag_name: tag,
    name: "VisionWiz " + tag.slice(1),
    draft: false,
    prerelease: false,
    body: [
      "## 中文",
      "",
      "- 已从 GitHub 官方发布页面确认有新版本。",
      "- 详细更新内容请查看该版本的 GitHub Release 页面。",
      "",
      "## English",
      "",
      "- A new version was confirmed on the official GitHub Release page.",
      "- See the GitHub Release page for detailed changes.",
    ].join("\n"),
    assets: [installer],
    updateFallbackSource: "github-release-page",
  };
}

module.exports = {
  parseLatestTagFromRedirect,
  findPublishedInstaller,
  fetchLatestGitHubWebsiteRelease,
};
