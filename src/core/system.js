const dns = require('dns');
const os = require('os');

const GIGABYTE = 1024 * 1024 * 1024;

/** Comprueba si hay conexión a internet resolviendo un dominio conocido */
function checkInternet(hostname = 'google.com') {
  return new Promise((resolve) => {
    dns.lookup(hostname, (error) => resolve(!error));
  });
}

function getRamInfo() {
  const totalGB = os.totalmem() / GIGABYTE;
  const freeGB = os.freemem() / GIGABYTE;

  return {
    totalGB: totalGB.toFixed(1),
    totalGBRounded: Math.round(totalGB),
    threeQuartersTotalGB: Math.round(totalGB * 0.75),
    freeGB: freeGB.toFixed(1)
  };
}

module.exports = {
  checkInternet,
  getRamInfo
};
