const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function firstExistingPath(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) || null;
}

function getLinuxMinecraftCandidatePaths() {
  const homePath = app.getPath('home');
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homePath, '.config');
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homePath, '.local', 'share');

  return [
    process.env.MINECRAFT_HOME,
    path.join(homePath, '.minecraft'),
    path.join(xdgDataHome, 'minecraft'),
    path.join(xdgConfigHome, 'minecraft'),
    path.join(homePath, '.var', 'app', 'com.mojang.Minecraft', 'data', 'minecraft'),
    path.join(homePath, '.var', 'app', 'com.mojang.Minecraft', 'data', '.minecraft'),
    path.join(homePath, '.var', 'app', 'com.mojang.MinecraftLauncher', 'data', 'minecraft'),
    path.join(homePath, '.var', 'app', 'com.mojang.MinecraftLauncher', 'data', '.minecraft')
  ].filter(Boolean);
}

function getLinuxMinecraftPath() {
  const candidates = getLinuxMinecraftCandidatePaths();

  const preferred = firstExistingPath(candidates.filter((candidate) => {
    return fs.existsSync(path.join(candidate, 'launcher_profiles.json'))
      || fs.existsSync(path.join(candidate, 'launcher_accounts.json'))
      || fs.existsSync(path.join(candidate, 'versions'))
      || fs.existsSync(path.join(candidate, 'launcher'));
  }));

  return preferred || path.join(app.getPath('home'), '.minecraft');
}

function getMacMinecraftCandidatePaths() {
  const homePath = app.getPath('home');
  const libraryAppSupport = path.join(homePath, 'Library', 'Application Support');

  return [
    process.env.MINECRAFT_HOME,
    path.join(libraryAppSupport, 'minecraft'),
    path.join(libraryAppSupport, '.minecraft'),
    path.join(homePath, '.minecraft')
  ].filter(Boolean);
}

function getMacMinecraftPath() {
  const candidates = getMacMinecraftCandidatePaths();

  const preferred = firstExistingPath(candidates.filter((candidate) => {
    return fs.existsSync(path.join(candidate, 'launcher_profiles.json'))
      || fs.existsSync(path.join(candidate, 'launcher_accounts.json'))
      || fs.existsSync(path.join(candidate, 'versions'))
      || fs.existsSync(path.join(candidate, 'launcher'))
      || fs.existsSync(path.join(candidate, 'game'))
      || fs.existsSync(path.join(candidate, 'runtime'));
  }));

  return preferred || path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
}

/**
 * Obtiene la ruta de .minecraft según el sistema operativo
 */
function getMinecraftPath() {
  const platform = process.platform;
  
  if (platform === 'win32') {
    return path.join(app.getPath('appData'), '.minecraft');
  } else if (platform === 'darwin') {
    return getMacMinecraftPath();
  } else {
    return getLinuxMinecraftPath();
  }
}

module.exports = {
    getMinecraftPath
}
