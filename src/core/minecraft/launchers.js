const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const logger = require('../logger');
const windowsLauncher = require('./windows-launcher');

/**
 * Detección y apertura del launcher oficial de Minecraft en cada sistema.
 *
 * Las funciones públicas reciben un contexto:
 *   { minecraftPath, platform?, classicLauncherPath? }
 */

function commandExists(command, args = ['--version']) {
  try {
    const result = spawnSync(command, args, { stdio: 'ignore' });
    return !result.error && result.status === 0;
  } catch (_) {
    return false;
  }
}

function firstExistingPath(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) || null;
}

function spawnDetached(command, args, options = {}) {
  const child = spawn(command, args, { ...options, detached: true, stdio: 'ignore' });
  child.on('error', (error) => logger.error('Error lanzando el launcher:', error));
  child.unref();
  return true;
}

// ---------------------------------------------------------------- macOS

function detectMacOsLauncher({ minecraftPath }) {
  const appPath = firstExistingPath([
    '/Applications/Minecraft.app',
    path.join(os.homedir(), 'Applications', 'Minecraft.app'),
    path.join(minecraftPath, 'launcher', 'Minecraft.app')
  ]);

  return {
    installed: Boolean(appPath),
    appPath,
    minecraftPath
  };
}

// ---------------------------------------------------------------- Linux

const LINUX_COMMANDS = ['minecraft-launcher', 'minecraft-launcher-beta', 'minecraft-launcher-msa'];
const LINUX_FLATPAK_IDS = ['com.mojang.Minecraft', 'com.mojang.MinecraftLauncher'];

function getLinuxBinaryCandidates(minecraftPath) {
  const home = os.homedir();
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');

  return [
    path.join(minecraftPath, 'launcher', 'minecraft-launcher'),
    path.join(home, '.minecraft', 'launcher', 'minecraft-launcher'),
    path.join(xdgDataHome, 'Minecraft Launcher', 'minecraft-launcher'),
    path.join(xdgDataHome, 'minecraft-launcher', 'minecraft-launcher'),
    path.join(home, 'Descargas', 'Minecraft', 'minecraft-launcher', 'minecraft-launcher'),
    path.join(home, 'Downloads', 'Minecraft', 'minecraft-launcher', 'minecraft-launcher')
  ];
}

function detectLinuxLauncher({ minecraftPath }) {
  const workDirArgs = ['--workDir', minecraftPath];

  const nativeCommand = LINUX_COMMANDS.find((command) => commandExists('sh', ['-c', `command -v ${command}`]));
  if (nativeCommand) {
    return { installed: true, command: nativeCommand, args: workDirArgs };
  }

  const localBinary = firstExistingPath(getLinuxBinaryCandidates(minecraftPath));
  if (localBinary) {
    return { installed: true, command: localBinary, args: workDirArgs, cwd: path.dirname(localBinary) };
  }

  if (commandExists('flatpak')) {
    const flatpakId = LINUX_FLATPAK_IDS.find((id) => commandExists('flatpak', ['info', id]));
    if (flatpakId) {
      return { installed: true, command: 'flatpak', args: ['run', flatpakId, ...workDirArgs] };
    }
  }

  return { installed: false };
}

// ---------------------------------------------------------------- Definiciones

function getLauncherDefinitions(platform) {
  switch (platform) {
    case 'win32':
      return [
        {
          id: 'classic',
          label: 'Oficial Clásico',
          description: '(.exe)',
          detect: (context) => windowsLauncher.detectClassicLauncher(context.classicLauncherPath),
          open: (details) => spawnDetached(details.path, [])
        },
        {
          id: 'uwp',
          label: 'Oficial Windows App',
          description: '(Microsoft Store)',
          detect: () => windowsLauncher.detectUwpLauncher(),
          open: (details) => spawnDetached('explorer.exe', [`shell:appsFolder\\${details.familyName}!Minecraft`])
        }
      ];

    case 'darwin':
      return [
        {
          id: 'macos-app',
          label: 'Minecraft.app',
          description: '(oficial)',
          detect: detectMacOsLauncher,
          open: (details) => {
            const args = ['-a', details.appPath];
            if (details.minecraftPath) args.push('--args', '--workDir', details.minecraftPath);
            return spawnDetached('open', args);
          }
        }
      ];

    default:
      return [
        {
          id: 'linux-launcher',
          label: 'Minecraft Launcher',
          description: '(oficial)',
          detect: detectLinuxLauncher,
          open: (details) => spawnDetached(details.command, details.args || [], { cwd: details.cwd })
        }
      ];
  }
}

// ---------------------------------------------------------------- API pública

/**
 * Lista los launchers soportados en esta plataforma y si están instalados.
 * @param {{minecraftPath: string, platform?: string, classicLauncherPath?: string}} context
 */
function getMinecraftLaunchers(context) {
  const platform = context.platform || process.platform;

  return {
    platform,
    launchers: getLauncherDefinitions(platform).map((definition) => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      installed: Boolean(definition.detect(context).installed)
    }))
  };
}

/**
 * Abre el launcher indicado.
 * @returns {boolean} true si se ha podido lanzar
 */
function openMinecraftLauncher(launcherId, context) {
  const platform = context.platform || process.platform;
  const definition = getLauncherDefinitions(platform).find((item) => item.id === launcherId);
  if (!definition) return false;

  try {
    const detected = definition.detect(context);
    if (!detected.installed) return false;
    return definition.open(detected);
  } catch (error) {
    logger.error('Error abriendo el launcher:', error);
    return false;
  }
}

module.exports = {
  openMinecraftLauncher,
  getMinecraftLaunchers
};
