const { createRemoteApi } = require('./remoteApi');
const { createLocalStore } = require('./localStore');
const { calculateSyncOperations } = require('./sync');
const { installOrUpdateModpack, cancelInstallation, ensureLauncherReady } = require('./installer');
const { verifyModpack } = require('./verifier');
const { uninstallModpack } = require('./uninstaller');
const { ModpackError, ERROR_CODES, isCancellation } = require('./errors');

/**
 * Servicio de modpacks: todo lo que la aplicación sabe hacer con un modpack.
 * No conoce la interfaz ni el framework; recibe lo que necesita del entorno.
 *
 * @param {object} options
 * @param {string} options.modpacksDir - Carpeta donde se instalan los modpacks
 * @param {string} options.baseUrl - URL del servidor de modpacks
 * @param {() => string} options.getMinecraftPath - Devuelve la ruta de .minecraft
 * @param {(key: string) => any} options.getPreference - Lee una preferencia del usuario
 *        (copyOptions, createProfile, maxRamMB)
 */
function createModpackService({ modpacksDir, baseUrl, getMinecraftPath, getPreference }) {
  const ctx = {
    remote: createRemoteApi(baseUrl),
    store: createLocalStore(modpacksDir),
    getMinecraftPath,
    getPreference,
    // modpackId -> estado de la instalación en curso
    activeInstallations: new Map()
  };

  return {
    isInstalled: (modpackId) => ctx.store.isInstalled(modpackId),
    getLocalManifest: (modpackId) => ctx.store.readManifest(modpackId),
    getRemoteManifest: (modpackId) => ctx.remote.getModpack(modpackId),
    getRemoteList: () => ctx.remote.getModpackList(),
    getDataPath: (modpackId) => ctx.store.getDataPath(modpackId),

    calculateSyncOperations: (modpackId) => calculateSyncOperations(ctx, modpackId),
    installOrUpdate: (modpackId, onProgress) => installOrUpdateModpack(ctx, modpackId, onProgress),
    cancelInstallation: (modpackId) => cancelInstallation(ctx, modpackId),
    verify: (modpackId) => verifyModpack(ctx, modpackId),
    uninstall: (modpackId, onProgress) => uninstallModpack(ctx, modpackId, onProgress),
    ensureLauncherReady: (modpackId) => ensureLauncherReady(ctx, modpackId)
  };
}

module.exports = {
  createModpackService,
  ModpackError,
  ERROR_CODES,
  isCancellation
};
