/**
 * Errores del servicio de modpacks. El "code" permite a la capa de
 * presentación decidir qué mostrar sin depender del texto del mensaje.
 */
const ERROR_CODES = {
  REMOTE_UNAVAILABLE: 'REMOTE_UNAVAILABLE',
  LOADER_INSTALL_FAILED: 'LOADER_INSTALL_FAILED',
  INSTALLATION_ACTIVE: 'INSTALLATION_ACTIVE'
};

class ModpackError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'ModpackError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

// Mensajes con los que se propaga una cancelación a través de las descargas
const CANCEL_MESSAGES = ['Installation cancelled', 'Download cancelled'];

function isCancellation(error) {
  return Boolean(error) && CANCEL_MESSAGES.includes(error.message);
}

module.exports = {
  ERROR_CODES,
  ModpackError,
  isCancellation
};
