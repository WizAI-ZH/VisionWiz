import { defineConfig, loadEnv, UserConfig, UserConfigExport, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

export default ({ mode }: UserConfig): UserConfigExport => {
  process.env = { ...process.env, ...loadEnv(mode || 'development', process.cwd()) };

  const SRC_DIR = process.env.SRC_DIR || 'src';
  const OUT_DIR = process.env.OUT_DIR || 'dist';

  console.log(`[make-sense] build source: ${SRC_DIR}`);

  const htmlFixPlugin: Plugin = {
    name: 'html-entry-fix',
    enforce: 'pre',
    transformIndexHtml(html) {
      return html.replace(/\/src\/index\.tsx/g, `/${SRC_DIR}/index.tsx`);
    },
  };

  return defineConfig({
    root: __dirname,
    base: './',
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
      modulePreload: false,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        treeshake: true,
        output: {
          manualChunks: {
            lodash: ['lodash'],
            classnames: ['classnames'],
            runtime: ['react', 'react-is'],
            'runtime-dom': ['react-dom'],
            aiModels: [
              '@tensorflow/tfjs',
              '@tensorflow/tfjs-backend-cpu',
              '@tensorflow/tfjs-backend-webgl',
              '@tensorflow/tfjs-core',
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
      preprocessorOptions: {
        scss: {
          includePaths: [__dirname],
        },
      },
      modules: {
        generateScopedName:
          mode === 'development' ? '[name]__[local]___[hash:base64:5]' : '[hash:base64:8]',
        scopeBehaviour: 'local',
        localsConvention: 'camelCase',
      },
    },
  });
};
