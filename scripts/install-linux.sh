#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Newsdesk Linux installer

Usage: install-linux.sh [--repo owner/name] [--version vX.Y.Z] [--prefix DIR]

Options:
  --repo     GitHub repository that hosts releases (default: UA-99/newsdesk).
  --version  Specific tag to install (default: latest release).
  --prefix   Installation directory (default: $HOME/.local/share/newsdesk).

Requires: bash, curl, python3, chmod.
EOF
}

REPO="UA-99/newsdesk"
VERSION="latest"
PREFIX="$HOME/.local/share/newsdesk"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"; shift 2 ;;
    --version)
      VERSION="$2"; shift 2 ;;
    --prefix)
      PREFIX="$2"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

API_URL="https://api.github.com/repos/${REPO}/releases"
if [[ "$VERSION" == "latest" ]]; then
  RELEASE_URL="${API_URL}/latest"
else
  RELEASE_URL="${API_URL}/tags/${VERSION}"
fi

echo "Fetching release metadata (${VERSION})..."
JSON="$(curl -fsSL "$RELEASE_URL")"

ASSET_URL="$(python3 - "$JSON" <<'PY'
import json, sys
data = json.loads(sys.argv[1])
assets = data.get("assets") or []
for asset in assets:
    url = asset.get("browser_download_url", "")
    if url.endswith(".AppImage"):
        print(url)
        break
PY
)"

if [[ -z "$ASSET_URL" ]]; then
  echo "Could not find an AppImage asset in the selected release." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

APPIMAGE_PATH="${TMP_DIR}/newsdesk.AppImage"
echo "Downloading AppImage..."
curl -L "$ASSET_URL" -o "$APPIMAGE_PATH"
chmod +x "$APPIMAGE_PATH"

INSTALL_DIR="$PREFIX"
mkdir -p "$INSTALL_DIR"
cp "$APPIMAGE_PATH" "$INSTALL_DIR/Newsdesk.AppImage"

BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/Newsdesk.AppImage" "$BIN_DIR/newsdesk"

DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_DIR/newsdesk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Newsdesk
Exec=$BIN_DIR/newsdesk
Icon=newsdesk
Categories=Network;News;
Terminal=false
EOF

echo "Newsdesk installed to $INSTALL_DIR"
echo "Ensure $BIN_DIR is in your PATH."
