
const fs = require("fs");
const path = require("path");

/**
 * 自动修复多语言版 Make Sense 构建输出：
 * 1️⃣ 修正 index.html 中路径（"/" => "./"）
 * 2️⃣ 删除旧版本构建产物（assets 文件夹 + index.html 等）
 * 3️⃣ 移除 index.html 的 <title>Make Sense</title>
 * 4️⃣ 拷贝新版本文件到 ../tools/make-sense-XX/
 */

const variants = [
  { src: "dist_eng", target: "../tools/make-sense-en" },
  { src: "dist_zh", target: "../tools/make-sense-zh" },
  { src: "dist_zht", target: "../tools/make-sense-zht" },
];

/** 清理旧的构建内容，仅删除 make-sense 相关部分 */
function cleanOldBuildFiles(dir) {
  if (!fs.existsSync(dir)) return;

  const filesToRemove = ["index.html", "manifest.json", "favicon.ico"];
  const assetsDir = path.join(dir, "assets");

  if (fs.existsSync(assetsDir)) {
    fs.rmSync(assetsDir, { recursive: true, force: true });
    console.log(`🧹 已清空旧 assets: ${assetsDir}`);
  }

  for (const name of filesToRemove) {
    const target = path.join(dir, name);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`🧹 已删除旧文件: ${target}`);
    }
  }
}

/** 修复 index.html 中路径、删除 title */
function fixIndexHtml(dir) {
  const indexPath = path.join(dir, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.warn(`⚠️ 找不到 ${indexPath}, 跳过`);
    return;
  }

  let html = fs.readFileSync(indexPath, "utf8");

  // ✅ 替换 /src 或 /assets 路径为相对路径
  html = html.replace(/(href|src)=["']\/(?!\/)/g, '$1="./');

  // ✅ 删除 <title>Make Sense</title>
  html = html.replace(/<title>\s*Make Sense\s*<\/title>/i, "");
  html = html.replace(/<script[^>]+googletagmanager[^>]*><\/script>\s*/gi, "");
  html = html.replace(/<script>\s*window\.dataLayer[\s\S]*?gtag\('config',\s*'UA-155837750-1'\);\s*<\/script>\s*/gi, "");
  html = html.replace(/<script>\s*\(function\(w,d,s,l,i\)[\s\S]*?GTM-5N6WR7G'\);<\/script>\s*/gi, "");
  html = html.replace(/<link[^>]+fonts\.googleapis\.com[^>]*>\s*/gi, "");
  html = html.replace(/<noscript>\s*<iframe[^>]+googletagmanager[\s\S]*?<\/iframe>\s*<\/noscript>\s*/gi, "");

  fs.writeFileSync(indexPath, html, "utf8");
  console.log(`✅ 已修正路径并移除标题: ${indexPath}`);
}

/** 递归复制目录 */
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });

  for (const file of fs.readdirSync(src)) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** 主流程 */
for (const v of variants) {
  const { src, target } = v;
  const absTarget = path.resolve(target);

  console.log(`\n📦 处理版本目录: ${src}`);

  // 1️⃣ 修复 index.html
  fixIndexHtml(src);

  // 2️⃣ 清理旧的 make-sense 文件
  cleanOldBuildFiles(absTarget);

  // 3️⃣ 拷贝新文件
  copyRecursive(src, absTarget);

  console.log(`✅ 新版本已复制 → ${absTarget}`);
}

console.log("\n🎉 postbuild 全部处理完成！");
