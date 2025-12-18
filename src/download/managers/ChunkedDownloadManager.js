const axios = require('axios');
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const pLimit = require('p-limit');
const { httpsAgent, httpAgent } = require('../../utils/httpAgents');
const logger = require('../../utils/logger');
const { AdaptiveDownloadManager } = require('./AdaptiveDownloadManager');
const { ensureDir, safeUnlink } = require('../utils/fileOperations');

const axiosInstance = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 60000,
    maxRedirects: 5,
});

/**
 * Manager especializado en descargar un SOLO archivo grande rapido
 * partiendo el archivo en chunks y descargandolos en paralelo
 */
class ChunkedDownloadManager extends AdaptiveDownloadManager {
    constructor(networkConcurrency = 8, chunkSize = 1024 * 1024 * 10) { // Default 8 connections, 10MB chunks
        super(networkConcurrency, 1, 1); // IO concurrency 1 (single file write), min 1
        this.chunkSize = chunkSize;
        this.networkConcurrency = networkConcurrency;
        this.activeChunks = new Map(); // Track chunk progress
    }

    async downloadFiles(filesList, onFileComplete, onFileProgress) {
        this.stats.total = filesList.length;
        this.stats.completed = 0;
        this.stats.failed = 0;
        this.stats.startTime = Date.now();
        this.completedBytes = 0;
        this.totalBytes = 0;

        if (this.controller.signal.aborted) {
            this.controller = new AbortController();
        }

        this.isCancelling = false;

        // Process sequentially as this manager is optimized for single file focus
        for (let i = 0; i < filesList.length; i++) {
            if (this.controller.signal.aborted || this.isCancelling) break;

            const file = filesList[i];
            try {
                await this.downloadSingleFileChunked(file, i, onFileComplete, onFileProgress);

                if (!this.controller.signal.aborted) {
                    this.stats.completed++;
                    if (onFileComplete) onFileComplete(i, file, null);
                }
            } catch (error) {
                if (this.controller.signal.aborted || this.isCancelling || error.message === 'Download cancelled') {
                    logger.warn('Download cancelled');
                    break;
                }

                this.stats.failed++;
                logger.error(`Failed to download ${file.url}:`, error);

                // Fallback to normal download if chunked fails and not cancelled
                try {
                    logger.info('Falling back to standard download...');
                    await super.downloadWithSeparatedQueues(file, i, onFileProgress); // Pass onFileProgress instead of complete to manually handle it
                    this.stats.failed--; // Correct stats if fallback succeeds
                    this.stats.completed++;
                    if (onFileComplete) onFileComplete(i, file, null);
                } catch (fallbackError) {
                    if (onFileComplete) onFileComplete(i, file, fallbackError);
                }
            }
        }

        const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);
        return {
            total: this.stats.total,
            completed: this.stats.completed,
            failed: this.stats.failed,
            cancelled: this.controller.signal.aborted,
            duration: parseFloat(duration)
        };
    }

    async downloadSingleFileChunked(file, index, onFileComplete, onFileProgress) {
        // 1. Get File Info
        logger.info(`Getting info for ${file.url}`);
        let headResponse;
        try {
            headResponse = await axiosInstance.head(file.url);
        } catch (e) {
            // If HEAD fails, maybe method not allowed, try generic download
            throw new Error(`HEAD request failed: ${e.message}`);
        }

        const acceptRanges = headResponse.headers['accept-ranges'];
        const contentLength = parseInt(headResponse.headers['content-length'], 10);

        if (!contentLength) {
            throw new Error('No content-length found');
        }

        this.totalBytes += contentLength; // Update total for progress tracking

        // If no ranges support or file too small (< 20MB), use super
        if (acceptRanges !== 'bytes' || contentLength < 1024 * 1024 * 20) {
            logger.info(`File ${path.basename(file.destPath)} does not support ranges or is too small, using standard download.`);
            // Reset totalBytes as super will handle its own tracking? 
            // Actually adaptive manager resets totalBytes in downloadFiles, but we are inside the loop.
            // We'll just call the super method for single file logic.
            return await super.downloadWithSeparatedQueues(file, index, undefined, onFileProgress);
        }

        logger.info(`Starting chunked download for ${path.basename(file.destPath)} (${(contentLength / 1024 / 1024).toFixed(2)} MB)`);

        await ensureDir(path.dirname(file.destPath));
        const tempPath = file.destPath + '.part';
        await safeUnlink(tempPath);

        // 2. Allocate file
        const fd = await fs.open(tempPath, 'w');
        // We don't necessarily need to fallocate, but it helps. 
        // Node doesn't have a direct fallocate in fs.promises easily cross-platform without potential issues?
        // simple ftruncate ensures size.
        await fd.truncate(contentLength);
        await fd.close(); // Close, we will use individual streams or just standard fs.write with position

        // 3. Create Chunks
        const chunks = [];
        const chunkCount = Math.ceil(contentLength / this.chunkSize);

        for (let i = 0; i < chunkCount; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize - 1, contentLength - 1);
            chunks.push({ index: i, start, end, downloaded: 0 });
        }

        this.activeChunks.clear();

        // 4. Download Chunks Parallel
        const downloadLimit = pLimit(this.networkConcurrency);
        const chunkPromises = chunks.map(chunk => {
            return downloadLimit(() => this.downloadChunk(file.url, tempPath, chunk, (bytes) => {
                this.activeChunks.set(chunk.index, bytes);
                this.reportProgress(index, file, onFileProgress, contentLength);
            }));
        });

        await Promise.all(chunkPromises);

        // 5. Finalize
        await safeUnlink(file.destPath);
        await fs.rename(tempPath, file.destPath);

        if (!fsSync.existsSync(file.destPath)) {
            throw new Error('File rename failed after chunked download');
        }

        logger.info(`Chunked download finished: ${file.destPath}`);
    }

    async downloadChunk(url, destPath, chunk, onProgress) {
        if (this.controller.signal.aborted || this.isCancelling) throw new Error('Download cancelled');

        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                const response = await axiosInstance({
                    method: 'get',
                    url: url,
                    headers: {
                        'Range': `bytes=${chunk.start}-${chunk.end}`
                    },
                    responseType: 'arraybuffer', // Or stream, arraybuffer is easier for seeking write usually
                    signal: this.controller.signal
                });

                // Write to position
                const buffer = Buffer.from(response.data);

                // Using fs.promises.open inside loop effectively? 
                // Better to open once? concurrency issues if sharing FD?
                // Safe way: open, write, close for each chunk write? 
                // Since we download whole chunk to RAM (max 10MB), we just write it once.

                const fd = await fs.open(destPath, 'r+'); // Open for reading and writing
                try {
                    await fd.write(buffer, 0, buffer.length, chunk.start);
                } finally {
                    await fd.close();
                }

                if (onProgress) onProgress(buffer.length);
                return;

            } catch (error) {
                if (this.controller.signal.aborted || this.isCancelling) throw new Error('Download cancelled');

                attempts++;
                logger.warn(`Chunk ${chunk.index} failed (attempt ${attempts}/${maxAttempts}): ${error.message}`);
                await new Promise(r => setTimeout(r, 1000 * attempts));

                if (attempts === maxAttempts) throw error;
            }
        }
    }

    reportProgress(index, file, onFileProgress, totalSize) {
        if (!onFileProgress) return;

        let totalDownloaded = 0;
        for (const bytes of this.activeChunks.values()) {
            totalDownloaded += bytes;
        }

        // Add previously completed bytes from other files if any (though we assume single file mostly)
        // this.completedBytes only updates on file complete in main loop? 
        // Ideally we track global progress.

        this.updateProgressSnapshotWithBytes(totalDownloaded);
        const progressInfo = this.getProgressInfo(totalDownloaded);

        // Override getProgressInfo logic slightly or use base logic.
        // Base getProgressInfo uses this.completedBytes + currentFileBytes.
        // calling getProgressInfo(totalDownloaded) works if this.completedBytes is 0 (first file).

        onFileProgress(index, file, {
            fileProgress: Math.round((totalDownloaded / totalSize) * 100),
            fileDownloaded: totalDownloaded,
            fileTotal: totalSize,
            totalDownloaded: totalDownloaded, // Assuming single file for now
            totalBytes: totalSize,
            speed: progressInfo.speed,
            speedBps: progressInfo.speedBps,
            eta: progressInfo.eta,
            progressPercent: ((totalDownloaded / totalSize) * 100).toFixed(1)
        });
    }

    // Helper to pipe into existing AdaptiveManager progress logic
    updateProgressSnapshotWithBytes(currentBytes) {
        // We need to simulate the byte counting for speed calc
        // Base class uses this.completedBytes.
        // We can temperarily store the internal current progress to help calc speed?

        // AdaptiveManager.updateProgressSnapshot uses 'this.completedBytes' which is committed bytes.
        // To make it work for a single file in progress, we might need a custom speed calc or
        // temporarily update 'this.completedBytes' (risky).

        // Better: Create a local implementation of snapshotting for this manager 
        // OR just override getAverageSpeed to look at current progress.

        const now = Date.now();
        if (now - this.lastSnapshotTime >= this.snapshotInterval) {
            this.progressSnapshots.push({
                timestamp: now,
                bytes: currentBytes // For this manager, we track absolute bytes of current file
            });
            if (this.progressSnapshots.length > this.maxSnapshots) this.progressSnapshots.shift();
            this.lastSnapshotTime = now;
        }
    }

    // Override to work with our custom bytes tracking
    getAverageSpeed() {
        if (this.progressSnapshots.length < 2) return 0;
        const first = this.progressSnapshots[0];
        const last = this.progressSnapshots[this.progressSnapshots.length - 1];
        const timeDiff = (last.timestamp - first.timestamp) / 1000;
        const bytesDiff = last.bytes - first.bytes;
        return timeDiff > 0 ? bytesDiff / timeDiff : 0;
    }

}

module.exports = { ChunkedDownloadManager };
