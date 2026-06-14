import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/quest/',
  plugins: [react(), tailwindcss()],
  // Build-time id appended to data fetches so a new deploy always busts
  // the browser/CDN cache for the static JSON question banks.
  define: {
    __BUILD_ID__: JSON.stringify(String(Date.now())),
  },
})
