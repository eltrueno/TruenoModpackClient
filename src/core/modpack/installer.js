const fs = require('fs').promises;
const path = require('path');
const pLimit = require('p-limit');

const logger = require('../logger');
const { calculateFileHash } = require('../utils/file-utils');
const { AdaptiveDownloadManager } = require('../download');
const loaderInstaller = require('../minecraft/loader-installer');
const minecraftProfile = require('../minecraft/profile');
const minecraftOptions = require('../minecraft/options');

const { calculateSyncOperations } = require('./sync');
const { ModpackError, ERROR_CODES, isCancellation } = require('./errors');

function getVersionId(modpackId, minecraftVersion) {
  return `truenomodpack-${modpackId}-${minecraftVersion}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function hasLoaderFiles(manifest) {
  return Boolean(manifest.loader_files) && Object.keys(manifest.loader_files).length > 0;
}

function createOrUpdateProfile(ctx, modpackId, modpackName, versionId) {
  return minecraftProfile.createOrUpdateProfile({
    minecraftPath: ctx.getMinecraftPath(),
    modpackId,
    modpackName,
    versionId,
    modpackPath: ctx.store.getDataPath(modpackId),
    maxRamMB: ctx.getPreference('maxRamMB')
  });
}

/**
 * Instala el loader (Fabric, Forge...) en .minecraft si aún no lo está.
 * @returns {Promise<boolean>} true si se ha instalado ahora
 */
async function installLoaderIfNeeded(ctx, remote, versionId, state, onProgress) {
  if (!hasLoaderFiles(remote)) return false;

  const minecraftPath = ctx.getMinecraftPath();
  const loaderName = capitalize(remote.loader);

  onProgress({
    stage: 'loader', progress: 0,
    message: `Comprobando ${loaderName} loader v${remote.loader_version} ...`
  });

  if (await loaderInstaller.isLoaderInstalled(minecraftPath, versionId)) return false;

  state.checkCancelled();
  const message = `Instalando ${loaderName} para Minecraft ${remote.minecraft_version} ...`;
  onProgress({ stage: 'loader', progress: 5, message });

  try {
    const downloadManager = new AdaptiveDownloadManager(55, 15, 8);
    state.downloadManager = downloadManager;

    const result = await loaderInstaller.installLoader(minecraftPath, remote.loader_files, downloadManager, (loaderProgress) => {
      onProgress({
        stage: 'loader',
        progress: 5 + Math.round((loaderProgress.progress || 0) * 0.15),
        message,
        currentFile: loaderProgress.currentFile,
        totalFiles: loaderProgress.totalFiles,
        downloadedSize: loaderProgress.downloadedSize,
        totalSize: loaderProgress.totalSize,
        speedMBps: loaderProgress.speedMBps,
        etaSeconds: loaderProgress.etaSeconds
      });
    });

    state.downloadManager = null;
    state.checkCancelled();

    if (result.success) logger.info('Loader instalado correctamente');
    return Boolean(result.success);
  } catch (error) {
    if (isCancellation(error) || state.cancelled) throw new Error('Installation cancelled');
    logger.error('Error instalando loader:', error);
    throw new ModpackError(ERROR_CODES.LOADER_INSTALL_FAILED, 'Error instalando el loader', error);
  }
}

async function deleteObsoleteFiles(installPath, operations, state, onProgress) {
  const totalFiles = operations.download.length + operations.delete.length;
  let processedFiles = 0;

  onProgress({ stage: 'deleting', progress: 20, message: 'Eliminando archivos obsoletos...' });

  for (const filePath of operations.delete) {
    state.checkCancelled();
    try {
      await fs.unlink(path.join(installPath, filePath));
      logger.info(`Deleted: ${filePath}`);
    } catch (error) {
      logger.error(`Error deleting ${filePath}:`, error);
    }

    processedFiles++;
    const progress = Math.round((processedFiles / totalFiles) * 100);
    onProgress({
      stage: 'deleting',
      progress: 20 + Math.round((progress || 0) * 0.5),
      message: 'Eliminando archivos obsoletos... ',
      currentFile: processedFiles,
      totalFiles: operations.delete.length
    });
  }
}

/**
 * Descarga los archivos nuevos o modificados y comprueba su hash.
 */
async function downloadFiles(installPath, operations, state, onProgress) {
  const downloadManager = new AdaptiveDownloadManager(60, 20, 10, 3);
  state.downloadManager = downloadManager;

  const downloadList = operations.download.map((file) => ({
    url: file.url,
    destPath: path.join(installPath, file.path),
    hash: file.hash,
    size: Number(file.size),
    path: file.path
  }));

  onProgress({
    stage: 'downloading',
    progress: 25,
    message: 'Iniciando descargas...',
    currentFile: 0,
    totalFiles: downloadList.length
  });

  const hashLimit = pLimit(4);
  const hashChecks = [];

  await downloadManager.downloadFiles(
    downloadList,
    // Archivo completado
    async (_index, file, error) => {
      if (state.cancelled) return;

      if (error) {
        if (!isCancellation(error)) logger.error(`Error downloading ${file.path}:`, error);
        return;
      }

      const { path: filePath, destPath, hash: expectedHash } = file;
      hashChecks.push(hashLimit(async () => {
        if (state.cancelled) return;
        try {
          const actualHash = await calculateFileHash(destPath);
          if (actualHash !== expectedHash && !state.cancelled) {
            throw new Error(`Hash mismatch for ${filePath}. Expected: ${expectedHash}, Got: ${actualHash}`);
          }
        } catch (hashError) {
          if (!state.cancelled) throw hashError;
        }
      }));

      onProgress({ stage: 'downloading', lastDownloadedFile: filePath });
    },
    // Progreso global
    async (_index, _file, stats) => {
      onProgress({
        stage: 'downloading',
        progress: 25 + Math.round(parseFloat(stats.progressPercent) * 0.7),
        message: 'Descargando archivos del modpack...',
        currentFile: stats.filesCompleted,
        totalFiles: stats.filesTotal,
        downloadedSize: stats.totalDownloaded,
        totalSize: stats.totalBytes,
        speedMBps: stats.speedBps / 1024 / 1024,
        etaSeconds: stats.etaSeconds
      });
    }
  );

  state.downloadManager = null;
  state.checkCancelled();

  onProgress({ stage: 'verifying', progress: 95, message: 'Verificando integridad...' });
  await Promise.all(hashChecks);
}

function buildLocalManifest(remote, previousManifest, now) {
  const versionInfo = remote.versions[String(remote.version)];
  const files = {};
  for (const [filePath, fileData] of Object.entries(remote.files)) {
    if (!fileData.removed_in_version) files[filePath] = { hash: fileData.hash };
  }

  return {
    id: remote.id,
    name: remote.name,
    description: remote.description,
    version: {
      version: remote.version,
      string: versionInfo.string
    },
    installed_at: previousManifest ? previousManifest.installed_at : now,
    updated_at: now,
    minecraft_version: remote.minecraft_version,
    loader: remote.loader,
    loader_version: remote.loader_version,
    synced_at: now,
    files_size: Object.values(remote.files).reduce((total, file) => total + (file.size || 0), 0),
    files
  };
}

/**
 * Instala el modpack o lo actualiza a la última versión.
 * @param {(progress: object) => void} onProgress
 * @returns {Promise<{success: boolean, cancelled?: boolean, manifest?: object, operations?: object}>}
 */
async function installOrUpdateModpack(ctx, modpackId, onProgress) {
  const state = {
    cancelled: false,
    downloadManager: null,
    checkCancelled() {
      if (this.cancelled) throw new Error('Installation cancelled');
    }
  };

  try {
    onProgress({ stage: 'calculating', progress: 0, message: 'Calculando cambios necesarios...' });

    const { operations, remote } = await calculateSyncOperations(ctx, modpackId);
    const installPath = ctx.store.getDataPath(modpackId);
    const versionId = getVersionId(modpackId, remote.minecraft_version);

    ctx.activeInstallations.set(modpackId, state);
    state.checkCancelled();

    // 1. Loader (en .minecraft)
    const loaderInstalledNow = await installLoaderIfNeeded(ctx, remote, versionId, state, onProgress);
    state.checkCancelled();

    // 2. Archivos obsoletos
    await deleteObsoleteFiles(installPath, operations, state, onProgress);
    state.checkCancelled();

    // 3. Archivos nuevos o modificados
    await downloadFiles(installPath, operations, state, onProgress);

    // 4. Aplicar cambios
    onProgress({ stage: 'finalizing', progress: 99, message: 'Aplicando cambios...' });

    if (ctx.getPreference('copyOptions')) {
      await minecraftOptions.copyOptions(ctx.getMinecraftPath(), installPath);
    }

    const now = new Date().toISOString();
    const previousManifest = await ctx.store.readManifestIfInstalled(modpackId);
    const localManifest = buildLocalManifest(remote, previousManifest, now);
    await ctx.store.saveManifest(modpackId, localManifest);

    const versionInfo = remote.versions[String(remote.version)];
    await ctx.store.saveVersionInfo(modpackId, {
      modpack_id: remote.id,
      modpack_name: remote.name,
      installed_version: remote.version,
      installed_version_string: versionInfo.string,
      installed_version_description: versionInfo.description,
      updated_at: now
    });

    // 5. Perfil en el launcher (siempre que se acabe de instalar el loader)
    if (loaderInstalledNow || ctx.getPreference('createProfile')) {
      await createOrUpdateProfile(ctx, modpackId, remote.name, versionId);
    }

    onProgress({ stage: 'complete', progress: 100, message: 'Instalación completada!' });

    return { success: true, manifest: localManifest, operations };
  } catch (error) {
    if (isCancellation(error)) {
      logger.warn('Instalación cancelada por el usuario');
      return { success: false, cancelled: true };
    }
    logger.error('Error durante la instalación:', error);
    throw error;
  } finally {
    ctx.activeInstallations.delete(modpackId);
  }
}

/**
 * Cancela la instalación en curso de un modpack.
 * @returns {boolean} false si no había ninguna instalación activa
 */
function cancelInstallation(ctx, modpackId) {
  const state = ctx.activeInstallations.get(modpackId);
  if (!state) return false;

  state.cancelled = true;
  if (state.downloadManager) {
    state.downloadManager.cancel();
    logger.info(`Cancellation initiated for ${modpackId}`);
  }
  return true;
}

/**
 * Antes de abrir el launcher: asegura que el loader está instalado y que el
 * perfil del modpack existe y está al día.
 * @returns {Promise<{success: boolean, reason?: string, versionId?: string, error?: string}>}
 */
async function ensureLauncherReady(ctx, modpackId) {
  const localManifest = await ctx.store.readManifestIfInstalled(modpackId);
  if (!localManifest) return { success: false, reason: 'not-installed' };

  const versionId = getVersionId(modpackId, localManifest.minecraft_version);

  try {
    const minecraftPath = ctx.getMinecraftPath();

    if (!await loaderInstaller.isLoaderInstalled(minecraftPath, versionId)) {
      const remote = await ctx.remote.getModpack(modpackId);
      if (!hasLoaderFiles(remote)) {
        return { success: false, reason: 'missing-loader-files', versionId };
      }

      await loaderInstaller.installLoader(minecraftPath, remote.loader_files, new AdaptiveDownloadManager(20, 8, 4));
    }

    await createOrUpdateProfile(ctx, modpackId, localManifest.name, versionId);
    return { success: true, versionId };
  } catch (error) {
    logger.error('Error preparing modpack launcher profile:', error);
    return { success: false, reason: 'profile-sync-failed', error: error.message, versionId };
  }
}

module.exports = {
  installOrUpdateModpack,
  cancelInstallation,
  ensureLauncherReady
};
