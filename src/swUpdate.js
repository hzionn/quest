// ──────────────────────────────────────────────────────────────────────────
// Coordinates auto-reloading the page when a new service-worker version
// takes control (see vite.config.js's `skipWaiting`/`clientsClaim` and
// main.jsx's `controllerchange` listener).
//
// The reload itself is cheap — progress is persisted on every change, and the
// practice session is restored from session.js on boot — but it is jarring to
// have the page blink out from under you, and a live mock exam's timer and
// answers live only in memory, so reloading mid-exam silently drops the
// attempt. So a reload that arrives while the user is busy is held and applied
// at the next moment nobody is looking:
//
//   - exam in progress  → wait until the exam ends (submitted or exited)
//   - practising        → wait until the page is hidden
//
// The "hidden" trigger matters most on mobile: the version check runs on
// visibilitychange, i.e. the instant you unlock the phone, which is exactly
// when a reload is most disruptive. Deferring it to the *next* hide means the
// new build is already in place the next time the user looks at the screen.
// ──────────────────────────────────────────────────────────────────────────

let pending = false
let examActive = false
let practiceActive = false

function flushIfIdle() {
  if (pending && !examActive && !practiceActive) reloadNow()
}

export function markExamActive(active) {
  examActive = active
  flushIfIdle()
}

// Set while the user is sitting in a practice session. Unlike an exam this
// never really "ends", so a pending reload waits for the page to be hidden
// rather than for this to clear.
export function markPracticeActive(active) {
  practiceActive = active
  flushIfIdle()
}

function reloadNow() {
  pending = false
  window.location.reload()
}

export function requestReload() {
  if (examActive || practiceActive) { pending = true; return }
  reloadNow()
}

// A held reload is applied the moment the page goes away, so the user never
// sees it happen. An exam still wins: dropping a live attempt is worse than
// running the old bundle for a while longer.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pending && !examActive) reloadNow()
})

// ── Version polling (SW-independent) ──────────────────────────────────────
// The service-worker update lifecycle (skipWaiting/clientsClaim/reload) is
// the primary mechanism, but browsers vary in how reliably they actually run
// it (Safari's SW update checks are a known weak spot). This is a plain,
// cache-busted fetch of a one-line build-id file, so it detects a new
// deploy regardless of whatever the SW is or isn't doing.
export function startVersionPolling(baseUrl, currentBuildId) {
  let checking = false
  const check = async () => {
    if (checking) return
    checking = true
    try {
      const res = await fetch(`${baseUrl}version.txt?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const latest = (await res.text()).trim()
        if (latest && latest !== String(currentBuildId)) requestReload()
      }
    } catch {
      // offline, or the request was blocked — just try again next time
    } finally {
      checking = false
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
  setInterval(check, 10 * 60 * 1000)
}
