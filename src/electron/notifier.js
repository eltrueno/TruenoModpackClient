const { sendToWindow } = require('./window');
const channels = require('../shared/ipc-channels.json');

/**
 * Muestra un toast en la interfaz.
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {string} title
 * @param {string} message
 * @param {number} [duration] - Duración en ms
 */
function showToast(type, title, message, duration) {
  sendToWindow(channels.events.toast, { type, title, message, duration });
}

module.exports = { showToast };
