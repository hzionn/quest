import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Network-first service worker so a normal refresh always picks up the latest
// deploy. On startup we also actively clean up any stale registrations and
// caches left over from previous deploys, so a bad SW from a past build can't
// keep pinning the user to old content.
if ('serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL || '/quest/'
  const swUrl = new URL(`${base}sw.js`, window.location.origin).href
  const hadController = !!navigator.serviceWorker.controller

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload()
  })

  const cleanupAndRegister = async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(async (reg) => {
        const url = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL
        if (url && url !== swUrl) await reg.unregister()
      }))
    } catch { /* ignore */ }
    try {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => !n.startsWith('quest-runtime-')).map((n) => caches.delete(n)))
    } catch { /* ignore */ }
    try {
      await navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' })
    } catch { /* ignore */ }
  }

  window.addEventListener('load', cleanupAndRegister)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
