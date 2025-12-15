# Newsdesk

<img width="1200" height="800" alt="image" src="https://github.com/user-attachments/assets/2c7cd6da-5737-4115-b1a5-319a4bfc2304" />

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


## Packaging & Releases


```bash
./scripts/build-release.sh [--skip-install]
```

The script runs `electron-builder`, copies the generated AppImage/tarball into
`release/<version>`, and writes a `SHA256SUMS` file (using whichever of
`sha256sum` or `shasum` is available). Pass `--skip-install` if dependencies are
already installed.

## Linux Install Script


```bash
curl -fsSL https://raw.githubusercontent.com/UA-99/newsdesk/main/scripts/install-linux.sh -o install-newsdesk.sh
bash install-newsdesk.sh
```

`install-linux.sh` downloads the latest (or a specific) AppImage release, drops
it into `~/.local/share/newsdesk`, adds a `newsdesk` symlink under
`~/.local/bin`, and registers a `.desktop` entry for launching via app menus.
You can override the defaults:

- `--version vX.Y.Z` installs a specific tag.
- `--repo owner/name` points the script at a fork.
- `--prefix DIR` changes the install location.
