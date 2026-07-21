import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { requestReload, startVersionPolling } from './swUpdate.js'

const BASE_URL = import.meta.env.BASE_URL || '/quest/'
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : String(Date.now())

// PWA service worker (autoUpdate): precaches the app shell for offline use
// and runtime-caches the question-bank JSONs. Data URLs carry a per-deploy
// ?v=<build id>, so a new deploy always fetches fresh data. The app shell
// itself (JS/HTML) is precached, so an already-open tab keeps running the
// old bundle until a new one takes over — skipWaiting/clientsClaim (see
// vite.config.js) let a newly installed worker activate and claim existing
// tabs right away instead of waiting for every tab to close.
//
// registerType 'autoUpdate' already reloads the page itself once that
// happens (vite-plugin-pwa's registerSW, "auto" branch: an `activated`
// event with isUpdate fires `window.location.reload()` unconditionally)
// — UNLESS `onNeedReload` is provided, which hands control of that reload
// to us. We do that here and route it through requestReload() so a live
// mock exam (timer/answers live only in memory, not persisted) isn't
// yanked out from under the user mid-attempt — see swUpdate.js.
//
// The browser only checks for a new SW on an actual navigation. A home
// -screen PWA that gets backgrounded and resumed (not force-quit) never
// navigates again, so it would never notice a new deploy. onRegisteredSW
// forces an explicit update check whenever the app becomes visible again,
// so a resumed session catches up too.
registerSW({
  immediate: true,
  onNeedReload: requestReload,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    window.addEventListener('focus', check)
  },
})

// Belt-and-suspenders: some browsers (Safari in particular) don't reliably
// run the service-worker update check at all, which would leave the whole
// mechanism above silently inert. This polls a plain build-id file instead
// — no service worker involved, so it works regardless of SW quirks.
startVersionPolling(BASE_URL, BUILD_ID)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
