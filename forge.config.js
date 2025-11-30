const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, "./public/icon/icon"),
    name: "TruenoModpackClient",
    executableName: "TruenoModpack",
    productName: "Trueno Modpack",
    appBundleId: "es.eltrueno.modpack.client",
    win32metadata: {
      CompanyName: "Raúl Jiménez (el_trueno)",
      FileDescription: "Trueno Modpack",
      OriginalFilename: "TruenoModpack.exe",
      ProductName: "Trueno Modpack",
      InternalName: "TruenoModpackClient"
    },
    ignore: [
      /^\/src$/,
      /^\/\.vscode$/,
      /^\/node_modules\/\.cache/,
      /^\/node_modules\/.*\/(test|tests|__tests__)\/?/,
      /^\/scripts$/,
      /README\.md$/,
      /\.gitignore$/,
      /\.eslintrc\.json$/,
      /\.prettier(rc|\.config\.js)?$/,
      /tsconfig\.json$/,
      /package-lock\.json$/,
      /\.env(\..+)?$/,
      /^\/out$/
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "TruenoModpackClient",
        exe: "TruenoModpack.exe",
        setupExe: "TruenoModpackSetup.exe",
        certificateFile: './eltrueno-app-certificate.pfx',
        authors: 'Raúl Jiménez (el_trueno)',
        iconUrl: "https://eltrueno.github.io/truenomodpack/icon.ico",
        setupIcon: path.resolve(__dirname, "./public/icon/icon.ico"),
        loadingGif: path.resolve(__dirname, "./public/TruenoModpack-loading-animation.gif"),
        title: "Trueno Modpack",
        productName: "Trueno Modpack",
        remoteReleases: "https://truenomodpack.eltrueno.es/update/win32/:version",
        noDelta: false
      },
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: path.resolve(__dirname, 'vite.main.config.mjs'),
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: path.resolve(__dirname, 'vite.preload.config.mjs'),
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: path.resolve(__dirname, 'vite.renderer.config.mjs'),
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
