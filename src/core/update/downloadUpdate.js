const { ChunkedDownloadManager } = require('../download/managers/ChunkedDownloadManager');

const CONNECTIONS = 12;
const CHUNK_SIZE = 1024 * 1024 * 6;

/**
 * Descarga un instalador o paquete de actualización por trozos en paralelo.
 * @param {string} url
 * @param {string} destPath
 * @param {(progress: object) => void} [onProgress] - Progreso listo para la interfaz
 */
async function downloadUpdateFile(url, destPath, onProgress) {
  const manager = new ChunkedDownloadManager(CONNECTIONS, CHUNK_SIZE);

  const result = await manager.downloadFiles([{ url, destPath }], null, (_index, _file, progress) => {
    if (!onProgress) return;
    onProgress({
      percent: Math.round(progress.progressPercent),
      speed: Math.round(progress.speedBps / 1024),
      downloaded: Math.round(progress.totalDownloaded / 1024 / 1024),
      totalMB: Math.round(progress.totalBytes / 1024 / 1024),
      total: progress.totalBytes,
      transferred: progress.totalDownloaded
    });
  });

  if (result.completed <= 0) {
    throw new Error('La descarga fallo o fue cancelada');
  }

  return destPath;
}

module.exports = { downloadUpdateFile };
