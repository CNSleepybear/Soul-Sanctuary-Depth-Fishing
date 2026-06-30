import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

// ===== Rollup 输出配置：最大化压缩混淆 =====
const outputOptions = {
  compact: true,
  minifyInternalExports: true,
  generatedCode: {
    arrowFunctions: true,
    constBindings: true,
    objectShorthand: true,
    reservedNamesAsProps: false,
    symbols: false,
  },
} as const;

// 生产构建时剔除 console.* / debugger，减少包体与运行时噪音
const esbuildDrop = (isProd: boolean) =>
  isProd ? (['console', 'debugger'] as ('console' | 'debugger')[]) : [];

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    plugins: [
      electron([
        {
          // 主进程入口
          entry: 'src/main/index.ts',
          vite: {
            esbuild: {
              drop: esbuildDrop(isProd),
            },
            build: {
              outDir: 'dist/main',
              emptyOutDir: true,
              minify: 'esbuild',
              sourcemap: false,
              target: 'esnext',
              rollupOptions: {
                external: ['electron'],
                output: { ...outputOptions },
              },
            },
          },
        },
        {
          // Preload 脚本
          entry: 'src/main/preload.ts',
          vite: {
            esbuild: {
              drop: esbuildDrop(isProd),
            },
            build: {
              outDir: 'dist-electron',
              emptyOutDir: true,
              minify: 'esbuild',
              sourcemap: false,
              target: 'esnext',
              rollupOptions: {
                external: ['electron'],
                output: { ...outputOptions },
              },
            },
          },
          onstart(options) {
            options.reload();
          },
        },
      ]),
      renderer(),
    ],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@core': resolve(__dirname, 'src/renderer/core'),
        '@rendering': resolve(__dirname, 'src/renderer/rendering'),
        '@locations': resolve(__dirname, 'src/renderer/locations'),
        '@data': resolve(__dirname, 'src/renderer/data'),
        '@ui': resolve(__dirname, 'src/renderer/ui'),
      },
    },
    root: '.',
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
      minify: 'esbuild',
      sourcemap: false,
      target: 'esnext',
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          ...outputOptions,
          manualChunks: {
            vendor: ['three'],
          },
        },
      },
    },
    esbuild: {
      drop: esbuildDrop(isProd),
    },
    css: {
      devSourcemap: false,
    },
  };
});
