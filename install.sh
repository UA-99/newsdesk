#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

INSTALL_DEPS=1
BUILD_DIST=1

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Installs Newsdesk's dependencies and builds platform distributables.

Options:
  --skip-build    Install dependencies only.
  --only-build    Rebuild distributables without reinstalling dependencies.
  -h, --help      Show this help message.
EOF
}

log() {
  printf "\n==> %s\n" "$1"
}

err() {
  echo "Error: $1" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "$1 is required but was not found in PATH."
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      BUILD_DIST=0
      shift
      ;;
    --only-build)
      INSTALL_DEPS=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown option: $1"
      ;;
  esac
done

require_cmd node
require_cmd npm

NODE_VERSION="$(node --version | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
REQUIRED_MAJOR=20
if [[ "$NODE_MAJOR" -lt "$REQUIRED_MAJOR" ]]; then
  err "Node.js ${REQUIRED_MAJOR}+ is required (detected ${NODE_VERSION})."
fi

if [[ "$INSTALL_DEPS" -eq 1 ]]; then
  log "Installing dependencies via npm ci"
  npm ci
fi

if [[ "$BUILD_DIST" -eq 1 ]]; then
  log "Building distributables with electron-builder"
  npm run dist -- --publish never
  log "Build artifacts ready under dist/"
fi

if [[ "$INSTALL_DEPS" -eq 0 && "$BUILD_DIST" -eq 0 ]]; then
  log "Nothing to do."
fi
