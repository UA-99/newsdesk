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

Feeds and source metadata live in `src/sources.json`. Renderer assets are in the `renderer/` folder.

## Linux installer


```bash
curl -fsSL https://raw.githubusercontent.com/UA-99/newsdesk/main/scripts/install-linux.sh | bash -s -- --repo UA-99/newsdesk
```

The script downloads the latest AppImage, places it in `~/.local/share/newsdesk`, and creates a launcher in `~/.local/bin/newsdesk`.
