/**
 * Punto de entrada del proceso principal.
 *
 * Aquí solo se conectan las piezas:
 *   - core/      lógica de la aplicación, sin dependencias de Electron
 *   - electron/  ventana, IPC, actualizador y demás integración con Electron
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

// El logger se configura antes que nada para que el core escriba en el archivo de log
const coreLogger = require('./core/logger');
const electronLogger = require('./electron/logger');
coreLogger.setLogger(electronLogger);

const { ConfigStore } = require('./core/config/ConfigStore');
const { createModpackService } = require('./core/modpack');
const { resolveMinecraftPath } = require('./core/minecraft/paths');
const system = require('./core/system');

const updater = require('./electron/updater');
const { createMainWindow, sendToWindow } = require('./electron/window');
const { showToast } = require('./electron/notifier');
const { registerIpcHandlers } = require('./electron/ipc');
const channels = require('./shared/ipc-channels.json');

const MODPACK_SERVER_URL = 'https://s3.truenomodpack.eltrueno.es';

process.on('uncaughtException', (error) => {
  coreLogger.error('Uncaught Exception: ', error);
  showToast('error', 'Error inesperado', 'Ha ocurrido un error inesperado. Para más información, consulta el log.');
});

// Durante la instalación/desinstalación en Windows la app se lanza solo para
// gestionar accesos directos y debe cerrarse sin abrir ventana
if (updater.handleSquirrelEvents()) {
  app.quit();
  process.exit(0);
}

// ------------------------------------------------------------------ Servicios

const userDataPath = app.getPath('userData');

const config = new ConfigStore(path.join(userDataPath, 'config.json'));

const getMinecraftPath = () => resolveMinecraftPath({
  platform: process.platform,
  home: app.getPath('home'),
  appData: app.getPath('appData'),
  env: process.env
});

const modpacks = createModpackService({
  modpacksDir: path.join(userDataPath, 'modpack'),
  baseUrl: MODPACK_SERVER_URL,
  getMinecraftPath,
  getPreference: (key) => config.get(`userPreferences.${key}`)
});

registerIpcHandlers({
  modpacks,
  config,
  getLauncherContext: () => ({
    platform: process.platform,
    minecraftPath: getMinecraftPath(),
    classicLauncherPath: config.get('userPreferences.classicLauncherPath')
  })
});

// ------------------------------------------------------------------ Ventana

async function createWindow() {
  const online = await system.checkInternet();
  await config.load();

  const mainWindow = createMainWindow({
    preloadPath: path.join(__dirname, 'preload.js'),
    devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
    rendererFile: path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  });

  mainWindow.webContents.once('did-finish-load', () => {
    sendToWindow(channels.events.onlineStatus, online);
  });

  updater.setupAutoUpdater(sendToWindow, { autoDownload: true });
}

app.whenReady().then(createWindow);

// En macOS las aplicaciones siguen abiertas hasta que el usuario sale con Cmd + Q
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', async () => {
  await config.save();
});
