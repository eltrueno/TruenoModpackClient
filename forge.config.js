const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const { generateLatestYml } = require('./generate-latest-yml');

module.exports = {
  hooks: {
    postMake: async (forgeConfig, makeResults) => {
      for (const result of makeResults) {
        for (const artifactPath of result.artifacts) {
          if (artifactPath.endsWith('Setup.exe')) {
            await generateLatestYml(artifactPath);
          }
        }
      }
    }
  },
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
        // IMPORTANTE: electron-updater maneja esto automáticamente
        // remoteReleases ya no es necesario
        noDelta: true // Mantener deltas activados
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: path.resolve(__dirname, "./public/icon/icon.png"),
          name: "truenomodpackclient", // En linux los nombres de paquete suelen ser en minúsculas
          productName: "Trueno Modpack",
          description: "Installer for Trueno's Minecraft modpacks",
          maintainer: "Raúl Jiménez (el_trueno) <truenodeveloper@gmail.com>",
          homepage: "https://eltrueno.github.io/TruenoModpackClient/",
          categories: ["Game"],
          section: "games"
        }
      }
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'eltrueno',
          name: 'TruenoModpackClient'
        },
        prerelease: false
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
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
