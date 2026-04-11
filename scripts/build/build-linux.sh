#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node no esta instalado." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm no esta instalado." >&2
  exit 1
fi

echo "Instalando dependencias..."
npm install

echo "Generando paquetes de Linux..."
npm run make:linux

echo "Build completada."
echo "Paquetes generados en:"
echo "  - out/make/deb/x64/"
echo "  - out/make/rpm/x64/"
