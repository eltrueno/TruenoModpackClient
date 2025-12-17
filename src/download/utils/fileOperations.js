const fsSync = require('fs');
const fs = require('fs').promises;
const logger = require('../../utils/logger');

/**
 * Asegura que un directorio existe, creándolo si es necesario
 * @param {string} dir - Ruta del directorio
 */
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

/**
 * Intenta eliminar un archivo con reintentos (para manejar locks temporales)
 * Aumentado a 5 intentos para Windows
 * @param {string} filePath - Ruta del archivo a eliminar
 * @param {number} maxAttempts - Número máximo de intentos
 * @returns {Promise<boolean>} - true si se eliminó, false si falló
 */
async function safeUnlink(filePath, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            if (fsSync.existsSync(filePath)) {
                await fs.unlink(filePath);
            }
            return true;
        } catch (error) {
            if (i === maxAttempts - 1) {
                logger.warn(`Could not delete file after ${maxAttempts} attempts: ${filePath}`);
                return false;
            }
            // Esperar más tiempo en Windows para que el antivirus libere el archivo
            await new Promise(resolve => setTimeout(resolve, 800 * (i + 1)));
        }
    }
    return false;
}

module.exports = {
    ensureDir,
    safeUnlink
};
