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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5tYWluLmNvbmZpZy5tanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx0cnVlblxcXFxEb2N1bWVudHNcXFxcRWxlY3Ryb25BcHBzXFxcXFRydWVub01vZHBhY2tDbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHRydWVuXFxcXERvY3VtZW50c1xcXFxFbGVjdHJvbkFwcHNcXFxcVHJ1ZW5vTW9kcGFja0NsaWVudFxcXFx2aXRlLm1haW4uY29uZmlnLm1qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvdHJ1ZW4vRG9jdW1lbnRzL0VsZWN0cm9uQXBwcy9UcnVlbm9Nb2RwYWNrQ2xpZW50L3ZpdGUubWFpbi5jb25maWcubWpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBidWlsdGluTW9kdWxlcyB9IGZyb20gJ21vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSAndml0ZS1wbHVnaW4tc3RhdGljLWNvcHknO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBwbHVnaW5zOiBbXG4gICAgdml0ZVN0YXRpY0NvcHkoe1xuICAgICAgdGFyZ2V0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnc3JjL21pbmVjcmFmdC8qKi8qJyxcbiAgICAgICAgICBkZXN0OiAnbWluZWNyYWZ0J1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiBub3JtYWxpemVQYXRoKCdzcmMvbWluZWNyYWZ0LyoqLyonKSxcbiAgICAgICAgICBkZXN0OiAnbWluZWNyYWZ0J1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnc3JjL3V0aWxzLyoqLyonLFxuICAgICAgICAgIGRlc3Q6ICd1dGlscydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHNyYzogbm9ybWFsaXplUGF0aCgnc3JjL3V0aWxzLyoqLyonKSxcbiAgICAgICAgICBkZXN0OiAndXRpbHMnXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgfSlcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL21haW4uanMnKSxcbiAgICAgIGZvcm1hdHM6IFsnY2pzJ10sXG4gICAgICBmaWxlTmFtZTogKCkgPT4gJ1tuYW1lXS5qcydcbiAgICB9LFxuICAgIGNvcHlQdWJsaWNEaXI6IGZhbHNlLFxuICAgIHNvdXJjZW1hcDogbW9kZSA9PT0gJ2RldmVsb3BtZW50JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdbbmFtZV0uanMnXG4gICAgICB9LFxuICAgICAgZXh0ZXJuYWw6IFtcbiAgICAgICAgJ2VsZWN0cm9uJyxcbiAgICAgICAgLi4uYnVpbHRpbk1vZHVsZXMsXG4gICAgICAgIC4uLmJ1aWx0aW5Nb2R1bGVzLm1hcChtID0+IGBub2RlOiR7bX1gKVxuICAgICAgXSxcbiAgICB9LFxuICAgIG91dERpcjogJy52aXRlL2J1aWxkJyxcbiAgICBlbXB0eU91dERpcjogZmFsc2VcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGJyb3dzZXJGaWVsZDogZmFsc2UsXG4gICAgbWFpbkZpZWxkczogWydtb2R1bGUnLCAnanNuZXh0Om1haW4nLCAnanNuZXh0J11cbiAgfVxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFxWCxTQUFTLGNBQWMscUJBQXFCO0FBQ2phLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sVUFBVTtBQUNqQixTQUFTLHNCQUFzQjtBQUgvQixJQUFNLG1DQUFtQztBQU16QyxJQUFPLDJCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFNBQVM7QUFBQSxJQUNQLGVBQWU7QUFBQSxNQUNiLFNBQVM7QUFBQSxRQUNQO0FBQUEsVUFDRSxLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxVQUNFLEtBQUssY0FBYyxvQkFBb0I7QUFBQSxVQUN2QyxNQUFNO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxVQUNFLEtBQUs7QUFBQSxVQUNMLE1BQU07QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFVBQ0UsS0FBSyxjQUFjLGdCQUFnQjtBQUFBLFVBQ25DLE1BQU07QUFBQSxRQUNSO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLEtBQUs7QUFBQSxNQUNILE9BQU8sS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUM1QyxTQUFTLENBQUMsS0FBSztBQUFBLE1BQ2YsVUFBVSxNQUFNO0FBQUEsSUFDbEI7QUFBQSxJQUNBLGVBQWU7QUFBQSxJQUNmLFdBQVcsU0FBUztBQUFBLElBQ3BCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsTUFDQSxVQUFVO0FBQUEsUUFDUjtBQUFBLFFBQ0EsR0FBRztBQUFBLFFBQ0gsR0FBRyxlQUFlLElBQUksT0FBSyxRQUFRLENBQUMsRUFBRTtBQUFBLE1BQ3hDO0FBQUEsSUFDRjtBQUFBLElBQ0EsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLGNBQWM7QUFBQSxJQUNkLFlBQVksQ0FBQyxVQUFVLGVBQWUsUUFBUTtBQUFBLEVBQ2hEO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
