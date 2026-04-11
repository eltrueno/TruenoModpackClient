const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Script para generar el archivo latest.yml necesario para electron-updater
 * cuando se usa Electron Forge (ya que Forge no lo genera por defecto).
 */

/**
 * Genera el archivo latest.yml necesario para electron-updater
 * @param {string} customSetupPath - Ruta opcional al instalador .exe
 */
async function generateLatestYml(customSetupPath) {
    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const version = packageJson.version;
        const setupExeName = 'TruenoModpackSetup.exe';

        let setupPath = customSetupPath;

        if (!setupPath) {
            const possiblePaths = [
                path.join(__dirname, 'out', 'make', 'squirrel.windows', 'x64', setupExeName),
                path.join(__dirname, 'out', 'make', 'squirrel.windows', 'ia32', setupExeName),
                path.join(__dirname, 'out', 'make', setupExeName)
            ];
            setupPath = possiblePaths.find(p => fs.existsSync(p));
        }

        if (!setupPath || !fs.existsSync(setupPath)) {
            console.error('ERROR: No se encontró el instalador .exe para generar latest.yml');
            return;
        }

        console.log(`Generando latest.yml para: ${setupPath}`);

        const fileBuffer = fs.readFileSync(setupPath);
        const hash = crypto.createHash('sha512').update(fileBuffer).digest('base64');
        const size = fileBuffer.length;

        const date = new Date().toISOString();
        const yamlContent = `version: ${version}
files:
  - url: ${setupExeName}
    sha512: ${hash}
    size: ${size}
path: ${setupExeName}
sha512: ${hash}
releaseDate: '${date}'
`;

        // Guardar en la raíz y también junto al instalador
        //fs.writeFileSync(path.join(__dirname, 'latest.yml'), yamlContent);
        fs.writeFileSync(path.join(path.dirname(setupPath), 'latest.yml'), yamlContent);

        console.log('✅ latest.yml generado con éxito');
    } catch (error) {
        console.error('Error generando latest.yml:', error);
    }
}

module.exports = { generateLatestYml };

// Si se ejecuta directamente
if (require.main === module) {
    generateLatestYml();
}
