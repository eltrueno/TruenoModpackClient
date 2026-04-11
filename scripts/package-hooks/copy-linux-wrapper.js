const fs = require('fs').promises;
const path = require('path');

module.exports = async (buildPath, _electronVersion, platform, _arch, done) => {
  try {
    if (platform !== 'linux') {
      done();
      return;
    }

    const sourcePath = path.resolve(__dirname, '..', 'linux', 'truenomodpackclient');
    const targetPath = path.join(buildPath, 'truenomodpackclient');

    await fs.copyFile(sourcePath, targetPath);
    await fs.chmod(targetPath, 0o755);
    done();
  } catch (error) {
    done(error);
  }
};
