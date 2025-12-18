const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const dns = require("dns");
const lockfile = require('proper-lockfile');
const pLimit = require('p-limit');

const { calculateFileHash, ensureDir, fileExists, ensureFile } = require('./utils/file-utils.js')
const loaderInstaller = require('./minecraft/loader-installer.js');
const minecraftProfile = require('./minecraft/profile.js');
const { openMinecraftLauncher, getMinecraftLaunchers } = require('./minecraft/launcher.js');
const minecraftOptions = require('./minecraft/options.js');

const autoUpdater = require('./utils/autoUpdater.js');
const configManager = require('./utils/configManager.js');
const { AdaptiveDownloadManager } = require('./download');
const logger = require('./utils/logger.js');

const activeInstallations = new Map();

function checkInternet() {
  return new Promise((resolve) => {
    dns.lookup("google.com", (err) => {
      resolve(!err);
    });
  });
}

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception: ', err);
  showToast('error', 'Error inesperado', 'Ha ocurrido un error inesperado. Para más información, consulta el log.');
});



if (autoUpdater.handleSquirrelEvents()) {
  app.quit();
  process.exit(0);
}


let mainWindow;
let online = false;

const createWindow = async () => {
  online = await checkInternet();

  await configManager.load();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    minWidth: 1000,
    maxWidth: 1200,
    height: 800,
    minHeight: 775,
    maxHeight: 900,
    maximizable: false,
    icon: '././public/icon/icon.png',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    },
  });


  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("status", online);
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.removeMenu()

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

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

  //AutoUpdater
  // No pasamos updateServerUrl para que use la config de package.json (GitHub) por defecto
  autoUpdater.setupAutoUpdater(mainWindow, {
    channel: 'latest',
    initialDelay: 3000,
    checkInterval: 0,
    autoDownload: true,
    autoInstallOnAppQuit: true
  });


};


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
//app.on('ready', createWindow);
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', async () => {
  await configManager.save();
});


/*async function calculateFileHash(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return 'sha256:' + hashSum.digest('hex');
  } catch (error) {
    logger.error('Error calculating hash:', error);
    return null;
  }
}*/

/*const { createReadStream } = require('fs');
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve('sha256:' + hash.digest('hex')));
  });
}
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true
  } catch (error) {
    logger.error('Error creating directory:', error);
    return false
  }
}*/

function getModpackBasePath(modpackId) {
  return path.join(app.getPath("userData"), 'modpack', modpackId);
}

function getModpackManifestPath(modpackId) {
  return path.join(getModpackBasePath(modpackId), 'truenomodpack.json');
}

async function existsModpackJsonFile(modpackId) {
  return await fileExists(getModpackManifestPath(modpackId));
}

function getModpackDataPath(modpackId) {
  return path.join(getModpackBasePath(modpackId), 'minecraftdata');
}

const TRUENOMODPACK_BASE_URL = "https://s3.truenomodpack.eltrueno.es"

const getRemoteModpackList = async () => {
  try {
    const response = await axios.get(TRUENOMODPACK_BASE_URL + "/modpacks.json");
    return response.data;
  } catch (error) {
    logger.error('Error getting modpack list:', error);
    throw error;
  }
}

const getRemoteModpack = async (modpackid) => {
  try {
    const response = await axios.get(TRUENOMODPACK_BASE_URL + "/" + modpackid + "/truenomodpack.json");
    return response.data;
  } catch (error) {
    logger.error('Error getting remote modpack:', error);
    showToast('warning', 'Error de conexión', 'No se ha podido conectar con el servidor. Por favor, revisa tu conexión y prueba de nuevo más tarde');
    throw error;
  }
}

async function getLocalModpack(modpackid) {
  const filePath = path.join(app.getPath("userData"), 'modpack', modpackid, 'truenomodpack.json');

  const release = await lockfile.lock(filePath, { retries: 5 });
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } finally {
    await release();
  }
}

/*async function saveLocalModpack(modpackId, manifest) {
  try {
    const manifestPath = getModpackManifestPath(modpackId);
    await ensureDir(path.dirname(manifestPath));
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  } catch (error) {
    logger.error('Error saving local modpack:', error);
    throw error;
  }
}*/

async function saveLocalModpack(modpackId, manifest) {
  const filePath = path.join(app.getPath("userData"), 'modpack', modpackId, 'truenomodpack.json');

  await ensureDir(path.dirname(filePath));
  await ensureFile(filePath);

  const release = await lockfile.lock(filePath, { retries: 5 });
  try {
    await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));
  } finally {
    await release();
  }
}

async function saveLocalVersion(modpackId, data) {
  const filePath = path.join(getModpackDataPath(modpackId), 'truenomodpack_version.json');

  await ensureDir(path.dirname(filePath));
  await ensureFile(filePath);

  const release = await lockfile.lock(filePath, { retries: 5 });
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } finally {
    await release();
  }
}


async function calculateSyncOperations(modpackId, remoteModpack) {
  const remote = remoteModpack ? remoteModpack : await getRemoteModpack(modpackId);
  const local = await existsModpackJsonFile(modpackId) ? await getLocalModpack(modpackId) : null;
  const installPath = getModpackDataPath(modpackId);

  const operations = {
    download: [],
    delete: [],
    totalSize: 0
  };

  // Comparar archivos remotos con locales
  for (const [filePath, remoteFile] of Object.entries(remote.files || {})) {
    // Ignorar archivos marcados como eliminados
    if (remoteFile.removed_in_version) continue;

    const localFile = local?.files?.[filePath];
    const fullPath = path.join(installPath, filePath);

    if (!localFile) {
      // Archivo nuevo
      operations.download.push({
        path: filePath,
        url: remoteFile.url,
        hash: remoteFile.hash,
        size: Number(remoteFile.size),
        reason: 'new'
      });
      operations.totalSize += remoteFile.size;
    } else if (localFile.hash !== remoteFile.hash && !remoteFile.editable) {
      // Archivo modificado
      operations.download.push({
        path: filePath,
        url: remoteFile.url,
        hash: remoteFile.hash,
        size: Number(remoteFile.size),
        reason: 'modified'
      });
      operations.totalSize += remoteFile.size;
    } else {
      // Verificar integridad del archivo existente
      const actualHash = await calculateFileHash(fullPath);
      if (actualHash !== remoteFile.hash && !remoteFile.editable) {
        operations.download.push({
          path: filePath,
          url: remoteFile.url,
          hash: remoteFile.hash,
          size: Number(remoteFile.size),
          reason: 'corrupted'
        });
        operations.totalSize += remoteFile.size;
      }
    }
  }

  // Detectar archivos a eliminar
  if (local?.files) {
    const remoteFiles = remote.files || {};
    for (const filePath of Object.keys(local.files)) {
      if (!remoteFiles[filePath] || remoteFiles[filePath]?.removed_in_version) {
        operations.delete.push(filePath);
      }
    }
  }

  return { operations, remote, local };
}


async function installOrUpdateModpack(modpackId, onProgress, remoteMp) {
  try {
    onProgress({ stage: 'calculating', progress: 0, message: 'Calculando cambios necesarios...' });

    const remoteModpack = remoteMp ? remoteMp : await getRemoteModpack(modpackId);

    const { operations, remote } = await calculateSyncOperations(modpackId, remoteModpack)

    //const { operations, remote } = await calculateSyncOperations(modpackId);
    const installPath = getModpackDataPath(modpackId);

    // Inicializar estado de instalación
    const installationState = {
      cancelled: false,
      downloadManager: null
    };
    activeInstallations.set(modpackId, installationState);

    const versionId = 'truenomodpack-' + modpackId + "-" + remote.minecraft_version;

    let makeProfile = await configManager.get('userPreferences.createProfile');

    // Check cancel status helper
    const checkCancelled = () => {
      if (installationState.cancelled) throw new Error('Installation cancelled');
    };
    checkCancelled();

    //Instalar archivos de loader (en la .minecraft)
    if (remote.loader_files && Object.keys(remote.loader_files).length > 0) {
      onProgress({
        stage: 'loader', progress: 0,
        message: `Comprobando ${remote.loader.charAt(0).toUpperCase() + remote.loader.slice(1)} loader v${remote.loader_version} ...`
      });
      const loaderInstalled = await loaderInstaller.isLoaderInstalled(versionId)
      if (!loaderInstalled) {
        checkCancelled();
        const installMsg = `Instalando ${remote.loader.charAt(0).toUpperCase() + remote.loader.slice(1)} para Minecraft ${remote.minecraft_version} ...`;
        onProgress({ stage: 'loader', progress: 5, message: installMsg });
        try {
          // Usar AdaptiveDownloadManager para loader
          const loaderDownloadManager = new AdaptiveDownloadManager(55, 15, 8);
          installationState.downloadManager = loaderDownloadManager;

          const loaderResult = await loaderInstaller.installLoader(remote.loader_files, loaderDownloadManager, (loaderProgress) => {
            onProgress({
              stage: 'loader',
              progress: 5 + Math.round((loaderProgress.progress || 0) * 0.15),
              message: installMsg,
              currentFile: loaderProgress.currentFile,
              totalFiles: loaderProgress.totalFiles,
              downloadedSize: loaderProgress.downloadedSize,
              totalSize: loaderProgress.totalSize,
              speedMBps: loaderProgress.speedMBps,
              etaSeconds: loaderProgress.etaSeconds
            });
          });

          installationState.downloadManager = null; // Limpiar ref
          checkCancelled();

          if (loaderResult.success) logger.info("Loader instalado correctamente"); makeProfile = true;
        } catch (loaderError) {
          if (loaderError.message === 'Download cancelled' || installationState.cancelled) throw new Error('Installation cancelled');
          logger.error('Error instalando loader:', loaderError)
          showToast('error', 'Error durante la instalación', 'Ha ocurrido un error inesperado durante la instalación del loader. Por favor, prueba de nuevo más tarde.');
          throw loaderError;
        }
      }
    }

    checkCancelled();
    const totalFiles = operations.download.length + operations.delete.length;
    let processedFiles = 0;

    // Eliminar archivos obsoletos
    onProgress({ stage: 'deleting', progress: 20, message: 'Eliminando archivos obsoletos...' });
    for (const filePath of operations.delete) {
      checkCancelled();
      const fullPath = path.join(installPath, filePath);
      try {
        await fs.unlink(fullPath);
        logger.info(`Deleted: ${filePath}`);
      } catch (error) {
        logger.error(`Error deleting ${filePath}:`, error);
      }
      processedFiles++;
      const progress = Math.round((processedFiles / totalFiles) * 100);
      onProgress({
        stage: 'deleting',
        progress: 20 + Math.round((progress || 0) * 0.5),
        message: `Eliminando archivos obsoletos... `,
        currentFile: processedFiles,
        totalFiles: operations.delete.length
      });
    }

    checkCancelled();
    // Descargar archivos nuevos/modificados (con sistema paralelo)
    let downloadedSize = 0;
    const downloadManager = new AdaptiveDownloadManager(60, 20, 10, 3);
    installationState.downloadManager = downloadManager;

    // Preparar lista de descargas
    const downloadList = operations.download.map(file => ({
      url: file.url,
      destPath: path.join(installPath, file.path),
      hash: file.hash,
      size: Number(file.size),
      path: file.path
    }));

    onProgress({
      stage: 'downloading',
      progress: 25,
      message: 'Iniciando descargas...',
      currentFile: 0,
      totalFiles: downloadList.length
    });

    const hashLimit = pLimit(4);
    const hashPromises = [];

    await downloadManager.downloadFiles(
      downloadList,
      async (index, file, error) => {
        if (installationState.cancelled) return;

        if (error) {
          if (installationState.cancelled) return;
          if (error.message === 'Download cancelled') return;
          logger.error(`Error downloading ${file.path}:`, error);
          return;
        }

        const fileSnapshot = {
          path: file.path,
          destPath: file.destPath,
          expectedHash: file.hash
        };

        const hashPromise = hashLimit(async () => {
          if (installationState.cancelled) return;
          try {
            const actualHash = await calculateFileHash(fileSnapshot.destPath);
            if (actualHash !== fileSnapshot.expectedHash) {
              if (installationState.cancelled) return;
              throw new Error(
                `Hash mismatch for ${fileSnapshot.path}. Expected: ${fileSnapshot.expectedHash}, Got: ${actualHash}`
              );
            }
          } catch (e) {
            if (installationState.cancelled) return;
            throw e;
          }
        });
        hashPromises.push(hashPromise);

        downloadedSize += file.size;
        processedFiles++;

        onProgress({
          stage: 'downloading',
          lastDownloadedFile: file.path
        });
      },
      async (index, file, stats) => {
        onProgress({
          stage: "downloading",
          progress: 25 + Math.round(parseFloat(stats.progressPercent) * 0.7),
          message: `Descargando archivos del modpack...`,
          currentFile: stats.filesCompleted,
          totalFiles: stats.filesTotal,
          downloadedSize: stats.totalDownloaded,
          totalSize: stats.totalBytes,
          speedMBps: stats.speedBps / 1024 / 1024,
          etaSeconds: stats.etaSeconds
        });
      }
    );

    installationState.downloadManager = null;
    checkCancelled();

    onProgress({ stage: 'verifying', progress: 95, message: 'Verificando integridad...' });

    // Check hashes
    await Promise.all(hashPromises);


    // Guardar manifiesto local
    onProgress({ stage: 'finalizing', progress: 99, message: 'Aplicando cambios...' });

    const cfgCopyOptions = await configManager.get('userPreferences.copyOptions');
    if (cfgCopyOptions) {
      await minecraftOptions.copyOptions(installPath);
    }

    const actualLocalManifest = await existsModpackJsonFile(modpackId) ? await getLocalModpack(modpackId) : null;

    const totalFilesSize = Object.values(remoteModpack.files).reduce((acc, file) => acc + (file.size || 0), 0);
    const nowDate = new Date().toISOString();
    const localManifest = {
      id: remote.id,
      name: remote.name,
      description: remote.description,
      version: {
        version: remote.version,
        string: remote.versions[remote.version + ""].string
      },
      installed_at: actualLocalManifest == null ? nowDate : actualLocalManifest.installed_at,
      updated_at: nowDate,
      minecraft_version: remote.minecraft_version,
      loader: remote.loader,
      loader_version: remote.loader_version,
      synced_at: nowDate,
      files_size: totalFilesSize,
      files: {}
    };

    for (const [filePath, fileData] of Object.entries(remote.files)) {
      if (!fileData.removed_in_version) {
        localManifest.files[filePath] = {
          hash: fileData.hash
        };
      }
    }

    //Aplicar cambios al manifest json
    await saveLocalModpack(modpackId, localManifest);

    await saveLocalVersion(modpackId, {
      modpack_id: remote.id,
      modpack_name: remote.name,
      installed_version: remote.version,
      installed_version_string: remote.versions[remote.version + ""].string,
      installed_version_description: remote.versions[remote.version + ""].description,
      updated_at: nowDate
    });

    //Añadir perfil al profiles_json de la .minecraft
    if (makeProfile) await minecraftProfile.createOrUpdateProfile(modpackId, remote.name, versionId, installPath)

    onProgress({ stage: 'complete', progress: 100, message: 'Instalación completada!' });

    return {
      success: true,
      manifest: localManifest,
      operations
    };

  } catch (error) {
    if (error.message === 'Installation cancelled' || error.message === 'Download cancelled') {
      logger.warn('Instalación cancelada por el usuario');
      // No mostrar toast de error, solo retornar info
      return { success: false, cancelled: true };
    }
    logger.error('Error durante la instalación:', error);
    showToast('error', 'Error durante la instalación', 'Ha ocurrido un error inesperado durante la instalación del modpack. Por favor, prueba de nuevo más tarde.');
    throw error;
  } finally {
    activeInstallations.delete(modpackId);
  }
}

/**
 * Verify real local files and sync it with local manifest
 */
async function verifyAndSyncLocal(modpackId) {
  const local = await existsModpackJsonFile(modpackId) ? await getLocalModpack(modpackId) : null;
  const installPath = getModpackDataPath(modpackId);
  if (!local) return { valid: false, error: 'El modpack no está instalado' };

  const realFiles = {};

  if (Object.entries(local.files).length > 0) {
    let missing = 0, corrupted = 0
    for (const [filePath, fileData] of Object.entries(local.files)) {
      const fullPath = path.join(installPath, filePath);
      const exists = await fileExists(fullPath);

      if (!exists) {
        missing += 1
        continue;
      }
      //Si es un archivo editable saltar hash check.
      /**TODO: Que coja si es editable o no del remote */
      const ext = path.extname(fullPath);
      if (ext.endsWith('json') || ext.endsWith('txt') || ext.endsWith('cfg')) {
        realFiles[filePath] = { hash: fileData.hash };
        continue;
      };

      const actualHash = await calculateFileHash(fullPath);
      if (actualHash !== fileData.hash) {
        corrupted += 1
      }

      realFiles[filePath] = { hash: actualHash };
    }

    local.files = realFiles;
    local.synced_at = new Date().toISOString()

    saveLocalModpack(modpackId, local)

    const valid = missing === 0 && corrupted === 0;
    if (valid) showToast('success', 'Verificación correcta', 'Se han verificado todos los archivos del modpack correctamente');
    return {
      valid: valid,
      error: 'Se han detectado archivos faltantes y/o corruptos',
      missing: missing,
      corrupted: corrupted
    };
  } else return { valid: false, error: 'El modpack no está instalado' };

}


ipcMain.handle('is-modpack-installed', (event, modpackid) => {
  return existsModpackJsonFile(modpackid)
});

ipcMain.handle('get-modpack-local', async (event, modpackid) => {
  return await getLocalModpack(modpackid);
});

ipcMain.handle('get-modpack-remote', async (event, modpackid) => {
  return await getRemoteModpack(modpackid)
});

ipcMain.handle('calculate-sync-operations', async (event, modpackId) => {
  const { operations, remote, local } = await calculateSyncOperations(modpackId);
  return {
    operations,
    remoteVersion: remote.version,
    localVersion: local?.version?.version || 0
  };
});

ipcMain.handle('install-or-update-modpack', async (event, modpackId) => {
  const reply = await installOrUpdateModpack(modpackId, (progressData) => {
    mainWindow.webContents.send('on-progress', progressData);
  });
  if (reply.success) showToast('success', 'Instalación correcta', 'Se ha instalado el modpack correctamente');
  else if (reply.cancelled) {
    // Optional: show info check
    showToast('info', 'Cancelado', 'Instalación cancelada');
  }
  return reply;
});

ipcMain.handle('cancel-install-or-update', async (event, modpackId) => {
  const state = activeInstallations.get(modpackId);
  if (state) {
    state.cancelled = true;
    if (state.downloadManager) {
      state.downloadManager.cancel();
      logger.info(`Cancellation initiated for ${modpackId}`);
    }
    return true;
  }
  return false;
});

ipcMain.handle('verify-modpack-integrity', async (event, modpackId) => {
  return await verifyAndSyncLocal(modpackId)
});


ipcMain.handle('get-minecraft-launchers', async () => {
  return await getMinecraftLaunchers();
});

ipcMain.handle('open-minecraft-launcher', async (event, launcher) => {
  const reply = await openMinecraftLauncher(launcher);
  if (!reply) showToast('error', 'Error al abrir el launcher', 'No se ha podido abrir el launcher. Comprueba que esté instalado correctamente');
  else showToast('info', 'Ejecutando launcher', 'Se esta ejecutando el launcher seleccionado...');
  return reply;
});

ipcMain.handle('open-modpack-path', async (event, modpackId) => {
  return await shell.openPath(getModpackDataPath(modpackId));
});

// Toast system
ipcMain.on('show-toast', (event, toastData) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('show-toast', toastData);
  }
});

/**
 * Función global para mostrar toasts desde el main process
 * @param {string} type - Tipo: info, success, warning, error
 * @param {string} title - Titulo del toast
 * @param {string} message - Mensaje a mostrar
 * @param {number} duration - Duración en ms (opcional)
 */
function showToast(type = 'info', title, message, duration) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('show-toast', { type, title, message, duration });
  }
}

const os = require('os');
ipcMain.handle('get-ram-info', async () => {
  const total = os.totalmem();
  const free = os.freemem();

  return {
    totalGB: (total / 1024 / 1024 / 1024).toFixed(1),
    totalGBRounded: Math.round(total / 1024 / 1024 / 1024),
    threeQuartersTotalGB: Math.round((total / 1024 / 1024 / 1024) * 0.75),
    freeGB: (free / 1024 / 1024 / 1024).toFixed(1)
  };
});