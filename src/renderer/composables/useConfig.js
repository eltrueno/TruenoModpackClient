import { reactive, watch, toRefs } from 'vue';

const state = reactive({
    config: {},
    isLoading: true,
    isSaving: false
});

//let autoSaveTimeout = null;
let watchInitialized = false;

// Auto-guardar con debounce
/*function scheduleAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

    autoSaveTimeout = setTimeout(async () => {
        // Sincronizar TODO el estado primero
        await window.config.setAll(JSON.parse(JSON.stringify(state.config)));
        await window.config.save();
        console.log('Auto-guardado completado');
    }, 1000);
}*/

// Cargar configuración inicial
async function initConfig() {
    try {
        state.isLoading = true;
        state.config = await window.config.getAll();
    } catch (error) {
        console.error('Error cargando config:', error);
    } finally {
        state.isLoading = false;
    }

    // Watcher para detectar cambios en la configuración
    // Inicializar el watcher solo una vez
    /*if (!watchInitialized) {
        watch(() => state.config, () => {
            if (!state.isLoading) {
                scheduleAutoSave();
            }
        }, { deep: true });
        watchInitialized = true;
    }*/
    if (!watchInitialized) {
        watch(() => state.config, () => {
            if (!state.isLoading) {
                // Solo sincronizar en memoria, no guardar a disco
                const plainConfig = JSON.parse(JSON.stringify(state.config));
                window.config.setAll(plainConfig);
            }
        }, { deep: true });
        watchInitialized = true;
    }
}

export function useConfig() {
    // Setter reactivo
    async function set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let obj = state.config;

        for (const k of keys) {
            if (!(k in obj)) obj[k] = {};
            obj = obj[k];
        }

        obj[lastKey] = value;

        // Sincronizar con main process inmediatamente
        await window.config.set(key, value);
    }

    // Getter reactivo
    function get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = state.config;

        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) return defaultValue;
        }

        return value;
    }

    // Guardar manualmente
    async function saveConfig() {
        try {
            state.isSaving = true;
            // IMPORTANTE: Sincronizar todo el estado antes de guardar
            await window.config.setAll(JSON.parse(JSON.stringify(state.config)));
            await window.config.save();
            console.log('Configuración guardada');
        } catch (error) {
            console.error('Error guardando config:', error);
        } finally {
            state.isSaving = false;
        }
    }

    // Resetear configuración
    async function reset() {
        try {
            state.config = await window.config.reset();
        } catch (error) {
            console.error('Error reseteando config:', error);
        }
    }

    return {
        ...toRefs(state),
        config: state.config, // Objeto reactivo directo
        set,
        get,
        save: saveConfig,
        reset,
        init: initConfig
    };
}