// Main exports
const { DownloadManager } = require('./managers/DownloadManager');
const { AdaptiveDownloadManager } = require('./managers/AdaptiveDownloadManager');

// Utility exports
const { getOptimalConcurrency } = require('./utils/concurrencyConfig');
const { ensureDir, safeUnlink } = require('./utils/fileOperations');

// Strategy exports
const { downloadFile, downloadFileToMemory } = require('./strategies/downloadStrategies');

module.exports = {
    // Managers
    DownloadManager,
    AdaptiveDownloadManager,

    // Utilities
    getOptimalConcurrency,
    ensureDir,
    safeUnlink,

    // Strategies
    downloadFile,
    downloadFileToMemory
};
