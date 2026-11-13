const axios = require('axios');
const logger = require('../logger');
const { ModpackError, ERROR_CODES } = require('./errors');

/**
 * Cliente del servidor de modpacks.
 * @param {string} baseUrl - p. ej. https://s3.truenomodpack.eltrueno.es
 */
function createRemoteApi(baseUrl) {
  // El manifiesto remoto se descarga una vez por sesión
  const manifestCache = new Map();

  async function getModpackList() {
    try {
      const response = await axios.get(`${baseUrl}/modpacks.json`);
      return response.data;
    } catch (error) {
      logger.error('Error getting modpack list:', error);
      throw new ModpackError(ERROR_CODES.REMOTE_UNAVAILABLE, 'No se ha podido obtener la lista de modpacks', error);
    }
  }

  async function getModpack(modpackId) {
    if (manifestCache.has(modpackId)) {
      return manifestCache.get(modpackId);
    }

    try {
      const response = await axios.get(`${baseUrl}/${modpackId}/truenomodpack.json`);
      manifestCache.set(modpackId, response.data);
      return response.data;
    } catch (error) {
      logger.error('Error getting remote modpack:', error);
      throw new ModpackError(ERROR_CODES.REMOTE_UNAVAILABLE, `No se ha podido obtener el modpack ${modpackId}`, error);
    }
  }

  return { getModpackList, getModpack };
}

module.exports = { createRemoteApi };
