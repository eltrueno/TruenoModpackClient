const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');

const logger = require('../core/logger');
const { findUpdate } = require('../core/update/updateCheck');
const { downloadUpdateFile } = require('../core/update/downloadUpdate');
const linuxPackageUpdater = require('../core/update/linuxPackageUpdater');
const channels = require('../shared/ipc-channels.json');

const GITHUB_OWNER = 'eltrueno';
const GITHUB_REPO = 'TruenoModpackClient';

const EVENTS = channels.events;

// Segundos que se muestra el aviso antes de reiniciar tras actualizar
const RESTART_DELAY_MS = 5000;

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

function usesElectronUpdater() {
  return getUpdateCapabilities().mode === 'squirrel-manual';
}

/**
 * Eventos de instalacion de Squirrel (Windows). Si devuelve true, la app
 * debe cerrarse sin abrir ventana.
 */
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

  switch (process.argv[1]) {
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
// Funcion (channel, data) => void con la que se avisa a la interfaz
let sendToWindow = () => {};

/**
 * @param {(channel: string, data?: any) => void} send - Envia un evento a la interfaz
 * @param {{autoDownload?: boolean, updateServerUrl?: string}} [options]
 */
function setupAutoUpdater(send, options = {}) {
  sendToWindow = send;

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

  if (options.updateServerUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: options.updateServerUrl });
  } else {
    autoUpdater.setFeedURL({ provider: 'github', owner: GITHUB_OWNER, repo: GITHUB_REPO });
  }

  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.on('checking-for-update', () => {
    logger.info('[AutoUpdater] Comprobando actualizaciones...');
    sendToWindow(EVENTS.updateChecking);
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('[AutoUpdater] Actualizacion disponible:', info.version);
    lastUpdateInfo = info;

    sendToWindow(EVENTS.updateAvailable, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
      size: info.files && info.files[0] ? info.files[0].size : 0
    });

    if (options.autoDownload !== false) {
      downloadWindowsInstaller();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('[AutoUpdater] No hay actualizaciones disponibles');
    sendToWindow(EVENTS.updateNotAvailable, { version: info.version });
  });

  autoUpdater.on('error', (error) => {
    logger.error('[AutoUpdater] Error:', error.message);
    sendToWindow(EVENTS.updateError, { message: error.message, stack: error.stack });
  });

  return capabilities;
}

async function checkForUpdates() {
  const capabilities = getUpdateCapabilities();
  if (!capabilities.enabled) {
    return { success: false, unsupported: true, reason: capabilities.reason };
  }

  if (!usesElectronUpdater()) {
    return checkGithubRelease();
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result ? result.updateInfo : null };
  } catch (error) {
    logger.error('[AutoUpdater] Error en comprobacion manual:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Comprobacion para Linux y macOS: consulta la ultima release de GitHub.
 * Si hay version nueva, se instala (Linux desde paquete) o se avisa.
 */
async function checkGithubRelease() {
  const capabilities = getUpdateCapabilities();
  sendToWindow(EVENTS.updateChecking);

  let update;
  try {
    update = await findUpdate({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      currentVersion: app.getVersion(),
      packageType: capabilities.mode === 'linux-package' ? capabilities.packageType : undefined
    });
  } catch (error) {
    // Un fallo al comprobar no debe bloquear el uso de la aplicacion
    logger.warn('[AutoUpdater] No se pudo consultar la ultima release:', error.message);
    sendToWindow(EVENTS.updateNotAvailable, { version: app.getVersion() });
    return { success: false, error: error.message };
  }

  if (!update.available) {
    logger.info('[AutoUpdater] No hay actualizaciones disponibles');
    sendToWindow(EVENTS.updateNotAvailable, { version: app.getVersion() });
    return { success: true, updateInfo: null };
  }

  logger.info('[AutoUpdater] Version nueva disponible:', update.version);
  const updateInfo = { version: update.version, url: update.url };

  if (capabilities.mode === 'linux-package') {
    if (update.asset) {
      sendToWindow(EVENTS.updateAvailable, {
        version: update.version,
        releaseDate: update.publishedAt,
        releaseNotes: update.notes,
        size: update.asset.size
      });
      // No se espera: el progreso llega a la interfaz por eventos
      installLinuxPackageUpdate(update, capabilities.packageType);
      return { success: true, updateInfo };
    }
    logger.warn(`[AutoUpdater] La release ${update.version} no incluye paquete .${capabilities.packageType} para ${process.arch}`);
  }

  sendToWindow(EVENTS.updateManual, updateInfo);
  return { success: true, updateInfo, manual: true };
}

async function installLinuxPackageUpdate(update, packageType) {
  // Si algo falla, la app sigue siendo usable y se ofrece la descarga manual
  const fallbackToManual = (reason) => {
    logger.warn('[AutoUpdater] Actualizacion automatica no completada:', reason);
    sendToWindow(EVENTS.updateManual, { version: update.version, url: update.url, reason });
  };

  try {
    const result = await linuxPackageUpdater.downloadAndInstall({
      asset: update.asset,
      packageType,
      tempDir: app.getPath('temp'),
      onProgress: (progress) => sendToWindow(EVENTS.updateDownloadProgress, progress),
      onInstalling: () => sendToWindow(EVENTS.updateInstalling, { version: update.version })
    });

    if (!result.success) {
      fallbackToManual(result.reason);
      return;
    }

    sendToWindow(EVENTS.updateDownloaded, { version: update.version, path: result.packagePath });
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, RESTART_DELAY_MS);
  } catch (error) {
    logger.error('[AutoUpdater] Error actualizando desde paquete:', error);
    fallbackToManual('error');
  }
}

/** Windows: descarga el instalador de la nueva version y lo lanza */
async function downloadWindowsInstaller() {
  if (!lastUpdateInfo || !lastUpdateInfo.files || !lastUpdateInfo.files[0]) {
    logger.error('[AutoUpdater] No hay informacion de actualizacion para descargar');
    return { success: false, error: 'No update info available' };
  }

  try {
    let downloadUrl = lastUpdateInfo.files[0].url;
    if (!downloadUrl.startsWith('http')) {
      downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${lastUpdateInfo.version}/${downloadUrl}`;
    }

    const installerPath = path.join(app.getPath('temp'), `TruenoModpackSetup-${lastUpdateInfo.version}.exe`);
    await downloadUpdateFile(downloadUrl, installerPath, (progress) => {
      sendToWindow(EVENTS.updateDownloadProgress, progress);
    });

    sendToWindow(EVENTS.updateDownloaded, { version: lastUpdateInfo.version, path: installerPath });
    setTimeout(() => launchWindowsInstaller(installerPath), RESTART_DELAY_MS);

    return { success: true, path: installerPath };
  } catch (error) {
    logger.error('[AutoUpdater] Error descargando actualizacion:', error);
    sendToWindow(EVENTS.updateError, { message: error.message });
    return { success: false, error: error.message };
  }
}

function launchWindowsInstaller(installerPath) {
  logger.info('[AutoUpdater] Lanzando instalador:', installerPath);
  const child = spawn(installerPath, ['--updated', '--force-run'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  app.quit();
}

module.exports = {
  handleSquirrelEvents,
  setupAutoUpdater,
  checkForUpdates,
  getUpdateCapabilities
};
