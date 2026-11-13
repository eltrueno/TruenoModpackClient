const log = require('electron-log');
const path = require('path');
const { app } = require('electron');

// Configuración
log.transports.file.level = 'info'; // Nivel mínimo a guardar
log.transports.console.level = 'debug'; // Todo en consola durante desarrollo

// Ubicación del archivo de log
const logPath = path.join(app.getPath('userData'), 'logs', 'main.log');
log.transports.file.resolvePathFn = () => logPath;

// Formato personalizado
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Rotación de logs (mantener solo últimos 7 días)
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB por archivo
log.transports.file.archiveLogFn = (oldLogFile) => {
    const info = path.parse(oldLogFile.path);
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    return path.join(info.dir, `${info.name}.${timestamp}${info.ext}`);
};

// Capturar errores no manejados
log.catchErrors({
    showDialog: false,
    onError(error, versions, submitIssue) {
        log.error('Unhandled error:', error);
        log.error('Versions:', versions);
    }
});

// Exportar con métodos útiles
module.exports = {
    info: log.info.bind(log),
    warn: log.warn.bind(log),
    error: log.error.bind(log),
    debug: log.debug.bind(log),

    // Método para obtener ruta del log
    getLogPath: () => logPath,

    // Método para logging de descargas
    download: (message, data) => {
        log.info(`[DOWNLOAD] ${message}`, data || '');
    }
};