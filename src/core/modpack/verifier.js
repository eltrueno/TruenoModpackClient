const logger = require('../logger');
const { syncLocalManifest } = require('./sync');

const NOT_INSTALLED = { valid: false, error: 'El modpack no está instalado' };

/**
 * Comprueba los archivos instalados contra el manifiesto remoto.
 * @returns {Promise<{valid: boolean, error?: string, missing?: number, corrupted?: number, obsolet?: number}>}
 */
async function verifyModpack(ctx, modpackId) {
  logger.info(`Verificando archivos del modpack ${modpackId}`);

  if (!await ctx.store.isInstalled(modpackId)) return NOT_INSTALLED;

  const remote = await ctx.remote.getModpack(modpackId);
  const localFiles = await syncLocalManifest(ctx, modpackId);
  if (!localFiles || Object.keys(localFiles).length === 0) return NOT_INSTALLED;

  let missing = 0;
  let corrupted = 0;
  let obsolet = 0;

  for (const [filePath, fileData] of Object.entries(remote.files)) {
    const localFile = localFiles[filePath];

    if (!localFile) {
      missing++;
      logger.warn(`El archivo ${filePath} no existe`);
      continue;
    }

    // Los archivos editables no se comparan por hash
    if (fileData.editable) continue;

    if (localFile.hash !== fileData.hash) {
      corrupted++;
      logger.warn(`El archivo ${filePath} está corrupto`);
    }
  }

  for (const filePath of Object.keys(localFiles)) {
    if (!remote.files[filePath] || remote.files[filePath].removed_in_version) {
      obsolet++;
      logger.warn(`El archivo ${filePath} está obsoleto`);
    }
  }

  return {
    valid: missing === 0 && corrupted === 0 && obsolet === 0,
    error: 'Se han detectado archivos faltantes y/o corruptos',
    missing,
    corrupted,
    obsolet
  };
}

module.exports = { verifyModpack };
