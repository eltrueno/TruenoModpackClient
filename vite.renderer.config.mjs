import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader'
import pkg from './package.json';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [vue(), svgLoader()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  css: {
    postcss: './postcss.config.js',
  }
});
