const fs = require("fs");
const path = require("path");

const packagePath = path.join(__dirname, "..", "package.json");
const raw = fs.readFileSync(packagePath, "utf8").replace(/^\uFEFF/, "");
const packageJson = JSON.parse(raw);

const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
const buildDate = `${yyyy}-${mm}-${dd}`;

packageJson.buildInfo = {
  productName: packageJson.buildInfo?.productName || packageJson.name || "VisionWiz",
  date: buildDate,
  copyright: packageJson.buildInfo?.copyright || "(C) 2025 VisionWiz Team",
};

const content = `${JSON.stringify(packageJson, null, 2)}\n`;
fs.writeFileSync(packagePath, content, "utf8");
console.log(`[build-info] package.json buildInfo.date updated to ${buildDate}`);
