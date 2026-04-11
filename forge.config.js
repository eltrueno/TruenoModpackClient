const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');
const { generateLatestYml } = require('./scripts/build/generate-latest-yml');

const GITHUB_OWNER = 'JesusMontoro';
const GITHUB_REPO = 'TruenoModpackClient';

function getOsxSignConfig() {
  if (!process.env.APPLE_IDENTITY) {
    return undefined;
  }

  return {
    identity: process.env.APPLE_IDENTITY
  };
}

function getOsxNotarizeConfig() {
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    return undefined;
  }

  return {
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  };
}

function getWindowsCertificateConfig() {
  const localCertificatePath = path.resolve(__dirname, './eltrueno-app-certificate.pfx');
  const envCertificatePath = process.env.WINDOWS_CERTIFICATE_FILE;
  const certificateFile = envCertificatePath && fs.existsSync(envCertificatePath)
    ? envCertificatePath
    : (fs.existsSync(localCertificatePath) ? localCertificatePath : null);

  if (!certificateFile) {
    return {};
  }

  return {
    certificateFile,
    certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD || undefined
  };
}

module.exports = {
  hooks: {
    postMake: async (forgeConfig, makeResults) => {
      for (const result of makeResults) {
        for (const artifactPath of result.artifacts) {
          if (result.platform === 'win32' && artifactPath.endsWith('Setup.exe')) {
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
    appCategoryType: "public.app-category.games",
    osxSign: getOsxSignConfig(),
    osxNotarize: getOsxNotarizeConfig(),
    afterCopy: [
      path.resolve(__dirname, "./scripts/package-hooks/copy-linux-wrapper.js")
    ],
    afterComplete: [
      path.resolve(__dirname, "./scripts/package-hooks/copy-linux-wrapper.js")
    ],
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
        authors: 'Raúl Jiménez (el_trueno)',
        iconUrl: "https://eltrueno.github.io/truenomodpack/icon.ico",
        setupIcon: path.resolve(__dirname, "./public/icon/icon.ico"),
        loadingGif: path.resolve(__dirname, "./public/TruenoModpack-loading-animation.gif"),
        title: "Trueno Modpack",
        productName: "Trueno Modpack",
        // IMPORTANTE: electron-updater maneja esto automáticamente
        // remoteReleases ya no es necesario
        noDelta: true, // Mantener deltas activados
        ...getWindowsCertificateConfig()
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: path.resolve(__dirname, "./public/icon/icon.png"),
          name: "truenomodpackclient", // En linux los nombres de paquete suelen ser en minúsculas
          bin: "truenomodpackclient",
          productName: "Trueno Modpack",
          description: "Installer for Trueno's Minecraft modpacks",
          maintainer: "Raúl Jiménez (el_trueno) <truenodeveloper@gmail.com>",
          homepage: "https://eltrueno.github.io/TruenoModpackClient/",
          desktopTemplate: path.resolve(__dirname, "./packaging/linux/truenomodpack.desktop.ejs"),
          categories: ["Game"],
          section: "games",
          scripts: {
            postinst: path.resolve(__dirname, "./packaging/linux/deb/postinst"),
            prerm: path.resolve(__dirname, "./packaging/linux/deb/prerm"),
            postrm: path.resolve(__dirname, "./packaging/linux/deb/postrm")
          }
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: path.resolve(__dirname, "./public/icon/icon.png"),
          name: "truenomodpackclient",
          bin: "truenomodpackclient",
          productName: "Trueno Modpack",
          description: "Installer for Trueno's Minecraft modpacks",
          homepage: "https://eltrueno.github.io/TruenoModpackClient/",
          execArguments: ["%U"],
          categories: ["Games"]
        }
      }
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: GITHUB_OWNER,
          name: GITHUB_REPO
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
