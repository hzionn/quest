// Kill-switch service worker.
//
// Earlier builds registered a network-first service worker. It turned out to be
// a sticky extra cache layer that could pin users to an old version, so the app
// no longer uses a service worker (freshness now comes from the per-build ?v=
// cache-bust + cache:'no-store' on data fetches).
//
// This file remains only to deactivate any previously-installed SW: browsers
// re-check the SW script on navigation, pick this version up, then it clears all
// caches, unregisters itself, and reloads open tabs back to a SW-free state.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch { /* ignore */ }
    try {
      await self.registration.unregister()
    } catch { /* ignore */ }
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach((c) => c.navigate(c.url))
  })())
})
