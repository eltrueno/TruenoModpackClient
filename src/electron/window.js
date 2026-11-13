const { BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow = null;

/**
 * Crea la ventana principal.
 * @param {object} options
 * @param {string} options.preloadPath
 * @param {string} [options.devServerUrl] - URL de Vite en desarrollo
 * @param {string} options.rendererFile - index.html empaquetado
 */
function createMainWindow({ preloadPath, devServerUrl, rendererFile }) {
  mainWindow = new BrowserWindow({
    width: 1000,
    minWidth: 1000,
    maxWidth: 1200,
    height: 800,
    minHeight: 775,
    maxHeight: 900,
    maximizable: false,
    icon: path.join('public', 'icon', 'icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(rendererFile);
  }

  mainWindow.removeMenu();

  // Los enlaces se abren en el navegador del sistema, nunca dentro de la app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/** Envía un evento a la interfaz si la ventana sigue abierta */
function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

module.exports = {
  createMainWindow,
  sendToWindow
};
