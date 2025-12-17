const axios = require('axios');
const pLimit = require('p-limit');
const logger = require('../../utils/logger');
const { getOptimalConcurrency } = require('../utils/concurrencyConfig');
const { downloadFile } = require('../strategies/downloadStrategies');

// Aumentar el límite de listeners para AbortSignal
const { setMaxListeners } = require('events');
if (typeof setMaxListeners === 'function') {
    setMaxListeners(0); // 0 = sin límite
}

/**
 * Manager de descargas paralelas básico
 */
class DownloadManager {
    constructor(concurrency = 50) {
        const config = getOptimalConcurrency();
        this.limit = pLimit(concurrency || config.network);
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
        this.isCancelling = false; // Flag para cancelación inmediata
        logger.info(`DownloadManager initialized with concurrency: ${concurrency || config.network} (platform: ${process.platform})`);
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

        // Si se canceló, retornar inmediatamente sin esperar más
        if (this.isCancelling) {
            logger.warn('Download cancelled during execution');
            return {
                total: this.stats.total,
                completed: this.stats.completed,
                failed: this.stats.failed,
                cancelled: true,
                paused: this.paused,
                duration: parseFloat(duration)
            };
        }

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
        this.isCancelling = true;
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

module.exports = { DownloadManager };
