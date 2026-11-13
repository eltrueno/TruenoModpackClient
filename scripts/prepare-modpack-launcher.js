/**
 * Utilidad de desarrollo: instala el loader de un modpack (si falta) y crea
 * o actualiza su perfil en el launcher de Minecraft.
 *
 * Usa solo src/core, así que se ejecuta con Node, sin Electron:
 *   node scripts/prepare-modpack-launcher.js <modpackId> <modpackName> <minecraftVersion> <modpackPath> <manifestUrl>
 */
const os = require('os');
const axios = require('axios');

const { resolveMinecraftPath } = require('../src/core/minecraft/paths');
const loaderInstaller = require('../src/core/minecraft/loader-installer');
const minecraftProfile = require('../src/core/minecraft/profile');
const { AdaptiveDownloadManager } = require('../src/core/download');

const [, , modpackId, modpackName, minecraftVersion, modpackPath, manifestUrl] = process.argv;

async function main() {
  if (!modpackId || !modpackName || !minecraftVersion || !modpackPath || !manifestUrl) {
    throw new Error('Usage: node scripts/prepare-modpack-launcher.js <modpackId> <modpackName> <minecraftVersion> <modpackPath> <manifestUrl>');
  }

  const minecraftPath = resolveMinecraftPath({
    platform: process.platform,
    home: os.homedir(),
    appData: process.env.APPDATA,
    env: process.env
  });

  const versionId = `truenomodpack-${modpackId}-${minecraftVersion}`;
  const remoteManifest = (await axios.get(manifestUrl)).data;

  if (remoteManifest.loader_files && Object.keys(remoteManifest.loader_files).length > 0) {
    if (!await loaderInstaller.isLoaderInstalled(minecraftPath, versionId)) {
      await loaderInstaller.installLoader(minecraftPath, remoteManifest.loader_files, new AdaptiveDownloadManager(20, 8, 4));
    }
  }

  const result = await minecraftProfile.createOrUpdateProfile({ minecraftPath, modpackId, modpackName, versionId, modpackPath });
  console.log(JSON.stringify({ versionId, result }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
