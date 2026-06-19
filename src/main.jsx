import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register a network-first service worker so a normal refresh always picks
// up the latest deploy. Without it, a browser-cached index.html keeps users
// pinned to a stale bundle and stale question JSON across deploys.
if ('serviceWorker' in navigator) {
  const swUrl = `${import.meta.env.BASE_URL || '/quest/'}sw.js`
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
