const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const axios = require('axios');
const dns = require("dns");
const lockfile = require('proper-lockfile');

const { calculateFileHash, ensureDir, fileExists, ensureFile } = require('./utils/file-utils.js')
const loaderInstaller = require('./minecraft/loader-installer.js');
const minecraftProfile = require('./minecraft/minecraft-profile.js')
const { openMinecraftLauncher, getMinecraftLaunchers } = require('./minecraft/launcher.js');

function checkInternet() {
  return new Promise((resolve) => {
    dns.lookup("google.com", (err) => {
      resolve(!err);
    });
  });
}

process.on('uncaughtException', (err) => {
  console.error(err);
});

//import started from "electron-squirrel-startup";
const started = require('electron-squirrel-startup');

if (started) {
  app.quit();
}

let mainWindow;
let online = false;

const createWindow = async () => {
  online = await checkInternet();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1100,
    minWidth: 1100,
    maxWidth: 1300,
    height: 900,
    minHeight: 900,
    maxHeight: 950,
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


/*async function calculateFileHash(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return 'sha256:' + hashSum.digest('hex');
  } catch (error) {
    console.error('Error calculating hash:', error);
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
    console.error('Error creating directory:', error);
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

const getRemoteModpackList = async () => {
  try {
    const response = await axios.get("https://eltrueno.github.io/truenomodpack/modpacks.json");
    return response.data;
  } catch (error) {
    console.error('Error getting modpack list:', error);
    throw error;
  }
}

const getRemoteModpack = async (modpackid) => {
  try {
    const response = await axios.get("https://eltrueno.github.io/truenomodpack/" + modpackid + "/truenomodpack.json");
    return response.data;
  } catch (error) {
    console.error('Error getting remote modpack:', error);
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
    console.error('Error saving local modpack:', error);
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
        size: remoteFile.size,
        reason: 'new'
      });
      operations.totalSize += remoteFile.size;
    } else if (localFile.hash !== remoteFile.hash && !remoteFile.editable) {
      // Archivo modificado
      operations.download.push({
        path: filePath,
        url: remoteFile.url,
        hash: remoteFile.hash,
        size: remoteFile.size,
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
          size: remoteFile.size,
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

async function downloadFile(url, destPath, onProgress) {
  await ensureDir(path.dirname(destPath));
  const writer = fsSync.createWriteStream(destPath);

  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream',
  });

  const totalLength = parseInt(response.headers['content-length'], 10);
  let downloadedLength = 0;

  response.data.on('data', (chunk) => {
    downloadedLength += chunk.length;
    if (onProgress && totalLength) {
      const progress = Math.round((downloadedLength / totalLength) * 100);
      onProgress(progress, downloadedLength, totalLength);
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function installOrUpdateModpack(modpackId, onProgress, remoteMp) {
  try {
    onProgress({ stage: 'calculating', progress: 0, message: 'Calculando cambios necesarios...' });

    const remoteModpack = remoteMp ? remoteMp : await getRemoteModpack(modpackId);

    const { operations, remote } = await calculateSyncOperations(modpackId, remoteModpack)

    //const { operations, remote } = await calculateSyncOperations(modpackId);
    const installPath = getModpackDataPath(modpackId);

    const versionId = 'truenomodpack-' + modpackId + "-" + remote.minecraft_version;

    let makeProfile = false;

    //Instalar archivos de loader (en la .minecraft)
    if (remote.loader_files && Object.keys(remote.loader_files).length > 0) {
      onProgress({
        stage: 'loader', progress: 0,
        message: `Comprobando ${remote.loader.charAt(0).toUpperCase() + remote.loader.slice(1)} loader v${remote.loader_version} ...`
      });
      const loaderInstalled = await loaderInstaller.isLoaderInstalled(versionId)
      if (!loaderInstalled) {
        const installMsg = `Instalando ${remote.loader.charAt(0).toUpperCase() + remote.loader.slice(1)} para Minecraft ${remote.minecraft_version} ...`;
        onProgress({ stage: 'loader', progress: 5, message: installMsg });
        try {
          const loaderResult = await loaderInstaller.installLoader(remote.loader_files, (loaderProgress) => {
            onProgress({
              stage: 'loader',
              progress: 5 + Math.round((loaderProgress.progress || 0) * 0.15),
              message: installMsg,
              currentFile: loaderProgress.currentFile,
              totalFiles: loaderProgress.totalFiles
            });
          });
          if (loaderResult.success) console.log("Loader instalado correctamente"); makeProfile = true;
        } catch (loaderError) {
          console.error('Error instalando loader:', loaderError)
          showToast('error', 'Error durante la instalación', 'Ha ocurrido un error inesperado durante la instalación del loader. Por favor, prueba de nuevo más tarde.');
        }
      }
    }

    const totalFiles = operations.download.length + operations.delete.length;
    let processedFiles = 0;

    // Eliminar archivos obsoletos
    onProgress({ stage: 'deleting', progress: 20, message: 'Eliminando archivos obsoletos...' });
    for (const filePath of operations.delete) {
      const fullPath = path.join(installPath, filePath);
      try {
        await fs.unlink(fullPath);
        console.log(`Deleted: ${filePath}`);
      } catch (error) {
        console.error(`Error deleting ${filePath}:`, error);
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

    // Descargar archivos nuevos/modificados
    let downloadedSize = 0;
    for (let i = 0; i < operations.download.length; i++) {
      const file = operations.download[i];
      const fullPath = path.join(installPath, file.path);

      const baseProgress = 25 + Math.round((i / operations.download.length) * 70); // 30–90

      onProgress({
        stage: 'downloading',
        progress: baseProgress,
        message: `Descargando ${file.path}...`,
        currentFile: i + 1,
        totalFiles: operations.download.length
      });

      await downloadFile(file.url, fullPath, (fileProgress, downloaded, total) => {
        onProgress({
          stage: 'downloading',
          progress: baseProgress,
          message: `Descargando ${file.path}...`,
          currentFile: i + 1,
          totalFiles: operations.download.length,
          fileProgress,
          downloadedSize: downloadedSize + downloaded,
          totalSize: operations.totalSize
        });
      });

      // Verificar hash del archivo descargado
      const actualHash = await calculateFileHash(fullPath);
      if (actualHash !== file.hash) {
        throw new Error(`Hash mismatch for ${file.path}. Expected: ${file.hash}, Got: ${actualHash}`);
      }

      downloadedSize += file.size;
      processedFiles++;
    }

    // Guardar manifiesto local
    onProgress({ stage: 'finalizing', progress: 95, message: 'Aplicando cambios...' });

    const actualLocalManifest = await existsModpackJsonFile(modpackId) ? await getLocalModpack(modpackId) : null;



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

    //Añadir perfil al profiles_json de la .minecraft
    if (makeProfile) await minecraftProfile.createOrUpdateProfile(modpackId, remote.name, versionId, installPath)

    onProgress({ stage: 'complete', progress: 100, message: 'Instalación completada!' });

    return {
      success: true,
      manifest: localManifest,
      operations
    };

  } catch (error) {
    console.error('Error durante la instalación:', error);
    showToast('error', 'Error durante la instalación', 'Ha ocurrido un error inesperado durante la instalación del modpack. Por favor, prueba de nuevo más tarde.');
    throw error;
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
    mainWindow.webContents.send('installation-progress', progressData);
  });
  if (reply.success) showToast('success', 'Instalación correcta', 'Se ha instalado el modpack correctamente');
  return reply;
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