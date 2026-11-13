const fs = require('fs').promises;
const path = require('path');

const logger = require('../logger');
const { fileExists } = require('../utils/file-utils');
const minecraftProfile = require('../minecraft/profile');
const { ModpackError, ERROR_CODES } = require('./errors');

async function countFiles(dir) {
  let count = 0;
  let size = 0;

  try {
    for (const file of await fs.readdir(dir)) {
      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        const nested = await countFiles(fullPath);
        count += nested.count;
        size += nested.size;
      } else {
        count++;
        size += stat.size;
      }
    }
  } catch (_) {
    // Solo se usa para el progreso: si falla, se cuenta lo que se pueda
  }

  return { count, size };
}

/** Borra archivo a archivo para poder informar del progreso */
async function deleteFolderRecursive(dir, state, onFileDeleted) {
  if (!await fileExists(dir)) return;

  for (const file of await fs.readdir(dir)) {
    const currentPath = path.join(dir, file);
    let stat;
    try { stat = await fs.lstat(currentPath); } catch (_) { continue; }

    if (stat.isDirectory()) {
      await deleteFolderRecursive(currentPath, state, onFileDeleted);
      try {
        await fs.rmdir(currentPath);
      } catch (error) { logger.error('Error removing dir', currentPath, error); }
    } else {
      try {
        await fs.unlink(currentPath);
        state.processedSize += stat.size;
        state.processed++;
        onFileDeleted();
      } catch (error) { logger.error('Error removing file', currentPath, error); }
    }
  }
}

/**
 * Elimina los archivos del modpack y su perfil del launcher.
 * @param {(progress: object) => void} onProgress
 */
async function uninstallModpack(ctx, modpackId, onProgress) {
  try {
    if (ctx.activeInstallations.has(modpackId)) {
      throw new ModpackError(ERROR_CODES.INSTALLATION_ACTIVE, 'Cannot uninstall while installation is active');
    }

    const basePath = ctx.store.getBasePath(modpackId);

    onProgress({ stage: 'calculating', progress: 0, message: 'Analizando archivos...' });
    const { count: totalFiles, size: totalSize } = await countFiles(basePath);

    onProgress({ stage: 'deleting', progress: 0, message: 'Eliminando archivos...' });
    const state = { processed: 0, processedSize: 0 };

    await deleteFolderRecursive(basePath, state, () => {
      onProgress({
        stage: 'deleting',
        progress: totalFiles > 0 ? Math.round((state.processed / totalFiles) * 100) : 100,
        message: `Eliminando archivos... (${state.processed}/${totalFiles})`,
        currentFile: state.processed,
        totalFiles,
        // Se reutiliza downloadedSize para que la interfaz muestre el progreso igual
        downloadedSize: state.processedSize,
        totalSize
      });
    });

    // A veces quedan carpetas vacías
    try {
      await fs.rm(basePath, { recursive: true, force: true });
    } catch (_) { /* ignorar */ }

    onProgress({ stage: 'finalizing', progress: 100, message: 'Eliminando perfil...' });
    await minecraftProfile.deleteProfile(ctx.getMinecraftPath(), ctx.store.getDataPath(modpackId));

    return { success: true };
  } catch (error) {
    logger.error('Error uninstalling modpack:', error);
    throw error;
  }
}

module.exports = { uninstallModpack };
