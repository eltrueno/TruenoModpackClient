const { app, ipcMain } = require('electron');

const system = require('../../core/system');
const updater = require('../updater');
const { sendToWindow } = require('../window');
const { registerModpackHandlers } = require('./modpack');
const { registerLauncherHandlers } = require('./launcher');
const channels = require('../../shared/ipc-channels.json');

function registerConfigHandlers(config) {
  const CHANNELS = channels.config;

  ipcMain.handle(CHANNELS.get, (_event, key) => config.get(key));
  ipcMain.handle(CHANNELS.set, (_event, key, value) => {
    config.set(key, value);
    return true;
  });
  ipcMain.handle(CHANNELS.getAll, () => config.getAll());
  ipcMain.handle(CHANNELS.setAll, (_event, newConfig) => config.setAll(newConfig));
  ipcMain.handle(CHANNELS.save, () => config.save());
  ipcMain.handle(CHANNELS.reset, () => config.reset());
}

function registerSystemHandlers() {
  ipcMain.handle(channels.system.getRamInfo, () => system.getRamInfo());

  // La interfaz pide un toast y se le devuelve por el canal de eventos
  ipcMain.on(channels.system.showToast, (_event, toastData) => {
    sendToWindow(channels.events.toast, toastData);
  });
}

function registerUpdaterHandlers() {
  ipcMain.handle(channels.updater.check, () => updater.checkForUpdates());

  ipcMain.handle(channels.updater.getCapabilities, () => ({
    ...updater.getUpdateCapabilities(),
    platform: process.platform,
    isPackaged: app.isPackaged
  }));
}

/**
 * Registra todos los handlers IPC. Es el único punto en el que la interfaz
 * habla con el core; los nombres de los canales están en shared/ipc-channels.json.
 */
function registerIpcHandlers({ modpacks, config, getLauncherContext }) {
  registerModpackHandlers(modpacks);
  registerLauncherHandlers({ modpacks, getLauncherContext });
  registerConfigHandlers(config);
  registerSystemHandlers();
  registerUpdaterHandlers();
}

module.exports = { registerIpcHandlers };
