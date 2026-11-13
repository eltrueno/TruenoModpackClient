/**
 * Configuración óptima de concurrencia según plataforma
 * @returns {Object} Configuración con network, io y min concurrency
 */
function getOptimalConcurrency() {
    const platform = process.platform;

    if (platform === 'win32') {
        return {
            network: 40,  // Reducido para Windows
            io: 15,       // Windows tiene límites más bajos en I/O
            min: 8
        };
    } else if (platform === 'darwin') {
        return {
            network: 60,
            io: 25,
            min: 10
        };
    } else { // linux
        return {
            network: 80,
            io: 30,
            min: 15
        };
    }
}

module.exports = {
    getOptimalConcurrency
};
