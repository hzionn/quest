import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { requestReload } from './swUpdate.js'

// PWA service worker (autoUpdate): precaches the app shell for offline use
// and runtime-caches the question-bank JSONs. Data URLs carry a per-deploy
// ?v=<build id>, so a new deploy always fetches fresh data. The app shell
// itself (JS/HTML) is precached, so an already-open tab keeps running the
// old bundle until a new one takes over — skipWaiting/clientsClaim (see
// vite.config.js) let that happen without waiting for a manual close+reopen,
// and the controllerchange listener below reloads the page once the new
// worker actually takes control (guarded by requestReload() so it doesn't
// interrupt a live mock exam — see swUpdate.js).
//
// The browser only checks for a new SW on an actual navigation. A home
// -screen PWA that gets backgrounded and resumed (not force-quit) never
// navigates again, so it would never notice a new deploy. onRegisteredSW
// below forces an explicit update check whenever the app becomes visible
// again, so a resumed session catches up too.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    window.addEventListener('focus', check)
  },
})

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Ignore the controllerchange that fires on a page's very first SW
    // install (no previous controller) — only react to an actual update.
    if (!hadController || reloaded) return
    reloaded = true
    requestReload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
