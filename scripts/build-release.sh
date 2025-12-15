#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Newsdesk release packager

Usage: build-release.sh [--skip-install]

Builds the Electron bundles (AppImage + tarball) via electron-builder and copies
the resulting artifacts into release/<version>. A SHA256SUMS file is generated
for convenience when uploading assets to UA-99/newsdesk releases.

Options:
  --skip-install  Assume dependencies are already installed, skip npm install.
EOF
}

SKIP_INSTALL="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to build releases." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM_CMD=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  CHECKSUM_CMD=(shasum -a 256)
else
  echo "sha256sum or shasum is required to generate checksums." >&2
  exit 1
fi

if [[ "$SKIP_INSTALL" != "true" ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building distributables via electron-builder..."
npx electron-builder --linux AppImage tar.gz --publish never

VERSION="$(node -p "require('./package.json').version")"
RELEASE_DIR="$ROOT_DIR/release/$VERSION"
mkdir -p "$RELEASE_DIR"

shopt -s nullglob
ARTIFACTS=()
for asset in dist/*.AppImage dist/*.tar.gz; do
  cp "$asset" "$RELEASE_DIR/"
  ARTIFACTS+=("$RELEASE_DIR/$(basename "$asset")")
done
shopt -u nullglob

if [[ "${#ARTIFACTS[@]}" -eq 0 ]]; then
  echo "No distributable artifacts were produced." >&2
  exit 1
fi

echo "Writing checksums..."
(cd "$RELEASE_DIR" && "${CHECKSUM_CMD[@]}" "${ARTIFACTS[@]##*/}" > SHA256SUMS)

echo "Release assets written to $RELEASE_DIR:"
for artifact in "${ARTIFACTS[@]}"; do
  echo "  - $(basename "$artifact")"
done
echo "  - SHA256SUMS"
