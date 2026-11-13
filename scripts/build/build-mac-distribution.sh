#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: build-mac-distribution.sh debe ejecutarse en macOS." >&2
  exit 1
fi

if ! command -v hdiutil >/dev/null 2>&1; then
  echo "Error: hdiutil no esta disponible en este sistema." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
PRODUCT_NAME="TruenoModpackClient"
DISPLAY_NAME="Trueno Modpack"
DIST_DIR="$PROJECT_DIR/dist/mac"
TMP_DIR="$PROJECT_DIR/.tmp-dmg"

rm -rf "$DIST_DIR" "$TMP_DIR"
mkdir -p "$DIST_DIR" "$TMP_DIR"

build_arch() {
  ARCH="$1"
  APP_DIR="$PROJECT_DIR/out/${PRODUCT_NAME}-darwin-${ARCH}"
  APP_PATH="$APP_DIR/${PRODUCT_NAME}.app"
  ZIP_PATH="$PROJECT_DIR/out/make/zip/darwin/${ARCH}/${PRODUCT_NAME}-darwin-${ARCH}-${VERSION}.zip"
  STAGE_DIR="$TMP_DIR/${ARCH}"
  DMG_NAME="Trueno-Modpack-macOS-${ARCH}-${VERSION}.dmg"
  DMG_PATH="$DIST_DIR/$DMG_NAME"
  ZIP_OUT="$DIST_DIR/Trueno-Modpack-macOS-${ARCH}-${VERSION}.zip"

  if [ ! -d "$APP_PATH" ]; then
    echo "Error: no existe la app para ${ARCH} en $APP_PATH" >&2
    exit 1
  fi

  if [ ! -f "$ZIP_PATH" ]; then
    echo "Error: no existe el zip para ${ARCH} en $ZIP_PATH" >&2
    exit 1
  fi

  mkdir -p "$STAGE_DIR"
  cp -R "$APP_PATH" "$STAGE_DIR/$DISPLAY_NAME.app"
  ln -s /Applications "$STAGE_DIR/Applications"

  cp "$ZIP_PATH" "$ZIP_OUT"

  hdiutil create \
    -volname "$DISPLAY_NAME" \
    -srcfolder "$STAGE_DIR" \
    -ov \
    -format UDZO \
    "$DMG_PATH" >/dev/null
}

build_arch "arm64"

if [ -d "$PROJECT_DIR/out/${PRODUCT_NAME}-darwin-x64/${PRODUCT_NAME}.app" ] && [ -f "$PROJECT_DIR/out/make/zip/darwin/x64/${PRODUCT_NAME}-darwin-x64-${VERSION}.zip" ]; then
  build_arch "x64"
fi

cp "$PROJECT_DIR/docs/build/macos/MAC_USERS_README.txt" "$DIST_DIR/LEEME-MAC.txt"

echo "Distribucion macOS creada en:"
echo "  - $DIST_DIR"
