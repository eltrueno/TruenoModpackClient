const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { ipcMain } = require('electron');

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

    async load() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = { ...this.defaultConfig, ...JSON.parse(data) };
            console.log('Configuración cargada:', this.config);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.config = { ...this.defaultConfig };
                await this.save();
                console.log('Configuración inicial creada');
            } else {
                console.error('Error al cargar configuración:', error);
                this.config = { ...this.defaultConfig };
            }
        }
        return this.config;
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
            if (!(k in obj)) obj[k] = {};
            obj = obj[k];
        }

        obj[lastKey] = value;
    }

    getAll() {
        return { ...this.config };
    }

    async reset() {
        this.config = { ...this.defaultConfig };
        await this.save();
    }
}

const configManager = new ConfigManager();
module.exports = configManager;

// Guardar al cerrar (sin preventDefault)
app.on('before-quit', async () => {
    await configManager.save();
});

// Salir cuando todas las ventanas están cerradas
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers
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
    configManager.config = newConfig;
    return true;
});