// loader-installer.js - Instalador simple de loaders
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { app } = require('electron');

const {calculateFileHash, ensureDir, fileExists} = require('../utils/file-utils.js')

const { getMinecraftPath } = require('./common.js')

/**
 * Verifica si un loader está instalado
 */
async function isLoaderInstalled(versionId) {
  const minecraftPath = getMinecraftPath();
  const versionJsonPath = path.join(minecraftPath, 'versions', versionId, `${versionId}.json`);
  
  return await fileExists(versionJsonPath)
}


/**
 * Descarga un archivo con reintentos
 */
async function downloadFileWithRetry(url, destPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      await ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, response.data);
      return true;
    } catch (error) {
      console.error(`Intento ${attempt}/${maxRetries} falló para ${url}:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Instala el loader copiando todos los archivos desde tu servidor
 */
async function installLoader(loaderFiles, onProgress) {
  try {
    const minecraftPath = getMinecraftPath();
    //const { loader_files } = loaderData;
    
    if (!loaderFiles || Object.keys(loaderFiles).length === 0) {
      return { success: true, alreadyInstalled: true };
    }
    
    if (onProgress) {
      onProgress({ stage: 'checking', message: 'Preparando instalación del loader...', progress: 0 });
    }
    
    // Verificar si ya está instalado (comprobar si existe el JSON de versión)
    /*const versionJsonPath = Object.keys(loaderFiles).find(path => path.includes('.json') && path.includes('versions'));
    if (versionJsonPath) {
      const fullPath = path.join(minecraftPath, versionJsonPath);
      if (fsSync.existsSync(fullPath)) {
        console.log(`✓ Loader ya está instalado`);
        if (onProgress) {
          onProgress({ stage: 'complete', message: 'Loader ya está instalado', progress: 100 });
        }
        return { success: true, alreadyInstalled: true };
      }
    }*/
    
    if (onProgress) {
      onProgress({ stage: 'downloading', message: 'Descargando archivos del loader...', progress: 10 });
    }
    
    // Descargar y copiar todos los archivos
    let downloadedCount = 0;
    const totalFiles = Object.keys(loaderFiles).length;
    
    for (const [filePath, fileData] of Object.entries(loaderFiles)) {
      const destPath = path.join(minecraftPath, filePath);
      
      // Si ya existe y tiene el tamaño correcto, skip
      /*if (fileExists(destPath)) {
        const stats = await fs.stat(destPath);
        if (stats.size === fileData.size) {
          console.log(`Fichero ya existe: ${path.basename(filePath)}`);
          downloadedCount++;
          continue;
        }
      }*/
     try {
        const stats = await fs.stat(destPath);
        if (stats.size === fileData.size) {
            console.log(`Fichero ya existe: ${path.basename(filePath)}`);
            downloadedCount++;
            continue;
        }
    } catch (err) {
        // Si no existe, seguimos con la descarga
    }
      
      //await fs.mkdir(path.dirname(destPath), { recursive: true });
      await ensureDir(path.dirname(destPath))
      
      console.log(`Descargando ${filePath}`);
      
      try {
        await downloadFileWithRetry(fileData.url, destPath);
        
        // Verificar hash si está presente
        if (fileData.hash) {
          const actualHash = await calculateFileHash(destPath);
          if (actualHash !== fileData.hash) {
            throw new Error(`Hash mismatch for ${filePath}`);
          }
        }
        
        downloadedCount++;
        
        const progress = 10 + Math.round((downloadedCount / totalFiles) * 80);
        if (onProgress) {
          onProgress({
            stage: 'downloading',
            message: `Instalando archivos del loader... (${downloadedCount}/${totalFiles})`,
            currentFile: downloadedCount,
            totalFiles: totalFiles,
            progress: progress
          });
        }
        
      } catch (error) {
        console.error(`Error descargando ${filePath}:`, error.message);
        throw error;
      }
    }
    
    console.log(`${totalFiles} archivos del loader instalados`);
    
    if (onProgress) {
      onProgress({ stage: 'complete', message: 'Loader instalado correctamente!', progress: 100 });
    }
    
    return {
      success: true,
      alreadyInstalled: false
    };
    
  } catch (error) {
    console.error('Error instalando loader:', error);
    throw error;
  }
}

module.exports = {
  installLoader,
  isLoaderInstalled,
  getMinecraftPath
};