// ──────────────────────────────────────────────────────────────────────────
// Practice-session snapshot
//
// Everything about *progress* (stats/bookmarks/reviews/daily) already lives in
// storage.js. This file owns the much smaller, much more volatile thing that
// did NOT survive a page load: the session you are sitting in right now —
// which questions are in it, where you are, and what you have answered.
//
// Why it matters on mobile: a phone that has been locked for a while will get
// its background tab discarded (iOS Safari and Android Chrome both do this to
// reclaim memory), and the app itself reloads on a new deploy. Either way the
// page boots fresh, `subjectChosen` starts false, and the user lands back on
// the subject picker having "lost" their session. Restoring this snapshot on
// boot makes that reload invisible.
//
// Deliberately NOT stored: the question objects themselves. Only their keys —
// the bank is re-fetched (and cached by the service worker) on boot anyway,
// and storing ~600 full questions would blow past the localStorage quota.
// ──────────────────────────────────────────────────────────────────────────

// NOT 'quest-session' — sync.js already owns that key for the auth JWT, and
// reusing it would sign the user out every time a session snapshot is written.
const KEY = 'quest-practice-session'
const VERSION = 1
// A month-old session is not something anyone wants resumed; fall back to the
// subject picker instead of dropping the user into stale questions.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Keep only entries whose value is meaningful, so a 600-question session with
// three answers stores three answers rather than 600 `undefined`s.
function compact(obj, keep = (v) => v !== undefined && v !== null && v !== false) {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) if (keep(v)) out[k] = v
  return out
}

export function saveSession({
  exam, filterType, filterSearch, activeTab, index, questions,
  answers, submitted, results,
}) {
  try {
    const keys = questions.map(q => `${q.exam}-${q.id}`)
    if (!keys.length) return
    const inSession = new Set(keys)
    const only = (obj) => compact(obj, (v) => v !== undefined && v !== null && v !== false)
    const pick = (obj) => {
      const c = only(obj)
      for (const k of Object.keys(c)) if (!inSession.has(k)) delete c[k]
      return c
    }
    localStorage.setItem(KEY, JSON.stringify({
      v: VERSION,
      at: Date.now(),
      exam: exam || '',
      filterType: filterType || '',
      filterSearch: filterSearch || '',
      activeTab: activeTab || 'practice',
      index: index || 0,
      // Which exams' bank files have to be fetched before the keys resolve.
      // Derived from the questions rather than parsed out of the keys, because
      // exam codes contain dashes and would not split back out reliably.
      exams: [...new Set(questions.map(q => q.exam))],
      keys,
      answers: pick(answers),
      submitted: pick(submitted),
      results: pick(results),
    }))
  } catch {
    /* quota / private mode — the session just won't survive a reload */
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || s.v !== VERSION) return null
    if (!Array.isArray(s.keys) || !s.keys.length) return null
    if (!s.at || Date.now() - s.at > MAX_AGE_MS) return null
    return s
  } catch {
    return null
  }
}

export function clearSession() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
