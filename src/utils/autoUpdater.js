const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');

const logger = require('./logger');
const { ChunkedDownloadManager } = require('../download/managers/ChunkedDownloadManager');

const GITHUB_OWNER = 'JesusMontoro';
const GITHUB_REPO = 'TruenoModpackClient';

autoUpdater.logger = logger;
autoUpdater.autoDownload = false;

const UPDATE_CAPABILITIES = {
  win32: {
    enabled: true,
    provider: 'github',
    mode: 'squirrel-manual',
    reason: null
  },
  darwin: {
    enabled: false,
    provider: 'github',
    mode: 'disabled',
    reason: 'La actualizacion automatica para macOS requiere artefactos y metadatos de release que este proyecto aun no genera.'
  },
  linux: {
    enabled: false,
    provider: 'github',
    mode: 'disabled',
    reason: 'La actualizacion automatica en Linux depende del formato de paquete publicado y no esta implementada en este proyecto.'
  }
};

function getUpdateCapabilities() {
  return UPDATE_CAPABILITIES[process.platform] || {
    enabled: false,
    provider: 'none',
    mode: 'disabled',
    reason: `La plataforma ${process.platform} no esta soportada por el auto-updater.`
  };
}

function isAutoUpdateEnabled() {
  return getUpdateCapabilities().enabled;
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
  logger.info('Auto-update habilitado:', capabilities.enabled);
  if (!capabilities.enabled && capabilities.reason) {
    logger.info('Motivo:', capabilities.reason);
  }
  logger.info('========================================');

  if (!capabilities.enabled) {
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

async function downloadUpdateWithManager() {
  if (!isAutoUpdateEnabled()) {
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
  if (!isAutoUpdateEnabled()) return;

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
  if (!isAutoUpdateEnabled()) return;

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
