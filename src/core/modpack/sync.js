const path = require('path');

const logger = require('../logger');
const { calculateFileHash, fileExists } = require('../utils/file-utils');

/**
 * Recalcula el hash de los archivos instalados y actualiza el manifiesto
 * local para que refleje lo que hay realmente en disco.
 * @returns {Promise<object|undefined>} mapa ruta -> { hash }, o undefined si no está instalado
 */
async function syncLocalManifest(ctx, modpackId) {
  logger.info(`Sincronizando archivos del manifiesto local del modpack ${modpackId}`);
  const installPath = ctx.store.getDataPath(modpackId);
  const local = await ctx.store.readManifestIfInstalled(modpackId);
  const remote = await ctx.remote.getModpack(modpackId);
  if (!local) return;

  const realFiles = {};
  for (const [filePath, fileData] of Object.entries(local.files)) {
    const fullPath = path.join(installPath, filePath);
    if (!await fileExists(fullPath)) continue;

    // Los archivos editables (configs) no se comparan por hash
    if (remote.files[filePath]?.editable) {
      realFiles[filePath] = { hash: fileData.hash };
      continue;
    }

    realFiles[filePath] = { hash: await calculateFileHash(fullPath) };
  }

  local.files = realFiles;
  local.synced_at = new Date().toISOString();
  await ctx.store.saveManifest(modpackId, local);

  logger.info(`Archivos del manifiesto local del modpack ${modpackId} sincronizados`);
  return realFiles;
}

function toDownload(filePath, remoteFile, reason) {
  return {
    path: filePath,
    url: remoteFile.url,
    hash: remoteFile.hash,
    size: Number(remoteFile.size),
    reason
  };
}

/**
 * Compara el manifiesto remoto con los archivos locales.
 * @returns {Promise<{operations: {download: object[], delete: string[], totalSize: number}, remote: object, local: object|null}>}
 */
async function calculateSyncOperations(ctx, modpackId) {
  logger.info(`Calculando operaciones de sincronización para el modpack ${modpackId}`);
  const remote = await ctx.remote.getModpack(modpackId);
  const local = await ctx.store.readManifestIfInstalled(modpackId);
  const localFiles = await syncLocalManifest(ctx, modpackId);
  const remoteFiles = remote.files || {};

  const operations = {
    download: [],
    delete: [],
    totalSize: 0
  };

  for (const [filePath, remoteFile] of Object.entries(remoteFiles)) {
    if (remoteFile.removed_in_version) continue;

    const localFile = localFiles?.[filePath];

    if (!localFile) {
      operations.download.push(toDownload(filePath, remoteFile, 'new'));
      operations.totalSize += remoteFile.size;
    } else if (localFile.hash !== remoteFile.hash && !remoteFile.editable) {
      operations.download.push(toDownload(filePath, remoteFile, 'modified'));
      operations.totalSize += remoteFile.size;
    }
  }

  // Archivos locales que ya no existen en el remoto
  for (const filePath of Object.keys(localFiles || {})) {
    if (!remoteFiles[filePath] || remoteFiles[filePath].removed_in_version) {
      operations.delete.push(filePath);
    }
  }

  logger.info(`Operaciones de sincronización para el modpack ${modpackId}:`, JSON.stringify(operations));
  return { operations, remote, local };
}

module.exports = {
  syncLocalManifest,
  calculateSyncOperations
};
