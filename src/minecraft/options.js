// options.js - Módulo para gestionar opciones de Minecraft (options.txt)
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger.js')
const { getMinecraftPath } = require('./common.js');
const { fileExists } = require('../utils/file-utils.js')

/**
 * Copia el archivo options.txt de la carpeta .minecraft a la ruta de instalación del modpack.
 * @param {string} modpackPath - La ruta donde está instalado el modpack (gameDir).
 * @returns {Promise<boolean>} - True si se copió correctamente, false si hubo error o no existía.
 */
async function copyOptions(modpackPath) {
    try {
        const minecraftPath = getMinecraftPath();
        const sourcePath = path.join(minecraftPath, 'options.txt');
        const destPath = path.join(modpackPath, 'options.txt');

        // Verificar si existe el origen
        try {
            await fs.access(sourcePath);
        } catch {
            logger.info('No se encontró options.txt original en .minecraft, omitiendo copia.');
            return false;
        }

        const alreadyExists = await fileExists(destPath)
        // Solo copiar en caso de que no exista en el destino (no reemplazar)
        if(!alreadyExists){
            await fs.copyFile(sourcePath, destPath);
            logger.info(`options.txt copiado a ${modpackPath}`);
        }else logger.info('Omitido copiado de options.txt (ya existe)')
        return true;

    } catch (error) {
        logger.error('Error copiando options.txt:', error);
        return false;
    }
}

module.exports = {
    copyOptions
};