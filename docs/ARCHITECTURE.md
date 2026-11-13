# Arquitectura

El objetivo de esta estructura es que la lógica de la aplicación **no dependa de Electron**. Electron queda como una capa fina que se podría sustituir por otro runtime (por ejemplo, un backend en Rust) sin reescribir la interfaz ni rediseñar la lógica.

## Capas

```
┌──────────────────────────────────────────────────────────────┐
│ renderer/   Interfaz (Vue). Solo conoce window.modpackAPI,   │
│             window.appAPI, window.config y window.autoUpdater│
└──────────────────────────────▲───────────────────────────────┘
                               │  contrato IPC (shared/ipc-channels.json)
┌──────────────────────────────▼───────────────────────────────┐
│ preload.js  Expone el contrato a la interfaz                 │
│ electron/   Ventana, handlers IPC, toasts, actualizador, logs│
└──────────────────────────────▲───────────────────────────────┘
                               │  llamadas a funciones normales
┌──────────────────────────────▼───────────────────────────────┐
│ core/       Lógica pura. Solo Node (fs, path, child_process) │
│             y librerías sin Electron (axios, p-limit…)       │
└──────────────────────────────────────────────────────────────┘
```

`src/main.js` es el único sitio donde se juntan las dos capas: crea los servicios del core pasándoles lo que necesitan del entorno y registra los handlers IPC.

## `src/core`

| Carpeta | Contenido |
|---|---|
| `modpack/` | Servicio de modpacks: manifiesto remoto y local, cálculo de diferencias, instalación, verificación y desinstalación. |
| `minecraft/` | Ruta de `.minecraft`, detección y apertura del launcher, perfiles, loader y `options.txt`. |
| `download/` | Gestores de descarga en paralelo, adaptativos y por trozos. |
| `update/` | Comprobación de versiones en GitHub y actualización por paquete en Linux. |
| `config/` | `ConfigStore`: preferencias persistidas en un JSON. |
| `net/`, `utils/` | Cliente de releases de GitHub, agentes HTTP y utilidades de archivos. |
| `logger.js` | Fachada de log. Por defecto usa la consola; el anfitrión inyecta su implementación. |
| `system.js` | Memoria del equipo y comprobación de conexión. |

### Reglas del core

1. **No importa `electron`** ni librerías que solo funcionan dentro de Electron (`electron-log`, `electron-updater`…), ni nada de fuera de `src/core`.
2. **Recibe el entorno por parámetro.** Rutas (`userData`, `.minecraft`, carpeta temporal), versión de la app o preferencias llegan como argumentos; el core no las averigua.
3. **No conoce la interfaz.** No muestra toasts ni habla con la ventana. Devuelve resultados, lanza errores con `code` (`ModpackError`) e informa del progreso mediante callbacks.

La regla 1 se comprueba automáticamente:

```sh
npm run check:core
```

Como consecuencia, el core se puede ejecutar con Node a secas. Por ejemplo:

```js
const { createModpackService } = require('./src/core/modpack');

const modpacks = createModpackService({
  modpacksDir: '/tmp/modpacks',
  baseUrl: 'https://s3.truenomodpack.eltrueno.es',
  getMinecraftPath: () => '/home/yo/.minecraft',
  getPreference: (key) => ({ copyOptions: true, createProfile: true, maxRamMB: 8192 })[key]
});

await modpacks.installOrUpdate('depresivos2k25', (progress) => console.log(progress.stage));
```

## `src/electron`

| Archivo | Responsabilidad |
|---|---|
| `window.js` | Crea la ventana y envía eventos a la interfaz. |
| `ipc/` | Un archivo por dominio. Cada handler llama al core y decide qué toast mostrar. |
| `notifier.js` | Toasts. |
| `updater.js` | Actualización de la app: Squirrel en Windows, paquete en Linux, aviso en el resto. |
| `logger.js` | Implementación de log con `electron-log`. |

Los textos que ve el usuario en los toasts viven aquí, no en el core.

## Contrato IPC

`src/shared/ipc-channels.json` es la lista completa de canales entre la interfaz y el proceso principal. Lo leen tanto `electron/ipc/*` como `preload.js`, así que no hay nombres de canal repetidos a mano.

| Grupo | Dirección | Uso |
|---|---|---|
| `modpack`, `launcher`, `system`, `config`, `updater` | interfaz → principal | Peticiones (`invoke`) |
| `events` | principal → interfaz | Progreso, toasts, estado de conexión y eventos de actualización |

Este archivo es la frontera que tendría que respetar otro backend: si implementa los mismos canales con los mismos datos, la interfaz no necesita cambios.

## Cómo añadir una funcionalidad

1. Escribe la lógica en `src/core`, recibiendo por parámetro lo que necesite del entorno.
2. Añade el canal a `src/shared/ipc-channels.json`.
3. Registra el handler en `src/electron/ipc/` y exponlo en `src/preload.js`.
4. Úsalo desde la interfaz a través de `window.*`.

## Build

`main.js` carga `core/`, `electron/` y `shared/` con `require()` en tiempo de ejecución. Por eso `vite.main.config.mjs` no los empaqueta: los copia tal cual a `.vite/build/` junto al `main.js` compilado. `preload.js` sí se empaqueta en un único archivo, porque se ejecuta en un entorno aislado que no puede cargar módulos locales.
