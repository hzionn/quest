import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Computed once per build and both embedded in the JS bundle (below) and
// published as a plain static file (see the write-build-version plugin) —
// the app polls that file to detect a new deploy independent of whether the
// service worker's own update lifecycle actually runs (Safari's SW update
// checks are notoriously unreliable; a plain versioned fetch isn't).
const BUILD_ID = String(Date.now())

export default defineConfig({
  base: '/quest/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'write-build-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.txt', source: BUILD_ID })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png', 'aws.png', 'gcp-logo.png', 'azure-logo.png'],
      manifest: {
        name: '雲端證照考試練習器',
        short_name: '證照練習',
        description: 'AWS / GCP 雲端證照考題練習與模擬考，支援跨裝置進度同步',
        lang: 'zh-TW',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Activate a new service worker (and let it take control of already
        // -open tabs) as soon as it installs, instead of waiting for every
        // tab to close. Paired with the controllerchange reload in main.jsx
        // so a deploy reaches an already-open tab without a manual refresh.
        skipWaiting: true,
        clientsClaim: true,
        // Precache the app shell only — the 14 MB question bank goes through
        // runtime caching below instead (URLs carry ?v=<build id>, so entries
        // are immutable; a new deploy simply caches new URLs and the old ones
        // age out via maxEntries).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/data/**'],
        navigateFallbackDenylist: [/\/data\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'quest-data',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // Build-time id appended to data fetches so a new deploy always busts
  // the browser/CDN cache for the static JSON question banks.
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
})
