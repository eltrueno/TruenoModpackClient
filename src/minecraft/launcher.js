const { execFileSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getMinecraftPath } = require('./common.js');

function commandExists(command, args = ['--version']) {
  try {
    const result = spawnSync(command, args, { stdio: 'ignore' });
    return !result.error;
  } catch (_) {
    return false;
  }
}

function firstExistingPath(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) || null;
}

function getLinuxLauncherBinaryCandidates(minecraftPath) {
  const homePath = os.homedir();
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homePath, '.local', 'share');

  return [
    path.join(minecraftPath, 'launcher', 'minecraft-launcher'),
    path.join(homePath, '.minecraft', 'launcher', 'minecraft-launcher'),
    path.join(xdgDataHome, 'Minecraft Launcher', 'minecraft-launcher'),
    path.join(xdgDataHome, 'minecraft-launcher', 'minecraft-launcher'),
    path.join(homePath, 'Descargas', 'Minecraft', 'minecraft-launcher', 'minecraft-launcher'),
    path.join(homePath, 'Downloads', 'Minecraft', 'minecraft-launcher', 'minecraft-launcher')
  ];
}

function getLinuxFlatpakIds() {
  return [
    'com.mojang.Minecraft',
    'com.mojang.MinecraftLauncher'
  ];
}

function detectWindowsUwpLauncher() {
  const pfnList = [
    'Microsoft.4297127D64EC6',
    'Mojang.MinecraftLauncher'
  ];

  for (const pfn of pfnList) {
    try {
      const result = execFileSync('powershell', ['-command', `Get-AppxPackage '${pfn}'`], { stdio: 'pipe' })
        .toString()
        .trim();

      if (!result.includes('PackageFamilyName')) continue;

      const match = result.match(/PackageFamilyName\s*:\s*(.+)/);
      if (match) {
        return {
          installed: true,
          familyName: match[1].trim()
        };
      }
    } catch (_) {
      // Intentamos con la siguiente variante.
    }
  }

  return { installed: false };
}

function detectWindowsClassicLauncher() {
  const classicPath = firstExistingPath([
    path.join('C:', 'Program Files (x86)', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join('C:', 'Program Files', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join('D:', 'Program Files (x86)', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join('D:', 'Program Files', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Minecraft Launcher', 'MinecraftLauncher.exe')
  ]);

  return {
    installed: Boolean(classicPath),
    path: classicPath
  };
}

function detectMacOsLauncher() {
  const minecraftPath = getMinecraftPath();
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

function detectLinuxLauncher() {
  const minecraftPath = getMinecraftPath();

  const nativeCommand = ['minecraft-launcher', 'minecraft-launcher-beta', 'minecraft-launcher-msa']
    .find((command) => commandExists(command));

  if (nativeCommand) {
    return {
      installed: true,
      command: nativeCommand,
      args: ['--workDir', minecraftPath],
      minecraftPath,
      type: 'native'
    };
  }

  const localLauncherPath = firstExistingPath(getLinuxLauncherBinaryCandidates(minecraftPath));

  if (localLauncherPath) {
    return {
      installed: true,
      command: localLauncherPath,
      args: ['--workDir', minecraftPath],
      cwd: path.dirname(localLauncherPath),
      minecraftPath,
      type: 'local-binary'
    };
  }

  if (commandExists('flatpak')) {
    for (const flatpakId of getLinuxFlatpakIds()) {
      if (commandExists('flatpak', ['info', flatpakId])) {
        return {
          installed: true,
          command: 'flatpak',
          args: ['run', flatpakId, '--workDir', minecraftPath],
          minecraftPath,
          type: 'flatpak'
        };
      }
    }
  }

  return { installed: false };
}

function getLauncherDefinitions() {
  switch (process.platform) {
    case 'win32':
      return [
        {
          id: 'classic',
          label: 'Oficial Clasico',
          description: '(.exe)',
          detect: detectWindowsClassicLauncher,
          open: (details) => {
            const child = spawn(details.path, [], {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            return true;
          }
        },
        {
          id: 'uwp',
          label: 'Oficial Windows App',
          description: '(uwp)',
          detect: detectWindowsUwpLauncher,
          open: (details) => {
            const appId = `${details.familyName}!Minecraft`;
            const child = spawn('explorer.exe', [`shell:appsFolder\\${appId}`], {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            return true;
          }
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
            const openArgs = ['-a', details.appPath];

            if (details.minecraftPath) {
              openArgs.push('--args', '--workDir', details.minecraftPath);
            }

            const child = spawn('open', openArgs, {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            return true;
          }
        }
      ];

    default:
      return [
        {
          id: 'linux-launcher',
          label: 'Minecraft Launcher',
          description: '(cualquier ocifial)',
          detect: detectLinuxLauncher,
          open: (details) => {
            if (details.type === 'flatpak') {
              const child = spawn(details.command, details.args || [], {
                detached: true,
                stdio: 'ignore'
              });
              child.unref();
              return true;
            }

            const child = spawn(details.command, details.args || [], {
              cwd: details.cwd,
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            return true;
          }
        }
      ];
  }
}

function getMinecraftLaunchers() {
  return {
    platform: process.platform,
    launchers: getLauncherDefinitions().map((definition) => {
      const detected = definition.detect();

      return {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        installed: Boolean(detected.installed)
      };
    })
  };
}

function openMinecraftLauncher(launcherId) {
  const definition = getLauncherDefinitions().find((item) => item.id === launcherId);
  if (!definition) return false;

  const detected = definition.detect();
  if (!detected.installed) return false;

  try {
    return definition.open(detected);
  } catch (_) {
    return false;
  }
}

module.exports = {
  openMinecraftLauncher,
  getMinecraftLaunchers
};
