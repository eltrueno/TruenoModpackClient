const fs = require('fs').promises;
const crypto = require('crypto');

const { createReadStream } = require('fs');
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve('sha256:' + hash.digest('hex')));
  });
}

// Verifica si un archivo existe
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Crea directorios recursivamente
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true
  } catch (error) {
    console.error('Error creating directory:', error);
    return false
  }
}

async function ensureFile(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '{}');
  }
}

module.exports = {
    calculateFileHash,
    fileExists,
    ensureDir,
    ensureFile
}