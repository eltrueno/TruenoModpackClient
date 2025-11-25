/**
 * Hecho por Claude AI (xd)
 */

const { app, ipcMain } = require('electron');

/**
 * Maneja los eventos de Squirrel durante instalación/actualización
 * Debe ser llamado al inicio de la app, antes de cualquier otra cosa
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
            // Instalación completada
            console.log('Squirrel: Instalación completada');
            setTimeout(() => app.quit(), 1000);
            return true;

        case '--squirrel-updated':
            // Actualización completada
            console.log('Squirrel: Actualización completada');
            setTimeout(() => app.quit(), 1000);
            return true;

        case '--squirrel-uninstall':
            // Desinstalación
            console.log('Squirrel: Desinstalación');
            // Aquí podrías limpiar datos de usuario si quisieras
            setTimeout(() => app.quit(), 1000);
            return true;

        case '--squirrel-obsolete':
            // Versión obsoleta, cerrar
            console.log('Squirrel: Versión obsoleta');
            app.quit();
            return true;

        default:
            return false;
    }
}

/**
 * Configura el auto-updater y sus event listeners
 * @param {BrowserWindow} mainWindow - Ventana principal para enviar eventos
 * @param {Object} options - Opciones de configuración
 * @param {string} options.updateServerUrl - URL del servidor de actualizaciones (Hazel)
 * @param {number} options.initialDelay - Delay inicial en ms antes de la primera comprobación (default: 3 segundos)
 */
function setupAutoUpdater(mainWindow, options = {}) {
    const { autoUpdater } = require('electron');

    // Configuración por defecto
    const config = {
        updateServerUrl: options.updateServerUrl || 'https://truenomodpack.eltrueno.es/update/win32/' + app.getVersion(),
        initialDelay: options.initialDelay || 3000 // 3 segundos
    };

    // Solo configurar en Windows y macOS
    if (process.platform !== 'win32' && process.platform !== 'darwin') {
        console.log('Auto-updater no disponible en esta plataforma');
        return;
    }

    // Configurar feed URL
    try {
        autoUpdater.setFeedURL({
            url: config.updateServerUrl
        });
        console.log('========================================');
        console.log('AutoUpdater configurado');
        console.log('Feed URL:', config.updateServerUrl);
        console.log('Versión actual:', app.getVersion());
        console.log('========================================');
    } catch (error) {
        console.error('Error configurando feed URL:', error);
        return;
    }

    // ====================================
    // Event Listeners
    // ====================================

    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Comprobando actualizaciones...');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-checking');
        }
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] ¡Actualización disponible!');
        if (info && info.version) {
            console.log('[AutoUpdater] Nueva versión:', info.version);
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-available', info);
        }
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[AutoUpdater] Ya estás en la última versión');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-not-available');
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent);
        const speed = Math.round(progressObj.bytesPerSecond / 1024);
        const downloaded = Math.round(progressObj.transferred / 1024 / 1024);
        const total = Math.round(progressObj.total / 1024 / 1024);

        console.log(`[AutoUpdater] Descargando: ${percent}% (${downloaded}MB/${total}MB) - ${speed} KB/s`);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-download-progress', progressObj);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] Actualización descargada');
        console.log('[AutoUpdater] Reiniciando en 5 segundos...');

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-downloaded', info);
        }

        // Dar tiempo al usuario para ver el mensaje antes de reiniciar
        setTimeout(() => {
            console.log('[AutoUpdater] Instalando actualización y reiniciando...');
            autoUpdater.quitAndInstall();
        }, 5000);
    });

    autoUpdater.on('error', (error) => {
        if (error.message.includes('204')) {
            console.log('[AutoUpdater] Ya estás en la última versión');
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-not-available');
            }
            return;
        }
        console.error('[AutoUpdater] Error:', error.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-error', error);
        }
    });

    // ====================================
    // Comprobaciones automáticas
    // ====================================

    // Primera comprobación después del delay inicial
    if (config.initialDelay > 0) {
        setTimeout(() => {
            console.log('[AutoUpdater] Iniciando primera comprobación de actualizaciones...');
            checkForUpdates();
        }, config.initialDelay);
    }

    /**
     * Función auxiliar para comprobar actualizaciones con manejo de errores
     */
    function checkForUpdates() {
        try {
            autoUpdater.checkForUpdates();
        } catch (error) {
            console.error('[AutoUpdater] Error al comprobar actualizaciones:', error);
        }
    }
}

/**
 * Comprueba actualizaciones manualmente
 * Útil para botones de "Comprobar actualizaciones" en la UI
 * @returns {Promise<Object>} Resultado de la comprobación
 */
async function checkForUpdatesManually() {
    const { autoUpdater } = require('electron');

    try {
        await autoUpdater.checkForUpdates();
        return { success: true };
    } catch (error) {
        console.error('[AutoUpdater] Error en comprobación manual:', error);
        return { success: false, error: error.message };
    }
}


ipcMain.handle('check-for-updates', async () => {
    await checkForUpdatesManually();
});

module.exports = {
    handleSquirrelEvents,
    setupAutoUpdater,
    checkForUpdatesManually
};