#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: build-mac.sh debe ejecutarse en macOS." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node no esta instalado." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm no esta instalado." >&2
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Error: Xcode Command Line Tools no estan instaladas." >&2
  exit 1
fi

ARCH="$(uname -m)"
ROLLUP_HOST_DIR=""
ESBUILD_HOST_DIR=""

case "$ARCH" in
  arm64)
    ROLLUP_HOST_DIR="node_modules/@rollup/rollup-darwin-arm64"
    ESBUILD_HOST_DIR="node_modules/@esbuild/darwin-arm64"
    ;;
  x86_64)
    ROLLUP_HOST_DIR="node_modules/@rollup/rollup-darwin-x64"
    ESBUILD_HOST_DIR="node_modules/@esbuild/darwin-x64"
    ;;
  *)
    echo "Error: arquitectura macOS no soportada: $ARCH" >&2
    exit 1
    ;;
esac

if [ -d node_modules ] && { [ ! -d "$ROLLUP_HOST_DIR" ] || [ ! -d "$ESBUILD_HOST_DIR" ]; }; then
  echo "Se han detectado dependencias generadas para otra plataforma."
  echo "Eliminando node_modules para reinstalar dependencias nativas de macOS..."
  rm -rf node_modules
fi

echo "Instalando dependencias de macOS..."
npm ci

echo "Generando build de macOS..."
npm run make:mac

echo "Build completada."
echo "Artefactos generados en:"
echo "  - out/make/zip/darwin/"
