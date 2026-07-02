import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// No service worker. Freshness is handled by the per-build ?v= cache-bust and
// cache: 'no-store' on the data fetches, so a normal refresh just works. We do
// proactively unregister any service worker left over from earlier builds and
// drop its caches, so users who picked up the old SW are cleaned up here too.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {})
  if (window.caches?.keys) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n))).catch(() => {})
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
