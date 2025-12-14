const axios = require('axios');
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const pLimit = require('p-limit');
const { httpsAgent, httpAgent } = require('../utils/httpAgents');
const logger = require('../utils/logger');

const axiosInstance = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 60000,
    maxRedirects: 5,
});

// Aumentar el límite de listeners para AbortSignal
const { setMaxListeners } = require('events');
if (typeof setMaxListeners === 'function') {
    // Para Node.js >= 15.4.0
    setMaxListeners(0); // 0 = sin límite
}

async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

/**
 * Intenta eliminar un archivo con reintentos (para manejar locks temporales)
 */
async function safeUnlink(filePath, maxAttempts = 3) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            if (fsSync.existsSync(filePath)) {
                await fs.unlink(filePath);
            }
            return true;
        } catch (error) {
            if (i === maxAttempts - 1) {
                logger.warn(`Could not delete file after ${maxAttempts} attempts: ${path.basename(filePath)}`);
                return false;
            }
            // Esperar antes de reintentar
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
    }
    return false;
}

/**
 * Descarga un archivo individual con reintentos y manejo robusto de errores
 */
async function downloadFile(url, destPath, onProgress, retries = 3, signal = null) {
    const fileName = path.basename(destPath);
    const tempPath = destPath + '.tmp';

    for (let attempt = 0; attempt < retries; attempt++) {
        if (signal?.aborted) throw new Error('Download cancelled');

        let writer = null;

        try {
            // Asegurar que el directorio existe
            await ensureDir(path.dirname(destPath));

            // Limpiar archivos temporales anteriores
            await safeUnlink(tempPath);

            // Si es un reintento, esperar un poco más
            if (attempt > 0) {
                const waitTime = Math.min(2000 * Math.pow(2, attempt), 15000);
                logger.warn(`Retry ${attempt}/${retries} for ${fileName} in ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // Descargar a archivo temporal
            writer = fsSync.createWriteStream(tempPath, { flags: 'w' });

            const response = await axiosInstance({
                method: 'get',
                url: url,
                responseType: 'stream',
                signal: signal
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

            // Manejar la señal de cancelación
            const abortHandler = signal ? () => {
                writer.destroy();
            } : null;

            if (signal && abortHandler) {
                signal.addEventListener('abort', abortHandler, { once: true });
            }

            try {
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    response.data.on('error', reject);
                });
            } finally {
                // Limpiar el listener si existe
                if (signal && abortHandler) {
                    signal.removeEventListener('abort', abortHandler);
                }
            }

            // Verificar si fue cancelado después de completar
            if (signal?.aborted) {
                throw new Error('Download cancelled');
            }

            // Cerrar el stream y esperar un momento
            writer.close();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Si el archivo destino existe, eliminarlo primero
            await safeUnlink(destPath);

            // Renombrar de temporal a definitivo
            await fs.rename(tempPath, destPath);

            // Verificar que el renombrado funcionó
            if (!fsSync.existsSync(destPath)) {
                throw new Error('File rename failed');
            }

            if (attempt > 0) {
                logger.info(`Download succeeded after ${attempt + 1} attempts: ${fileName}`);
            }

            return; // Éxito

        } catch (error) {
            // Cerrar writer si está abierto
            if (writer && !writer.destroyed) {
                try {
                    writer.destroy();
                } catch (e) {
                    // Ignorar errores al destruir
                }
            }

            // Check cancel explicitly
            if (signal?.aborted || axios.isCancel(error) || error.message === 'Download cancelled') {
                await safeUnlink(tempPath);
                throw new Error('Download cancelled');
            }

            // Limpiar archivos temporales y parciales
            await safeUnlink(tempPath);
            await safeUnlink(destPath);

            const isPermError = error.code === 'EPERM' ||
                error.code === 'EBUSY' ||
                error.code === 'EACCES';

            if (attempt === retries - 1) {
                logger.error(`Download failed after ${retries} attempts: ${fileName}`, {
                    url,
                    error: error.message,
                    code: error.code,
                    isPermError
                });
                throw new Error(`Failed to download ${fileName} after ${retries} attempts: ${error.message}`);
            }

            // Espera más larga para errores de permisos
            const baseWait = isPermError ? 5000 : 2000;
            const waitTime = Math.min(baseWait * Math.pow(2, attempt), 20000);

            logger.warn(`Retry ${attempt + 1}/${retries} for ${fileName} in ${waitTime}ms - Error: ${error.code || error.message}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

/**
 * Manager de descargas paralelas básico
 */
class DownloadManager {
    constructor(concurrency = 100) {
        this.limit = pLimit(concurrency);
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            startTime: null,
            completedBytes: 0,
            totalBytes: 0
        };
        this.controller = new AbortController();
        this.lastLoggedPercent = 0;
        logger.info(`DownloadManager initialized with concurrency: ${concurrency}`);
    }

    /**
     * Descarga múltiples archivos en paralelo
     */
    async downloadFiles(filesList, onFileComplete, onFileProgress) {
        this.stats.total = filesList.length;
        this.stats.completed = 0;
        this.stats.failed = 0;
        this.stats.startTime = Date.now();

        if (this.controller.signal.aborted) {
            this.controller = new AbortController();
        }

        this.paused = false;
        this.lastLoggedPercent = 0;

        logger.info(`Starting download of ${filesList.length} files`);

        const downloads = filesList.map((file, index) =>
            this.limit(() => {
                if (this.controller.signal.aborted) {
                    return Promise.reject(new Error('Download cancelled'));
                }
                return this.downloadWithTracking(file, index, onFileComplete, onFileProgress);
            })
        );

        const results = await Promise.allSettled(downloads);

        const duration = this.stats.startTime
            ? ((Date.now() - this.stats.startTime) / 1000).toFixed(2)
            : '0';
        logger.info(`Download completed in ${duration}s - Success: ${this.stats.completed}, Failed: ${this.stats.failed}`);

        const failed = results.filter(r => r.status === 'rejected');

        if (failed.length > 0 && !this.controller.signal.aborted) {
            logger.error(`${failed.length} files failed to download`);
        }

        return {
            total: this.stats.total,
            completed: this.stats.completed,
            failed: this.stats.failed,
            cancelled: this.controller.signal.aborted,
            paused: this.paused,
            duration: parseFloat(duration)
        };
    }

    async downloadWithTracking(file, index, onFileComplete, onFileProgress) {
        try {
            await downloadFile(
                file.url,
                file.destPath,
                (progress, downloaded, total) => {
                    if (onFileProgress) {
                        onFileProgress(index, file, progress, downloaded, total);
                    }
                },
                3,
                this.controller.signal
            );

            this.stats.completed++;

            const percent = Math.floor((this.stats.completed / this.stats.total) * 100);
            const rounded = Math.floor(percent / 10) * 10;

            if (rounded > this.lastLoggedPercent && rounded % 10 === 0) {
                this.lastLoggedPercent = rounded;
                const elapsed = this.stats.startTime
                    ? ((Date.now() - this.stats.startTime) / 1000).toFixed(1)
                    : '0.0';
                const rate = (this.stats.completed / (parseFloat(elapsed) || 1)).toFixed(1);
                logger.info(`Progress: ${percent}% (${this.stats.completed}/${this.stats.total}) - ${rate} files/s - Elapsed: ${elapsed}s`);
            }

            if (onFileComplete) {
                onFileComplete(index, file, null);
            }

        } catch (error) {
            this.stats.failed++;
            const isCancelled = error.message === 'Download cancelled' || axios.isCancel(error);

            if (!isCancelled) logger.error(`Failed to download ${file.url}:`, error.message);

            if (onFileComplete) {
                onFileComplete(index, file, error);
            }

            throw error;
        }
    }

    cancel() {
        logger.warn('Download cancelled by user');
        this.controller.abort();
    }

    pause() {
        this.paused = true;
        logger.info('Download paused');
    }

    resume() {
        this.paused = false;
        logger.info('Download resumed');
    }

    reset() {
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            startTime: null
        };
        this.controller = new AbortController();
    }
}

/**
 * Manager adaptativo con mejor manejo de concurrencia y errores
 */
class AdaptiveDownloadManager extends DownloadManager {
    constructor(initialConcurrency = 100, minConcurrency = 15, maxFileRetries = 5) {
        super(initialConcurrency);
        this.initialConcurrency = initialConcurrency;
        this.minConcurrency = minConcurrency;
        this.maxFileRetries = maxFileRetries;
        this.completedBytes = 0;
        this.totalBytes = 0;
        this.consecutiveErrors = 0;
        this.permissionErrors = 0;
        this.lastConcurrencyChange = 0; // Para evitar logs repetidos
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

        // Ordenar por tamaño (grandes primero para optimizar tiempo)
        const sortedFiles = [...filesList].sort((a, b) => b.size - a.size);

        logger.info(`Starting download of ${filesList.length} files (${(this.totalBytes / 1024 / 1024).toFixed(2)}MB) with adaptive concurrency`);

        // Pre-crear todos los directorios necesarios
        const directories = new Set();
        for (const file of sortedFiles) {
            directories.add(path.dirname(file.destPath));
        }

        logger.info(`Pre-creating ${directories.size} directories...`);
        for (const dir of directories) {
            await ensureDir(dir);
        }

        // Pequeña pausa para que el sistema de archivos se sincronice
        await new Promise(resolve => setTimeout(resolve, 300));

        // Cola de archivos fallidos para reintento final
        const failedFiles = [];

        // Dividir en lotes
        const batchSize = 100;
        let currentConcurrency = this.initialConcurrency;

        for (let i = 0; i < sortedFiles.length; i += batchSize) {
            if (this.controller.signal.aborted) break;

            const batch = sortedFiles.slice(i, i + batchSize);
            const remainingPercent = ((sortedFiles.length - i) / sortedFiles.length) * 100;

            // Reducir concurrencia si hay muchos errores de permisos
            if (this.permissionErrors > 5 && currentConcurrency > this.minConcurrency) {
                const newConcurrency = Math.max(this.minConcurrency, Math.floor(currentConcurrency * 0.6));
                if (newConcurrency !== currentConcurrency) {
                    currentConcurrency = newConcurrency;
                    logger.warn(`Permission errors detected (${this.permissionErrors}), reducing concurrency to ${currentConcurrency}`);
                    this.limit = pLimit(currentConcurrency);
                    this.permissionErrors = 0; // Reset counter
                    this.lastConcurrencyChange = Date.now();
                }
            }

            // Reducir en el último 20% o si hay muchos errores consecutivos
            const shouldReduce = (remainingPercent < 20 || this.consecutiveErrors > 10) &&
                currentConcurrency > this.minConcurrency;

            // Solo cambiar si ha pasado al menos 5 segundos desde el último cambio
            const timeSinceLastChange = Date.now() - this.lastConcurrencyChange;

            if (shouldReduce && timeSinceLastChange > 5000) {
                const newConcurrency = Math.max(this.minConcurrency, Math.floor(this.initialConcurrency * 0.5));
                if (newConcurrency !== currentConcurrency) {
                    currentConcurrency = newConcurrency;
                    logger.info(`Reducing concurrency to ${currentConcurrency} (remaining: ${remainingPercent.toFixed(0)}%, errors: ${this.consecutiveErrors})`);
                    this.limit = pLimit(currentConcurrency);
                    this.lastConcurrencyChange = Date.now();
                }
            }

            // Descargar lote
            const downloads = batch.map((file, batchIndex) =>
                this.limit(async () => {
                    if (this.controller.signal.aborted) {
                        return Promise.reject(new Error('Download cancelled'));
                    }

                    const fileWithIndex = { ...file, originalIndex: i + batchIndex };
                    const result = await this.downloadWithRetries(fileWithIndex, onFileComplete, onFileProgress);

                    if (!result.success) {
                        failedFiles.push(fileWithIndex);
                    }

                    return result;
                })
            );

            await Promise.allSettled(downloads);

            // Pausa si hay muchos errores consecutivos
            if (this.consecutiveErrors > 8) {
                logger.warn(`High error rate detected (${this.consecutiveErrors}), pausing for 5 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                this.consecutiveErrors = 0;
            }
        }

        // Reintentar archivos fallidos con concurrencia muy baja
        if (failedFiles.length > 0 && !this.controller.signal.aborted) {
            logger.warn(`Retrying ${failedFiles.length} failed files with minimal concurrency...`);
            this.limit = pLimit(5); // Solo 5 conexiones simultáneas

            const retryDownloads = failedFiles.map(file =>
                this.limit(async () => {
                    if (this.controller.signal.aborted) return { success: false };

                    // Reintento final más agresivo
                    return await this.downloadWithRetries(file, onFileComplete, onFileProgress, 3);
                })
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
     * Descarga con reintentos a nivel de manager
     */
    async downloadWithRetries(file, onFileComplete, onFileProgress, maxRetries = null) {
        if (this.controller.signal.aborted) return { success: false, file };

        const retries = maxRetries !== null ? maxRetries : this.maxFileRetries;
        const index = file.originalIndex;

        for (let attempt = 0; attempt < retries; attempt++) {
            if (this.controller.signal.aborted) return { success: false, file };

            try {
                await this.downloadWithByteTracking(file, index, onFileComplete, onFileProgress);

                // Éxito - resetear contador de errores
                this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);

                return { success: true, file };

            } catch (error) {
                if (this.controller.signal.aborted || error.message === 'Download cancelled') {
                    return { success: false, file };
                }

                this.consecutiveErrors++;

                const isPermError = error.message?.includes('EPERM') ||
                    error.message?.includes('EBUSY') ||
                    error.message?.includes('EACCES') ||
                    error.message?.includes('locked');

                if (isPermError) {
                    this.permissionErrors++;
                }

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

    async downloadWithByteTracking(file, index, onFileComplete, onFileProgress) {
        let fileDownloadedBytes = 0;

        try {
            await downloadFile(
                file.url,
                file.destPath,
                (progress, downloaded, total) => {
                    const chunkBytes = downloaded - fileDownloadedBytes;
                    fileDownloadedBytes = downloaded;
                    this.completedBytes += chunkBytes;

                    if (onFileProgress) {
                        const elapsed = (Date.now() - this.stats.startTime) / 1000;
                        const speed = this.completedBytes / elapsed;
                        const remainingBytes = this.totalBytes - this.completedBytes;
                        const eta = remainingBytes / (speed || 1);

                        onFileProgress(index, file, {
                            fileProgress: progress,
                            fileDownloaded: downloaded,
                            fileTotal: total,
                            totalDownloaded: this.completedBytes,
                            totalBytes: this.totalBytes,
                            speedBps: speed,
                            speedMBps: speed / 1024 / 1024,
                            etaSeconds: eta
                        });
                    }
                },
                4, // 4 reintentos en downloadFile
                this.controller.signal
            );

            this.stats.completed++;

            const percent = Math.floor((this.stats.completed / this.stats.total) * 100);
            const rounded = Math.floor(percent / 10) * 10;

            if (rounded > this.lastLoggedPercent && rounded % 10 === 0) {
                this.lastLoggedPercent = rounded;
                const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
                const rate = (this.stats.completed / (parseFloat(elapsed) || 1)).toFixed(1);
                const speedMB = (this.completedBytes / parseFloat(elapsed) / 1024 / 1024).toFixed(2);
                logger.info(`Progress: ${percent}% (${this.stats.completed}/${this.stats.total}) - ${rate} files/s (${speedMB} MB/s) - Elapsed: ${elapsed}s`);
            }

            if (onFileComplete) {
                onFileComplete(index, file, null);
            }

        } catch (error) {
            this.stats.failed++;
            const isCancelled = error.message === 'Download cancelled' || axios.isCancel(error);

            if (!isCancelled) {
                logger.error(`Download tracking failed for ${file.path}:`, error.message);
            }

            if (onFileComplete) {
                onFileComplete(index, file, error);
            }

            throw error;
        }
    }
}

module.exports = {
    DownloadManager,
    AdaptiveDownloadManager,
    downloadFile
};