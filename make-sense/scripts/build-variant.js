
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function renameDir(oldPath, newPath) {
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`📁 重命名: ${oldPath} → ${newPath}`);
  }
}

function buildVariant(variant) {
  const root = path.resolve(__dirname, "..");
  const srcDir = path.join(root, `src_${variant}_ver`);
  const tempSrc = path.join(root, "src");
  const backupSrc = path.join(root, "_src_backup");

  if (!fs.existsSync(srcDir)) {
    console.error(`❌ 找不到对应版本源码目录: ${srcDir}`);
    process.exit(1);
  }

  // 1️⃣ 备份旧 src
  if (fs.existsSync(tempSrc)) {
    renameDir(tempSrc, backupSrc);
  }

  // 2️⃣ 将目标目录改为 src
  renameDir(srcDir, tempSrc);

  try {
    // 3️⃣ 执行构建
    console.log(`🚧 正在构建 ${variant} 版本...`);
    execSync(`cross-env OUT_DIR=dist_${variant} vite build`, { stdio: "inherit" });
    console.log(`✅ 构建完成: dist_${variant}`);
  } catch (err) {
    console.error(`❌ 构建失败: ${variant}`, err);
  } finally {
    // 4️⃣ 还原目录结构
    renameDir(tempSrc, srcDir);
    if (fs.existsSync(backupSrc)) {
      renameDir(backupSrc, tempSrc);
    }
    console.log(`♻️ 已还原目录结构`);
  }
}

// 从命令行参数取版本名
const variant = process.argv[2];
if (!variant) {
  console.error("❌ 请指定构建版本，如: node scripts/build-variant.js zh");
  process.exit(1);
}

buildVariant(variant);
