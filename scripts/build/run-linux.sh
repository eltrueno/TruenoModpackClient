#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BINARY="$PROJECT_DIR/out/TruenoModpackClient-linux-x64/TruenoModpack"

if [ ! -x "$BINARY" ]; then
  echo "Error: no se encontro el binario Linux en $BINARY" >&2
  echo "Generalo primero con ./scripts/build/build-linux.sh o npm run make -- --platform=linux" >&2
  exit 1
fi

exec "$BINARY" --no-sandbox "$@"
