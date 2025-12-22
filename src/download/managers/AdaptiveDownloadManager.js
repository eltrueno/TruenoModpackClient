const axios = require('axios');
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const pLimit = require('p-limit');
const { httpsAgent, httpAgent } = require('../../utils/httpAgents');
const logger = require('../../utils/logger');
const { DownloadManager } = require('./DownloadManager');
const { getOptimalConcurrency } = require('../utils/concurrencyConfig');
const { ensureDir, safeUnlink } = require('../utils/fileOperations');

const axiosInstance = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 60000,
    maxRedirects: 5,
});

/**
 * Manager adaptativo con COLAS SEPARADAS para red e I/O
 * Mejor manejo de concurrencia y errores
 */
class AdaptiveDownloadManager extends DownloadManager {
    constructor(networkConcurrency = null, ioConcurrency = null, minConcurrency = null, maxFileRetries = 5) {
        const config = getOptimalConcurrency();

        // Usar configuración óptima según plataforma si no se especifica
        const netConc = networkConcurrency || config.network;
        const ioConc = ioConcurrency || config.io;
        const minConc = minConcurrency || config.min;

        super(netConc);

        // DOS LIMITADORES SEPARADOS
        this.networkLimit = pLimit(netConc);  // Para HTTP requests
        this.ioLimit = pLimit(ioConc);        // Para escritura de archivos

        this.initialNetworkConcurrency = netConc;
        this.initialIoConcurrency = ioConc;
        this.minConcurrency = minConc;
        this.maxFileRetries = maxFileRetries;

        this.completedBytes = 0;
        this.totalBytes = 0;
        this.consecutiveErrors = 0;
        this.permissionErrors = 0;
        this.lastConcurrencyChange = 0;

        // Umbral para decidir si descargar a memoria (5MB)
        this.memoryDownloadThreshold = 5 * 1024 * 1024;

        // Tracking de progreso mejorado
        this.progressSnapshots = []; // Array de {timestamp, bytes}
        this.snapshotInterval = 1000; // Tomar snapshot cada 1 segundo
        this.lastSnapshotTime = 0;
        this.maxSnapshots = 10; // Mantener últimos 10 segundos para moving average

        logger.info(`AdaptiveDownloadManager initialized - Network: ${netConc}, I/O: ${ioConc}, Min: ${minConc} (platform: ${process.platform})`);
    }

    async downloadFiles(filesList, onFileComplete, onFileProgress) {
        this.stats.total = filesList.length;
        this.stats.completed = 0;
        this.stats.failed = 0;
        this.stats.startTime = Date.now();

        if (this.controller.signal.aborted) {
            this.controller = new AbortController();
        }

        this.lastLoggedPercent = 0;
        this.consecutiveErrors = 0;
        this.permissionErrors = 0;
        this.lastConcurrencyChange = 0;

        // Calcular tamaño total
        this.totalBytes = filesList.reduce((acc, f) => acc + (f.size || 0), 0);
        this.completedBytes = 0;

        // Reset progress tracking
        this.progressSnapshots = [];
        this.lastSnapshotTime = Date.now();

        // Ordenar por tamaño (grandes primero para optimizar tiempo)
        const sortedFiles = [...filesList].sort((a, b) => (b.size || 0) - (a.size || 0));

        logger.info(`Starting download of ${filesList.length} files (${(this.totalBytes / 1024 / 1024).toFixed(2)}MB) with adaptive concurrency`);

        logger.debug(`Files list: ${sortedFiles}`);

        // Pre-crear todos los directorios necesarios
        const directories = new Set();
        for (const file of sortedFiles) {
            directories.add(path.dirname(file.destPath));
        }

        logger.info(`Pre-creating ${directories.size} directories...`);
        for (const dir of directories) {
            await ensureDir(dir);
        }

        // Pausa para que el sistema de archivos se sincronice
        await new Promise(resolve => setTimeout(resolve, 300));

        // Cola de archivos fallidos para reintento final
        const failedFiles = [];

        // Dividir en lotes
        const batchSize = 500;
        let currentNetworkConcurrency = this.initialNetworkConcurrency;
        let currentIoConcurrency = this.initialIoConcurrency;

        for (let i = 0; i < sortedFiles.length; i += batchSize) {
            // Salir inmediatamente si se canceló
            if (this.controller.signal.aborted || this.isCancelling) {
                logger.warn('Download cancelled, exiting batch loop');
                break;
            }

            const batch = sortedFiles.slice(i, i + batchSize);
            const remainingPercent = ((sortedFiles.length - i) / sortedFiles.length) * 100;

            // Reducir concurrencia si hay muchos errores de permisos
            if (this.permissionErrors > 5) {
                const newNetConc = Math.max(this.minConcurrency, Math.floor(currentNetworkConcurrency * 0.6));
                const newIoConc = Math.max(Math.floor(this.minConcurrency * 0.6), Math.floor(currentIoConcurrency * 0.5));

                if (newNetConc !== currentNetworkConcurrency || newIoConc !== currentIoConcurrency) {
                    currentNetworkConcurrency = newNetConc;
                    currentIoConcurrency = newIoConc;
                    logger.warn(`Permission errors detected (${this.permissionErrors}), reducing concurrency - Network: ${currentNetworkConcurrency}, I/O: ${currentIoConcurrency}`);
                    this.networkLimit = pLimit(currentNetworkConcurrency);
                    this.ioLimit = pLimit(currentIoConcurrency);
                    this.permissionErrors = 0;
                    this.lastConcurrencyChange = Date.now();
                }
            }

            // Reducir si hay muchos errores consecutivos
            const shouldReduce = (this.consecutiveErrors > 10) &&
                currentNetworkConcurrency > this.minConcurrency;

            const timeSinceLastChange = Date.now() - this.lastConcurrencyChange;

            if (shouldReduce && timeSinceLastChange > 5000) {
                const newNetConc = Math.max(this.minConcurrency, Math.floor(this.initialNetworkConcurrency * 0.5));
                const newIoConc = Math.max(Math.floor(this.minConcurrency * 0.6), Math.floor(this.initialIoConcurrency * 0.5));

                if (newNetConc !== currentNetworkConcurrency || newIoConc !== currentIoConcurrency) {
                    currentNetworkConcurrency = newNetConc;
                    currentIoConcurrency = newIoConc;
                    logger.info(`Reducing concurrency - Network: ${currentNetworkConcurrency}, I/O: ${currentIoConcurrency} (remaining: ${remainingPercent.toFixed(0)}%, errors: ${this.consecutiveErrors})`);
                    this.networkLimit = pLimit(currentNetworkConcurrency);
                    this.ioLimit = pLimit(currentIoConcurrency);
                    this.lastConcurrencyChange = Date.now();
                }
            }

            // Descargar lote
            const downloads = batch.map((file, batchIndex) =>
                this.downloadWithSeparatedQueues(file, i + batchIndex, onFileComplete, onFileProgress)
                    .catch(error => {
                        if (error.message !== 'Download cancelled') {
                            failedFiles.push({ ...file, originalIndex: i + batchIndex });
                        }
                        return { success: false, error };
                    })
            );

            // Usar race para salir inmediatamente si se cancela
            const cancelWatcher = new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (this.isCancelling || this.controller.signal.aborted) {
                        clearInterval(interval);
                        resolve('cancelled');
                    }
                }, 20); // Check cada 20ms (más reactivo)

                Promise.allSettled(downloads).then(() => {
                    clearInterval(interval);
                    resolve('completed');
                });
            });

            const result = await cancelWatcher;
            if (result === 'cancelled') {
                logger.warn('Batch cancelled mid-execution, exiting immediately');
                break;
            }

            // Pausa si hay muchos errores consecutivos
            if (this.consecutiveErrors > 8 && !this.controller.signal.aborted && !this.isCancelling) {
                logger.warn(`High error rate detected (${this.consecutiveErrors}), pausing for 5 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                this.consecutiveErrors = 0;
            }
        }

        // Reintentar archivos fallidos con concurrencia muy baja
        if (failedFiles.length > 0 && !this.controller.signal.aborted && !this.isCancelling) {
            logger.warn(`Retrying ${failedFiles.length} failed files with minimal concurrency...`);
            this.networkLimit = pLimit(5);
            this.ioLimit = pLimit(3);

            const retryDownloads = failedFiles.map(file =>
                this.downloadWithRetries(file, file.originalIndex, onFileComplete, onFileProgress, 3)
                    .catch(() => ({ success: false }))
            );

            await Promise.allSettled(retryDownloads);
        }

        const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);
        const avgSpeed = (this.completedBytes / parseFloat(duration) / 1024 / 1024).toFixed(2);
        logger.info(`Download completed in ${duration}s (${avgSpeed} MB/s avg) - Success: ${this.stats.completed}, Failed: ${this.stats.failed}`);

        return {
            total: this.stats.total,
            completed: this.stats.completed,
            failed: this.stats.failed,
            cancelled: this.controller.signal.aborted,
            duration: parseFloat(duration)
        };
    }

    /**
     * Descarga con COLAS SEPARADAS para red e I/O
     */
    async downloadWithSeparatedQueues(file, index, onFileComplete, onFileProgress) {
        if (this.controller.signal.aborted || this.isCancelling) {
            // Retorno inmediato silencioso o throw para limpiar cola rápido
            throw new Error('Download cancelled');
        }

        const fileSize = file.size || 0;
        const useMemoryDownload = fileSize > 0 && fileSize < this.memoryDownloadThreshold;

        try {
            logger.info("Downloading file: " + file.path + " (" + fileSize + " bytes)");
            let bytesWritten = 0;

            if (useMemoryDownload) {
                // ARCHIVOS PEQUEÑOS: Descargar a memoria, luego escribir
                bytesWritten = await this.downloadSmallFile(file, index, onFileProgress);
            } else {
                // ARCHIVOS GRANDES: Streaming pero con I/O limitado
                bytesWritten = await this.downloadLargeFile(file, index, onFileProgress);
            }

            this.stats.completed++;
            this.completedBytes += bytesWritten;

            // Actualizar snapshots de progreso
            this.updateProgressSnapshot();

            // Emitir evento de progreso para asegurar que la UI se actualice
            // incluso con archivos pequeños
            if (onFileProgress) {
                const progressInfo = this.getProgressInfo(0);
                onFileProgress(index, file, {
                    fileProgress: 100,
                    fileDownloaded: fileSize,
                    fileTotal: fileSize,
                    totalDownloaded: this.completedBytes,
                    totalBytes: this.totalBytes,
                    speed: progressInfo.speed,
                    speedBps: progressInfo.speedBps,
                    speedMBps: progressInfo.speedMBps,
                    eta: progressInfo.eta,
                    etaSeconds: progressInfo.etaSeconds,
                    progressPercent: progressInfo.progressPercent
                });
            }

            // Logging de progreso
            // Usar porcentaje de bytes para coincidir con la UI
            const percent = Math.floor((this.stats.completed / this.stats.total) * 100);
            const rounded = Math.floor(percent / 10) * 10;

            if (rounded > this.lastLoggedPercent && rounded % 10 === 0) {
                this.lastLoggedPercent = rounded;
                const progressInfo = this.getProgressInfo(0);
                logger.info(`Progress: ${progressInfo.progressPercent}% (${this.stats.completed}/${this.stats.total}) - ${progressInfo.speed} - ETA: ${progressInfo.eta}`);
            }

            if (onFileComplete) {
                onFileComplete(index, file, null);
            }

            // Resetear errores consecutivos en éxito
            this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);

        } catch (error) {
            const isCancelled = error.message === 'Download cancelled' || this.isCancelling || this.controller.signal.aborted;

            if (!isCancelled) {
                this.stats.failed++;
                this.consecutiveErrors++;

                const isPermError = error.code === 'EPERM' ||
                    error.code === 'EBUSY' ||
                    error.code === 'EACCES';

                if (isPermError) {
                    this.permissionErrors++;
                }

                logger.error(`Download failed for ${file.path}:`, error.message);
            }

            if (onFileComplete) {
                onFileComplete(index, file, error);
            }

            throw error;
        }
    }

    /**
     * Descarga archivo pequeño a memoria primero
     */
    async downloadSmallFile(file, index, onFileProgress) {
        // FASE 1: Descargar (limitado por networkLimit)
        const buffer = await this.networkLimit(async () => {
            if (this.controller.signal.aborted || this.isCancelling) {
                throw new Error('Download cancelled');
            }

            const response = await axiosInstance({
                method: 'get',
                url: file.url,
                responseType: 'arraybuffer',
                signal: this.controller.signal
            });

            return Buffer.from(response.data);
        });

        // FASE 2: Escribir (limitado por ioLimit)
        // FASE 2: Escribir (limitado por ioLimit)
        await this.ioLimit(async () => {
            if (this.controller.signal.aborted || this.isCancelling) {
                throw new Error('Download cancelled');
            }

            const destPath = file.destPath;
            const tempPath = destPath + '.tmp';

            await ensureDir(path.dirname(destPath));
            await safeUnlink(tempPath);

            await fs.writeFile(tempPath, buffer, { flag: 'w' });

            // Esperar para antivirus
            await new Promise(resolve => setTimeout(resolve, 100));

            await safeUnlink(destPath);
            await fs.rename(tempPath, destPath);

            if (!fsSync.existsSync(destPath)) {
                throw new Error('File rename failed');
            }
        });

        return buffer.length;
    }

    /**
     * Descarga archivo grande con streaming
     */
    async downloadLargeFile(file, index, onFileProgress) {
        let downloadedBytes = 0;

        // Descargar con streaming (limitado por networkLimit)
        const response = await this.networkLimit(async () => {
            if (this.controller.signal.aborted || this.isCancelling) {
                throw new Error('Download cancelled');
            }

            return await axiosInstance({
                method: 'get',
                url: file.url,
                responseType: 'stream',
                signal: this.controller.signal
            });
        });

        // Escribir (limitado por ioLimit)
        await this.ioLimit(async () => {
            if (this.controller.signal.aborted) {
                throw new Error('Download cancelled');
            }

            const destPath = file.destPath;
            const tempPath = destPath + '.tmp';

            await ensureDir(path.dirname(destPath));
            await safeUnlink(tempPath);

            const writer = fsSync.createWriteStream(tempPath, { flags: 'w' });

            const totalLength = parseInt(response.headers['content-length'], 10);

            response.data.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (onFileProgress && totalLength) {
                    const progress = Math.round((downloadedBytes / totalLength) * 100);
                    const progressInfo = this.getProgressInfo(downloadedBytes);

                    onFileProgress(index, file, {
                        fileProgress: progress,
                        fileDownloaded: downloadedBytes,
                        fileTotal: totalLength,
                        totalDownloaded: this.completedBytes + downloadedBytes,
                        totalBytes: this.totalBytes,
                        speed: progressInfo.speed,
                        speedBps: progressInfo.speedBps,
                        eta: progressInfo.eta,
                        etaSeconds: progressInfo.etaSeconds,
                        progressPercent: progressInfo.progressPercent
                    });
                }
            });

            response.data.pipe(writer);

            const abortHandler = () => writer.destroy();
            if (this.controller.signal) {
                this.controller.signal.addEventListener('abort', abortHandler, { once: true });
            }

            try {
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    response.data.on('error', reject);
                });
            } finally {
                if (this.controller.signal) {
                    this.controller.signal.removeEventListener('abort', abortHandler);
                }
            }

            if (this.controller.signal.aborted) {
                throw new Error('Download cancelled');
            }

            writer.close();
            await new Promise(resolve => setTimeout(resolve, 200));

            await safeUnlink(destPath);
            await fs.rename(tempPath, destPath);

            if (!fsSync.existsSync(destPath)) {
                throw new Error('File rename failed');
            }
        });

        return downloadedBytes;
    }

    /**
     * Descarga con reintentos a nivel de manager
     */
    async downloadWithRetries(file, index, onFileComplete, onFileProgress, maxRetries = null) {
        if (this.controller.signal.aborted) return { success: false, file };

        const retries = maxRetries !== null ? maxRetries : this.maxFileRetries;

        for (let attempt = 0; attempt < retries; attempt++) {
            if (this.controller.signal.aborted) return { success: false, file };

            try {
                await this.downloadWithSeparatedQueues(file, index, onFileComplete, onFileProgress);
                return { success: true, file };

            } catch (error) {
                if (this.controller.signal.aborted || error.message === 'Download cancelled') {
                    return { success: false, file };
                }

                const isPermError = error.message?.includes('EPERM') ||
                    error.message?.includes('EBUSY') ||
                    error.message?.includes('EACCES') ||
                    error.message?.includes('locked');

                const isLastAttempt = attempt === retries - 1;

                if (isLastAttempt) {
                    logger.error(`File failed after ${retries} manager retries: ${file.path}`);
                    return { success: false, file, error };
                }

                // Backoff más largo para errores de permisos
                const baseWait = isPermError ? 8000 : 3000;
                const waitTime = Math.min(baseWait * Math.pow(1.5, attempt), 30000);

                logger.warn(`Manager retry ${attempt + 1}/${retries} for ${file.path} in ${waitTime}ms (${isPermError ? 'PERM ERROR' : error.code || error.message})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        return { success: false, file };
    }

    /**
     * Actualiza el snapshot de progreso para calcular velocidad promedio
     */
    updateProgressSnapshot() {
        const now = Date.now();

        // Solo tomar snapshot si ha pasado suficiente tiempo
        if (now - this.lastSnapshotTime >= this.snapshotInterval) {
            this.progressSnapshots.push({
                timestamp: now,
                bytes: this.completedBytes
            });

            // Mantener solo los últimos N snapshots
            if (this.progressSnapshots.length > this.maxSnapshots) {
                this.progressSnapshots.shift();
            }

            this.lastSnapshotTime = now;
        }
    }

    /**
     * Calcula la velocidad promedio usando moving average
     * @returns {number} Velocidad en bytes/segundo
     */
    getAverageSpeed() {
        if (this.progressSnapshots.length < 2) {
            // Fallback a velocidad total si no hay suficientes snapshots
            const elapsed = (Date.now() - this.stats.startTime) / 1000;
            return elapsed > 0 ? this.completedBytes / elapsed : 0;
        }

        // Calcular velocidad entre el primer y último snapshot
        const first = this.progressSnapshots[0];
        const last = this.progressSnapshots[this.progressSnapshots.length - 1];

        const timeDiff = (last.timestamp - first.timestamp) / 1000; // en segundos
        const bytesDiff = last.bytes - first.bytes;

        return timeDiff > 0 ? bytesDiff / timeDiff : 0;
    }

    /**
     * Obtiene información detallada de progreso
     * @param {number} currentFileBytes - Bytes descargados del archivo actual (opcional)
     * @returns {Object} Información de progreso con velocidad y ETA
     */
    getProgressInfo(currentFileBytes = 0) {
        const speedBps = this.getAverageSpeed();
        const speedMBps = speedBps / 1024 / 1024;

        // Formatear velocidad
        let speedStr;
        if (speedMBps >= 1) {
            speedStr = `${speedMBps.toFixed(2)} MB/s`;
        } else {
            speedStr = `${(speedBps / 1024).toFixed(2)} KB/s`;
        }

        // Calcular bytes actuales incluyendo archivo en progreso
        const actualCompletedBytes = this.completedBytes + currentFileBytes;

        // Calcular ETA
        const remainingBytes = this.totalBytes - actualCompletedBytes;
        const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

        // Formatear ETA
        let etaStr;
        if (etaSeconds < 60) {
            etaStr = `${Math.ceil(etaSeconds)}s`;
        } else if (etaSeconds < 3600) {
            const minutes = Math.floor(etaSeconds / 60);
            const seconds = Math.ceil(etaSeconds % 60);
            etaStr = `${minutes}m ${seconds}s`;
        } else {
            const hours = Math.floor(etaSeconds / 3600);
            const minutes = Math.floor((etaSeconds % 3600) / 60);
            etaStr = `${hours}h ${minutes}m`;
        }

        // Calcular progreso de bytes
        const progressPercent = this.totalBytes > 0
            ? (actualCompletedBytes / this.totalBytes * 100).toFixed(1)
            : 0;

        return {
            speed: speedStr,
            speedBps,
            speedMBps,
            eta: etaStr,
            etaSeconds,
            completedBytes: actualCompletedBytes,
            totalBytes: this.totalBytes,
            progressPercent,
            filesCompleted: this.stats.completed,
            filesTotal: this.stats.total
        };
    }
}

module.exports = { AdaptiveDownloadManager };
