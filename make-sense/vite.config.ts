import { defineConfig, loadEnv, UserConfig, UserConfigExport, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import fs from 'fs';
import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

export default ({ mode }: UserConfig): UserConfigExport => {
  process.env = { ...process.env, ...loadEnv(mode || 'development', process.cwd()) };

  const SRC_DIR = process.env.SRC_DIR || 'src';
  const OUT_DIR = process.env.OUT_DIR || 'dist';

  console.log(`🔧 当前构建源码目录: ${SRC_DIR}`);

  // 一个简单的自定义插件：在构建时替换 index.html 中源码路径
  const htmlFixPlugin: Plugin = {
    name: 'html-entry-fix',
    enforce: 'pre', // ✅ 提前执行，避免被其他插件覆盖
    transformIndexHtml(html) {
      const newHtml = html.replace(/\/src\/index\.tsx/g, `/${SRC_DIR}/index.tsx`);
      console.log(`🧩 HTML入口已替换为 -> /${SRC_DIR}/index.tsx`);
      return newHtml;
    },
  };

  return defineConfig({
    root: __dirname,                  // ✅ 告诉 Vite "index.html" 就在项目根目录
    base: './',                       // ✅ 输出路径相对化（便于 postbuild 修正路径）
    plugins: [react(), htmlFixPlugin],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, SRC_DIR),
      },
    },
    build: {
      outDir: OUT_DIR,
      minify: 'terser',
      sourcemap: mode === 'development',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'), // ✅ 根目录HTML
        treeshake: true,
        output: {
          manualChunks: {
            lodash: ['lodash'],
            classnames: ['classnames'],
            runtime: ['react', 'react-is'],
            'runtime-dom': ['react-dom'],
            ai: [
              '@tensorflow/tfjs',
              '@tensorflow/tfjs-backend-cpu',
              '@tensorflow/tfjs-backend-webgl',
              '@tensorflow/tfjs-core',
            ],
            models: [
              '@tensorflow-models/coco-ssd',
              '@tensorflow-models/posenet',
            ],
            ui: ['@mui/material', '@mui/system'],
            moment: ['moment'],
          },
        },
      },
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
    },
    css: {
      modules: {
        generateScopedName: mode === 'development'
          ? '[name]__[local]___[hash:base64:5]'
          : '[hash:base64:8]',
        scopeBehaviour: 'local',
        localsConvention: 'camelCase',
      },
    },
  });
};
