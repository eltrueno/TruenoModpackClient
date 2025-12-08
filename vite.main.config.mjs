import { defineConfig, normalizePath } from 'vite';
import { builtinModules } from 'module';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/minecraft/**/*',
          dest: 'minecraft'
        },
        {
          src: normalizePath('src/minecraft/**/*'),
          dest: 'minecraft'
        },
        {
          src: 'src/utils/**/*',
          dest: 'utils'
        },
        {
          src: normalizePath('src/utils/**/*'),
          dest: 'utils'
        },
        {
          src: 'src/download/**/*',
          dest: 'download'
        },
        {
          src: normalizePath('src/download/**/*'),
          dest: 'download'
        }
      ]
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      formats: ['cjs'],
      fileName: () => '[name].js'
    },
    copyPublicDir: false,
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        entryFileNames: '[name].js'
      },
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`)
      ],
    },
    outDir: '.vite/build',
    emptyOutDir: false
  },
  resolve: {
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext']
  }
}));
