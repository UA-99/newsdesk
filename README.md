# Newsdesk

Desktop RSS reader built with Electron. Provides:

- Unified list of configured news sources
- Reader mode toggle with ad blocking
- Sidebar controls to filter/search feeds and customize source colors

## Development

Install dependencies and start the app:

```bash
npm install
npm start
```

Feeds and source metadata live in `src/sources.json`. Renderer assets are in the `renderer/` folder.

## Building releases

Releases are produced with [electron-builder](https://www.electron.build/):

```bash
npm install
npm run dist
```

GitHub Actions (`.github/workflows/release.yml`) builds signed artifacts for Linux (AppImage + deb), macOS (dmg), and Windows (NSIS) whenever you push a tag such as `v0.1.0`.

## Linux installer

After publishing a release, Linux users can install the latest AppImage by running:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/newsdesk/main/scripts/install-linux.sh | bash -s -- --repo <owner>/newsdesk
```

The script downloads the latest AppImage, places it in `~/.local/share/newsdesk`, and creates a launcher in `~/.local/bin/newsdesk`.
