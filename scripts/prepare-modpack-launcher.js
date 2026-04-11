const axios = require('axios');
const loaderInstaller = require('../src/minecraft/loader-installer.js');
const minecraftProfile = require('../src/minecraft/profile.js');
const { AdaptiveDownloadManager } = require('../src/download');

const [, , modpackId, modpackName, minecraftVersion, modpackPath, manifestUrl] = process.argv;

async function main() {
  if (!modpackId || !modpackName || !minecraftVersion || !modpackPath || !manifestUrl) {
    throw new Error('Usage: electron scripts/prepare-modpack-launcher.js <modpackId> <modpackName> <minecraftVersion> <modpackPath> <manifestUrl>');
  }

  const versionId = `truenomodpack-${modpackId}-${minecraftVersion}`;
  const remoteManifest = (await axios.get(manifestUrl)).data;

  if (remoteManifest.loader_files && Object.keys(remoteManifest.loader_files).length > 0) {
    const loaderInstalled = await loaderInstaller.isLoaderInstalled(versionId);
    if (!loaderInstalled) {
      const manager = new AdaptiveDownloadManager(20, 8, 4);
      await loaderInstaller.installLoader(remoteManifest.loader_files, manager);
    }
  }

  const result = await minecraftProfile.createOrUpdateProfile(modpackId, modpackName, versionId, modpackPath);
  console.log(JSON.stringify({ versionId, result }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
