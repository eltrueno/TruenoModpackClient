# Trueno Modpack en Linux

## Requisitos

- Un equipo Linux
- Node.js 20 LTS
- npm
- Minecraft Launcher instalado en Linux

## 1. Generar los paquetes de Linux

Abre una terminal en la carpeta del proyecto y ejecuta:

```sh
chmod +x ./scripts/build/build-linux.sh
./scripts/build/build-linux.sh
```

Tambien puedes lanzar el build directamente con:

```sh
npm run make:linux
```

Los instaladores se generan en:

```txt
out/make/deb/x64/truenomodpackclient_<version>_amd64.deb
out/make/rpm/x64/truenomodpackclient-<version>-1.x86_64.rpm
```

## 2. Instalar la app

En Debian, Ubuntu o derivadas:

```sh
sudo apt install ./out/make/deb/x64/truenomodpackclient_<version>_amd64.deb
```

En Fedora, Nobara o derivadas:

```sh
sudo dnf install ./out/make/rpm/x64/truenomodpackclient-<version>-1.x86_64.rpm
```

El paquete instala:

- un lanzador de escritorio `.desktop`
- icono de aplicacion
- el comando `truenomodpackclient` en `/usr/bin`

Ese comando ejecuta internamente el binario de Electron con `--no-sandbox`, para evitar el problema habitual de `chrome-sandbox` en muchas instalaciones Linux.

Si solo quieres probarla sin instalar el paquete, puedes usar:

```sh
npm start
```

En este proyecto, `npm start` ya aplica el workaround necesario para Linux cuando `chrome-sandbox` no tiene permisos SUID validos.

Si solo quieres probar el binario empaquetado local sin instalar el `.deb` o `.rpm`, puedes usar:

```sh
./scripts/build/run-linux.sh
```

## 3. Instalar el modpack

Cuando se abra la app:

1. Espera a que termine la comprobacion inicial.
2. Pulsa `Descargar e instalar`.
3. Espera a que termine la descarga y la instalacion.
4. Cuando el estado cambie a modpack instalado, pulsa `Abrir lanzador de Minecraft`.
5. La app intentara preparar automaticamente la version personalizada del modpack y dejar el perfil listo en el launcher.
6. En Minecraft Launcher, ejecuta el perfil del modpack si no arranca automaticamente.

## 4. Deteccion de Minecraft en Linux

La app intenta encontrar tanto la carpeta de Minecraft como el launcher oficial en rutas habituales de Linux.

Carpetas de Minecraft contempladas:

- `MINECRAFT_HOME` si esta definida
- `~/.minecraft`
- rutas XDG habituales bajo `~/.local/share` y `~/.config`
- instalaciones Flatpak bajo `~/.var/app/...`

Launchers detectados automaticamente:

- `minecraft-launcher`, `minecraft-launcher-beta` o `minecraft-launcher-msa` en `PATH`
- launcher oficial instalado localmente en `~/.minecraft/launcher/minecraft-launcher`
- variantes equivalentes en rutas XDG
- instalaciones Flatpak compatibles

Antes de abrir Minecraft Launcher, la app intenta dejar seleccionado el perfil del modpack y asegurar que exista la version personalizada.

## 5. Si algo falla

- Comprueba que Linux tiene conexion a internet.
- Comprueba que tienes instalado Minecraft Launcher.
- Si la app no arranca, ejecuta primero:

```sh
npm install
```

## Nota importante

- El auto-update en Linux esta desactivado.
- La instalacion del modpack si esta preparada para probarse en Linux.
- Los artefactos generados para Linux se dejaran en `out/make/`.
- El paquete recomendado para distribuir en Linux es el `.deb` o `.rpm`, no la carpeta `out/TruenoModpackClient-linux-x64/`.
