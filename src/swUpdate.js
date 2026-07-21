// ──────────────────────────────────────────────────────────────────────────
// Coordinates auto-reloading the page when a new service-worker version
// takes control (see vite.config.js's `skipWaiting`/`clientsClaim` and
// main.jsx's `controllerchange` listener).
//
// A bare reload would be safe most of the time (progress is persisted to
// localStorage on every change), but a live mock exam's timer/answers live
// only in memory — reloading mid-exam would silently drop the attempt. So
// the reload is deferred while an exam is active and fires as soon as it
// ends (submitted or exited).
// ──────────────────────────────────────────────────────────────────────────

let pending = false
let examActive = false

export function markExamActive(active) {
  examActive = active
  if (pending && !examActive) reloadNow()
}

function reloadNow() {
  pending = false
  window.location.reload()
}

export function requestReload() {
  if (examActive) { pending = true; return }
  reloadNow()
}

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
