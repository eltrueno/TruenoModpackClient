const minecraftProfile = require('../src/minecraft/profile.js');

const [, , modpackId, modpackName, versionId, modpackPath] = process.argv;

async function main() {
  if (!modpackId || !modpackName || !versionId || !modpackPath) {
    throw new Error('Usage: electron scripts/sync-minecraft-profile.js <modpackId> <modpackName> <versionId> <modpackPath>');
  }

  const result = await minecraftProfile.createOrUpdateProfile(modpackId, modpackName, versionId, modpackPath);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
