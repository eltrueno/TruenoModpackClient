/**
 * Auto-updater con electron-updater (usa Squirrel en Windows)
 * Migrado desde autoUpdater nativo
 */

const { app, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const logger = require('./logger');
const { ChunkedDownloadManager } = require('../download/managers/ChunkedDownloadManager');

// Configurar logging
autoUpdater.logger = logger;
autoUpdater.autoDownload = false; // Desactivamos descarga automática para usar ChunkedDownloadManager

/**
 * Maneja los eventos de Squirrel durante instalación/actualización
 * @returns {boolean} true si la app debe cerrarse (evento de Squirrel), false si debe continuar
 */
function handleSquirrelEvents() {
    if (process.platform !== 'win32') {
        return false;
    }

    // Verificar si es un evento de Squirrel
    if (require('electron-squirrel-startup')) {
        return true;
    }

    if (process.argv.length === 1) {
        return false;
    }

    const squirrelEvent = process.argv[1];

    switch (squirrelEvent) {
        case '--squirrel-install':
            logger.info('Squirrel: Instalación completada');
            setTimeout(() => app.quit(), 1000);
            return true;

        case '--squirrel-updated':
            logger.info('Squirrel: Actualización completada');
            setTimeout(() => app.quit(), 1000);
            return true;

        case '--squirrel-uninstall':
            logger.info('Squirrel: Desinstalación');
            setTimeout(() => app.quit(), 1000);
            return true;

        case '--squirrel-obsolete':
            logger.info('Squirrel: Versión obsoleta');
            app.quit();
            return true;

        default:
            return false;
    }
}

let lastUpdateInfo = null;
let mainWindowRef = null;

/**
 * Helper para enviar eventos a la ventana
 */
function sendToWindow(channel, data) {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send(channel, data);
    }
}

/**
 * Configura electron-updater y sus event listeners
 * @param {BrowserWindow} mainWindow - Ventana principal para enviar eventos
 * @param {Object} options - Opciones de configuración
 */
function setupAutoUpdater(mainWindow, options = {}) {
    mainWindowRef = mainWindow;
    // Configuración por defecto
    const config = {
        // GitHub Releases
        provider: 'github',
        owner: 'eltrueno',
        repo: 'TruenoModpackClient',
        // url: options.updateServerUrl || 'https://truenomodpack.eltrueno.es/update', // No needed for github provider
        channel: options.channel || 'latest',
        initialDelay: options.initialDelay || 3000, // 3 segundos
        checkInterval: options.checkInterval || 0 // 0 = no comprobar automáticamente
    };

    // Configurar electron-updater
    // Si la URL es undefined, electron-updater usará la configuración de package.json
    // Pero forzamos nuestra config si queremos defaults
    // autoUpdater.setFeedURL(config); // generic uses url, github uses object

    // Si queremos sobreescribir lo del package.json:
    // autoUpdater.setFeedURL({
    //    provider: 'github',
    //    owner: 'eltrueno',
    //    repo: 'TruenoModpackClient'
    // });
    // Pero electron-updater lo lee solo si está bien configurado en package.json.
    // Dejemos que lea del package.json o le pasamos lo básico.

    // Para GitHub provider no se suele llamar a setFeedURL con URL, sino con opciones.
    // O mejor, dejar que lea de package.json si no se pasan opciones explicitas.

    if (options.updateServerUrl) {
        // Si se pasa URL explicita (dev), usamos generic
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: options.updateServerUrl
        });
    } else {
        // En prod, forzamos GitHub para que electron-updater sepa dónde mirar
        // sin depender de archivos .yml secundarios
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'eltrueno',
            repo: 'TruenoModpackClient'
        });
    }

    // Forzar configuración de desarrollo si no está empaquetado
    if (!app.isPackaged) {
        autoUpdater.forceDevUpdateConfig = true;
    }

    logger.info('========================================');
    logger.info('electron-updater configurado');
    logger.info('Feed URL:', config.url);
    logger.info('Channel:', config.channel);
    logger.info('Versión actual:', app.getVersion());
    logger.info('Plataforma:', process.platform);
    logger.info('========================================');

    // ====================================
    // Event Listeners
    // ====================================

    autoUpdater.on('checking-for-update', () => {
        logger.info('[AutoUpdater] Comprobando actualizaciones...');
        sendToWindow('update-checking');
    });

    autoUpdater.on('update-available', (info) => {
        logger.info('[AutoUpdater] ¡Actualización disponible!');
        logger.info('[AutoUpdater] Nueva versión:', info.version);
        logger.info('[AutoUpdater] Fecha de lanzamiento:', info.releaseDate);
        if (info.files && info.files[0]) {
            logger.info('[AutoUpdater] Tamaño:', (info.files[0].size / 1024 / 1024).toFixed(2), 'MB');
        }

        lastUpdateInfo = info;

        sendToWindow('update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
            size: info.files && info.files[0] ? info.files[0].size : 0
        });

        // Autostart download if requested
        if (options.autoDownload !== false) {
            downloadUpdateWithManager();
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        logger.info('[AutoUpdater] Ya estás en la última versión');
        sendToWindow('update-not-available', {
            version: info.version
        });
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent);
        const speed = Math.round(progressObj.bytesPerSecond / 1024);
        const downloaded = Math.round(progressObj.transferred / 1024 / 1024);
        const total = Math.round(progressObj.total / 1024 / 1024);

        // logger.info(`[AutoUpdater] Descargando: ${percent}% (${downloaded}MB/${total}MB) - ${speed} KB/s`);

        sendToWindow('update-download-progress', {
            percent,
            bytesPerSecond: progressObj.bytesPerSecond,
            transferred: progressObj.transferred,
            total: progressObj.total,
            speed,
            downloaded,
            totalMB: total
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        // NOTA: Este evento lo emite electron-updater si el baja el archivo.
        // Como usamos nuestro propio manager, emitiremos un evento personalizado.
        // Pero lo dejamos por si acaso.
    });

    autoUpdater.on('error', (error) => {
        logger.error('[AutoUpdater] Error:', error.message);
        // logger.error('[AutoUpdater] Stack:', error.stack);

        sendToWindow('update-error', {
            message: error.message,
            stack: error.stack
        });
    });

    // Comprobaciones automáticas DESACTIVADAS
    // La UI (App.vue) se encarga de llamar a checkForUpdates() cuando es necesario.

    /**
     * Función auxiliar para comprobar actualizaciones con manejo de errores
     */
    function checkForUpdates() {
        /*if (!app.isReady()) {
            logger.warn('[AutoUpdater] App no está lista, saltando comprobación');
            return;
        }*/

        try {
            autoUpdater.checkForUpdates();
        } catch (error) {
            logger.error('[AutoUpdater] Error al comprobar actualizaciones:', error);
        }
    }
}

/**
 * Comprueba actualizaciones manualmente
 * @returns {Promise<Object>} Resultado de la comprobación
 */
async function checkForUpdatesManually() {
    try {
        const result = await autoUpdater.checkForUpdates();
        return {
            success: true,
            updateInfo: result ? result.updateInfo : null
        };
    } catch (error) {
        logger.error('[AutoUpdater] Error en comprobación manual:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Descarga una actualización usando ChunkedDownloadManager
 */
async function downloadUpdateWithManager() {
    if (!lastUpdateInfo || !lastUpdateInfo.files || !lastUpdateInfo.files[0]) {
        logger.error('[AutoUpdater] No hay info de actualización para descargar');
        return { success: false, error: 'No update info available' };
    }

    try {
        const fileInfo = lastUpdateInfo.files[0];
        // En GitHub provider, el .url a veces es solo el nombre.
        // Intentar resolver la URL completa si es necesario.
        // Pero electron-updater ya suele resolverlo si el provider está configurado.

        let downloadUrl = fileInfo.url;

        // Fix para GitHub si la URL no es completa (aunque suele serlo)
        if (!downloadUrl.startsWith('http')) {
            // Construir URL de release de GitHub si no viene completa
            const owner = 'eltrueno';
            const repo = 'TruenoModpackClient';
            // Quitamos el 'v' del tag ya que según los logs no lo usas en el tag de descarga
            downloadUrl = `https://github.com/${owner}/${repo}/releases/download/${lastUpdateInfo.version}/${downloadUrl}`;
        }

        logger.info(`[AutoUpdater] Descargando actualización con ChunkedDownloadManager: ${downloadUrl}`);

        const installerPath = path.join(app.getPath('temp'), `TruenoModpackSetup-${lastUpdateInfo.version}.exe`);

        const manager = new ChunkedDownloadManager(8, 1024 * 1024 * 5); // 8 hilos, chunks 5MB

        const result = await manager.downloadFiles([{
            url: downloadUrl,
            destPath: installerPath
        }], null, (idx, file, progress) => {
            // Mapear al formato que espera la UI
            sendToWindow('update-download-progress', {
                percent: Math.round(progress.progressPercent),
                speed: Math.round(progress.speedBps / 1024),
                downloaded: Math.round(progress.totalDownloaded / 1024 / 1024),
                totalMB: Math.round(progress.totalBytes / 1024 / 1024),
                total: progress.totalBytes,
                transferred: progress.totalDownloaded
            });
        });

        if (result.completed > 0) {
            logger.info('[AutoUpdater] Descarga completada con éxito');

            sendToWindow('update-downloaded', {
                version: lastUpdateInfo.version,
                path: installerPath
            });

            // Iniciar instalación automática tras 5 segundos (como antes)
            setTimeout(() => {
                installManualUpdate(installerPath);
            }, 5000);

            return { success: true, path: installerPath };
        } else {
            throw new Error('La descarga falló o fue cancelada');
        }

    } catch (error) {
        logger.error('[AutoUpdater] Error descargando con manager:', error);
        sendToWindow('update-error', { message: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Lanza el instalador .exe descargado
 * @param {string} installerPath 
 */
function installManualUpdate(installerPath) {
    logger.info(`[AutoUpdater] Lanzando instalador: ${installerPath}`);

    // En Windows, el instalador de Squirrel se puede lanzar directamente.
    // Usamos spawn para que sea independiente del proceso actual.
    const child = spawn(installerPath, ['--updated', '--force-run'], {
        detached: true,
        stdio: 'ignore'
    });

    child.unref();

    // Salir de la app
    app.quit();
}

/**
 * Descarga una actualización manualmente
 * @returns {Promise<Object>}
 */
async function downloadUpdateManually() {
    return await downloadUpdateWithManager();
}

/**
 * Instala la actualización y reinicia
 */
function quitAndInstall() {
    logger.info('[AutoUpdater] Instalando actualización y reiniciando...');
    autoUpdater.quitAndInstall(false, true);
}

// ====================================
// IPC Handlers
// ====================================

ipcMain.handle('updater:check', async () => {
    return await checkForUpdatesManually();
});

ipcMain.handle('updater:download', async () => {
    return await downloadUpdateManually();
});

ipcMain.handle('updater:install', () => {
    quitAndInstall();
    return { success: true };
});

ipcMain.handle('updater:get-version', () => {
    return { version: app.getVersion() };
});

// Mantener compatibilidad con llamadas antiguas si es necesario
ipcMain.handle('check-for-updates', async () => {
    return await checkForUpdatesManually();
});

module.exports = {
    handleSquirrelEvents,
    setupAutoUpdater,
    checkForUpdatesManually,
    downloadUpdateManually,
    quitAndInstall
};