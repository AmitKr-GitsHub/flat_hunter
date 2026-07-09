const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();
const dbPath = path.resolve(process.env.DATABASE_PATH || './data/flat_hunter.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
function initDb() {
  db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  source_group_url TEXT NOT NULL,
  source_post_url TEXT,
  author_name TEXT,
  message TEXT,
  created_time TEXT,
  fetched_at TEXT NOT NULL,
  post_type TEXT,
  is_hall_sharing INTEGER DEFAULT 0,
  rent_amount INTEGER,
  rent_text TEXT,
  brokerage_label TEXT,
  matched_area TEXT,
  is_match INTEGER DEFAULT 0,
  excluded_reason TEXT,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  local_path TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_usage (
  month TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0,
  last_call_at TEXT,
  manual_disabled_until TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_match_created ON posts(is_match, created_time DESC);
CREATE INDEX IF NOT EXISTS idx_posts_area ON posts(matched_area);
`);
  const defaults = {
    keywords: 'rent, flat, room, apartment, 1bhk, 2bhk, 3bhk, studio, pg',
    exclude_keywords: 'sold, not available, commercial, shop, office',
    areas: 'Koramangala, Indiranagar, HSR, Whitefield, Marathahalli, Bellandur',
    max_rent: '0',
    group_url: process.env.FACEBOOK_GROUP_URL || '',
    polling_enabled: 'true',
    telegram_enabled: 'false',
    poll_interval_minutes: String(safeIntervalMinutes())
  };
  const stmt = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
  Object.entries(defaults).forEach(([k,v]) => stmt.run(k,v));
}
function monthKey(d = new Date()) { return d.toISOString().slice(0,7); }
function safeIntervalMinutes() { return Math.max(220, Math.ceil((31*24*60)/200)); }
function getSettings() { return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value])); }
function setSetting(k,v){ db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,String(v)); }
function usage() { const m=monthKey(); db.prepare('INSERT OR IGNORE INTO api_usage(month,calls) VALUES(?,0)').run(m); return db.prepare('SELECT * FROM api_usage WHERE month=?').get(m); }
function remaining() { return Math.max(0, 200 - usage().calls); }
function incrementUsage() { const m=monthKey(); db.prepare('INSERT INTO api_usage(month,calls,last_call_at) VALUES(?,1,?) ON CONFLICT(month) DO UPDATE SET calls=calls+1,last_call_at=excluded.last_call_at').run(m,new Date().toISOString()); }
initDb();
module.exports = { db, initDb, getSettings, setSetting, usage, remaining, incrementUsage, monthKey, safeIntervalMinutes };
