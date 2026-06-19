// Network-first for HTML and data JSON so that a normal refresh always picks
// up the latest deploy (and the latest question bank). Hashed JS/CSS assets
// stay cache-first since their filenames already change on every deploy.
const VERSION = 'v1'
const RUNTIME = `quest-runtime-${VERSION}`

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== RUNTIME).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

const isNetworkFirst = (url) => {
  if (url.pathname.endsWith('/') || url.pathname.endsWith('.html')) return true
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) return true
  return false
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (isNetworkFirst(url)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' })
        const cache = await caches.open(RUNTIME)
        cache.put(req, fresh.clone()).catch(() => {})
        return fresh
      } catch {
        const cached = await caches.match(req)
        if (cached) return cached
        throw new Error('offline and no cache')
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(req)
    if (cached) return cached
    const fresh = await fetch(req)
    const cache = await caches.open(RUNTIME)
    cache.put(req, fresh.clone()).catch(() => {})
    return fresh
  })())
})
