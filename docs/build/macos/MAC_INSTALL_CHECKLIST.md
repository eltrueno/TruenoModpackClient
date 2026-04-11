# Checklist de instalacion en macOS

Esta guia esta pensada para seguirse en un Mac paso a paso, sin improvisar.

## Antes de empezar

1. Tener `Minecraft Launcher` oficial instalado.
2. Abrir `Minecraft Launcher` una vez y cerrarlo.
3. Tener `Node.js 20 LTS` instalado.
4. Tener la carpeta del proyecto en el Mac.

## Generar la app del modpack

1. Abrir `Terminal`.
2. Entrar en la carpeta del proyecto.
3. Ejecutar:

```sh
chmod +x ./scripts/build/build-mac.sh
./scripts/build/build-mac.sh
```

4. Si falla, ejecutar:

```sh
npm install
npm run make:mac
```

## Abrir la app

1. Buscar la build generada dentro de `out/`.
2. Abrir la app del modpack.
3. Si macOS la bloquea:
   - clic derecho sobre la app y luego `Abrir`
   - o ir a `Ajustes del Sistema > Privacidad y seguridad > Abrir igualmente`

## Instalar el modpack

1. Esperar a que cargue la app.
2. Pulsar `Descargar e instalar`.
3. Esperar a que termine.

## Abrir Minecraft

1. Pulsar `Abrir lanzador de Minecraft`.
2. Esperar a que se abra `Minecraft Launcher`.
3. Buscar el perfil del modpack.
4. Confirmar que usa la version personalizada del modpack.
5. Pulsar `Play`.

## Comprobaciones si falla

1. Confirmar que existe alguna de estas rutas:
   - `/Applications/Minecraft.app`
   - `~/Applications/Minecraft.app`
2. Confirmar que existe esta carpeta:
   - `~/Library/Application Support/minecraft`
3. Si el perfil no aparece, revisar este archivo:
   - `~/Library/Application Support/minecraft/launcher_profiles.json`

## Orden mas seguro

1. Instalar Minecraft Launcher.
2. Abrirlo una vez.
3. Cerrarlo.
4. Generar la app del modpack.
5. Abrir la app del modpack.
6. Instalar modpack.
7. Abrir launcher desde la app.
8. Verificar el perfil.
9. Jugar.
