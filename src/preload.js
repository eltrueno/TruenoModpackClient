// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appAPI', {
  isModpackInstalled: (modpackid) => ipcRenderer.invoke('is-modpack-installed', modpackid),
  getLocalModpackJson: (modpackid) => ipcRenderer.invoke('get-modpack-local', modpackid),
  getRemoteModpackJson: (modpackid) => ipcRenderer.invoke('get-modpack-remote', modpackid),
  calculateSyncOperations: (modpackId) => ipcRenderer.invoke('calculate-sync-operations', modpackId),
  installOrUpdateModpack: (modpackId) => ipcRenderer.invoke('install-or-update-modpack', modpackId),
  verifyModpackIntegrity: (modpackId) => ipcRenderer.invoke('verify-modpack-integrity', modpackId),
  openMinecraftLauncher: (launcher) => ipcRenderer.invoke('open-minecraft-launcher', launcher),
  getMinecraftLaunchers: () => ipcRenderer.invoke('get-minecraft-launchers'),
  onInstallationProgress: (callback) => ipcRenderer.on('installation-progress', (event, data) => callback(data)),
  removeInstallationProgressListener: () => ipcRenderer.removeAllListeners('installation-progress'),
  onStatus: (callback) => ipcRenderer.on("status", callback),
  // Toast API
  showToast: (type, title, message, duration) => ipcRenderer.send('show-toast', { type, title, message, duration }),
  onToast: (callback) => ipcRenderer.on('show-toast', callback)
});