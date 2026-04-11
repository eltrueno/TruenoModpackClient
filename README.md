# TruenoModpackClient

Cliente de escritorio para instalar, actualizar y abrir modpacks de Minecraft con Electron, Vite y Vue.

## Estructura

- `src/`: codigo fuente de Electron, launcher, descargas y renderer Vue
- `public/`: assets estaticos
- `scripts/`: utilidades del proyecto
- `scripts/build/`: wrappers y scripts de empaquetado multiplataforma
- `scripts/linux/`: wrapper usado por el paquete Linux
- `packaging/`: plantillas y scripts de empaquetado para Linux
- `docs/build/`: documentacion de build y distribucion por plataforma

## Build

- Linux: [docs/build/linux/README_LINUX_BUILD.md](docs/build/linux/README_LINUX_BUILD.md)
- macOS: [docs/build/macos/README_MAC_BUILD.md](docs/build/macos/README_MAC_BUILD.md)
- Checklist macOS: [docs/build/macos/MAC_INSTALL_CHECKLIST.md](docs/build/macos/MAC_INSTALL_CHECKLIST.md)

## Notas

- Los artefactos generados (`dist/`, `out/`, `__MACOSX/`) no deben versionarse.
- Los wrappers movidos desde la raiz siguen siendo funcionales desde `scripts/build/`.
