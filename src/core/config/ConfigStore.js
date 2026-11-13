const fs = require('fs').promises;
const logger = require('../logger');

const DEFAULT_CONFIG = {
    justUpdated: false,
    updateCooldownMinutes: 30,
    lastOpened: null,
    userPreferences: {
        copyOptions: true,
        createProfile: true,
        maxRamMB: 8192,
        preferedLauncher: 'classic'
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Mezcla en profundidad: los valores de partialConfig pisan los de baseConfig.
 */
function mergeConfig(baseConfig, partialConfig) {
    const output = clone(baseConfig);
    if (!isPlainObject(partialConfig)) return output;

    for (const [key, value] of Object.entries(partialConfig)) {
        output[key] = isPlainObject(value) && isPlainObject(output[key])
            ? mergeConfig(output[key], value)
            : value;
    }

    return output;
}

/**
 * Configuración de la aplicación persistida en un archivo JSON.
 * La ruta del archivo la decide quien crea el store.
 */
class ConfigStore {
    /**
     * @param {string} configPath - Ruta completa del archivo config.json
     */
    constructor(configPath) {
        this.configPath = configPath;
        this.defaultConfig = DEFAULT_CONFIG;
        this.config = clone(DEFAULT_CONFIG);
    }

    async load() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = mergeConfig(this.defaultConfig, JSON.parse(data));
            logger.info('Configuración cargada');
        } catch (error) {
            this.config = clone(this.defaultConfig);
            if (error.code === 'ENOENT') {
                await this.save();
                logger.info('Configuración inicial creada');
            } else {
                logger.error('Error al cargar configuración:', error);
            }
        }

        return this.getAll();
    }

    async save() {
        try {
            this.config.lastOpened = new Date().toISOString();
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            return true;
        } catch (error) {
            logger.error('Error al guardar configuración:', error);
            return false;
        }
    }

    /**
     * @param {string} key - Clave con puntos, p. ej. "userPreferences.maxRamMB"
     */
    get(key, defaultValue = null) {
        let value = this.config;

        for (const k of key.split('.')) {
            value = value?.[k];
            if (value === undefined) return defaultValue;
        }

        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let obj = this.config;

        for (const k of keys) {
            if (!isPlainObject(obj[k])) obj[k] = {};
            obj = obj[k];
        }

        obj[lastKey] = value;
    }

    getAll() {
        return clone(this.config);
    }

    setAll(newConfig) {
        this.config = mergeConfig(this.defaultConfig, newConfig);
        return this.getAll();
    }

    async reset() {
        this.config = clone(this.defaultConfig);
        await this.save();
        return this.getAll();
    }
}

module.exports = { ConfigStore, DEFAULT_CONFIG };
