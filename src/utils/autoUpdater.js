const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');

const logger = require('./logger');
const { ChunkedDownloadManager } = require('../download/managers/ChunkedDownloadManager');
const githubReleases = require('./githubReleases');
const linuxPackageUpdater = require('./linuxPackageUpdater');

const GITHUB_OWNER = 'eltrueno';
const GITHUB_REPO = 'TruenoModpackClient';

autoUpdater.logger = logger;
autoUpdater.autoDownload = false;

/**
 * Modos de actualizacion:
 *  - squirrel-manual: Windows. electron-updater comprueba y el instalador se descarga y lanza.
 *  - linux-package:   Linux instalado desde .deb/.rpm. Se descarga el paquete y se instala con pkexec.
 *  - notify:          macOS y resto de Linux. Solo se avisa de que hay una version nueva.
 *  - disabled:        plataforma no soportada.
 */
const UPDATE_MODES = ['squirrel-manual', 'linux-package', 'notify', 'disabled'];

let cachedCapabilities = null;

function resolveUpdateCapabilities() {
  // Solo en desarrollo: permite probar otro modo, p. ej. TRUENO_FORCE_UPDATE_MODE=notify
  const forcedMode = !app.isPackaged ? process.env.TRUENO_FORCE_UPDATE_MODE : null;
  if (forcedMode && UPDATE_MODES.includes(forcedMode)) {
    return { enabled: forcedMode !== 'disabled', provider: 'github', mode: forcedMode, reason: null };
  }

  if (process.platform === 'win32') {
    return { enabled: true, provider: 'github', mode: 'squirrel-manual', reason: null };
  }

  if (process.platform === 'linux') {
    const packageType = app.isPackaged ? linuxPackageUpdater.detectInstalledPackageType() : null;
    if (packageType && linuxPackageUpdater.canElevate()) {
      return { enabled: true, provider: 'github', mode: 'linux-package', packageType, reason: null };
    }

    return {
      enabled: true,
      provider: 'github',
      mode: 'notify',
      reason: packageType
        ? 'No se ha encontrado pkexec para instalar la actualizacion automaticamente.'
        : 'La aplicacion no esta instalada desde un paquete .deb o .rpm.'
    };
  }

  if (process.platform === 'darwin') {
    return {
      enabled: true,
      provider: 'github',
      mode: 'notify',
      reason: 'La actualizacion automatica en macOS requiere una aplicacion firmada.'
    };
  }

  return {
    enabled: false,
    provider: 'none',
    mode: 'disabled',
    reason: `La plataforma ${process.platform} no esta soportada por el auto-updater.`
  };
}

function getUpdateCapabilities() {
  if (!cachedCapabilities) {
    cachedCapabilities = resolveUpdateCapabilities();
  }
  return cachedCapabilities;
}

function isAutoUpdateEnabled() {
  return getUpdateCapabilities().enabled;
}

function usesElectronUpdater() {
  return getUpdateCapabilities().mode === 'squirrel-manual';
}

function handleSquirrelEvents() {
  if (process.platform !== 'win32') {
    return false;
  }

  if (require('electron-squirrel-startup')) {
    return true;
  }

  if (process.argv.length === 1) {
    return false;
  }

  const squirrelEvent = process.argv[1];

  switch (squirrelEvent) {
    case '--squirrel-install':
      logger.info('Squirrel: Instalacion completada');
      setTimeout(() => app.quit(), 1000);
      return true;

    case '--squirrel-updated':
      logger.info('Squirrel: Actualizacion completada');
      setTimeout(() => app.quit(), 1000);
      return true;

    case '--squirrel-uninstall':
      logger.info('Squirrel: Desinstalacion');
      setTimeout(() => app.quit(), 1000);
      return true;

    case '--squirrel-obsolete':
      logger.info('Squirrel: Version obsoleta');
      app.quit();
      return true;

    default:
      return false;
  }
}

let lastUpdateInfo = null;
let mainWindowRef = null;

function sendToWindow(channel, data) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, data);
  }
}

function configureFeed(options = {}) {
  if (options.updateServerUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: options.updateServerUrl
    });
    return;
  }

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO
  });
}

function setupAutoUpdater(mainWindow, options = {}) {
  mainWindowRef = mainWindow;

  const capabilities = getUpdateCapabilities();
  logger.info('========================================');
  logger.info('Auto-updater inicializado');
  logger.info('Plataforma:', process.platform);
  logger.info('Version actual:', app.getVersion());
  logger.info('Modo de actualizacion:', capabilities.mode);
  if (capabilities.reason) {
    logger.info('Motivo:', capabilities.reason);
  }
  logger.info('========================================');

  // En Linux y macOS la comprobacion se hace contra la API de GitHub
  if (!usesElectronUpdater()) {
    return capabilities;
  }

  configureFeed(options);

  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.on('checking-for-update', () => {
    logger.info('[AutoUpdater] Comprobando actualizaciones...');
    sendToWindow('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('[AutoUpdater] Actualizacion disponible:', info.version);
    lastUpdateInfo = info;

    sendToWindow('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
      size: info.files && info.files[0] ? info.files[0].size : 0
    });

    if (options.autoDownload !== false) {
      downloadUpdateWithManager();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('[AutoUpdater] No hay actualizaciones disponibles');
    sendToWindow('update-not-available', {
      version: info.version
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendToWindow('update-download-progress', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
      speed: Math.round(progressObj.bytesPerSecond / 1024),
      downloaded: Math.round(progressObj.transferred / 1024 / 1024),
      totalMB: Math.round(progressObj.total / 1024 / 1024)
    });
  });

  autoUpdater.on('error', (error) => {
    logger.error('[AutoUpdater] Error:', error.message);
    sendToWindow('update-error', {
      message: error.message,
      stack: error.stack
    });
  });

  return capabilities;
}

async function checkForUpdatesManually() {
  const capabilities = getUpdateCapabilities();
  if (!capabilities.enabled) {
    return {
      success: false,
      unsupported: true,
      reason: capabilities.reason
    };
  }

  if (!usesElectronUpdater()) {
    return checkGithubRelease();
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      success: true,
      updateInfo: result ? result.updateInfo : null
    };
  } catch (error) {
    logger.error('[AutoUpdater] Error en comprobacion manual:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Comprobacion para Linux y macOS: consulta la ultima release de GitHub.
 * Si hay version nueva, se instala (Linux desde paquete) o se avisa.
 */
async function checkGithubRelease() {
  const capabilities = getUpdateCapabilities();
  sendToWindow('update-checking');

  let release;
  try {
    release = await githubReleases.fetchLatestRelease(GITHUB_OWNER, GITHUB_REPO);
  } catch (error) {
    // Un fallo al comprobar no debe bloquear el uso de la aplicacion
    logger.warn('[AutoUpdater] No se pudo consultar la ultima release:', error.message);
    sendToWindow('update-not-available', { version: app.getVersion() });
    return { success: false, error: error.message };
  }

  if (!release.version || githubReleases.compareVersions(release.version, app.getVersion()) <= 0) {
    logger.info('[AutoUpdater] No hay actualizaciones disponibles');
    sendToWindow('update-not-available', { version: app.getVersion() });
    return { success: true, updateInfo: null };
  }

  logger.info('[AutoUpdater] Version nueva disponible:', release.version);
  const updateInfo = { version: release.version, url: release.url };

  if (capabilities.mode === 'linux-package') {
    const asset = githubReleases.findLinuxPackageAsset(release, capabilities.packageType);
    if (asset) {
      sendToWindow('update-available', {
        version: release.version,
        releaseDate: release.publishedAt,
        releaseNotes: release.notes,
        size: asset.size
      });
      // No se espera: el progreso llega a la ventana por eventos
      installLinuxPackageUpdate(release, asset, capabilities.packageType);
      return { success: true, updateInfo };
    }
    logger.warn(`[AutoUpdater] La release ${release.version} no incluye paquete .${capabilities.packageType} para ${process.arch}`);
  }

  sendToWindow('update-manual', updateInfo);
  return { success: true, updateInfo, manual: true };
}

async function installLinuxPackageUpdate(release, asset, packageType) {
  // Si algo falla, la app sigue siendo usable y se ofrece la descarga manual
  const fallbackToManual = (reason) => {
    logger.warn('[AutoUpdater] Actualizacion automatica no completada:', reason);
    sendToWindow('update-manual', { version: release.version, url: release.url, reason });
  };

  try {
    const packagePath = path.join(app.getPath('temp'), asset.name);
    const manager = new ChunkedDownloadManager(12, 1024 * 1024 * 6);

    const result = await manager.downloadFiles([{
      url: asset.url,
      destPath: packagePath
    }], null, (_idx, _file, progress) => {
      sendToWindow('update-download-progress', {
        percent: Math.round(progress.progressPercent),
        speed: Math.round(progress.speedBps / 1024),
        downloaded: Math.round(progress.totalDownloaded / 1024 / 1024),
        totalMB: Math.round(progress.totalBytes / 1024 / 1024),
        total: progress.totalBytes,
        transferred: progress.totalDownloaded
      });
    });

    if (result.completed <= 0) {
      throw new Error('La descarga fallo o fue cancelada');
    }

    const { verified } = await linuxPackageUpdater.verifyDigest(packagePath, asset.digest);
    if (!verified) {
      logger.warn('[AutoUpdater] La release no publica hash del paquete; no se ha podido verificar');
    }

    sendToWindow('update-installing', { version: release.version });
    logger.info('[AutoUpdater] Instalando paquete:', packagePath);
    const install = await linuxPackageUpdater.installPackage(packagePath, packageType);

    if (!install.success) {
      if (!install.cancelled) {
        logger.error('[AutoUpdater] Fallo instalando el paquete:', install.code, install.output);
      }
      fallbackToManual(install.cancelled ? 'cancelled' : 'install-failed');
      return;
    }

    sendToWindow('update-downloaded', { version: release.version, path: packagePath });
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 5000);
  } catch (error) {
    logger.error('[AutoUpdater] Error actualizando desde paquete:', error);
    fallbackToManual('error');
  }
}

async function downloadUpdateWithManager() {
  if (!usesElectronUpdater()) {
    return {
      success: false,
      unsupported: true,
      reason: getUpdateCapabilities().reason
    };
  }

  if (!lastUpdateInfo || !lastUpdateInfo.files || !lastUpdateInfo.files[0]) {
    logger.error('[AutoUpdater] No hay informacion de actualizacion para descargar');
    return { success: false, error: 'No update info available' };
  }

  try {
    const fileInfo = lastUpdateInfo.files[0];
    let downloadUrl = fileInfo.url;

    if (!downloadUrl.startsWith('http')) {
      downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${lastUpdateInfo.version}/${downloadUrl}`;
    }

    const installerPath = path.join(app.getPath('temp'), `TruenoModpackSetup-${lastUpdateInfo.version}.exe`);
    const manager = new ChunkedDownloadManager(12, 1024 * 1024 * 6);

    const result = await manager.downloadFiles([{
      url: downloadUrl,
      destPath: installerPath
    }], null, (_idx, _file, progress) => {
      sendToWindow('update-download-progress', {
        percent: Math.round(progress.progressPercent),
        speed: Math.round(progress.speedBps / 1024),
        downloaded: Math.round(progress.totalDownloaded / 1024 / 1024),
        totalMB: Math.round(progress.totalBytes / 1024 / 1024),
        total: progress.totalBytes,
        transferred: progress.totalDownloaded
      });
    });

    if (result.completed <= 0) {
      throw new Error('La descarga fallo o fue cancelada');
    }

    sendToWindow('update-downloaded', {
      version: lastUpdateInfo.version,
      path: installerPath
    });

    setTimeout(() => {
      installManualUpdate(installerPath);
    }, 5000);

    return { success: true, path: installerPath };
  } catch (error) {
    logger.error('[AutoUpdater] Error descargando actualizacion:', error);
    sendToWindow('update-error', { message: error.message });
    return { success: false, error: error.message };
  }
}

function installManualUpdate(installerPath) {
  if (!usesElectronUpdater()) return;

  logger.info('[AutoUpdater] Lanzando instalador:', installerPath);
  const child = spawn(installerPath, ['--updated', '--force-run'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  app.quit();
}

async function downloadUpdateManually() {
  return downloadUpdateWithManager();
}

function quitAndInstall() {
  if (!usesElectronUpdater()) return;

  logger.info('[AutoUpdater] Instalando actualizacion y reiniciando...');
  autoUpdater.quitAndInstall(false, true);
}

ipcMain.handle('updater:get-capabilities', () => {
  return {
    ...getUpdateCapabilities(),
    platform: process.platform,
    isPackaged: app.isPackaged
  };
});

ipcMain.handle('updater:check', async () => {
  return checkForUpdatesManually();
});

ipcMain.handle('updater:download', async () => {
  return downloadUpdateManually();
});

ipcMain.handle('updater:install', () => {
  quitAndInstall();
  return { success: true };
});

ipcMain.handle('updater:get-version', () => {
  return { version: app.getVersion() };
});

ipcMain.handle('check-for-updates', async () => {
  return checkForUpdatesManually();
});

module.exports = {
  handleSquirrelEvents,
  setupAutoUpdater,
  checkForUpdatesManually,
  downloadUpdateManually,
  quitAndInstall,
  getUpdateCapabilities
};
