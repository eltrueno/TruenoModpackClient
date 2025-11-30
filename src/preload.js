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
  //Online status?
  onStatus: (callback) => ipcRenderer.on("status", callback),
  //Open native file explorer
  openModpackPath: (modpackId) => ipcRenderer.invoke("open-modpack-path", modpackId),
  // Toast API
  showToast: (type, title, message, duration) => ipcRenderer.send('show-toast', { type, title, message, duration }),
  onToast: (callback) => ipcRenderer.on('show-toast', callback),
  getRamInfo: () => ipcRenderer.invoke('get-ram-info')
});

contextBridge.exposeInMainWorld('autoUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', callback),
});

contextBridge.exposeInMainWorld('config', {
  get: (key) => ipcRenderer.invoke('config:get', key),
  set: (key, value) => ipcRenderer.invoke('config:set', key, value),
  getAll: () => ipcRenderer.invoke('config:getAll'),
  setAll: (config) => ipcRenderer.invoke('config:setAll', config),
  save: () => ipcRenderer.invoke('config:save'),
  reset: () => ipcRenderer.invoke('config:reset')
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel, callback) => {
      if (channel === 'app-closing') {
        ipcRenderer.on(channel, callback);
      }
    }
  }
});