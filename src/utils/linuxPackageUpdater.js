const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

/**
 * Actualización en Linux cuando la app está instalada desde el paquete
 * .deb o .rpm: se descarga el paquete nuevo y se instala con el gestor de
 * paquetes del sistema, pidiendo la contraseña con pkexec (polkit).
 */

const PACKAGE_NAME = 'truenomodpackclient';

// pkexec devuelve 126 si el usuario cierra el diálogo y 127 si no se autoriza
const PKEXEC_CANCELLED_CODES = [126, 127];

const INSTALL_SCRIPTS = {
  deb: 'dpkg -i "$1" || apt-get install -f -y',
  rpm: [
    'if command -v dnf >/dev/null 2>&1; then dnf install --nogpgcheck -y "$1";',
    'elif command -v zypper >/dev/null 2>&1; then zypper --non-interactive --no-refresh install --allow-unsigned-rpm -f "$1";',
    'elif command -v yum >/dev/null 2>&1; then yum install --nogpgcheck -y "$1";',
    'else rpm -U --force "$1"; fi'
  ].join(' ')
};

function commandSucceeds(command, args) {
  try {
    const result = spawnSync(command, args, { stdio: 'pipe', timeout: 5000 });
    return !result.error && result.status === 0 ? result.stdout.toString() : null;
  } catch (_) {
    return null;
  }
}

function hasCommand(command) {
  return commandSucceeds('sh', ['-c', `command -v ${command}`]) !== null;
}

/**
 * Devuelve 'deb' o 'rpm' si la app está instalada mediante ese tipo de
 * paquete, o null si no (p. ej. ejecutada desde una carpeta descomprimida).
 */
function detectInstalledPackageType() {
  if (process.platform !== 'linux') return null;

  const dpkgStatus = commandSucceeds('dpkg-query', ['-W', '-f=${Status}', PACKAGE_NAME]);
  if (dpkgStatus && dpkgStatus.includes('install ok installed')) return 'deb';

  if (commandSucceeds('rpm', ['-q', PACKAGE_NAME]) !== null) return 'rpm';

  return null;
}

function canElevate() {
  return hasCommand('pkexec');
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Comprueba el paquete descargado contra el digest publicado por GitHub
 * ("sha256:<hex>"). Si la release no trae digest no se puede comprobar.
 */
async function verifyDigest(filePath, digest) {
  if (!digest || !digest.startsWith('sha256:')) return { verified: false };

  const expected = digest.slice('sha256:'.length).toLowerCase();
  const actual = await sha256File(filePath);
  if (actual !== expected) {
    throw new Error(`El paquete descargado no coincide con el hash publicado (esperado ${expected}, obtenido ${actual})`);
  }
  return { verified: true };
}

/**
 * Instala el paquete con privilegios de administrador.
 * @returns {Promise<{success: boolean, cancelled?: boolean, code?: number, output?: string}>}
 */
function installPackage(packagePath, packageType) {
  const script = INSTALL_SCRIPTS[packageType];
  if (!script) return Promise.resolve({ success: false, output: `Tipo de paquete no soportado: ${packageType}` });

  return new Promise((resolve) => {
    // La ruta se pasa como argumento ($1), nunca interpolada en el script
    const child = spawn('pkexec', ['/bin/sh', '-c', script, 'sh', packagePath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });

    child.on('error', (error) => resolve({ success: false, output: error.message }));
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        cancelled: PKEXEC_CANCELLED_CODES.includes(code),
        code,
        output: output.slice(-2000)
      });
    });
  });
}

module.exports = {
  detectInstalledPackageType,
  canElevate,
  verifyDigest,
  installPackage
};
