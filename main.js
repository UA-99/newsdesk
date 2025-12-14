const { app, BrowserWindow, BrowserView, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { ElectronBlocker } = require("@cliqz/adblocker-electron");
const fetch = require("cross-fetch");
const { Worker } = require("worker_threads");
const readerWorkerPath = path.join(__dirname, "src", "reader-worker.js");

const {
  openDb,
  upsertSources,
  insertItems,
  listItems,
  markRead,
  toggleStar,
  getSources,
  getSourceDomain,
  listSourceConfigs,
  setSourceColors,
  addSource,
  sourceExists
} = require("./src/db");

const { fetchFeed } = require("./src/feeds");

let win;
let view;
let db;
let sidebarWidth = 320;
let listWidth = 520;         // headline list pane width
let articleVisible = false;  // hidden until open
let blockerPromise;
let readerModeEnabled = false;
let currentArticle = null;
const READER_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};


function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function applyLayout() {
  if (!win || !view) return;

  const [w, h] = win.getContentSize();

  // Ensure we always leave enough room for the left UI
  const minList = 360;
  const minArticle = 360;

  const sw = clamp(sidebarWidth, 72, 360);
  const lw = clamp(listWidth, minList, Math.max(minList, w - sw - minArticle));

  if (!articleVisible) {
    // Hide BrowserView
    view.setBounds({ x: w, y: 0, width: 0, height: h });
    return;
  }

  const x = sw + lw;
  view.setBounds({ x, y: 0, width: w - x, height: h });
  view.setAutoResize({ width: true, height: true });
}


function loadDefaultSources() {
  const p = path.join(__dirname, "src", "sources.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function enforceArticleLightTheme() {
  if (!view?.webContents) return;
  if (view.webContents.setColorScheme) {
    view.webContents.setColorScheme("light");
  }
  try {
    await view.webContents.insertCSS(":root { color-scheme: light !important; background: #ffffff !important; }");
  } catch {
    // ignore
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "source";
}

function normalizeColor(value) {
  if (!value) return null;
  const hex = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex) ? hex : null;
}

function generateSourceId(name) {
  const base = slugify(name);
  let candidate = base;
  let counter = 2;
  while (sourceExists(db, candidate)) {
    candidate = `${base}-${counter++}`;
  }
  return candidate;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  view = new BrowserView({
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setBrowserView(view);
  enableArticleAdBlocker(view.webContents.session);
  // Force article content to use its default light theme; sites like TNR break on forced dark.
  enforceArticleLightTheme();
  view.webContents.on("did-start-navigation", enforceArticleLightTheme);
  view.webContents.on("did-finish-load", enforceArticleLightTheme);

  win.on("resize", applyLayout);
  applyLayout();

  // Default blank page
  view.webContents.loadURL("about:blank");
}

function enableArticleAdBlocker(session) {
  if (!blockerPromise) {
    blockerPromise = ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  }
  blockerPromise
    .then((blocker) => {
      blocker.enableBlockingInSession(session);
    })
    .catch((err) => {
      console.error("Failed to initialize ad blocker", err);
    });
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReaderHtml(article, sourceUrl) {
  const host = (() => {
    try { return new URL(sourceUrl).hostname; } catch { return sourceUrl; }
  })();
  const byline = article.byline ? `<p class="byline">${escapeHtml(article.byline)}</p>` : "";
  const excerpt = article.excerpt ? `<p class="excerpt">${escapeHtml(article.excerpt)}</p>` : "";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(article.title || host)}</title>
    <style>
      body {
        background: #f6f2eb;
        color: #1d1d1d;
        font-family: 'Georgia', 'Times New Roman', serif;
        max-width: 780px;
        margin: 0 auto;
        padding: 40px 24px 80px;
        line-height: 1.6;
      }
      header { margin-bottom: 32px; }
      .source {
        text-transform: uppercase;
        letter-spacing: 2px;
        font-size: 12px;
        color: #a06a00;
        margin-bottom: 8px;
      }
      h1 {
        font-size: 34px;
        margin: 0 0 12px;
      }
      .byline, .excerpt {
        margin: 6px 0;
        color: #4f4f4f;
      }
      img { max-width: 100%; height: auto; }
      article > section { font-size: 18px; }
      a { color: #b54800; }
    </style>
  </head>
  <body>
    <article>
      <header>
        <div class="source">${escapeHtml(host)}</div>
        <h1>${escapeHtml(article.title || "")}</h1>
        ${byline}
        ${excerpt}
      </header>
      <section>${article.content || ""}</section>
    </article>
  </body>
</html>`;
}

function parseArticleWithWorker(html, url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(readerWorkerPath, { workerData: { html, url } });
    worker.once("message", (msg) => {
      settled = true;
      if (msg && msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg ? msg.article : null);
      }
    });
    worker.once("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    worker.once("exit", (code) => {
      if (settled) return;
      if (code === 0) {
        reject(new Error("Reader worker exited without result"));
      } else {
        reject(new Error(`Reader worker exited with code ${code}`));
      }
    });
  });
}

async function loadReaderView(url) {
  const response = await fetch(url, { headers: READER_FETCH_HEADERS });
  if (!response.ok) throw new Error(`Failed to fetch article: ${response.status}`);
  const html = await response.text();
  const article = await parseArticleWithWorker(html, url);
  if (!article) throw new Error("Reader mode parsing failed");
  const readerHtml = buildReaderHtml(article, url);
  const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(readerHtml);
  await view.webContents.loadURL(dataUrl);
}

async function displayArticle(url) {
  if (!view) return;
  if (readerModeEnabled) {
    try {
      await loadReaderView(url);
      await enforceArticleLightTheme();
    } catch (err) {
      console.error("Reader mode failed, falling back to original page:", err);
      await view.webContents.loadURL(url);
      await enforceArticleLightTheme();
    }
  } else {
    await view.webContents.loadURL(url);
    await enforceArticleLightTheme();
  }
}

function domainMatches(urlStr, allowedDomain) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const d = allowedDomain.toLowerCase();
    return host === d || host.endsWith("." + d);
  } catch {
    return false;
  }
}

async function refreshAll() {
  const sources = listSourceConfigs(db);
  for (const s of sources) {
    try {
      const items = await fetchFeed(s);
      insertItems(db, items);
    } catch (e) {
      // swallow; per-source failures are expected sometimes
    }
  }
}

async function refreshSource(source) {
  try {
    const items = await fetchFeed(source);
    insertItems(db, items);
  } catch (err) {
    console.error(`Failed to refresh source ${source.id}`, err);
  }
}

app.whenReady().then(async () => {
  db = openDb(app.getPath("userData"));

  const sources = loadDefaultSources();
  upsertSources(db, sources);

  createWindow();

  // Initial fetch, then periodic refresh
  await refreshAll();
  setInterval(refreshAll, 10 * 60 * 1000); // 10 min
});

// IPC
ipcMain.handle("sources:list", () => getSources(db));
ipcMain.handle("sources:setColors", (_evt, { sourceId, textColor, bgColor }) => {
  if (!sourceId) return { ok: false, error: "Missing sourceId" };
  const text = normalizeColor(textColor);
  const bg = normalizeColor(bgColor);
  if (!text || !bg) return { ok: false, error: "Colors must be hex values like #ffffff" };
  setSourceColors(db, { sourceId, textColor: text, bgColor: bg });
  return { ok: true };
});

ipcMain.handle("sources:add", async (_evt, data) => {
  const name = String(data?.name || "").trim();
  const feedUrl = String(data?.feedUrl || "").trim();
  const domain = String(data?.domain || "").trim().toLowerCase();
  const textColor = normalizeColor(data?.textColor);
  const bgColor = normalizeColor(data?.bgColor);

  if (!name || !feedUrl || !domain) {
    return { ok: false, error: "Name, feed URL, and domain are required" };
  }

  const id = generateSourceId(name);
  addSource(db, { id, name, feedUrl, domain });
  if (textColor && bgColor) {
    setSourceColors(db, { sourceId: id, textColor, bgColor });
  }
  await refreshSource({ id, name, feedUrl, domain });
  return { ok: true, source: { id, name } };
});

ipcMain.handle("items:list", (_evt, opts) => listItems(db, opts));

ipcMain.handle("items:read", (_evt, { itemId, isRead }) => {
  markRead(db, itemId, !!isRead);
  return { ok: true };
});

ipcMain.handle("items:star", (_evt, { itemId }) => {
  toggleStar(db, itemId);
  return { ok: true };
});

ipcMain.handle("items:open", async (_evt, { itemId }) => {
  const row = db.prepare(`SELECT id, source_id AS sourceId, url FROM items WHERE id=?`).get(itemId);
  if (!row) return { ok: false, error: "Not found" };

  const allowedDomain = getSourceDomain(db, row.sourceId);
  if (!allowedDomain || !domainMatches(row.url, allowedDomain)) {
    // fall back to external browser rather than rendering unexpected domains
    shell.openExternal(row.url);
    return { ok: true, external: true };
  }
  currentArticle = { id: row.id, url: row.url };
  articleVisible = true;
  applyLayout();
  await displayArticle(row.url);
  markRead(db, itemId, true);
  return { ok: true };
});

ipcMain.handle("ui:setSidebarWidth", (_evt, { width }) => {
  sidebarWidth = Number(width);
  applyLayout();
  return { ok: true };
});

ipcMain.handle("ui:setListWidth", (_evt, { width }) => {
  listWidth = Number(width);
  applyLayout();
  return { ok: true };
});

ipcMain.handle("ui:setReaderMode", async (_evt, { enabled }) => {
  readerModeEnabled = !!enabled;
  if (articleVisible && currentArticle?.url) {
    await displayArticle(currentArticle.url);
  }
  return { ok: true, enabled: readerModeEnabled };
});

ipcMain.handle("ui:closeArticle", async () => {
  articleVisible = false;
  currentArticle = null;
  try { await view.webContents.loadURL("about:blank"); } catch {}
  applyLayout();
  return { ok: true };
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
