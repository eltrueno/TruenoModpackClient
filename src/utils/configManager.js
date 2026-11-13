const { app, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor() {
        this.config = {};
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        this.defaultConfig = {
            justUpdated: false,
            updateCooldownMinutes: 30,
            lastOpened: null,
            userPreferences: {
                copyOptions: true,
                createProfile: true,
                maxRamMB: 8192,
                preferedLauncher: "classic"
            }
        };
    }

    clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    mergeConfig(baseConfig, partialConfig) {
        if (!partialConfig || typeof partialConfig !== 'object' || Array.isArray(partialConfig)) {
            return this.clone(baseConfig);
        }

        const output = this.clone(baseConfig);

        for (const [key, value] of Object.entries(partialConfig)) {
            if (
                value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                output[key] &&
                typeof output[key] === 'object' &&
                !Array.isArray(output[key])
            ) {
                output[key] = this.mergeConfig(output[key], value);
            } else {
                output[key] = value;
            }
        }

        return output;
    }

    async load() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = this.mergeConfig(this.defaultConfig, JSON.parse(data));
            console.log('Configuración cargada:', this.config);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.config = this.clone(this.defaultConfig);
                await this.save();
                console.log('Configuración inicial creada');
            } else {
                console.error('Error al cargar configuración:', error);
                this.config = this.clone(this.defaultConfig);
            }
        }

        return this.getAll();
    }

    async save() {
        try {
            this.config.lastOpened = new Date().toISOString();
            const data = JSON.stringify(this.config, null, 2);
            await fs.writeFile(this.configPath, data, 'utf8');
            console.log('Configuración guardada');
            return true;
        } catch (error) {
            console.error('Error al guardar configuración:', error);
            return false;
        }
    }

    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
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
            if (!(k in obj) || typeof obj[k] !== 'object' || obj[k] === null) {
                obj[k] = {};
            }
            obj = obj[k];
        }

        obj[lastKey] = value;
    }

    getAll() {
        return this.clone(this.config);
    }

    setAll(newConfig) {
        this.config = this.mergeConfig(this.defaultConfig, newConfig);
        return this.getAll();
    }

    async reset() {
        this.config = this.clone(this.defaultConfig);
        await this.save();
        return this.getAll();
    }
}

const configManager = new ConfigManager();
module.exports = configManager;

ipcMain.handle('config:get', (event, key) => {
    return configManager.get(key);
});

ipcMain.handle('config:set', (event, key, value) => {
    configManager.set(key, value);
    return true;
});

ipcMain.handle('config:getAll', () => {
    return configManager.getAll();
});

ipcMain.handle('config:save', async () => {
    return await configManager.save();
});

ipcMain.handle('config:setAll', (event, newConfig) => {
    return configManager.setAll(newConfig);
});

ipcMain.handle('config:reset', async () => {
    return await configManager.reset();
});
