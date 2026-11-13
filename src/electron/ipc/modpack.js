const { ipcMain, shell } = require('electron');

const { ERROR_CODES } = require('../../core/modpack');
const { showToast } = require('../notifier');
const { sendToWindow } = require('../window');
const channels = require('../../shared/ipc-channels.json');

const CHANNELS = channels.modpack;

/**
 * Si el fallo es de conexión con el servidor de modpacks, avisa al usuario.
 * El error se vuelve a lanzar para que llegue a la interfaz.
 */
function notifyIfRemoteUnavailable(error) {
  if (error && error.code === ERROR_CODES.REMOTE_UNAVAILABLE) {
    showToast('warning', 'Error de conexión', 'No se ha podido conectar con el servidor. Por favor, revisa tu conexión y prueba de nuevo más tarde');
  }
}

function withConnectionNotice(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      notifyIfRemoteUnavailable(error);
      throw error;
    }
  };
}

/**
 * @param {ReturnType<import('../../core/modpack').createModpackService>} modpacks
 */
function registerModpackHandlers(modpacks) {
  const sendProgress = (progress) => sendToWindow(channels.events.progress, progress);

  ipcMain.handle(CHANNELS.isInstalled, (_event, modpackId) => modpacks.isInstalled(modpackId));

  ipcMain.handle(CHANNELS.getLocal, (_event, modpackId) => modpacks.getLocalManifest(modpackId));

  ipcMain.handle(CHANNELS.getRemote, withConnectionNotice((_event, modpackId) => modpacks.getRemoteManifest(modpackId)));

  ipcMain.handle(CHANNELS.calculateSyncOperations, withConnectionNotice(async (_event, modpackId) => {
    const { operations, remote, local } = await modpacks.calculateSyncOperations(modpackId);
    return {
      operations,
      remoteVersion: remote.version,
      localVersion: local?.version?.version || 0
    };
  }));

  ipcMain.handle(CHANNELS.installOrUpdate, async (_event, modpackId) => {
    let result;
    try {
      result = await modpacks.installOrUpdate(modpackId, sendProgress);
    } catch (error) {
      notifyIfRemoteUnavailable(error);
      if (error.code === ERROR_CODES.LOADER_INSTALL_FAILED) {
        showToast('error', 'Error durante la instalación', 'Ha ocurrido un error inesperado durante la instalación del loader. Por favor, prueba de nuevo más tarde.');
      }
      showToast('error', 'Error durante la instalación', 'Ha ocurrido un error inesperado durante la instalación del modpack. Por favor, prueba de nuevo más tarde.');
      throw error;
    }

    if (result.success) {
      showToast('success', 'Instalación correcta', 'Se ha instalado el modpack correctamente');
    } else if (result.cancelled) {
      showToast('info', 'Cancelado', 'Instalación cancelada');
    }
    return result;
  });

  ipcMain.handle(CHANNELS.cancelInstallOrUpdate, (_event, modpackId) => modpacks.cancelInstallation(modpackId));

  ipcMain.handle(CHANNELS.verifyIntegrity, withConnectionNotice(async (_event, modpackId) => {
    const result = await modpacks.verify(modpackId);
    if (result.valid) {
      showToast('success', 'Verificación correcta', 'Se han verificado todos los archivos del modpack correctamente');
    }
    return result;
  }));

  ipcMain.handle(CHANNELS.openPath, (_event, modpackId) => shell.openPath(modpacks.getDataPath(modpackId)));

  ipcMain.handle(CHANNELS.uninstall, async (_event, modpackId) => {
    try {
      const result = await modpacks.uninstall(modpackId, sendProgress);
      showToast('success', 'Desinstalación completada', 'El modpack ha sido desinstalado correctamente.');
      return result;
    } catch (error) {
      showToast('error', 'Error en desinstalación', 'No se pudo desinstalar el modpack.');
      throw error;
    }
  });
}

module.exports = { registerModpackHandlers };
