// launcherDetector.js
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Detectar Launcher UWP 
 */
function detectUwpLauncher() {
  const pfnList = [
    "Microsoft.4297127D64EC6",
    "Mojang.MinecraftLauncher"
  ];

  for (const pfn of pfnList) {
    try {
      const result = execSync(`powershell -command "Get-AppxPackage '${pfn}'"`, { stdio: 'pipe' })
        .toString()
        .trim();

      if (result.includes("PackageFamilyName")) {
        // Extraer el Package Family Name
        const match = result.match(/PackageFamilyName\s*:\s*(.+)/);
        if (match) {
          const familyName = match[1].trim();
          return {
            type: "uwp",
            familyName
          };
        }
      }
    } catch (_) {
      // No está esta variante, seguimos buscando
    }
  }

  return null;
}

/**
 * Detectar Launcher clásico .exe 
 */
function detectClassicLauncher() {
  const classicPaths = [
    path.join('C:', 'Program Files (x86)', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join('C:', 'Program Files', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Minecraft Launcher', 'MinecraftLauncher.exe')
  ];

  return classicPaths.find(fs.existsSync) || null;
}

function detectMinecraftLauncher() {
  const uwp = detectUwpLauncher();
  if (uwp) return uwp;

  const classic = detectClassicLauncher();
  if (classic) return { type: "classic", path: classic };

  return null;
}

function getMinecraftLaunchers() {
  let launchers = [];

  const uwp = detectUwpLauncher();
  if (uwp) launchers.push('uwp');

  const classic = detectClassicLauncher();
  if (classic) launchers.push('classic');

  return launchers;
}


function openMinecraftLauncher() {
  const detected = detectMinecraftLauncher();

  if (!detected) {
    console.error("❌ Ningún launcher detectado");
    return false;
  }

  if (detected.type === "uwp") {
    const appId = `${detected.familyName}!Minecraft`;

    console.log("🟦 Iniciando launcher UWP:", appId);
    exec(`explorer.exe shell:appsFolder\\${appId}`);
    return true;
  }

  if (detected.type === "classic") {
    console.log("🟩 Iniciando launcher clásico:", detected.path);
    const child = spawn(detected.path, [], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return true;
  }

  return false;
}

function openMinecraftLauncher(launcher) {
  const uwp = detectUwpLauncher();
  const classicPath = detectClassicLauncher();

  if (!uwp && !classic) return false;

  if (launcher === "uwp") {
    const appId = `${uwp.familyName}!Minecraft`;
    console.log("🟦 Iniciando launcher UWP:", appId);
    exec(`explorer.exe shell:appsFolder\\${appId}`);
    return true;
  }

  if (launcher === "classic") {
    console.log("🟩 Iniciando launcher clásico:", classicPath);
    const child = spawn(classicPath, [], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return true;
  }

  return false;
}

module.exports = {
  detectMinecraftLauncher,
  detectClassicLauncher,
  detectUwpLauncher,
  openMinecraftLauncher,
  getMinecraftLaunchers
};
