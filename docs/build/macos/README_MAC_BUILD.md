# Trueno Modpack en macOS

## Objetivo

Dejar una build de macOS lo mas facil y generica posible para usuarios de Minecraft Launcher en Mac.

## Estado actual

El proyecto ya queda preparado para macOS en estos puntos:

- deteccion de la carpeta de Minecraft en rutas habituales de macOS
- deteccion de `Minecraft.app` en `/Applications` y `~/Applications`
- preparacion automatica del perfil del modpack en `launcher_profiles.json`
- scripts de build para `package:mac` y `make:mac`

## Rutas de Minecraft contempladas

La app intenta localizar Minecraft en este orden:

- `MINECRAFT_HOME` si existe
- `~/Library/Application Support/minecraft`
- `~/Library/Application Support/.minecraft`
- `~/.minecraft`

La ruta por defecto usada por el launcher oficial de macOS es:

```txt
~/Library/Application Support/minecraft
```

## Launcher contemplado

La app intenta detectar el launcher oficial en:

- `/Applications/Minecraft.app`
- `~/Applications/Minecraft.app`
- una copia local bajo la carpeta detectada de Minecraft

Cuando se pulsa `Abrir lanzador de Minecraft`, la app intenta:

1. preparar la version personalizada del modpack
2. actualizar el perfil del launcher
3. abrir `Minecraft.app`

## Generar la build

La build final de macOS debe generarse en un Mac.

Desde un Mac con Xcode Command Line Tools, Node.js 20 LTS y npm:

```sh
chmod +x ./scripts/build/build-mac.sh
./scripts/build/build-mac.sh
```

O si prefieres lanzar el build directamente:

```sh
npm install
npm run make:mac
```

O para obtener solo la app empaquetada:

```sh
npm run package:mac
```

El artefacto actual configurado es un `.zip` de macOS.

## Distribucion recomendada

Para distribuirla de forma seria en macOS hace falta:

- firmar la app
- notarizarla
- probarla en un Mac limpio

La configuracion de Forge ya admite firma y notarizacion si se exportan estas variables:

```sh
export APPLE_IDENTITY="Developer ID Application: ..."
export APPLE_ID="tu-correo-apple"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID1234"
```

Sin firma y notarizacion, Gatekeeper puede advertir o bloquear la apertura en muchos equipos.

## Validacion pendiente

Esta preparacion deja la base lista en el codigo, pero sigue faltando validacion real en un Mac para confirmar:

- que `Minecraft.app` acepta correctamente el arranque con el `workDir` esperado
- que el launcher deja visible y seleccionada la version personalizada del modpack
- que la build firmada y notarizada se abre sin friccion
