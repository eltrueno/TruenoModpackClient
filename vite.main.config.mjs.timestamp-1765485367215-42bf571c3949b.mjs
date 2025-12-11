// vite.main.config.mjs
import { defineConfig, normalizePath } from "file:///C:/Users/truen/Documents/ElectronApps/TruenoModpackClient/node_modules/vite/dist/node/index.js";
import { builtinModules } from "module";
import path from "path";
import { viteStaticCopy } from "file:///C:/Users/truen/Documents/ElectronApps/TruenoModpackClient/node_modules/vite-plugin-static-copy/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\truen\\Documents\\ElectronApps\\TruenoModpackClient";
var vite_main_config_default = defineConfig(({ mode }) => ({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "src/minecraft/**/*",
          dest: "minecraft"
        },
        {
          src: normalizePath("src/minecraft/**/*"),
          dest: "minecraft"
        },
        {
          src: "src/utils/**/*",
          dest: "utils"
        },
        {
          src: normalizePath("src/utils/**/*"),
          dest: "utils"
        },
        {
          src: "src/download/**/*",
          dest: "download"
        },
        {
          src: normalizePath("src/download/**/*"),
          dest: "download"
        }
      ]
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__vite_injected_original_dirname, "src/main.js"),
      formats: ["cjs"],
      fileName: () => "[name].js"
    },
    copyPublicDir: false,
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        entryFileNames: "[name].js"
      },
      external: [
        "electron",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`)
      ]
    },
    outDir: ".vite/build",
    emptyOutDir: false
  },
  resolve: {
    browserField: false,
    mainFields: ["module", "jsnext:main", "jsnext"]
  }
}));
export {
  vite_main_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5tYWluLmNvbmZpZy5tanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx0cnVlblxcXFxEb2N1bWVudHNcXFxcRWxlY3Ryb25BcHBzXFxcXFRydWVub01vZHBhY2tDbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHRydWVuXFxcXERvY3VtZW50c1xcXFxFbGVjdHJvbkFwcHNcXFxcVHJ1ZW5vTW9kcGFja0NsaWVudFxcXFx2aXRlLm1haW4uY29uZmlnLm1qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvdHJ1ZW4vRG9jdW1lbnRzL0VsZWN0cm9uQXBwcy9UcnVlbm9Nb2RwYWNrQ2xpZW50L3ZpdGUubWFpbi5jb25maWcubWpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBidWlsdGluTW9kdWxlcyB9IGZyb20gJ21vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSAndml0ZS1wbHVnaW4tc3RhdGljLWNvcHknO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBwbHVnaW5zOiBbXG4gICAgdml0ZVN0YXRpY0NvcHkoe1xuICAgICAgdGFyZ2V0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnc3JjL21pbmVjcmFmdC8qKi8qJyxcbiAgICAgICAgICBkZXN0OiAnbWluZWNyYWZ0J1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiBub3JtYWxpemVQYXRoKCdzcmMvbWluZWNyYWZ0LyoqLyonKSxcbiAgICAgICAgICBkZXN0OiAnbWluZWNyYWZ0J1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnc3JjL3V0aWxzLyoqLyonLFxuICAgICAgICAgIGRlc3Q6ICd1dGlscydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHNyYzogbm9ybWFsaXplUGF0aCgnc3JjL3V0aWxzLyoqLyonKSxcbiAgICAgICAgICBkZXN0OiAndXRpbHMnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICdzcmMvZG93bmxvYWQvKiovKicsXG4gICAgICAgICAgZGVzdDogJ2Rvd25sb2FkJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiBub3JtYWxpemVQYXRoKCdzcmMvZG93bmxvYWQvKiovKicpLFxuICAgICAgICAgIGRlc3Q6ICdkb3dubG9hZCdcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgbGliOiB7XG4gICAgICBlbnRyeTogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9tYWluLmpzJyksXG4gICAgICBmb3JtYXRzOiBbJ2NqcyddLFxuICAgICAgZmlsZU5hbWU6ICgpID0+ICdbbmFtZV0uanMnXG4gICAgfSxcbiAgICBjb3B5UHVibGljRGlyOiBmYWxzZSxcbiAgICBzb3VyY2VtYXA6IG1vZGUgPT09ICdkZXZlbG9wbWVudCcsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnW25hbWVdLmpzJ1xuICAgICAgfSxcbiAgICAgIGV4dGVybmFsOiBbXG4gICAgICAgICdlbGVjdHJvbicsXG4gICAgICAgIC4uLmJ1aWx0aW5Nb2R1bGVzLFxuICAgICAgICAuLi5idWlsdGluTW9kdWxlcy5tYXAobSA9PiBgbm9kZToke219YClcbiAgICAgIF0sXG4gICAgfSxcbiAgICBvdXREaXI6ICcudml0ZS9idWlsZCcsXG4gICAgZW1wdHlPdXREaXI6IGZhbHNlXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBicm93c2VyRmllbGQ6IGZhbHNlLFxuICAgIG1haW5GaWVsZHM6IFsnbW9kdWxlJywgJ2pzbmV4dDptYWluJywgJ2pzbmV4dCddXG4gIH1cbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVgsU0FBUyxjQUFjLHFCQUFxQjtBQUNqYSxTQUFTLHNCQUFzQjtBQUMvQixPQUFPLFVBQVU7QUFDakIsU0FBUyxzQkFBc0I7QUFIL0IsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTywyQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxTQUFTO0FBQUEsSUFDUCxlQUFlO0FBQUEsTUFDYixTQUFTO0FBQUEsUUFDUDtBQUFBLFVBQ0UsS0FBSztBQUFBLFVBQ0wsTUFBTTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsVUFDRSxLQUFLLGNBQWMsb0JBQW9CO0FBQUEsVUFDdkMsTUFBTTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsVUFDRSxLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxVQUNFLEtBQUssY0FBYyxnQkFBZ0I7QUFBQSxVQUNuQyxNQUFNO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxVQUNFLEtBQUs7QUFBQSxVQUNMLE1BQU07QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFVBQ0UsS0FBSyxjQUFjLG1CQUFtQjtBQUFBLFVBQ3RDLE1BQU07QUFBQSxRQUNSO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLEtBQUs7QUFBQSxNQUNILE9BQU8sS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUM1QyxTQUFTLENBQUMsS0FBSztBQUFBLE1BQ2YsVUFBVSxNQUFNO0FBQUEsSUFDbEI7QUFBQSxJQUNBLGVBQWU7QUFBQSxJQUNmLFdBQVcsU0FBUztBQUFBLElBQ3BCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsTUFDQSxVQUFVO0FBQUEsUUFDUjtBQUFBLFFBQ0EsR0FBRztBQUFBLFFBQ0gsR0FBRyxlQUFlLElBQUksT0FBSyxRQUFRLENBQUMsRUFBRTtBQUFBLE1BQ3hDO0FBQUEsSUFDRjtBQUFBLElBQ0EsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLGNBQWM7QUFBQSxJQUNkLFlBQVksQ0FBQyxVQUFVLGVBQWUsUUFBUTtBQUFBLEVBQ2hEO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
