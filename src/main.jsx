import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// PWA service worker (autoUpdate): precaches the app shell for offline use
// and runtime-caches the question-bank JSONs. Staleness is impossible by
// construction — data URLs carry a per-deploy ?v=<build id>, so a new deploy
// fetches fresh URLs and the SW itself self-updates on the next visit.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
