import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '.vite/build';

// main.js carga estos directorios con require() en tiempo de ejecución, así
// que no pasan por el bundler: se copian tal cual junto al main.js compilado.
const RUNTIME_DIRS = ['core', 'electron', 'shared'];

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function copyRuntimeDirs() {
  return {
    name: 'copy-runtime-dirs',
    buildStart() {
      // En desarrollo, recompilar (y reiniciar la app) al cambiar cualquiera de estos archivos
      for (const dir of RUNTIME_DIRS) {
        for (const file of listFiles(path.resolve(__dirname, 'src', dir))) {
          this.addWatchFile(file);
        }
      }
    },
    closeBundle() {
      for (const dir of RUNTIME_DIRS) {
        const target = path.resolve(__dirname, OUT_DIR, dir);
        fs.rmSync(target, { recursive: true, force: true });
        fs.cpSync(path.resolve(__dirname, 'src', dir), target, { recursive: true });
      }
    }
  };
}

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  plugins: [copyRuntimeDirs()],
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
    outDir: OUT_DIR,
    emptyOutDir: false
  },
  resolve: {
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext']
  }
}));
