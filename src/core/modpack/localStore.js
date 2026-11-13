const fs = require('fs').promises;
const path = require('path');
const lockfile = require('proper-lockfile');

const { ensureDir, ensureFile, fileExists } = require('../utils/file-utils');

const MANIFEST_FILE = 'truenomodpack.json';
const VERSION_FILE = 'truenomodpack_version.json';
const DATA_DIR = 'minecraftdata';

/**
 * Datos locales de los modpacks instalados.
 *
 *   <modpacksDir>/<id>/truenomodpack.json   manifiesto local
 *   <modpacksDir>/<id>/minecraftdata/       carpeta de juego (gameDir)
 *
 * @param {string} modpacksDir - Carpeta raíz donde se instalan los modpacks
 */
function createLocalStore(modpacksDir) {
  const getBasePath = (modpackId) => path.join(modpacksDir, modpackId);
  const getManifestPath = (modpackId) => path.join(getBasePath(modpackId), MANIFEST_FILE);
  const getDataPath = (modpackId) => path.join(getBasePath(modpackId), DATA_DIR);

  async function writeJsonLocked(filePath, data) {
    await ensureDir(path.dirname(filePath));
    await ensureFile(filePath);

    const release = await lockfile.lock(filePath, { retries: 5 });
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } finally {
      await release();
    }
  }

  function isInstalled(modpackId) {
    return fileExists(getManifestPath(modpackId));
  }

  async function readManifest(modpackId) {
    const filePath = getManifestPath(modpackId);

    const release = await lockfile.lock(filePath, { retries: 5 });
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } finally {
      await release();
    }
  }

  /** Manifiesto local, o null si el modpack no está instalado */
  async function readManifestIfInstalled(modpackId) {
    return await isInstalled(modpackId) ? readManifest(modpackId) : null;
  }

  function saveManifest(modpackId, manifest) {
    return writeJsonLocked(getManifestPath(modpackId), manifest);
  }

  /** Archivo de versión dentro de la carpeta de juego (lo lee el propio modpack) */
  function saveVersionInfo(modpackId, data) {
    return writeJsonLocked(path.join(getDataPath(modpackId), VERSION_FILE), data);
  }

  return {
    getBasePath,
    getDataPath,
    isInstalled,
    readManifest,
    readManifestIfInstalled,
    saveManifest,
    saveVersionInfo
  };
}

module.exports = { createLocalStore };
