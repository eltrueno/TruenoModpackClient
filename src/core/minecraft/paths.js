const fs = require('fs');
const path = require('path');

/**
 * Localización de la carpeta de datos de Minecraft (.minecraft).
 *
 * Todas las funciones reciben un "entorno" con las rutas base del sistema,
 * para no depender de quién las resuelva:
 *   { platform, home, appData, env }
 */

// Archivos o carpetas que indican que una carpeta es realmente un .minecraft
const MINECRAFT_MARKERS = ['launcher_profiles.json', 'launcher_accounts.json', 'versions', 'launcher'];
const MAC_EXTRA_MARKERS = ['game', 'runtime'];

function looksLikeMinecraftDir(candidate, markers) {
  return markers.some((marker) => fs.existsSync(path.join(candidate, marker)));
}

function firstMinecraftDir(candidates, markers) {
  return candidates.find((candidate) => fs.existsSync(candidate) && looksLikeMinecraftDir(candidate, markers)) || null;
}

function getLinuxCandidates({ home, env = {} }) {
  const xdgConfigHome = env.XDG_CONFIG_HOME || path.join(home, '.config');
  const xdgDataHome = env.XDG_DATA_HOME || path.join(home, '.local', 'share');

  return [
    env.MINECRAFT_HOME,
    path.join(home, '.minecraft'),
    path.join(xdgDataHome, 'minecraft'),
    path.join(xdgConfigHome, 'minecraft'),
    // Instalaciones Flatpak
    path.join(home, '.var', 'app', 'com.mojang.Minecraft', 'data', 'minecraft'),
    path.join(home, '.var', 'app', 'com.mojang.Minecraft', 'data', '.minecraft'),
    path.join(home, '.var', 'app', 'com.mojang.MinecraftLauncher', 'data', 'minecraft'),
    path.join(home, '.var', 'app', 'com.mojang.MinecraftLauncher', 'data', '.minecraft')
  ].filter(Boolean);
}

function getMacCandidates({ home, env = {} }) {
  const appSupport = path.join(home, 'Library', 'Application Support');

  return [
    env.MINECRAFT_HOME,
    path.join(appSupport, 'minecraft'),
    path.join(appSupport, '.minecraft'),
    path.join(home, '.minecraft')
  ].filter(Boolean);
}

/**
 * Obtiene la ruta de .minecraft según el sistema operativo.
 * @param {{platform: string, home: string, appData?: string, env?: object}} environment
 */
function resolveMinecraftPath(environment) {
  const { platform, home, appData } = environment;

  if (platform === 'win32') {
    return path.join(appData || path.join(home, 'AppData', 'Roaming'), '.minecraft');
  }

  if (platform === 'darwin') {
    return firstMinecraftDir(getMacCandidates(environment), [...MINECRAFT_MARKERS, ...MAC_EXTRA_MARKERS])
      || path.join(home, 'Library', 'Application Support', 'minecraft');
  }

  return firstMinecraftDir(getLinuxCandidates(environment), MINECRAFT_MARKERS)
    || path.join(home, '.minecraft');
}

module.exports = {
  resolveMinecraftPath
};
