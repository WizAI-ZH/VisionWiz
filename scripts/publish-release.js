const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(projectRoot, "package.json"));

const releaseVersion = String(packageJson.version || "").trim();
const releaseTag = `v${releaseVersion}`;
const manualUpdateUrl = "https://vesibit.yuque.com/ednd8n/visionwiz/intro";
const githubToken =
  process.env.VISIONWIZ_GITHUB_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN;

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

function getApiHeaders(extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`,
    "User-Agent": "VisionWiz-Release-Script",
    ...extra,
  };
}

async function ensureTagAtHead(tagName) {
  const headCommit = await runCapture("git", ["rev-parse", "HEAD"]);
  const remoteTagLine = await runCapture("git", [
    "ls-remote",
    "--tags",
    "origin",
    `refs/tags/${tagName}`,
  ]).catch(() => "");
  const remoteTagCommit = remoteTagLine ? remoteTagLine.split(/\s+/)[0] : "";

  let localTagCommit = "";
  try {
    localTagCommit = await runCapture("git", ["rev-list", "-n", "1", tagName]);
  } catch (_error) {
    localTagCommit = "";
  }

  if (!localTagCommit && remoteTagCommit) {
    await run("git", ["fetch", "origin", `refs/tags/${tagName}:refs/tags/${tagName}`]);
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
    await run("git", ["push", "origin", tagName]);
    return;
  }

  if (localTagCommit && !remoteTagCommit) {
    await run("git", ["push", "origin", tagName]);
  }
}

async function buildReleaseNotes(tagName) {
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

  return [
    `## VisionWiz ${releaseVersion}`,
    "",
    `- Release version: ${releaseTag}`,
    `- Release date: ${today}`,
    `- Manual update guide: ${manualUpdateUrl}`,
    "",
    "### Highlights",
    commitLines || "- Maintenance release",
  ].join("\n");
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

  const artifacts = Array.from(uniqueByPath.values());
  if (artifacts.length === 0) {
    throw new Error("No uploadable installer artifacts were found. Check the local packaging output.");
  }
  return artifacts;
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

async function uploadReleaseAsset(release, artifact) {
  const uploadUrl = String(release.upload_url || "").replace(/\{.*$/, "");
  const fileBuffer = fs.readFileSync(artifact.path);
  const targetUrl = `${uploadUrl}?name=${encodeURIComponent(artifact.name)}`;
  await axios.post(targetUrl, fileBuffer, {
    headers: getApiHeaders({
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fileBuffer.length),
    }),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 0,
  });
}

async function main() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const buildStartedAt = Date.now();

  const remoteUrl = await runCapture("git", ["config", "--get", "remote.origin.url"]);
  const { owner, repo } = parseGitHubRepo(remoteUrl);

  console.log(`Publishing ${releaseTag} to ${owner}/${repo}`);
  await ensureTagAtHead(releaseTag);
  await run(npmCommand, ["run", "release-package-onekey_ps"]);

  const artifacts = findRecentArtifacts(buildStartedAt);
  const releaseBody = await buildReleaseNotes(releaseTag);
  const release = await getOrCreateRelease(owner, repo, releaseTag, releaseBody);

  for (const artifact of artifacts) {
    console.log(`Uploading asset: ${artifact.name}`);
    await deleteExistingAssetIfNeeded(release, artifact.name);
    await uploadReleaseAsset(release, artifact);
  }

  console.log(`Release published: ${release.html_url}`);
}

main().catch((error) => {
  console.error("Release publish failed:", error);
  process.exit(1);
});
