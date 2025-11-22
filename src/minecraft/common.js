const { app } = require('electron');
const path = require('path');

/**
 * Obtiene la ruta de .minecraft según el sistema operativo
 */
function getMinecraftPath() {
  const platform = process.platform;
  
  if (platform === 'win32') {
    return path.join(app.getPath('appData'), '.minecraft');
  } else if (platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
  } else {
    return path.join(app.getPath('home'), '.minecraft');
  }
}

module.exports = {
    getMinecraftPath
}