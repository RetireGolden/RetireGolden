import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Engine package source, as a posix path for Vite's resolver.
const engineSrc = fileURLToPath(new URL('../packages/engine/src', import.meta.url)).replaceAll('\\', '/')

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    // Dev, tests, and the bundled build all consume the engine package
    // straight from its TypeScript source — no rebuild step while iterating,
    // and the shipped app is compiled from the same files the tests ran
    // against. `tsc -b` still type-checks the app against the package's real
    // built dist/*.d.ts via the project reference.
    alias: [
      { find: /^@retiregolden\/engine$/, replacement: `${engineSrc}/index.ts` },
      { find: /^@retiregolden\/engine\/(.*)$/, replacement: `${engineSrc}/$1` },
    ],
  },
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
      // Engine coverage (and its thresholds) live in packages/engine; the
      // app run only measures app code, so aliased package sources don't
      // dilute the report.
      include: ['src/**'],
      thresholds: {
        // The ledger-consumed SS math (and its 88/75/90/90 bar) moved to
        // packages/engine. What remains here are the analysis features
        // (well-tested) plus the never-tested form/storage helpers that the
        // moved math used to average over — this floor reflects the actual
        // coverage the old threshold enforced on these files.
        'src/socialSecurity/**': {
          statements: 84,
          branches: 70,
          functions: 85,
          lines: 86,
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
