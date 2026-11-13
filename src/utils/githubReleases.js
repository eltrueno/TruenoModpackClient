const axios = require('axios');

/**
 * Consulta de releases en GitHub para las plataformas en las que no se usa
 * electron-updater (Linux y macOS).
 */

function parseVersion(version) {
  const clean = String(version || '').trim().replace(/^v/i, '');
  const [core, prerelease = ''] = clean.split('-', 2);
  const parts = core.split('.').map((part) => parseInt(part, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return { parts, prerelease };
}

/**
 * Compara dos versiones tipo semver.
 * @returns {number} >0 si a es mayor que b, <0 si es menor, 0 si son iguales
 */
function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  for (let i = 0; i < Math.max(va.parts.length, vb.parts.length); i++) {
    const diff = (va.parts[i] || 0) - (vb.parts[i] || 0);
    if (diff !== 0) return diff;
  }

  // Una versión sin sufijo (1.0.0) es mayor que una prerelease (1.0.0-beta)
  if (va.prerelease && !vb.prerelease) return -1;
  if (!va.prerelease && vb.prerelease) return 1;
  return va.prerelease.localeCompare(vb.prerelease);
}

async function fetchLatestRelease(owner, repo) {
  const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    timeout: 10000,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'TruenoModpackClient'
    }
  });

  const release = response.data;
  return {
    version: String(release.tag_name || '').replace(/^v/i, ''),
    tag: release.tag_name,
    url: release.html_url,
    publishedAt: release.published_at,
    notes: release.body,
    assets: (release.assets || []).map((asset) => ({
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size,
      // "sha256:<hex>" (GitHub lo calcula al subir el asset); puede no venir
      digest: asset.digest || null
    }))
  };
}

const ARCH_ALIASES = {
  x64: ['amd64', 'x86_64', 'x64'],
  arm64: ['arm64', 'aarch64'],
  arm: ['armhf', 'armv7l', 'armv7hl'],
  ia32: ['i386', 'i686', 'ia32']
};

/**
 * Busca el paquete (.deb / .rpm) de una release para la arquitectura dada.
 */
function findLinuxPackageAsset(release, packageType, arch = process.arch) {
  const aliases = ARCH_ALIASES[arch] || [arch];
  const extension = `.${packageType}`;

  return release.assets.find((asset) => {
    const name = asset.name.toLowerCase();
    return name.endsWith(extension) && aliases.some((alias) => name.includes(alias));
  }) || null;
}

module.exports = {
  compareVersions,
  fetchLatestRelease,
  findLinuxPackageAsset
};
