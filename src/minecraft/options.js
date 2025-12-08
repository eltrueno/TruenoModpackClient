// options.js - Módulo para gestionar opciones de Minecraft (options.txt)
const fs = require('fs').promises;
const path = require('path');
const { getMinecraftPath } = require('./common.js');

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
            console.log('No se encontró options.txt original en .minecraft, omitiendo copia.');
            return false;
        }

        await fs.copyFile(sourcePath, destPath);
        console.log(`options.txt copiado a ${modpackPath}`);
        return true;

    } catch (error) {
        console.error('Error copiando options.txt:', error);
        return false;
    }
}

module.exports = {
    copyOptions
};