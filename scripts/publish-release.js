const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(projectRoot, "package.json"));

const releaseVersion = String(packageJson.version || "").trim();
const releaseTag = `v${releaseVersion}`;
const manualUpdateUrl = "https://vesibit.yuque.com/ednd8n/visionwiz/intro";
const uploadableArtifactExtensions = new Set([".exe", ".zip", ".7z"]);
const githubToken =
  process.env.VISIONWIZ_GITHUB_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN;
const escapedReleaseVersion = releaseVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (!releaseVersion) {
  throw new Error("package.json is missing a version field.");
}

if (!githubToken) {
  throw new Error(
    "Missing GitHub token. Set VISIONWIZ_GITHUB_TOKEN, GITHUB_TOKEN, or GH_TOKEN."
  );
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function parseGitHubRepo(remoteUrl) {
  const normalized = String(remoteUrl || "").trim();
  const match = normalized.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
  if (!match) {
    throw new Error(`Unable to parse GitHub repository from remote URL: ${remoteUrl}`);
  }
  return {
    owner: match[1],
    repo: match[2],
  };
}

async function resolveGitRemoteName() {
  const configuredPushDefault = await runCapture("git", ["config", "--get", "remote.pushDefault"]).catch(() => "");
  if (configuredPushDefault) {
    return configuredPushDefault;
  }

  const remotesOutput = await runCapture("git", ["remote"]).catch(() => "");
  const remotes = remotesOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (remotes.includes("origin")) {
    return "origin";
  }
  if (remotes.length === 1) {
    return remotes[0];
  }
  if (remotes.length > 1) {
    return remotes[0];
  }

  throw new Error("No git remote found for release publishing.");
}

function getApiHeaders(extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`,
    "User-Agent": "VisionWiz-Release-Script",
    ...extra,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryUpload(error) {
  const retryableCodes = new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ECONNABORTED",
    "ENOTFOUND",
  ]);
  if (retryableCodes.has(error && error.code)) {
    return true;
  }
  if (!error || !error.response) {
    return true;
  }
  return error.response.status >= 500;
}

function logPublishError(error) {
  const status = error && error.response && error.response.status;
  const data = error && error.response && error.response.data;
  const code = error && error.code;
  const message = error && error.message ? error.message : String(error);
  console.error("Release publish failed:", {
    message,
    code,
    status,
    data,
  });
}

function isReleaseAssetCandidate(fileName) {
  const name = String(fileName || "").trim();
  const lowerName = name.toLowerCase();
  const extension = path.extname(lowerName);
  if (!uploadableArtifactExtensions.has(extension)) {
    return false;
  }

  if (/^visionwiz-win32-x64\.7z$/i.test(name)) {
    return true;
  }

  if (extension === ".exe") {
    return new RegExp(
      `^VisionWiz${escapedReleaseVersion}-win32-x64-Setup.*\\.exe$`,
      "i"
    ).test(name);
  }

  return new RegExp(escapedReleaseVersion, "i").test(name);
}

async function ensureTagAtHead(tagName, remoteName) {
  const headCommit = await runCapture("git", ["rev-parse", "HEAD"]);
  let localTagCommit = "";
  try {
    localTagCommit = await runCapture("git", ["rev-list", "-n", "1", tagName]);
  } catch (_error) {
    localTagCommit = "";
  }

  let remoteTagCommit = "";
  const remoteTagLine = await runCapture("git", [
    "ls-remote",
    "--tags",
    remoteName,
    `refs/tags/${tagName}`,
    `refs/tags/${tagName}^{}`,
  ]).catch(() => "");
  if (remoteTagLine) {
    const remoteRefs = remoteTagLine
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const peeledLine = remoteRefs.find((line) => line.endsWith(`refs/tags/${tagName}^{}`));
    const directLine = remoteRefs.find((line) => line.endsWith(`refs/tags/${tagName}`));
    const selectedLine = peeledLine || directLine || "";
    remoteTagCommit = selectedLine ? selectedLine.split(/\s+/)[0] : "";
  }

  if (!localTagCommit && remoteTagCommit) {
    await run("git", ["fetch", remoteName, `refs/tags/${tagName}:refs/tags/${tagName}`]);
    localTagCommit = await runCapture("git", ["rev-list", "-n", "1", tagName]);
  }

  if (localTagCommit && localTagCommit !== headCommit) {
    throw new Error(`Local tag ${tagName} does not point to the current HEAD.`);
  }

  if (remoteTagCommit && remoteTagCommit !== headCommit) {
    throw new Error(`Remote tag ${tagName} does not point to the current HEAD.`);
  }

  if (!localTagCommit && !remoteTagCommit) {
    await run("git", ["tag", "-a", tagName, "-m", `Release ${tagName}`]);
    await run("git", ["push", remoteName, tagName]);
    return;
  }

  if (localTagCommit && !remoteTagCommit) {
    await run("git", ["push", remoteName, tagName]);
  }
}

async function buildReleaseNotes(tagName) {
  const customReleaseNotesPath = path.join(
    projectRoot,
    "release-notes",
    `${releaseVersion}.md`
  );
  if (fs.existsSync(customReleaseNotesPath)) {
    return normalizeReleaseBody(fs.readFileSync(customReleaseNotesPath, "utf8").trim());
  }

  const tagsOutput = await runCapture("git", ["tag", "--sort=-version:refname"]).catch(() => "");
  const allTags = tagsOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const previousTag = allTags.find((item) => item !== tagName);
  const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
  const logArgs = previousTag
    ? ["log", range, "--pretty=format:- %s", "-n", "12"]
    : ["log", "--pretty=format:- %s", "-n", "12"];
  const commitLines = await runCapture("git", logArgs).catch(() => "");
  const today = new Date().toISOString().slice(0, 10);
  const highlights = commitLines || "- Maintenance release";
  const translatedHighlights = highlights
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^- /, "- ")
        .replace(/^-\s*release:\s+prepare\s+/i, "- 发布准备：")
        .replace(/^-\s*fix:\s+/i, "- 修复：")
        .replace(/^-\s*feat:\s+/i, "- 功能：")
        .replace(/^-\s*chore:\s+/i, "- 维护：")
    )
    .join("\n");

  return normalizeReleaseBody([
    `## VisionWiz ${releaseVersion}`,
    "",
    "### English",
    `- Release version: ${releaseTag}`,
    `- Release date: ${today}`,
    `- Manual update guide: ${manualUpdateUrl}`,
    "",
    "### Highlights",
    highlights,
    "",
    "### 中文",
    `- 发布版本：${releaseTag}`,
    `- 发布时间：${today}`,
    `- 手动更新说明：${manualUpdateUrl}`,
    "",
    "### 更新亮点",
    translatedHighlights || "- 维护版本更新",
  ].join("\n"));
}

function normalizeLanguageHeading(value) {
  const text = String(value || "")
    .replace(/^#+\s*/, "")
    .trim()
    .toLowerCase();
  if (text === "english" || text === "en" || text === "英文") {
    return "english";
  }
  if (text === "中文" || text === "chinese" || text === "zh") {
    return "chinese";
  }
  return "";
}

function normalizeReleaseBody(body) {
  const lines = String(body || "").split(/\r?\n/);
  const output = [];
  const seenLanguageSections = new Set();
  let skippingDuplicateLanguageSection = false;

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const languageKey = normalizeLanguageHeading(heading[2]);
      if (languageKey) {
        if (seenLanguageSections.has(languageKey)) {
          skippingDuplicateLanguageSection = true;
          continue;
        }
        seenLanguageSections.add(languageKey);
        skippingDuplicateLanguageSection = false;
      } else {
        skippingDuplicateLanguageSection = false;
      }
    }

    if (!skippingDuplicateLanguageSection) {
      output.push(line);
    }
  }

  return output.join("\n").trim();
}

function findRecentArtifacts(buildStartedAt) {
  const roots = [path.join(projectRoot, "out"), path.join(projectRoot, "dist")];
  const matches = [];
  const allowedExt = new Set([".exe", ".zip", ".7z"]);

  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) {
      return;
    }
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!allowedExt.has(extension)) {
        continue;
      }
      const stat = fs.statSync(fullPath);
      if (
        stat.mtimeMs >= buildStartedAt ||
        entry.name.includes(releaseVersion) ||
        entry.name.toLowerCase().includes("visionwiz")
      ) {
        matches.push({
          path: fullPath,
          name: entry.name,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        });
      }
    }
  }

  roots.forEach(walk);

  const uniqueByPath = new Map();
  for (const item of matches.sort((left, right) => right.mtimeMs - left.mtimeMs)) {
    if (!uniqueByPath.has(item.path)) {
      uniqueByPath.set(item.path, item);
    }
  }

  const artifacts = Array.from(uniqueByPath.values()).filter((item) =>
    isReleaseAssetCandidate(item.name)
  );
  if (artifacts.length === 0) {
    throw new Error("No uploadable installer artifacts were found. Check the local packaging output.");
  }
  return artifacts;
}

function findExistingReleaseArtifacts() {
  return findRecentArtifacts(0);
}

async function getOrCreateRelease(owner, repo, tagName, body) {
  const releaseApiBase = `https://api.github.com/repos/${owner}/${repo}/releases`;
  try {
    const existing = await axios.get(`${releaseApiBase}/tags/${tagName}`, {
      headers: getApiHeaders(),
      timeout: 15000,
    });
    const updated = await axios.patch(
      `${releaseApiBase}/${existing.data.id}`,
      {
        tag_name: tagName,
        name: `VisionWiz ${releaseVersion}`,
        body,
        draft: false,
        prerelease: false,
      },
      {
        headers: getApiHeaders(),
        timeout: 15000,
      }
    );
    return updated.data;
  } catch (error) {
    if (!error.response || error.response.status !== 404) {
      throw error;
    }
  }

  const created = await axios.post(
    releaseApiBase,
    {
      tag_name: tagName,
      name: `VisionWiz ${releaseVersion}`,
      body,
      draft: false,
      prerelease: false,
      generate_release_notes: false,
    },
    {
      headers: getApiHeaders(),
      timeout: 15000,
    }
  );
  return created.data;
}

async function deleteExistingAssetIfNeeded(release, assetName) {
  const asset = (release.assets || []).find((item) => item.name === assetName);
  if (!asset) {
    return;
  }
  await axios.delete(asset.url, {
    headers: getApiHeaders(),
    timeout: 15000,
  });
}

async function deleteStaleAssets(release, targetAssetNames) {
  const keepNames = new Set(targetAssetNames);
  for (const asset of release.assets || []) {
    if (!keepNames.has(asset.name)) {
      console.log(`Deleting stale asset: ${asset.name}`);
      await axios.delete(asset.url, {
        headers: getApiHeaders(),
        timeout: 15000,
      });
    }
  }
}

async function uploadReleaseAsset(release, artifact) {
  const uploadUrl = String(release.upload_url || "").replace(/\{.*$/, "");
  const targetUrl = `${uploadUrl}?name=${encodeURIComponent(artifact.name)}`;
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const fileStream = fs.createReadStream(artifact.path);
      await axios.post(targetUrl, fileStream, {
        headers: getApiHeaders({
          "Content-Type": "application/octet-stream",
          "Content-Length": String(artifact.size),
        }),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 0,
      });
      return;
    } catch (error) {
      if (attempt >= attempts || !shouldRetryUpload(error)) {
        throw error;
      }
      const delayMs = attempt * 5000;
      console.warn(
        `Upload failed for ${artifact.name} (${error.code || error.message}); retrying in ${delayMs / 1000}s...`
      );
      await sleep(delayMs);
    }
  }
}

async function main() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const buildStartedAt = Date.now();

  const remoteName = await resolveGitRemoteName();
  const remoteUrl = await runCapture("git", ["config", "--get", `remote.${remoteName}.url`]);
  const { owner, repo } = parseGitHubRepo(remoteUrl);

  console.log(`Publishing ${releaseTag} to ${owner}/${repo}`);
  await ensureTagAtHead(releaseTag, remoteName);
  let artifacts = [];
  try {
    artifacts = findExistingReleaseArtifacts();
  } catch (_error) {
    artifacts = [];
  }

  if (artifacts.length === 0) {
    await run(npmCommand, ["run", "release-package-onekey_ps"]);
    artifacts = findRecentArtifacts(buildStartedAt);
  } else {
    console.log(`Reusing existing release artifacts (${artifacts.length} found).`);
  }

  const releaseBody = await buildReleaseNotes(releaseTag);
  const release = await getOrCreateRelease(owner, repo, releaseTag, releaseBody);
  await deleteStaleAssets(release, artifacts.map((artifact) => artifact.name));

  for (const artifact of artifacts) {
    console.log(`Uploading asset: ${artifact.name}`);
    await deleteExistingAssetIfNeeded(release, artifact.name);
    await uploadReleaseAsset(release, artifact);
  }

  console.log(`Release published: ${release.html_url}`);
}

main().catch((error) => {
  logPublishError(error);
  process.exit(1);
});
