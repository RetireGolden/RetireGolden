import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'RetireGolden',
        short_name: 'RetireGolden',
        description:
          'Local-first retirement planner — model your household, accounts, income, and spending, then stress-test the plan. Your data stays on this device.',
        theme_color: '#D9A521',
        background_color: '#241a03',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built shell + assets so the app loads fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // SPA: serve index.html for client-routed navigations when offline.
        navigateFallback: '/index.html',
        // Heavyweight assets are deliberately runtime-cached instead of
        // precached, so the install stays light and users only pay for what
        // they use:
        //  - The ~3MB HiGHS wasm (optimizer solver) exceeds workbox's 2MiB
        //    precache default; cache-first here means Optimize works offline
        //    after its first online use.
        //  - The ~5MB of Learn illustrations (/learn/images/*) are cached as
        //    articles are viewed, so previously read articles keep their
        //    images offline.
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/learn\/images\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'learn-images',
              expiration: { maxEntries: 150, maxAgeSeconds: 180 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      thresholds: {
        'src/engine/**': {
          statements: 90,
          branches: 75,
          functions: 90,
          lines: 87,
        },
        'src/socialSecurity/**': {
          statements: 88,
          branches: 75,
          functions: 90,
          lines: 90,
        },
        'src/data/**': {
          statements: 90,
          branches: 70,
          functions: 75,
          lines: 90,
        },
      },
    },
  },
})
