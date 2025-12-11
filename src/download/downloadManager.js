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

async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

/**
 * Descarga un archivo individual con reintentos
 */
async function downloadFile(url, destPath, onProgress, retries = 3) {
    const fileName = path.basename(destPath);
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await ensureDir(path.dirname(destPath));
            const writer = fsSync.createWriteStream(destPath);

            const response = await axiosInstance({
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

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            });

            if (attempt > 0) {
                logger.info(`Download succeeded after ${attempt + 1} attempts: ${fileName}`);
            }

            return; // Éxito

        } catch (error) {
            try {
                if (fsSync.existsSync(destPath)) {
                    fsSync.unlinkSync(destPath);
                }
            } catch (e) {
                logger.warn(`Failed to clean partial file: ${fileName}`, e.message);
            }

            if (attempt === retries - 1) {
                logger.error(`Download failed after ${retries} attempts: ${fileName}`, {
                    url,
                    error: error.message,
                    code: error.code
                });
                throw new Error(`Failed to download ${url} after ${retries} attempts: ${error.message}`);
            }

            const waitTime = Math.min(2000 * Math.pow(2, attempt), 30000);
            logger.warn(`Retry ${attempt + 1}/${retries} for ${fileName} in ${waitTime}ms - Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

/**
 * Manager de descargas paralelas
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
        this.cancelled = false;
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
        this.cancelled = false;
        this.paused = false;
        this.lastLoggedPercent = 0

        logger.info(`Starting download of ${filesList.length} files`);

        const downloads = filesList.map((file, index) =>
            this.limit(() => {
                if (this.cancelled) {
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

        if (failed.length > 0 && !this.cancelled) {
            logger.error(`${failed.length} files failed to download`);
        }

        return {
            total: this.stats.total,
            completed: this.stats.completed,
            failed: this.stats.failed,
            cancelled: this.cancelled,
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
                }
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

            // PASAR file e index correctamente
            if (onFileComplete) {
                onFileComplete(index, file, null); // (index, file, error=null)
            }

        } catch (error) {
            this.stats.failed++;
            logger.error(`Failed to download ${file.url}:`, error.message);

            // PASAR file e index incluso en error
            if (onFileComplete) {
                onFileComplete(index, file, error); // (index, file, error)
            }

            throw error;
        }
    }

    cancel() {
        logger.warn('Download cancelled by user');
        this.cancelled = true;
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
        this.cancelled = false;
    }
}

class AdaptiveDownloadManager extends DownloadManager {
    constructor(initialConcurrency = 100, minConcurrency = 30, maxFileRetries = 3) {
        super(initialConcurrency);
        this.initialConcurrency = initialConcurrency;
        this.minConcurrency = minConcurrency;
        this.maxFileRetries = maxFileRetries;
        this.completedBytes = 0;
        this.totalBytes = 0;
        this.consecutiveErrors = 0; //para detectar problemas sistémicos
    }

    async downloadFiles(filesList, onFileComplete, onFileProgress) {
        this.stats.total = filesList.length;
        this.stats.completed = 0;
        this.stats.failed = 0;
        this.stats.startTime = Date.now();
        this.cancelled = false;
        this.lastLoggedPercent = 0;
        this.consecutiveErrors = 0;

        // Calcular tamaño total
        this.totalBytes = filesList.reduce((acc, f) => acc + (f.size || 0), 0);
        this.completedBytes = 0;

        // Ordenar por tamaño (grandes primero)
        const sortedFiles = [...filesList].sort((a, b) => b.size - a.size);

        logger.info(`Starting download of ${filesList.length} files (${(this.totalBytes / 1024 / 1024).toFixed(2)}MB) with adaptive concurrency`);

        // Cola de reintentos
        const failedFiles = [];

        // Dividir en lotes
        const batchSize = 100;
        let currentConcurrency = this.initialConcurrency;

        for (let i = 0; i < sortedFiles.length; i += batchSize) {
            const batch = sortedFiles.slice(i, i + batchSize);
            const remainingPercent = ((sortedFiles.length - i) / sortedFiles.length) * 100;

            // Reducir concurrencia en el último 20% o si hay muchos errores
            if ((remainingPercent < 20 || this.consecutiveErrors > 10) && currentConcurrency !== this.minConcurrency) {
                currentConcurrency = Math.max(this.minConcurrency, Math.floor(this.initialConcurrency * 0.5));
                logger.info(`Reducing concurrency to ${currentConcurrency} (remaining: ${remainingPercent.toFixed(0)}%, errors: ${this.consecutiveErrors})`);
                this.limit = pLimit(currentConcurrency);
            }

            // Descargar lote
            const downloads = batch.map((file, batchIndex) =>
                this.limit(async () => {
                    if (this.cancelled) {
                        return Promise.reject(new Error('Download cancelled'));
                    }

                    const fileWithIndex = { ...file, originalIndex: i + batchIndex };
                    const result = await this.downloadWithRetries(fileWithIndex, onFileComplete, onFileProgress);

                    // Si falló después de todos los reintentos, guardar para reintento global
                    if (!result.success) {
                        failedFiles.push(fileWithIndex);
                    }

                    return result;
                })
            );

            await Promise.allSettled(downloads);

            // Pausa si hay muchos errores consecutivos
            if (this.consecutiveErrors > 5) {
                logger.warn(`High error rate detected, pausing for 3 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                this.consecutiveErrors = 0;
            }
        }

        // REINTENTAR ARCHIVOS FALLIDOS (último intento con concurrencia baja)
        if (failedFiles.length > 0 && !this.cancelled) {
            logger.warn(`Retrying ${failedFiles.length} failed files with reduced concurrency...`);
            this.limit = pLimit(10); // Solo 10 conexiones para reintentos finales

            const retryDownloads = failedFiles.map(file =>
                this.limit(async () => {
                    if (this.cancelled) return { success: false };

                    // Último intento sin tracking de bytes para simplificar
                    return await this.downloadWithRetries(file, onFileComplete, null, 1);
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
            cancelled: this.cancelled,
            duration: parseFloat(duration)
        };
    }

    /**
     * Descarga con reintentos a nivel de manager
     */
    async downloadWithRetries(file, onFileComplete, onFileProgress, maxRetries = null) {
        const retries = maxRetries !== null ? maxRetries : this.maxFileRetries;
        const index = file.originalIndex;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await this.downloadWithByteTracking(file, index, onFileComplete, onFileProgress);

                // Éxito - resetear contador de errores consecutivos
                this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);

                return { success: true, file };

            } catch (error) {
                this.consecutiveErrors++;

                const isLastAttempt = attempt === retries - 1;
                const isPermError = error.message?.includes('EPERM') ||
                    error.message?.includes('EBUSY') ||
                    error.message?.includes('locked');

                if (isLastAttempt) {
                    logger.error(`File failed after ${retries} manager retries: ${file.path}`);
                    return { success: false, file, error };
                }

                // Backoff más largo para errores de permisos
                const baseWait = isPermError ? 5000 : 2000;
                const waitTime = Math.min(baseWait * Math.pow(2, attempt), 15000);

                logger.warn(`Manager retry ${attempt + 1}/${retries} for ${file.path} in ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));

                // Si es error de permisos, reducir concurrencia
                if (isPermError && this.limit._concurrency > this.minConcurrency) {
                    const newConcurrency = Math.max(this.minConcurrency, Math.floor(this.limit._concurrency * 0.7));
                    this.limit = pLimit(newConcurrency);
                    logger.warn(` Permission error detected, reducing concurrency to ${newConcurrency}`);
                }
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
                    // Calcular incremento desde último update
                    const chunkBytes = downloaded - fileDownloadedBytes;
                    fileDownloadedBytes = downloaded;
                    this.completedBytes += chunkBytes;

                    // Calcular estadísticas
                    if (onFileProgress) {
                        const elapsed = (Date.now() - this.stats.startTime) / 1000;
                        const speed = this.completedBytes / elapsed; // bytes/s
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
                }
            );

            this.stats.completed++;

            // Log cada 10%
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
            logger.error(`Download tracking failed for ${file.path}:`, error.message);

            if (onFileComplete) {
                onFileComplete(index, file, error);
            }

            throw error; // Propagar para que downloadWithRetries lo maneje
        }
    }
}


module.exports = {
    DownloadManager,
    AdaptiveDownloadManager,
    downloadFile
};