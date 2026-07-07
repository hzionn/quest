// D1 access + the merge semantics for cross-device sync.
//
// Merge rules (per qkey):
//   correct_count -> MAX(local, remote)        (answered-correctly count never regresses)
//   ever_wrong    -> OR                         (once wrong, stays wrong)
//   correct       -> last-write-wins by updated_at
//   bookmark/review enabled -> last-write-wins by updated_at (supports un-toggle)

export async function upsertUser(DB, g) {
  const now = Date.now()
  await DB.prepare(
    `INSERT INTO users (google_sub, email, name, picture, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email, name = excluded.name,
       picture = excluded.picture, last_seen = excluded.last_seen`
  ).bind(g.sub, g.email ?? null, g.name ?? null, g.picture ?? null, now, now).run()

  const row = await DB.prepare(
    `SELECT id, google_sub, email, name, picture FROM users WHERE google_sub = ?`
  ).bind(g.sub).first()
  return row
}

// Read the full state for one user.
export async function getState(DB, uid) {
  const [progress, bookmarks, reviews, settings, daily] = await Promise.all([
    DB.prepare(`SELECT qkey, exam, qid, correct, correct_count, ever_wrong, updated_at
                FROM progress WHERE user_id = ?`).bind(uid).all(),
    DB.prepare(`SELECT qkey, enabled, updated_at FROM bookmarks WHERE user_id = ?`).bind(uid).all(),
    DB.prepare(`SELECT qkey, enabled, updated_at FROM reviews WHERE user_id = ?`).bind(uid).all(),
    DB.prepare(`SELECT dark_mode, lang, updated_at FROM settings WHERE user_id = ?`).bind(uid).first(),
    DB.prepare(`SELECT device_id, day, answered, correct, seconds, updated_at
                FROM daily_stats WHERE user_id = ?`).bind(uid).all(),
  ])
  return {
    progress: progress.results || [],
    bookmarks: bookmarks.results || [],
    reviews: reviews.results || [],
    settings: settings || null,
    daily: daily.results || [],
  }
}

// Admin: per-user usage overview (user count is small; subselects are fine).
export async function getAdminOverview(DB) {
  const rows = await DB.prepare(
    `SELECT u.id, u.email, u.name, u.created_at, u.last_seen,
       (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id)                    AS questions_touched,
       (SELECT COALESCE(SUM(d.answered), 0) FROM daily_stats d WHERE d.user_id = u.id) AS answered_total,
       (SELECT COALESCE(SUM(d.seconds), 0)  FROM daily_stats d WHERE d.user_id = u.id) AS seconds_total,
       (SELECT MAX(d.day) FROM daily_stats d WHERE d.user_id = u.id)               AS last_active_day
     FROM users u
     ORDER BY u.last_seen DESC`
  ).all()
  return { users: rows.results || [] }
}

// Level leaderboard. XP is DERIVED from the same progress rows the client uses
// (mirrors gamify.js computeXP): correct_count*10, +3 if ever_wrong, +25 mastery
// bonus when ever_wrong && correct_count >= 3. Computing it server-side keeps a
// single source of truth — no separate score to push, sync or tamper with.
// Only public identity (name/picture) is exposed; email is never returned.
export async function getLeaderboard(DB, uid, limit = 20) {
  const rows = await DB.prepare(
    `SELECT u.id, u.name, u.picture,
       COALESCE(SUM(
         p.correct_count * 10
         + (CASE WHEN p.ever_wrong = 1 THEN 3 ELSE 0 END)
         + (CASE WHEN p.ever_wrong = 1 AND p.correct_count >= 3 THEN 25 ELSE 0 END)
       ), 0) AS xp,
       COUNT(p.qkey) AS answered
     FROM users u
     LEFT JOIN progress p ON p.user_id = u.id
     GROUP BY u.id
     ORDER BY xp DESC, answered DESC, u.id ASC`
  ).all()
  const all = rows.results || []
  // Standard competition ranking (1, 2, 2, 4): equal XP shares a rank.
  let rank = 0, prevXp = null, seen = 0
  const ranked = all.map((r) => {
    seen++
    if (r.xp !== prevXp) { rank = seen; prevXp = r.xp }
    return { rank, id: r.id, name: r.name, picture: r.picture, xp: r.xp, answered: r.answered }
  })
  const me = ranked.find((r) => r.id === uid) || null
  return { top: ranked.slice(0, limit), me, total: ranked.length }
}

// Merge a delta payload from a client into D1, then return the merged state.
// delta = { progress: [...], bookmarks: [...], reviews: [...], settings: {...} }
export async function mergeState(DB, uid, delta) {
  const stmts = []
  const now = Date.now()

  for (const p of delta.progress || []) {
    stmts.push(
      DB.prepare(
        `INSERT INTO progress (user_id, qkey, exam, qid, correct, correct_count, ever_wrong, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, qkey) DO UPDATE SET
           correct_count = MAX(correct_count, excluded.correct_count),
           ever_wrong    = MAX(ever_wrong, excluded.ever_wrong),
           correct       = CASE WHEN excluded.updated_at >= updated_at THEN excluded.correct ELSE correct END,
           exam          = excluded.exam,
           qid           = excluded.qid,
           updated_at    = MAX(updated_at, excluded.updated_at)`
      ).bind(
        uid, p.qkey, p.exam ?? null, p.qid ?? null,
        p.correct ? 1 : 0, p.correct_count ?? 0, p.ever_wrong ? 1 : 0,
        p.updated_at ?? now
      )
    )
  }

  for (const [table, rows] of [['bookmarks', delta.bookmarks], ['reviews', delta.reviews]]) {
    for (const b of rows || []) {
      stmts.push(
        DB.prepare(
          `INSERT INTO ${table} (user_id, qkey, enabled, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, qkey) DO UPDATE SET
             enabled    = CASE WHEN excluded.updated_at >= updated_at THEN excluded.enabled ELSE enabled END,
             updated_at = MAX(updated_at, excluded.updated_at)`
        ).bind(uid, b.qkey, b.enabled ? 1 : 0, b.updated_at ?? now)
      )
    }
  }

  // Per-device daily counters: G-Counter merge — every field takes MAX, which
  // is idempotent (safe on retries) because a device's own counts only grow.
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
  for (const d of delta.daily || []) {
    if (!d || typeof d.device_id !== 'string' || !d.device_id || d.device_id.length > 64) continue
    if (typeof d.day !== 'string' || !DAY_RE.test(d.day)) continue
    stmts.push(
      DB.prepare(
        `INSERT INTO daily_stats (user_id, device_id, day, answered, correct, seconds, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, device_id, day) DO UPDATE SET
           answered   = MAX(answered, excluded.answered),
           correct    = MAX(correct, excluded.correct),
           seconds    = MAX(seconds, excluded.seconds),
           updated_at = MAX(updated_at, excluded.updated_at)`
      ).bind(
        uid, d.device_id, d.day,
        Math.max(0, Number(d.answered) || 0),
        Math.max(0, Number(d.correct) || 0),
        Math.max(0, Number(d.seconds) || 0),
        d.updated_at ?? now
      )
    )
  }

  if (delta.settings) {
    const s = delta.settings
    stmts.push(
      DB.prepare(
        `INSERT INTO settings (user_id, dark_mode, lang, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           dark_mode  = CASE WHEN excluded.updated_at >= updated_at THEN excluded.dark_mode ELSE dark_mode END,
           lang       = CASE WHEN excluded.updated_at >= updated_at THEN excluded.lang ELSE lang END,
           updated_at = MAX(updated_at, excluded.updated_at)`
      ).bind(uid, s.dark_mode ? 1 : 0, s.lang ?? null, s.updated_at ?? now)
    )
  }

  if (stmts.length) await DB.batch(stmts)
  return await getState(DB, uid)
}
