
// package.js (smart incremental build with compressFolder)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

/* ========================
 * 基本路径
 * ======================== */
const projectRoot = __dirname;
const distDir = path.join(projectRoot, 'dist');
const winUnpackedDir = path.join(distDir, 'win-unpacked'); // electron-builder 的未安装目录

// 你的项目工具与资源
const toolsDir = path.join(projectRoot, 'tools');
const wizResizerPath = path.join(toolsDir, 'WizResizer.exe');
const miniLEDdisplay_advPath = path.join(toolsDir, 'miniLEDdisplay_adv');

// 复制到 win-unpacked 的位置
const resourcesToolsDir = path.join(winUnpackedDir, 'resources', 'tools');

// 输出目录与压缩包
const outputDir = path.join(projectRoot, 'out');
const compressedFile = path.join(outputDir, 'VisionWiz-win32-x64.7z');

// 🎯 新的统一 NSIS 脚本（多语言支持）
const nsisScriptPath = path.join(outputDir, 'nsis_package_script_unzip_file_visionwiz.nsi');

// 外部工具（建议 NSIS 安装到无空格路径，如 C:\Tools\NSIS）
// const makensisPath = 'C:\\Users\\chanw\\Desktop\\useful tools\\NSIS\\Bin\\makensis.exe'; // <-- 将 NSIS 安装到无空格路径并调整这里
const makensisPath = path.join('C:', 'Program Files (x86)', 'NSIS', 'makensis.exe');
const sevenZipPath = 'C:\\Program Files\\7-Zip\\7z.exe';   // 7-Zip 路径允许空格（spawn shell:false 没问题）

// 可选：trainOutput
const trainOutputSrc = path.join(outputDir, 'trainOutput');
const trainOutputDest = path.join(winUnpackedDir, 'trainOutput');

// 构建状态清单
const manifestPath = path.join(outputDir, 'build-manifest.json');

/* ========================
 * 基础工具函数
 * ======================== */
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`目录不存在: ${dir}`);
    process.exit(1);
  }
}
function ensureFileExists(file) {
  if (!fs.existsSync(file)) {
    console.error(`文件不存在: ${file}`);
    process.exit(1);
  }
}

function copyFolderSync(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`源目录不存在: ${src}`);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyFolderSync(s, d);
    else fs.copyFileSync(s, d);
  }
}
function copyFileSyncSafe(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`源文件不存在: ${src}`);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

function nsisPath(p) {
  // NSIS 路径需要把反斜杠转义
  return p.replace(/\\/g, '\\\\');
}

function run(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[cmd, ...args].map(v => (String(v).includes(' ') ? `"${v}"` : v)).join(' ')}`);
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: false, // 关键：避免 Windows 空格路径截断
      ...options,
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码: ${code}`))));
  });
}

/* ========================
 * 压缩函数（已补齐）
 * ======================== */
async function compressFolder(folderPath, outputFile) {
  ensureDirExists(folderPath);
  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // 清理旧包
  if (fs.existsSync(outputFile)) {
    try {
      fs.rmSync(outputFile, { force: true });
    } catch { }
  }

  const args = [
    'a', '-t7z',
    '-mx=7', '-m0=LZMA2', '-mfb=273', '-md=128m', '-mmt=on', '-ms=on', '-y',
    outputFile,
    path.join(folderPath, '*') // 让 7z 自行处理通配符
  ];
  await run(sevenZipPath, args);
}

/* ========================
 * 签名/哈希相关
 * ======================== */
function sha1(data) {
  return crypto.createHash('sha1').update(data).digest('hex');
}

// 简单读取文件 hash（逐个文件）
function fileHash(file) {
  const buf = fs.readFileSync(file);
  return sha1(buf);
}

// 目录快照签名：文件数量 + 总大小 + 最大 mtime（避免对每个文件做 hash，性能更好）
function dirSnapshotSignature(dir) {
  if (!fs.existsSync(dir)) return null;
  let files = 0;
  let bytes = 0;
  let maxMtime = 0;

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      const st = fs.statSync(p);
      if (e.isDirectory()) {
        walk(p);
      } else {
        files++;
        bytes += st.size;
        const m = st.mtimeMs || st.mtime.getTime();
        if (m > maxMtime) maxMtime = m;
      }
    }
  }

  walk(dir);
  return `${files}|${bytes}|${maxMtime}`;
}

// 读取/保存 manifest
function loadManifest() {
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return {};
  }
}
function saveManifest(m) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2), 'utf8');
}

/* ========================
 * 智能判定
 * ======================== */
function calcInputsSignatureForUnpacked() {
  // 可按你的项目实际加入更多关键输入文件/目录
  const inputs = [
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'package-lock.json'), // 或 yarn.lock/pnpm-lock.yaml
    // 你的打包入口/资源（示例）
    path.join(projectRoot, 'main_bootstrap.js'),
    path.join(projectRoot, 'utils_protected'),
    // 如果有 electron-builder.yml，也应把它加入
  ];

  const parts = [];
  for (const p of inputs) {
    if (fs.existsSync(p)) {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        parts.push(`${p}:${dirSnapshotSignature(p)}`);
      } else {
        parts.push(`${p}:${fileHash(p)}`);
      }
    } else {
      parts.push(`${p}:<missing>`);
    }
  }
  return sha1(parts.join('|'));
}

function shouldBuildUnpacked(manifest) {
  const current = calcInputsSignatureForUnpacked();
  const prev = manifest.unpackedInputsSig;
  const unpackedExists = fs.existsSync(winUnpackedDir);
  if (!unpackedExists) return { need: true, current };

  // 放宽：只根据 inputs 判定，目录快照仅用于记录
  const changed = current !== prev;
  const dirSig = dirSnapshotSignature(winUnpackedDir);
  return { need: changed, current, dirSig };
}

function shouldCompress7z(manifest) {
  const unpackedSig = dirSnapshotSignature(winUnpackedDir);
  const prevUnpackedSig = manifest.unpackedDirSigFor7z;
  const has7z = fs.existsSync(compressedFile);
  if (!has7z) return { need: true, unpackedSig };
  const changed = unpackedSig !== prevUnpackedSig;
  return { need: changed, unpackedSig };
}

function shouldRunNSIS(manifest, scriptPath) {
  const scriptMtime = fs.existsSync(scriptPath) ? fs.statSync(scriptPath).mtimeMs : 0;
  const prev = manifest[`nsis_${path.basename(scriptPath)}_sig`];
  const base = [
    scriptPath,
    String(scriptMtime),
    compressedFile,
    fs.existsSync(compressedFile) ? String(fs.statSync(compressedFile).mtimeMs) : '0',
  ].join('|');
  const current = sha1(base);
  const need = current !== prev;
  return { need, current };
}

/* ========================
 * 具体步骤
 * ======================== */
async function stepBuildUnpacked(manifest) {
  console.log('🔨 检查是否需要生成 win-unpacked...');
  const check = shouldBuildUnpacked(manifest);
  console.log('Debug shouldBuildUnpacked:', {
    prevInputsSig: manifest.unpackedInputsSig,
    currInputsSig: check.current,
    prevDirSig: manifest.unpackedDirSig,
    currDirSig: check.dirSig || dirSnapshotSignature(winUnpackedDir),
    winUnpackedExists: fs.existsSync(winUnpackedDir),
    need: check.need,
  });

  if (!check.need) {
    console.log('✅ 跳过：win-unpacked 无变化');
    return { updated: false, dirSig: check.dirSig || dirSnapshotSignature(winUnpackedDir), inputsSig: check.current };
  }

  process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
  await run('npx', ['electron-builder', '--win', '--x64', '--dir']);

  const dirSig = dirSnapshotSignature(winUnpackedDir);
  console.log('✅ 已生成 win-unpacked');
  return { updated: true, dirSig, inputsSig: check.current };
}

async function stepCopyExtraResources() {
  console.log('📁 同步额外资源到 win-unpacked...');
  ensureDirExists(winUnpackedDir);

  if (fs.existsSync(trainOutputSrc)) {
    console.log('  - 复制 trainOutput...');
    copyFolderSync(trainOutputSrc, trainOutputDest);
  } else {
    console.log('  - 跳过 trainOutput：源不存在');
  }

  if (!fs.existsSync(wizResizerPath)) throw new Error(`缺少 WizResizer.exe: ${wizResizerPath}`);
  if (!fs.existsSync(miniLEDdisplay_advPath)) throw new Error(`缺少 miniLEDdisplay_adv 目录: ${miniLEDdisplay_advPath}`);

  console.log('  - 复制 WizResizer.exe / miniLEDdisplay_adv -> resources/tools...');
  copyFileSyncSafe(wizResizerPath, path.join(resourcesToolsDir, 'WizResizer.exe'));
  copyFolderSync(miniLEDdisplay_advPath, path.join(resourcesToolsDir, 'miniLEDdisplay_adv'));
  console.log('✅ 额外资源已同步');
}

async function stepCompress7z(manifest) {
  console.log('🗜️ 检查是否需要压缩 7z...');
  const check = shouldCompress7z(manifest);
  if (!check.need) {
    console.log('✅ 跳过：7z 无变化');
    return { updated: false, unpackedSig: check.unpackedSig };
  }

  await compressFolder(winUnpackedDir, compressedFile);
  console.log('✅ 已生成 7z：', compressedFile);
  return { updated: true, unpackedSig: check.unpackedSig };
}

async function stepRunNSIS(manifest) {
  // 强烈建议将 NSIS 安装在无空格路径，例如 C:\Tools\NSIS，并更新 makensisPath
  ensureFileExists(makensisPath);
  ensureFileExists(nsisScriptPath);
  ensureFileExists(compressedFile);

  const pkg = require('./package.json');
  const defines = {
    V7Z_PATH: nsisPath(compressedFile),
    OUTDIR: nsisPath(outputDir),
    PRODUCT_NAME: pkg.productName || 'VisionWiz',
    PRODUCT_VERSION: pkg.version || '1.0.0',
    // 🎯 添加更多必要的定义
    ZIP_DIR: nsisPath(path.join(outputDir, '7-Zip')),
    ICON_PATH: nsisPath(path.join(projectRoot, 'icons', 'visionwiz_logo.ico')),
    LICENSE_PATH: nsisPath(path.join(projectRoot, 'LICENSE')),
    README_PATH: nsisPath(path.join(projectRoot, 'README.md')),
  };

  const check = shouldRunNSIS(manifest, nsisScriptPath);
  if (!check.need) {
    console.log(`✅ 跳过：${path.basename(nsisScriptPath)} 无变化`);
    return;
  }

  console.log(`🛠️ 运行 NSIS：${path.basename(nsisScriptPath)} ...`);
  
  // 构建 NSIS 命令行参数
  const nsisArgs = [
    '/V4', // 详细输出
    ...Object.entries(defines).map(([k, v]) => `/D${k}=${v}`),
    nsisScriptPath
  ];

  await run(makensisPath, nsisArgs);
  
  // 记录签名
  manifest[`nsis_${path.basename(nsisScriptPath)}_sig`] = check.current;
  saveManifest(manifest);

  console.log('✅ NSIS 编译完成');
}

/* ========================
 * 主函数
 * ======================== */
async function main() {
  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 前置检查：7z 必须存在；NSIS 稍后在执行前检查
    ensureFileExists(sevenZipPath);

    const manifest = loadManifest();

    const unpacked = await stepBuildUnpacked(manifest);
    await stepCopyExtraResources();
    const zipped = await stepCompress7z(manifest);

    // 更新 manifest（unpacked 的签名）
    manifest.unpackedInputsSig = unpacked.inputsSig;
    manifest.unpackedDirSig = unpacked.dirSig;
    manifest.unpackedDirSigFor7z = zipped.unpackedSig;
    saveManifest(manifest);

    await stepRunNSIS(manifest);

    console.log('\n🎉 全流程完成，产物目录：', outputDir);
  } catch (err) {
    console.error('❌ 构建失败：', err);
    process.exit(1);
  }
}

main();
