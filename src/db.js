const path = require("path");
const Database = require("better-sqlite3");

function openDb(userDataPath) {
  const dbPath = path.join(userDataPath, "newsdesk.sqlite3");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      domain TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      guid TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      published_at INTEGER,
      summary TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(source_id, guid),
      FOREIGN KEY(source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS state (
      item_id INTEGER PRIMARY KEY,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS source_preferences (
      source_id TEXT PRIMARY KEY,
      text_color TEXT,
      bg_color TEXT,
      FOREIGN KEY(source_id) REFERENCES sources(id)
    );
  `);

  return db;
}

function upsertSources(db, sources) {
  const stmt = db.prepare(`
    INSERT INTO sources (id, name, feed_url, domain)
    VALUES (@id, @name, @feedUrl, @domain)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      feed_url=excluded.feed_url,
      domain=excluded.domain
  `);

  const tx = db.transaction((rows) => rows.forEach((r) => stmt.run(r)));
  tx(sources);
}

function insertItems(db, items) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO items
      (source_id, guid, title, url, published_at, summary, created_at)
    VALUES
      (@sourceId, @guid, @title, @url, @publishedAt, @summary, @createdAt)
  `);

  const tx = db.transaction((rows) => rows.forEach((r) => stmt.run(r)));
  tx(items);
}

function listItems(db, { limit = 200, sourceId = null, q = null } = {}) {
  const where = [];
  const params = { limit };

  if (sourceId) {
    where.push("i.source_id = @sourceId");
    params.sourceId = sourceId;
  }
  if (q && q.trim()) {
    where.push("(i.title LIKE @q OR i.summary LIKE @q)");
    params.q = `%${q.trim()}%`;
  }

  const sql = `
    SELECT
      i.id,
      i.source_id AS sourceId,
      s.name AS sourceName,
      i.title,
      i.url,
      i.published_at AS publishedAt,
      i.summary,
      COALESCE(st.is_read, 0) AS isRead,
      COALESCE(st.is_starred, 0) AS isStarred,
      prefs.text_color AS textColor,
      prefs.bg_color AS bgColor
    FROM items i
    JOIN sources s ON s.id = i.source_id
    LEFT JOIN source_preferences prefs ON prefs.source_id = s.id
    LEFT JOIN state st ON st.item_id = i.id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY COALESCE(i.published_at, i.created_at) DESC
    LIMIT @limit
  `;

  return db.prepare(sql).all(params);
}

function markRead(db, itemId, isRead) {
  db.prepare(`
    INSERT INTO state (item_id, is_read, is_starred)
    VALUES (@itemId, @isRead, COALESCE((SELECT is_starred FROM state WHERE item_id=@itemId), 0))
    ON CONFLICT(item_id) DO UPDATE SET is_read=excluded.is_read
  `).run({ itemId, isRead: isRead ? 1 : 0 });
}

function toggleStar(db, itemId) {
  db.prepare(`
    INSERT INTO state (item_id, is_read, is_starred)
    VALUES (@itemId, COALESCE((SELECT is_read FROM state WHERE item_id=@itemId), 0), 1)
    ON CONFLICT(item_id) DO UPDATE SET is_starred=CASE WHEN is_starred=1 THEN 0 ELSE 1 END
  `).run({ itemId });
}

function getSources(db) {
  return db.prepare(`
    SELECT s.id, s.name, prefs.text_color AS textColor, prefs.bg_color AS bgColor
    FROM sources s
    LEFT JOIN source_preferences prefs ON prefs.source_id = s.id
    ORDER BY s.name
  `).all();
}

function listSourceConfigs(db) {
  return db.prepare(`SELECT id, name, feed_url AS feedUrl, domain FROM sources ORDER BY name`).all();
}

function setSourceColors(db, { sourceId, textColor, bgColor }) {
  db.prepare(`
    INSERT INTO source_preferences (source_id, text_color, bg_color)
    VALUES (@sourceId, @textColor, @bgColor)
    ON CONFLICT(source_id) DO UPDATE SET
      text_color=excluded.text_color,
      bg_color=excluded.bg_color
  `).run({ sourceId, textColor, bgColor });
}

function addSource(db, source) {
  db.prepare(`
    INSERT INTO sources (id, name, feed_url, domain)
    VALUES (@id, @name, @feedUrl, @domain)
  `).run(source);
}

function sourceExists(db, id) {
  const row = db.prepare(`SELECT 1 FROM sources WHERE id=?`).get(id);
  return !!row;
}

function getSourceDomain(db, sourceId) {
  const row = db.prepare(`SELECT domain FROM sources WHERE id=?`).get(sourceId);
  return row?.domain || null;
}

module.exports = {
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
};
