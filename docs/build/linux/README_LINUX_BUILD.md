# Trueno Modpack en Linux

Guía para compilar y probar la app en Linux. Si solo quieres instalarla, descarga el `.deb` o el `.rpm` desde [Releases](https://github.com/eltrueno/TruenoModpackClient/releases/latest).

## Requisitos

- Node.js 20 LTS y npm
- Para generar los paquetes: `dpkg`, `fakeroot` y `rpm`

  ```sh
  sudo apt install dpkg dpkg-dev fakeroot rpm
  ```

- El launcher oficial de Minecraft, para probar la app

## Generar los paquetes

```sh
./scripts/build/build-linux.sh
```

O directamente:

```sh
npm install
npm run make:linux
```

Los paquetes quedan en:

```txt
out/make/deb/x64/truenomodpackclient_<versión>_amd64.deb
out/make/rpm/x64/truenomodpackclient-<versión>-1.x86_64.rpm
```

## Instalar

Debian, Ubuntu y derivadas:

```sh
sudo apt install ./out/make/deb/x64/truenomodpackclient_<versión>_amd64.deb
```

Fedora, Nobara y derivadas:

```sh
sudo dnf install ./out/make/rpm/x64/truenomodpackclient-<versión>-1.x86_64.rpm
```

El paquete instala un lanzador de escritorio, el icono y el comando `truenomodpackclient` en `/usr/bin`.

> Ese comando ejecuta el binario de Electron con `--no-sandbox`, para evitar el problema habitual de permisos de `chrome-sandbox` en muchas distribuciones.

## Probar sin instalar

| Qué | Comando |
|---|---|
| Modo desarrollo | `npm start` (aplica el mismo ajuste de sandbox) |
| Binario empaquetado en `out/` | `./scripts/build/run-linux.sh` |

## Actualizaciones

| Instalación | Comportamiento |
|---|---|
| Desde `.deb` o `.rpm` | La app descarga el paquete nuevo de la release, comprueba su hash y lo instala con el gestor de paquetes. El sistema pide tu contraseña con `pkexec`. Después se reinicia sola. |
| Sin paquete (binario suelto, modo desarrollo) | Solo avisa de que hay versión nueva y abre la página de descarga. |

Si cancelas la contraseña o la instalación falla, la app sigue funcionando y te ofrece la descarga manual.

## Detección de Minecraft

Carpeta de datos, en este orden (se usa la primera que parezca un `.minecraft` real):

- `MINECRAFT_HOME`, si está definida
- `~/.minecraft`
- `~/.local/share/minecraft` y `~/.config/minecraft` (o las rutas XDG configuradas)
- Instalaciones Flatpak bajo `~/.var/app/com.mojang.Minecraft*`

Launcher oficial:

- `minecraft-launcher`, `minecraft-launcher-beta` o `minecraft-launcher-msa` en el `PATH`
- Binario local en `~/.minecraft/launcher/` o en las rutas XDG equivalentes
- Flatpak `com.mojang.Minecraft` o `com.mojang.MinecraftLauncher`

Antes de abrir el launcher, la app comprueba que el loader está instalado y deja el perfil del modpack actualizado.

## Si algo falla

- Revisa el registro en `~/.config/Trueno Modpack/logs/main.log`.
- Comprueba que el launcher oficial está instalado y que lo has abierto al menos una vez.
- Si la app no arranca en desarrollo, ejecuta `npm install` de nuevo.
