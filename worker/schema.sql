-- Cloudflare D1 schema for quest cross-device progress sync.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub  TEXT NOT NULL UNIQUE,   -- Google's stable user id (the `sub` claim)
  email       TEXT,
  name        TEXT,
  picture     TEXT,
  created_at  INTEGER NOT NULL,       -- epoch ms
  last_seen   INTEGER NOT NULL
);

-- Per-question practice history. qkey = "<exam>-<id>".
CREATE TABLE IF NOT EXISTS progress (
  user_id       INTEGER NOT NULL,
  qkey          TEXT NOT NULL,
  exam          TEXT,
  qid           INTEGER,
  correct       INTEGER DEFAULT 0,    -- last submitted result (0/1)
  correct_count INTEGER DEFAULT 0,    -- monotonic: max wins
  ever_wrong    INTEGER DEFAULT 0,    -- OR-merged
  updated_at    INTEGER NOT NULL,     -- epoch ms, for last-write-wins
  PRIMARY KEY (user_id, qkey)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    INTEGER NOT NULL,
  qkey       TEXT NOT NULL,
  enabled    INTEGER DEFAULT 1,       -- supports un-bookmark via LWW
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, qkey)
);

CREATE TABLE IF NOT EXISTS reviews (
  user_id    INTEGER NOT NULL,
  qkey       TEXT NOT NULL,
  enabled    INTEGER DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, qkey)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id    INTEGER PRIMARY KEY,
  dark_mode  INTEGER,
  lang       TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS earned_certifications (
  user_id    INTEGER NOT NULL,
  cert_id    TEXT NOT NULL,
  enabled    INTEGER DEFAULT 1,
  earned_at  INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, cert_id)
);

-- Per-device daily study counters (G-Counter CRDT): each device's counts for
-- a day only ever grow, so MAX-merge per (user, device, day) is idempotent and
-- the user's true daily total is the SUM across devices. day = 'YYYY-MM-DD'.
CREATE TABLE IF NOT EXISTS daily_stats (
  user_id    INTEGER NOT NULL,
  device_id  TEXT NOT NULL,
  day        TEXT NOT NULL,
  answered   INTEGER NOT NULL DEFAULT 0,
  correct    INTEGER NOT NULL DEFAULT 0,
  seconds    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, device_id, day)
);

CREATE INDEX IF NOT EXISTS idx_progress_user  ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user   ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_user     ON daily_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_certs_user     ON earned_certifications(user_id);
