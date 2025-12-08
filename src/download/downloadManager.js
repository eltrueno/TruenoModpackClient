const axios = require('axios');
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const pLimit = require('p-limit');
const { httpsAgent, httpAgent } = require('../utils/httpAgents');

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

            return; // Éxito

        } catch (error) {
            if (attempt === retries - 1) {
                throw new Error(`Failed to download ${url} after ${retries} attempts: ${error.message}`);
            }

            const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            try {
                if (fsSync.existsSync(destPath)) {
                    fsSync.unlinkSync(destPath);
                }
            } catch (e) {
                // Ignorar errores de limpieza
            }
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
            failed: 0
        };
        this.cancelled = false;
    }

    /**
     * Descarga múltiples archivos en paralelo
     */
    async downloadFiles(filesList, onFileComplete, onFileProgress) {
        this.stats.total = filesList.length;
        this.stats.completed = 0;
        this.stats.failed = 0;
        this.cancelled = false;

        const downloads = filesList.map((file, index) =>
            this.limit(() => {
                if (this.cancelled) {
                    return Promise.reject(new Error('Download cancelled'));
                }
                return this.downloadWithTracking(file, index, onFileComplete, onFileProgress);
            })
        );

        const results = await Promise.allSettled(downloads);

        const failed = results.filter(r => r.status === 'rejected');

        if (failed.length > 0 && !this.cancelled) {
            console.error(`${failed.length} files failed to download`);
        }

        return {
            total: this.stats.total,
            completed: this.stats.completed,
            failed: this.stats.failed,
            cancelled: this.cancelled
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

            // ✅ PASAR file e index correctamente
            if (onFileComplete) {
                onFileComplete(index, file, null); // (index, file, error=null)
            }

        } catch (error) {
            this.stats.failed++;
            console.error(`Failed to download ${file.url}:`, error.message);

            // ✅ PASAR file e index incluso en error
            if (onFileComplete) {
                onFileComplete(index, file, error); // (index, file, error)
            }

            throw error;
        }
    }

    cancel() {
        this.cancelled = true;
    }

    reset() {
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0
        };
        this.cancelled = false;
    }
}

module.exports = {
    DownloadManager,
    downloadFile
};