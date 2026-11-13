const githubReleases = require('../net/githubReleases');

/**
 * Comprueba en GitHub si hay una versión más nueva que la instalada.
 *
 * @param {object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.currentVersion
 * @param {'deb'|'rpm'} [options.packageType] - Si se indica, busca además el
 *        paquete de Linux de ese tipo para poder instalarlo automáticamente
 * @param {string} [options.arch]
 * @returns {Promise<{available: boolean, version?: string, url?: string,
 *           publishedAt?: string, notes?: string, asset?: object|null}>}
 */
async function findUpdate({ owner, repo, currentVersion, packageType, arch = process.arch }) {
  const release = await githubReleases.fetchLatestRelease(owner, repo);

  if (!release.version || githubReleases.compareVersions(release.version, currentVersion) <= 0) {
    return { available: false };
  }

  return {
    available: true,
    version: release.version,
    url: release.url,
    publishedAt: release.publishedAt,
    notes: release.notes,
    asset: packageType ? githubReleases.findLinuxPackageAsset(release, packageType, arch) : null
  };
}

module.exports = { findUpdate };
