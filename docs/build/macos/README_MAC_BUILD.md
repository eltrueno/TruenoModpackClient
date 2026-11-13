# Trueno Modpack en macOS

Guía para compilar y probar la app en macOS. Si solo quieres instalarla, descarga el `.dmg` desde [Releases](https://github.com/eltrueno/TruenoModpackClient/releases/latest) y sigue las [instrucciones para usuarios](MAC_USERS_README.txt).

## Requisitos

- Un Mac: la build de macOS solo se puede generar en macOS
- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 20 LTS y npm

## Generar la build

```sh
./scripts/build/build-mac.sh
```

O directamente:

```sh
npm install
npm run make:mac
```

Para las dos arquitecturas a la vez, como hace el workflow de release:

```sh
npx electron-forge make --platform=darwin --arch=arm64,x64
./scripts/build/build-mac-distribution.sh
```

| Paso | Resultado |
|---|---|
| `make` | `.zip` de la app en `out/make/zip/darwin/<arquitectura>/` |
| `build-mac-distribution.sh` | `.dmg` y `.zip` con nombre legible en `dist/mac/`, más el `LEEME-MAC.txt` |

Hay una [checklist paso a paso](MAC_INSTALL_CHECKLIST.md) para generar y probar la app en un Mac sin improvisar.

## Firma y notarización

La app se distribuye **sin firmar**, así que Gatekeeper muestra un aviso la primera vez que se abre. Para firmarla y notarizarla, define estas variables antes de compilar (o como secrets del repositorio para el workflow):

```sh
export APPLE_IDENTITY="Developer ID Application: ..."
export APPLE_ID="tu-correo-apple"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID1234"
```

## Actualizaciones

La actualización automática en macOS exige una app firmada, así que por ahora la app **solo avisa**: al abrirla comprueba la última release y, si hay versión nueva, ofrece abrir la página de descarga.

## Detección de Minecraft

Carpeta de datos, en este orden (se usa la primera que parezca una carpeta de Minecraft real):

- `MINECRAFT_HOME`, si está definida
- `~/Library/Application Support/minecraft` (la ruta por defecto del launcher oficial)
- `~/Library/Application Support/.minecraft`
- `~/.minecraft`

Launcher oficial:

- `/Applications/Minecraft.app`
- `~/Applications/Minecraft.app`
- Una copia dentro de la carpeta de Minecraft detectada

Al pulsar **Abrir lanzador de Minecraft**, la app comprueba que el loader está instalado, actualiza el perfil del modpack y abre `Minecraft.app`.

## Pendiente de validar en un Mac real

- Que `Minecraft.app` respeta el `workDir` con el que se abre.
- Que el launcher muestra y deja seleccionado el perfil del modpack.
- Que una build firmada y notarizada se abre sin avisos.
