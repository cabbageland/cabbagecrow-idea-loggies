#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="CabbageCrow.app"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/$APP_NAME"
RELEASE_DIR="${1:-$ROOT_DIR/dist-release}"
ZIP_PATH="$RELEASE_DIR/CabbageCrow-macOS.zip"
ZERO_FINDER_INFO="0000000000000000000000000000000000000000000000000000000000000000"

clear_finder_info() {
  local target="$1"

  if xattr -px com.apple.FinderInfo "$target" >/dev/null 2>&1; then
    xattr -wx com.apple.FinderInfo "$ZERO_FINDER_INFO" "$target" 2>/dev/null || true
  fi
}

cd "$ROOT_DIR"

npm run tauri:build

if [[ ! -d "$APP_PATH" ]]; then
  echo "Expected app bundle at $APP_PATH" >&2
  exit 1
fi

xattr -cr "$APP_PATH" || true
clear_finder_info "$APP_PATH"

if ! codesign --verify --deep --strict --verbose=4 "$APP_PATH"; then
  codesign --force --deep --sign - "$APP_PATH"
  xattr -cr "$APP_PATH" || true
  clear_finder_info "$APP_PATH"
  codesign --verify --deep --strict --verbose=4 "$APP_PATH"
fi

mkdir -p "$RELEASE_DIR"
rm -f "$ZIP_PATH"
ditto --noextattr --noqtn -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

VERIFY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cabbagecrow-release-verify.XXXXXX")"
trap 'rm -rf "$VERIFY_DIR"' EXIT

ditto -x -k "$ZIP_PATH" "$VERIFY_DIR"
codesign --verify --deep --strict --verbose=4 "$VERIFY_DIR/$APP_NAME"
shasum -a 256 "$ZIP_PATH"
