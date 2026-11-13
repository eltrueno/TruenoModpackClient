// minecraft-profile.js - Módulo para gestionar perfiles de Minecraft Launcher
// Todas las funciones reciben la ruta de .minecraft; no se resuelve aquí.
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const logger = require('../logger');
const { ensureDir } = require('../utils/file-utils');

const DEFAULT_MAX_RAM_MB = 8192;
const PROFILE_ICON_BASE_URL = 'https://eltrueno.github.io/truenomodpack/';

/**
 * Obtiene la ruta del launcher_profiles.json
 */
function getLauncherProfilesPath(minecraftPath) {
  return path.join(minecraftPath, 'launcher_profiles.json');
}

function getLauncherAccountsPath(minecraftPath) {
  return path.join(minecraftPath, 'launcher_accounts.json');
}

function getLauncherQuickPlayPath(minecraftPath) {
  return path.join(minecraftPath, 'launcher_quick_play.json');
}

/**
 * Lee el archivo launcher_profiles.json
 */
async function readLauncherProfiles(minecraftPath) {
  const profilesPath = getLauncherProfilesPath(minecraftPath);

  try {
    const data = await fs.readFile(profilesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('launcher_profiles.json no encontrado, creando uno nuevo...');
      return createDefaultLauncherProfiles();
    }
    throw error;
  }
}

/**
 * Crea un launcher_profiles.json por defecto
 */
function createDefaultLauncherProfiles() {
  return {
    profiles: {},
    settings: {
      enableSnapshots: false,
      enableAdvanced: false,
      profileSorting: "ByLastPlayed"
    },
    version: 5
  };
}

/**
 * Escribe el archivo launcher_profiles.json
 */
async function writeLauncherProfiles(minecraftPath, profiles) {
  const profilesPath = getLauncherProfilesPath(minecraftPath);

  // Crear directorio .minecraft si no existe
  await ensureDir(path.dirname(profilesPath))

  // Guardar con formato bonito
  await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
}

async function readLauncherAccounts(minecraftPath) {
  try {
    const data = await fs.readFile(getLauncherAccountsPath(minecraftPath), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readLauncherQuickPlay(minecraftPath) {
  try {
    const data = await fs.readFile(getLauncherQuickPlayPath(minecraftPath), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        quickPlayData: {},
        version: 2
      };
    }
    throw error;
  }
}

async function writeLauncherQuickPlay(minecraftPath, data) {
  const quickPlayPath = getLauncherQuickPlayPath(minecraftPath);
  await ensureDir(path.dirname(quickPlayPath));
  await fs.writeFile(quickPlayPath, JSON.stringify(data, null, 2));
}

async function updateQuickPlayProfile(minecraftPath, profileId) {
  const accounts = await readLauncherAccounts(minecraftPath);
  const activeAccountLocalId = accounts?.activeAccountLocalId;
  if (!activeAccountLocalId) return;

  const quickPlay = await readLauncherQuickPlay(minecraftPath);
  if (!quickPlay.quickPlayData) {
    quickPlay.quickPlayData = {};
  }

  quickPlay.quickPlayData[activeAccountLocalId] = [{
    epochLastPlayedTimeMs: Date.now(),
    id: profileId,
    javaInstance: {
      configId: profileId
    },
    source: 'Java'
  }];

  await writeLauncherQuickPlay(minecraftPath, quickPlay);
}

/**
 * Get the base64 string of an image url
 */
async function imageUrlToBase64(url) {
  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'arraybuffer'
  });

  const base64 = Buffer.from(response.data).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  return dataUrl
}

/**
 * Genera un ID único para el perfil
 */
function generateProfileId(modpackId) {
  return `truenomodpack_${modpackId}`;
}

/**
 * Genera el icono en base64 dandole el modpackId
 */
async function getProfileIcon(modpackId) {
  let base64img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  try {
    base64img = await imageUrlToBase64(PROFILE_ICON_BASE_URL + modpackId + '/icon.png');
  } catch (err) {
    logger.error("Error getting modpack icon", err)
  } finally {
    return base64img;
  }
}

/**
 * Crea o actualiza un perfil de Minecraft para el modpack
 * @param {object} options
 * @param {string} options.minecraftPath - Ruta de la carpeta .minecraft
 * @param {string} options.modpackId
 * @param {string} options.modpackName
 * @param {string} options.versionId - Versión (loader) que lanzará el perfil
 * @param {string} options.modpackPath - Carpeta de juego del modpack (gameDir)
 * @param {number} [options.maxRamMB] - Memoria máxima para la JVM
 */
async function createOrUpdateProfile({ minecraftPath, modpackId, modpackName, versionId, modpackPath, maxRamMB }) {

  try {
    const launcherProfiles = await readLauncherProfiles(minecraftPath);

    // Buscar si ya existe un perfil para este modpack
    let existingProfileId = null;
    for (const [profileId, profile] of Object.entries(launcherProfiles.profiles || {})) {
      if (profile.gameDir === modpackPath) {
        existingProfileId = profileId;
        break;
      }
    }

    const profileId = existingProfileId || generateProfileId(modpackId);

    const cfgMaxRam = Number(maxRamMB) || DEFAULT_MAX_RAM_MB;

    const profile = {
      name: modpackName,
      type: 'custom',
      created: existingProfileId ?
        launcherProfiles.profiles[existingProfileId].created :
        new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      icon: await getProfileIcon(modpackId),
      lastVersionId: versionId,
      gameDir: modpackPath,
      javaArgs: '-Xmx' + Math.max(1, Math.floor(cfgMaxRam / 1024)) + 'G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M'
    };

    // Añadir/actualizar el perfil
    if (!launcherProfiles.profiles) {
      launcherProfiles.profiles = {};
    }
    launcherProfiles.profiles[profileId] = profile;

    // Guardar cambios
    await writeLauncherProfiles(minecraftPath, launcherProfiles);
    await updateQuickPlayProfile(minecraftPath, profileId);

    logger.info('Perfil de Minecraft creado/actualizado');

    return {
      success: true,
      profileId,
      profileName: modpackName,
      action: existingProfileId ? 'updated' : 'created'
    };

  } catch (error) {
    logger.error('Error creando/actualizando perfil de Minecraft:', error);
    throw error;
  }
}


/**
 * Elimina un perfil del launcher
 */
async function deleteProfile(minecraftPath, installation_path) {
  try {
    const launcherProfiles = await readLauncherProfiles(minecraftPath);

    // Buscar el perfil a eliminar
    let profileIdToDelete = null;
    for (const [profileId, profile] of Object.entries(launcherProfiles.profiles || {})) {
      if (profile.gameDir === installation_path) {
        profileIdToDelete = profileId;
        break;
      }
    }

    if (profileIdToDelete) {
      delete launcherProfiles.profiles[profileIdToDelete];
      await writeLauncherProfiles(minecraftPath, launcherProfiles);
      logger.info(`Perfil eliminado: ${profileIdToDelete}`);
      return { success: true, deleted: true };
    }

    return { success: true, deleted: false, message: 'Perfil no encontrado' };

  } catch (error) {
    logger.error('Error eliminando perfil:', error);
    throw error;
  }
}


module.exports = {
  createOrUpdateProfile,
  deleteProfile,
  getLauncherProfilesPath
};
