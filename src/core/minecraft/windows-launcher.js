const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Detección de los launchers oficiales de Minecraft en Windows:
 *  - Clásico (MinecraftLauncher.exe, instalado con el .msi)
 *  - Windows App (paquete de Microsoft Store / Xbox)
 */

const CLASSIC_EXE = 'MinecraftLauncher.exe';
const CLASSIC_DIR = 'Minecraft Launcher';

const UNINSTALL_KEYS = [
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
];

const UWP_PACKAGE_NAMES = [
  'Microsoft.4297127D64EC6',
  'Mojang.MinecraftLauncher'
];

function run(command, args) {
  try {
    return execFileSync(command, args, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000, windowsHide: true }).toString();
  } catch (_) {
    return '';
  }
}

function existingFile(candidate) {
  try {
    return candidate && fs.statSync(candidate).isFile() ? candidate : null;
  } catch (_) {
    return null;
  }
}

function firstExistingFile(candidates) {
  for (const candidate of candidates) {
    const found = existingFile(candidate);
    if (found) return found;
  }
  return null;
}

/** Letras de unidad disponibles (C:\, D:\, ...) */
function listDriveRoots() {
  const roots = [];
  for (let code = 67; code <= 90; code++) { // C..Z
    const root = `${String.fromCharCode(code)}:\\`;
    if (fs.existsSync(root)) roots.push(root);
  }
  return roots;
}

/** 1. Carpetas habituales, en todas las unidades */
function findInCommonLocations() {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', CLASSIC_DIR, CLASSIC_EXE)
  ];

  for (const root of listDriveRoots()) {
    candidates.push(
      path.join(root, 'Program Files (x86)', CLASSIC_DIR, CLASSIC_EXE),
      path.join(root, 'Program Files', CLASSIC_DIR, CLASSIC_EXE),
      path.join(root, CLASSIC_DIR, CLASSIC_EXE),
      path.join(root, 'Games', CLASSIC_DIR, CLASSIC_EXE),
      path.join(root, 'Juegos', CLASSIC_DIR, CLASSIC_EXE)
    );
  }

  return firstExistingFile(candidates);
}

/**
 * 2. Registro de desinstalación. El .msi guarda en InstallLocation la carpeta
 *    que eligió el usuario (el launcher queda en "<carpeta>\Minecraft Launcher").
 */
function findInRegistry() {
  for (const uninstallKey of UNINSTALL_KEYS) {
    const search = run('reg', ['query', uninstallKey, '/s', '/f', 'Minecraft Launcher', '/d', '/e']);
    const productKeys = search.split(/\r?\n/).filter((line) => /^HKEY_/i.test(line.trim()));

    for (const productKey of productKeys) {
      const output = run('reg', ['query', productKey.trim(), '/v', 'InstallLocation']);
      const match = output.match(/InstallLocation\s+REG_\w+\s+(.+)/i);
      if (!match) continue;

      const installLocation = match[1].trim();
      const found = firstExistingFile([
        path.join(installLocation, CLASSIC_DIR, CLASSIC_EXE),
        path.join(installLocation, CLASSIC_EXE)
      ]);
      if (found) return found;
    }
  }

  return null;
}

/** 3. Acceso directo del menú Inicio, que apunta al ejecutable real */
function findInStartMenuShortcuts() {
  const script = [
    '$dirs = @("$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs", "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs")',
    '$shell = New-Object -ComObject WScript.Shell',
    'Get-ChildItem $dirs -Recurse -Filter "*Minecraft*.lnk" -ErrorAction SilentlyContinue | ForEach-Object { $shell.CreateShortcut($_.FullName).TargetPath }'
  ].join('; ');

  const targets = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => path.basename(line).toLowerCase() === CLASSIC_EXE.toLowerCase());

  return firstExistingFile(targets);
}

/**
 * Busca el launcher clásico, de la comprobación más barata a la más cara.
 * @param {string} [customPath] - Ruta indicada manualmente (tiene prioridad)
 */
function detectClassicLauncher(customPath) {
  const launcherPath = existingFile(customPath)
    || findInCommonLocations()
    || findInRegistry()
    || findInStartMenuShortcuts();

  return {
    installed: Boolean(launcherPath),
    path: launcherPath
  };
}

function detectUwpLauncher() {
  for (const packageName of UWP_PACKAGE_NAMES) {
    const output = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Get-AppxPackage '${packageName}'`]);
    const match = output.match(/PackageFamilyName\s*:\s*(.+)/);
    if (match) {
      return {
        installed: true,
        familyName: match[1].trim()
      };
    }
  }

  return { installed: false };
}

module.exports = {
  detectClassicLauncher,
  detectUwpLauncher
};
