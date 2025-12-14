const listEl = document.getElementById("list");
const sourceFilter = document.getElementById("sourceFilter");
const qEl = document.getElementById("q");
const refreshBtn = document.getElementById("refresh");
const toggleDenseBtn = document.getElementById("toggleDense");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const closeArticleBtn = document.getElementById("closeArticle");
const toggleReaderBtn = document.getElementById("toggleReader");
const mainEl = document.querySelector(".main");
const sidebarEl = document.querySelector(".sidebar");
const openControlsBtn = document.getElementById("openControls");
const colorSourceSelect = document.getElementById("colorSource");
const textColorInput = document.getElementById("textColor");
const bgColorInput = document.getElementById("bgColor");
const saveColorsBtn = document.getElementById("saveColors");
const newSourceNameInput = document.getElementById("newSourceName");
const newSourceFeedInput = document.getElementById("newSourceFeed");
const newSourceDomainInput = document.getElementById("newSourceDomain");
const newSourceTextColor = document.getElementById("newSourceTextColor");
const newSourceBgColor = document.getElementById("newSourceBgColor");
const addSourceBtn = document.getElementById("addSource");
const addSourceStatus = document.getElementById("addSourceStatus");

const LIST_WIDTH = 520;
const SIDEBAR_EXPANDED_WIDTH = 320;
const SIDEBAR_COLLAPSED_WIDTH = 72;
const DEFAULT_SOURCE_COLORS = {
  thenation: { text: "#ffffff", bg: "#c00000" },
  politico: { text: "#ffffff", bg: "#c00000" },
  thehill: { text: "#ffffff", bg: "#0b53ae" },
  nyt: { text: "#111111", bg: "#ffffff" },
  tnr: { text: "#111111", bg: "#ffffff" },
  wsj: { text: "#111111", bg: "#ffffff" },
  pcgamer: { text: "#ffffff", bg: "#ff2a2a" }
};

let currentSource = "";
let currentQ = "";
let compact = true;
let readerMode = false;
let sidebarCollapsed = true;
let sourceMeta = [];
const sourceColorOverrides = new Map();
let articleOpen = false;

function getEffectiveSourceColors(sourceId, explicitText, explicitBg) {
  if (explicitText && explicitBg) {
    return { text: explicitText, bg: explicitBg };
  }
  if (sourceColorOverrides.has(sourceId)) {
    return sourceColorOverrides.get(sourceId);
  }
  if (DEFAULT_SOURCE_COLORS[sourceId]) {
    return DEFAULT_SOURCE_COLORS[sourceId];
  }
  return null;
}

async function syncLayoutToMain() {
  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  document.documentElement.style.setProperty("--sidebarW", `${sidebarW}px`);
  document.documentElement.style.setProperty("--listW", `${LIST_WIDTH}px`);
  await window.newsdesk.setSidebarWidth(sidebarW);
  await window.newsdesk.setListWidth(LIST_WIDTH);
  if (sidebarEl) sidebarEl.classList.toggle("collapsed", sidebarCollapsed);
  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
}

closeArticleBtn.addEventListener("click", async () => {
  await window.newsdesk.closeArticle();
  articleOpen = false;
  document.body.classList.remove("article-open");
});

if (toggleReaderBtn) {
  toggleReaderBtn.setAttribute("aria-pressed", "false");
  toggleReaderBtn.addEventListener("click", async () => {
    readerMode = !readerMode;
    toggleReaderBtn.classList.toggle("is-active", readerMode);
    toggleReaderBtn.setAttribute("aria-pressed", readerMode ? "true" : "false");
    await window.newsdesk.setReaderMode(readerMode);
  });
}

openControlsBtn?.addEventListener("click", async () => {
  sidebarCollapsed = !sidebarCollapsed;
  await syncLayoutToMain();
});

if (colorSourceSelect) {
  colorSourceSelect.addEventListener("change", syncColorInputs);
}

if (saveColorsBtn) {
  saveColorsBtn.addEventListener("click", async () => {
    const sourceId = colorSourceSelect?.value;
    if (!sourceId) return;
    setStatus("Saving colors…");
    try {
      await window.newsdesk.setSourceColors({
        sourceId,
        textColor: textColorInput.value,
        bgColor: bgColorInput.value
      });
      sourceColorOverrides.set(sourceId, { text: textColorInput.value, bg: bgColorInput.value });
      setStatus("Colors updated");
      await refresh();
    } catch (err) {
      console.error(err);
      setStatus("Failed to save colors");
    }
  });
}

if (addSourceBtn) {
  addSourceBtn.addEventListener("click", async () => {
    const name = newSourceNameInput.value.trim();
    const feedUrl = newSourceFeedInput.value.trim();
    const domain = newSourceDomainInput.value.trim();
    if (!name || !feedUrl || !domain) {
      if (addSourceStatus) addSourceStatus.textContent = "Please provide name, feed, and domain.";
      return;
    }
    addSourceBtn.disabled = true;
    if (addSourceStatus) addSourceStatus.textContent = "Adding source…";
    try {
      const res = await window.newsdesk.addSource({
        name,
        feedUrl,
        domain,
        textColor: newSourceTextColor.value,
        bgColor: newSourceBgColor.value
      });
      if (!res?.ok) throw new Error(res?.error || "Failed to add source");
      if (addSourceStatus) addSourceStatus.textContent = "Source added!";
      newSourceNameInput.value = "";
      newSourceFeedInput.value = "";
      newSourceDomainInput.value = "";
      await loadSources();
      await refresh();
    } catch (err) {
      console.error(err);
      if (addSourceStatus) addSourceStatus.textContent = err.message || "Failed to add source.";
    } finally {
      addSourceBtn.disabled = false;
    }
  });
}


function fmtTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadSources() {
  const sources = await window.newsdesk.getSources();
  sourceMeta = sources;
  sourceColorOverrides.clear();

  sourceFilter.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "All sources";
  sourceFilter.appendChild(optAll);

  for (const s of sources) {
    if (s.textColor && s.bgColor) {
      sourceColorOverrides.set(s.id, { text: s.textColor, bg: s.bgColor });
    }
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    sourceFilter.appendChild(opt);
  }
  if (currentSource) {
    const match = sourceFilter.querySelector(`option[value="${currentSource}"]`);
    if (match) {
      sourceFilter.value = currentSource;
    } else {
      currentSource = "";
      sourceFilter.value = "";
    }
  }

  if (colorSourceSelect) {
    const prev = colorSourceSelect.value;
    colorSourceSelect.innerHTML = "";
    for (const s of sources) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      colorSourceSelect.appendChild(opt);
    }
    if (prev && colorSourceSelect.querySelector(`option[value="${prev}"]`)) {
      colorSourceSelect.value = prev;
    } else if (colorSourceSelect.options.length) {
      colorSourceSelect.value = colorSourceSelect.options[0].value;
    }
    syncColorInputs();
  }
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function syncColorInputs() {
  if (!colorSourceSelect || !textColorInput || !bgColorInput) return;
  const sourceId = colorSourceSelect.value;
  if (!sourceId) return;
  const colors = getEffectiveSourceColors(sourceId);
  textColorInput.value = colors?.text || "#ffffff";
  bgColorInput.value = colors?.bg || "#000000";
}

function renderItems(items) {
  listEl.innerHTML = "";
  if (countEl) countEl.textContent = `${items.length} items`;

  for (const it of items) {
    const div = document.createElement("div");
    div.className = "item" + (it.isRead ? "" : " unread");

    const header = document.createElement("div");
    header.className = "item-header";

    const left = document.createElement("div");

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = it.title;

    const meta = document.createElement("div");
    meta.className = "meta";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = it.sourceName;
    const colorSpec = getEffectiveSourceColors(it.sourceId, it.textColor, it.bgColor);
    if (colorSpec) {
      badge.style.color = colorSpec.text;
      badge.style.backgroundColor = colorSpec.bg;
      badge.style.borderColor = colorSpec.bg;
    } else {
      badge.style.removeProperty("color");
      badge.style.removeProperty("background-color");
      badge.style.removeProperty("border-color");
    }

    const time = document.createElement("span");
    time.textContent = fmtTime(it.publishedAt);

    meta.appendChild(badge);
    if (it.publishedAt) meta.appendChild(time);

    left.appendChild(title);
    left.appendChild(meta);

    const star = document.createElement("button");
    star.className = "star";
    star.textContent = it.isStarred ? "★" : "☆";
    star.title = "Toggle star";
    star.addEventListener("click", async (e) => {
      e.stopPropagation();
      await window.newsdesk.toggleStar(it.id);
      await refresh();
    });

    header.appendChild(left);
    header.appendChild(star);

    div.appendChild(header);

    if (it.summary) {
      const snip = document.createElement("div");
      snip.className = "snip";
      snip.textContent = it.summary;
      div.appendChild(snip);
    }

    div.addEventListener("click", async () => {
      setStatus("Loading article…");
      const res = await window.newsdesk.openItem(it.id);
      if (!res?.external) {
        articleOpen = true;
        document.body.classList.add("article-open");
      }
      setStatus("Ready");
      await refresh();
    });

    listEl.appendChild(div);
  }
}

async function refresh() {
  const items = await window.newsdesk.listItems({
    limit: 250,
    sourceId: currentSource || null,
    q: currentQ || null
  });
  renderItems(items);
}

sourceFilter.addEventListener("change", async () => {
  currentSource = sourceFilter.value;
  await refresh();
});

qEl.addEventListener("input", async () => {
  currentQ = qEl.value;
  await refresh();
});

refreshBtn.addEventListener("click", refresh);

toggleDenseBtn.addEventListener("click", async () => {
  compact = !compact;
  document.body.classList.toggle("compact", compact);
});

(async function boot() {
  setStatus("Loading…");
  await loadSources();
  await syncLayoutToMain();
  await refresh();
  setStatus("Ready");
})();
