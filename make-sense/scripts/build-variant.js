const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function removeJunction(junctionPath) {
  if (!fs.existsSync(junctionPath)) return;

  const stat = fs.lstatSync(junctionPath);
  if (!stat.isSymbolicLink() && !stat.isDirectory()) {
    throw new Error(`${junctionPath} is not a removable source junction`);
  }

  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "rmdir", junctionPath], { stdio: "inherit" });
  } else {
    fs.rmSync(junctionPath, { force: true, recursive: false });
  }
}

function createSourceJunction(sourceDir, tempSrc) {
  if (fs.existsSync(tempSrc)) {
    const stat = fs.lstatSync(tempSrc);
    if (!stat.isSymbolicLink()) {
      throw new Error(`${tempSrc} already exists and is not a build junction`);
    }
    removeJunction(tempSrc);
  }

  fs.symlinkSync(sourceDir, tempSrc, process.platform === "win32" ? "junction" : "dir");
}

function buildVariant(variant) {
  const root = path.resolve(__dirname, "..");
  const srcDir = path.join(root, `src_${variant}_ver`);
  const tempSrc = path.join(root, "src");

  if (!fs.existsSync(srcDir)) {
    console.error(`[make-sense] source variant not found: ${srcDir}`);
    process.exit(1);
  }

  try {
    createSourceJunction(srcDir, tempSrc);

    console.log(`[make-sense] building ${variant} from ${srcDir}`);
    const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
    const nodeOptions = [process.env.NODE_OPTIONS, "--experimental-global-webcrypto"]
      .filter(Boolean)
      .join(" ");
    const preferredVoltaNode =
      process.platform === "win32" && process.env.ProgramFiles
        ? path.join(process.env.ProgramFiles, "Volta", "node.exe")
        : null;
    const nodeCommand =
      preferredVoltaNode && fs.existsSync(preferredVoltaNode)
        ? preferredVoltaNode
        : process.platform === "win32"
          ? "node.exe"
          : "node";

    execFileSync(nodeCommand, [viteCli, "build"], {
      stdio: "inherit",
      env: {
        ...process.env,
        SRC_DIR: "src",
        OUT_DIR: `dist_${variant}`,
        NODE_OPTIONS: nodeOptions,
      },
    });
    console.log(`[make-sense] build complete: dist_${variant}`);
  } catch (err) {
    console.error(`[make-sense] build failed: ${variant}`, err);
    process.exitCode = 1;
  } finally {
    try {
      removeJunction(tempSrc);
    } catch (cleanupError) {
      console.warn(`[make-sense] failed to remove temporary source junction: ${cleanupError.message}`);
    }
  }
}

const variant = process.argv[2];
if (!variant) {
  console.error("[make-sense] missing variant. Example: node scripts/build-variant.js zh");
  process.exit(1);
}

buildVariant(variant);
