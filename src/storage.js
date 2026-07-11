// ──────────────────────────────────────────────────────────────────────────
// Storage adapter
//
// Single place that owns how user PROGRESS is persisted. Today that is the
// browser's localStorage (key `quest-stats`); later a remote layer (Cloudflare
// Worker + D1, reached with a Bearer JWT after Google sign-in) plugs in here so
// the rest of the app never talks to localStorage/the network directly.
//
// "Progress" is exactly three maps, each keyed by `${exam}-${id}`:
//   - statsHistory[qKey] = { correct, correctCount, everWrong, exam, type, id, question }
//   - bookmarked[qKey]   = true
//   - reviewMarked[qKey] = true
//
// Note: statsHistory entries also carry the full `question` object, which is
// heavy and recoverable from the loaded bank. stripQuestion()/rehydrate() keep
// the persisted/synced payload small; the remote sync layer (P3) reuses them.
// ──────────────────────────────────────────────────────────────────────────

const LOCAL_KEY = 'quest-stats'

const EMPTY = () => ({ statsHistory: {}, bookmarked: {}, reviewMarked: {}, dailyStats: {}, prefs: {} })

// Drop the bulky `question` object from a statsHistory map before persisting.
export function stripQuestions(statsHistory) {
  const out = {}
  for (const [k, v] of Object.entries(statsHistory || {})) {
    const rest = { ...v }
    delete rest.question
    out[k] = rest
  }
  return out
}

// Re-attach `question` objects to a statsHistory map from a qKey->question lookup.
export function rehydrateQuestions(statsHistory, qMap) {
  const out = {}
  for (const [k, v] of Object.entries(statsHistory || {})) {
    out[k] = v.question ? v : { ...v, question: qMap?.get(k) }
  }
  return out
}

// ── Local (browser) layer ──────────────────────────────────────────────────

export function loadLocalProgress() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return EMPTY()
    const data = JSON.parse(raw)
    return {
      statsHistory: data.statsHistory || {},
      bookmarked: data.bookmarked || {},
      reviewMarked: data.reviewMarked || {},
      dailyStats: data.dailyStats || {},
      prefs: data.prefs || {},
    }
  } catch {
    return EMPTY()
  }
}

export function saveLocalProgress({ statsHistory, bookmarked, reviewMarked, dailyStats, prefs }) {
  try {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        statsHistory: stripQuestions(statsHistory),
        bookmarked,
        reviewMarked,
        dailyStats: dailyStats || {},
        prefs: prefs || {},
      })
    )
  } catch {
    /* quota / private mode — progress just won't persist locally */
  }
}

export function clearLocalProgress() {
  try { localStorage.removeItem(LOCAL_KEY) } catch { /* ignore */ }
}

// ── Device identity ─────────────────────────────────────────────────────────
// Stable per-browser id for the daily-stats G-Counter: each device syncs its
// own monotonic counters and the server sums across devices. Survives
// clearLocalProgress (separate key) so history isn't double-counted.
const DEVICE_KEY = 'quest-device-id'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'unknown-device'
  }
}
