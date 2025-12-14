const Parser = require("rss-parser");
const { URL } = require("url");

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  }
});

function safeGuid(item) {
  return (
    item.guid ||
    item.id ||
    item.link ||
    (item.title ? `${item.title}:${item.pubDate || ""}` : null) ||
    `${Math.random()}`
  );
}

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    // strip common tracking params (optional)
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    url.searchParams.delete("utm_campaign");
    return url.toString();
  } catch {
    return u;
  }
}

async function fetchFeed(source) {
  const feed = await parser.parseURL(source.feedUrl);
  const now = Date.now();

  const items = (feed.items || [])
    .filter((it) => it.link && it.title)
    .map((it) => ({
      sourceId: source.id,
      guid: safeGuid(it),
      title: String(it.title).trim(),
      url: normalizeUrl(it.link),
      publishedAt: it.isoDate ? Date.parse(it.isoDate) : (it.pubDate ? Date.parse(it.pubDate) : null),
      summary: it.contentSnippet ? String(it.contentSnippet).trim() : null,
      createdAt: now
    }));

  return items;
}

module.exports = { fetchFeed };
