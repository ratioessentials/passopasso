import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Il manifest completo (icone PNG, screenshot) lo prepara la chat 4 in public/pwa/.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'PassoPasso',
        short_name: 'PassoPasso',
        description: 'Da zero a dove vuoi arrivare.',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#2C6975',
        background_color: '#E0ECDE',
        icons: [
          { src: '/icons/level-1.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    port: 5180,
    host: true,
    allowedHosts: true,
    proxy: { '/api': 'http://localhost:3210' },
  },
  preview: { port: 5180 },
  build: { outDir: 'dist' },
})
