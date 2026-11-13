const { ipcMain } = require('electron');

const launchers = require('../../core/minecraft/launchers');
const { showToast } = require('../notifier');
const channels = require('../../shared/ipc-channels.json');

const CHANNELS = channels.launcher;

/**
 * @param {object} deps
 * @param {ReturnType<import('../../core/modpack').createModpackService>} deps.modpacks
 * @param {() => object} deps.getLauncherContext - Contexto para detectar launchers
 */
function registerLauncherHandlers({ modpacks, getLauncherContext }) {
  ipcMain.handle(CHANNELS.list, () => launchers.getMinecraftLaunchers(getLauncherContext()));

  ipcMain.handle(CHANNELS.open, async (_event, launcherId, modpackId) => {
    if (modpackId) {
      const prepared = await modpacks.ensureLauncherReady(modpackId);
      if (!prepared.success) {
        showToast('warning', 'Perfil del launcher no sincronizado', 'No se pudo preparar automáticamente el perfil del modpack antes de abrir Minecraft Launcher.');
      }
    }

    const opened = launchers.openMinecraftLauncher(launcherId, getLauncherContext());
    if (opened) {
      showToast('info', 'Ejecutando launcher', 'Se está ejecutando el launcher seleccionado...');
    } else {
      showToast('error', 'Error al abrir el launcher', 'No se ha podido abrir el launcher. Comprueba que esté instalado correctamente');
    }
    return opened;
  });
}

module.exports = { registerLauncherHandlers };
