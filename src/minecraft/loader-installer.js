// loader-installer.js - Instalador simple de loaders
const fs = require('fs').promises;
const path = require('path');

const logger = require('../utils/logger.js')

const { fileExists } = require('../utils/file-utils.js')
const { getMinecraftPath } = require('./common.js')

/**
 * Verifica si un loader está instalado
 */
async function isLoaderInstalled(versionId) {
  const minecraftPath = getMinecraftPath();
  const versionJsonPath = path.join(minecraftPath, 'versions', versionId, `${versionId}.json`);

  return await fileExists(versionJsonPath)
}

/**
 * Instala el loader copiando todos los archivos desde tu servidor
 * @param {Object} loaderFiles - Mapa de archivos a descargar
 * @param {import('../download/downloadManager').AdaptiveDownloadManager} downloadManager - Manager de descargas
 * @param {Function} onProgress - Callback de progreso
 */
async function installLoader(loaderFiles, downloadManager, onProgress) {
  try {
    const minecraftPath = getMinecraftPath();

    if (!loaderFiles || Object.keys(loaderFiles).length === 0) {
      return { success: true, alreadyInstalled: true };
    }

    if (onProgress) {
      onProgress({ stage: 'checking', message: 'Preparando instalación del loader...', progress: 0 });
    }

    // Filtrar archivos que necesitan descarga
    const filesToDownload = [];
    const totalFiles = Object.keys(loaderFiles).length;
    let checkedCount = 0;

    for (const [filePath, fileData] of Object.entries(loaderFiles)) {
      const destPath = path.join(minecraftPath, filePath);

      try {
        const stats = await fs.stat(destPath);
        if (stats.size === fileData.size) {
          // Ya existe y tamaño correcto
          continue;
        }
      } catch (err) {
        // No existe, descargar
      }

      filesToDownload.push({
        url: fileData.url,
        destPath: destPath,
        size: fileData.size,
        hash: fileData.hash,
        path: filePath // Para logs/errores
      });

      checkedCount++;
    }

    if (filesToDownload.length === 0) {
      logger.info(`${totalFiles} archivos del loader ya están instalados`);
      return { success: true, alreadyInstalled: true };
    }

    if (onProgress) {
      onProgress({ stage: 'downloading', message: 'Descargando archivos del loader...', progress: 10 });
    }

    // Usar downloadManager para descargar
    await downloadManager.downloadFiles(
      filesToDownload,
      // On File Complete
      (index, file, error) => {
        if (error) return;
      },
      // On Progress (Global stats from manager)
      (index, file, stats) => {
        if (onProgress) {
          // Calculamos un progreso relativo para esta etapa (10% a 90%)
          const downloadPercent = (downloadManager.stats.completed / filesToDownload.length);
          const progress = 10 + Math.round(downloadPercent * 80);

          onProgress({
            stage: 'downloading',
            message: `Descargando archivos del loader... (${downloadManager.stats.completed}/${filesToDownload.length})`,
            currentFile: downloadManager.stats.completed,
            totalFiles: filesToDownload.length,
            progress: progress,
            downloadedSize: stats.totalDownloaded,
            totalSize: stats.totalBytes,
            speedMBps: stats.speedBps / 1024 / 1024,
            etaSeconds: stats.etaSeconds
          });
        }
      }
    );

    if (downloadManager.cancelled) throw new Error('Download cancelled');

    // Verificar hashes si es necesario (opcional, ya el downloadManager maneja errores de red)
    // Por simplicidad confiamos en el downloadManager y si acaso implementaremos verificación después si falla mucho

    logger.info(`${filesToDownload.length} archivos del loader instalados`);

    if (onProgress) {
      onProgress({ stage: 'complete', message: 'Loader instalado correctamente!', progress: 100 });
    }

    return {
      success: true,
      alreadyInstalled: false
    };

  } catch (error) {
    if (error.message === 'Download cancelled') {
      throw error;
    }
    logger.error('Error instalando loader:', error);
    throw error;
  }
}

module.exports = {
  installLoader,
  isLoaderInstalled,
  getMinecraftPath
};