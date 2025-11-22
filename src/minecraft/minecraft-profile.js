// minecraft-profile.js - Módulo para gestionar perfiles de Minecraft Launcher
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { app } = require('electron');
const axios = require('axios');

const { getMinecraftPath } = require('./common.js')
const {ensureFile} = require('../utils/file-utils.js')


/**
 * Obtiene la ruta del launcher_profiles.json
 */
function getLauncherProfilesPath() {
  let minecraftPath = getMinecraftPath();

  return path.join(minecraftPath, 'launcher_profiles.json');
}

/**
 * Lee el archivo launcher_profiles.json
 */
async function readLauncherProfiles() {
  const profilesPath = getLauncherProfilesPath();
  
  try {
    const data = await fs.readFile(profilesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('launcher_profiles.json no encontrado, creando uno nuevo...');
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
      profileSorting : "ByLastPlayed"
    },
    version: 5
  };
}

/**
 * Escribe el archivo launcher_profiles.json
 */
async function writeLauncherProfiles(profiles) {
  const profilesPath = getLauncherProfilesPath();
  
  // Crear directorio .minecraft si no existe
  await ensureFile(path.dirname(profilesPath))
  
  // Guardar con formato bonito
  await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
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
  try{
    base64img = await imageUrlToBase64('https://eltrueno.github.io/truenomodpack/'+modpackId+'/icon.png');
  }catch(err){
    console.error("Error getting modpack icon", err)
  }finally{
    return base64img;
  }
  //return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

/**
 * Crea o actualiza un perfil de Minecraft para el modpack
 */
async function createOrUpdateProfile(modpackId, modpackName, versionId, modpackPath) {

  try {
    const launcherProfiles = await readLauncherProfiles();

    // Buscar si ya existe un perfil para este modpack
    let existingProfileId = null;
    for (const [profileId, profile] of Object.entries(launcherProfiles.profiles || {})) {
      if (profile.gameDir === modpackPath) {
        existingProfileId = profileId;
        break;
      }
    }

    const profileId = existingProfileId || generateProfileId(modpackId);

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
      javaArgs: '-Xmx8G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M'
    };

    // Añadir/actualizar el perfil
    if (!launcherProfiles.profiles) {
      launcherProfiles.profiles = {};
    }
    launcherProfiles.profiles[profileId] = profile;

    // Guardar cambios
    await writeLauncherProfiles(launcherProfiles);

    console.log(`Perfil de Minecraft creado/actualizado`);

    return {
      success: true,
      profileId,
      profileName: modpackName,
      action: existingProfileId ? 'updated' : 'created'
    };

  } catch (error) {
    console.error('Error creando/actualizando perfil de Minecraft:', error);
    throw error;
  }
}


/**
 * Elimina un perfil del launcher
 */
async function deleteProfile(installation_path) {
  try {
    const launcherProfiles = await readLauncherProfiles();

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
      await writeLauncherProfiles(launcherProfiles);
      console.log(`Perfil eliminado: ${profileIdToDelete}`);
      return { success: true, deleted: true };
    }

    return { success: true, deleted: false, message: 'Perfil no encontrado' };

  } catch (error) {
    console.error('Error eliminando perfil:', error);
    throw error;
  }
}


module.exports = {
  createOrUpdateProfile,
  deleteProfile,
  getLauncherProfilesPath
};