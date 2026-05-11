try { require("bytenode"); } catch (_) {}

const fs = require("fs");
const path = require("path");

function getLoaderDir() {
  if (typeof document !== "undefined" && document.currentScript && document.currentScript.src) {
    try {
      const urlPath = decodeURIComponent(new URL(document.currentScript.src).pathname);
      const filePath = process.platform === "win32" && /^\/[A-Za-z]:/.test(urlPath)
        ? urlPath.slice(1)
        : urlPath;
      return path.dirname(filePath);
    } catch (_) {}
  }
  return __dirname;
}

const loaderDir = getLoaderDir();
const sourceEntry = path.join(loaderDir, "..", "utils", "language-html.js");
const protectedEntry = path.join(loaderDir, "language-html.jsc");

module.exports = require(fs.existsSync(sourceEntry) ? sourceEntry : protectedEntry);
