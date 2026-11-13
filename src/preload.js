// Puente entre la interfaz (renderer) y el proceso principal.
// Los nombres de los canales están en shared/ipc-channels.json, compartido con main.
import { contextBridge, ipcRenderer } from 'electron';
import channels from './shared/ipc-channels.json';

const { modpack, launcher, system, config, updater, events } = channels;

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);
const on = (channel) => (callback) => ipcRenderer.on(channel, callback);

contextBridge.exposeInMainWorld('appAPI', {
  openMinecraftLauncher: invoke(launcher.open),
  getMinecraftLaunchers: invoke(launcher.list),
  onProgress: (callback) => ipcRenderer.on(events.progress, (_event, data) => callback(data)),
  removeProgressListener: () => ipcRenderer.removeAllListeners(events.progress),
  // Estado de la conexión a internet
  onStatus: on(events.onlineStatus),
  // Toasts
  showToast: (type, title, message, duration) => ipcRenderer.send(system.showToast, { type, title, message, duration }),
  onToast: on(events.toast),
  getRamInfo: invoke(system.getRamInfo)
});

contextBridge.exposeInMainWorld('modpackAPI', {
  isModpackInstalled: invoke(modpack.isInstalled),
  getLocalModpackJson: invoke(modpack.getLocal),
  getRemoteModpackJson: invoke(modpack.getRemote),
  calculateSyncOperations: invoke(modpack.calculateSyncOperations),
  installOrUpdateModpack: invoke(modpack.installOrUpdate),
  cancelInstallOrUpdate: invoke(modpack.cancelInstallOrUpdate),
  verifyModpackIntegrity: invoke(modpack.verifyIntegrity),
  openModpackPath: invoke(modpack.openPath),
  uninstallModpack: invoke(modpack.uninstall)
});

contextBridge.exposeInMainWorld('autoUpdater', {
  checkForUpdates: invoke(updater.check),
  getCapabilities: invoke(updater.getCapabilities),
  onUpdateChecking: on(events.updateChecking),
  onUpdateAvailable: on(events.updateAvailable),
  onUpdateNotAvailable: on(events.updateNotAvailable),
  onUpdateDownloaded: on(events.updateDownloaded),
  onUpdateError: on(events.updateError),
  onUpdateDownloadProgress: on(events.updateDownloadProgress),
  // Linux: el paquete ya está descargado y se está instalando (pide contraseña)
  onUpdateInstalling: on(events.updateInstalling),
  // Hay versión nueva pero hay que descargarla a mano (macOS / Linux sin paquete)
  onUpdateManual: on(events.updateManual)
});

contextBridge.exposeInMainWorld('config', {
  get: invoke(config.get),
  set: invoke(config.set),
  getAll: invoke(config.getAll),
  setAll: invoke(config.setAll),
  save: invoke(config.save),
  reset: invoke(config.reset)
});
