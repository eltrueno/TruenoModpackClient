/**
 * Logger del core. No depende de ninguna librería concreta: por defecto
 * escribe en consola y la aplicación anfitriona puede sustituir la
 * implementación con setLogger() (en Electron, electron-log).
 */

let implementation = console;

function setLogger(logger) {
    implementation = logger || console;
}

module.exports = {
    setLogger,
    info: (...args) => implementation.info(...args),
    warn: (...args) => implementation.warn(...args),
    error: (...args) => implementation.error(...args),
    debug: (...args) => (implementation.debug || implementation.info).apply(implementation, args)
};
