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
