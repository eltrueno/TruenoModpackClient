const axios = require('axios');
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const { httpsAgent, httpAgent } = require('../../utils/httpAgents');
const logger = require('../../utils/logger');
const { ensureDir, safeUnlink } = require('../utils/fileOperations');

const axiosInstance = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 60000,
    maxRedirects: 5,
});

/**
 * Descarga un archivo individual con reintentos y manejo robusto de errores
 * @param {string} url - URL del archivo a descargar
 * @param {string} destPath - Ruta de destino
 * @param {Function} onProgress - Callback de progreso (progress, downloaded, total)
 * @param {number} retries - Número de reintentos
 * @param {AbortSignal} signal - Señal de cancelación
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

            // Cerrar el stream y esperar más tiempo (200ms para antivirus en Windows)
            writer.close();
            await new Promise(resolve => setTimeout(resolve, 200));

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
 * Descarga archivo pequeño directamente a memoria y luego escribe
 * Más eficiente y menos problemas en Windows
 * @param {string} url - URL del archivo
 * @param {string} destPath - Ruta de destino
 * @param {AbortSignal} signal - Señal de cancelación
 * @returns {Promise<number>} - Bytes escritos
 */
async function downloadFileToMemory(url, destPath, signal = null) {
    const fileName = path.basename(destPath);
    const tempPath = destPath + '.tmp';

    try {
        // Descargar a memoria
        const response = await axiosInstance({
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            signal: signal
        });

        if (signal?.aborted) throw new Error('Download cancelled');

        const buffer = Buffer.from(response.data);

        // Asegurar directorio
        await ensureDir(path.dirname(destPath));

        // Limpiar temporales
        await safeUnlink(tempPath);

        // Escribir de una vez
        await fs.writeFile(tempPath, buffer, { flag: 'w' });

        // Esperar para antivirus
        await new Promise(resolve => setTimeout(resolve, 100));

        if (signal?.aborted) throw new Error('Download cancelled');

        // Eliminar destino si existe y renombrar
        await safeUnlink(destPath);
        await fs.rename(tempPath, destPath);

        // Verificar que existe
        if (!fsSync.existsSync(destPath)) {
            throw new Error('File rename failed');
        }

        return buffer.length;

    } catch (error) {
        await safeUnlink(tempPath);
        throw error;
    }
}

module.exports = {
    downloadFile,
    downloadFileToMemory
};
