import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Workspace package sources, as posix paths for Vite's resolver.
const engineSrc = fileURLToPath(new URL('../packages/engine/src', import.meta.url)).replaceAll('\\', '/')
const plannerUiSrc = fileURLToPath(new URL('../packages/planner-ui/src', import.meta.url)).replaceAll('\\', '/')

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    // Dev, tests, and the bundled build all consume the workspace packages
    // straight from their TypeScript source — no rebuild step while
    // iterating, and the shipped app is compiled from the same files the
    // tests ran against. `tsc -b` still type-checks the app against the
    // engine's real built dist/*.d.ts via the project reference; planner-ui
    // ships TypeScript source, so its exports map points at the same files.
    alias: [
      { find: /^@retiregolden\/engine$/, replacement: `${engineSrc}/index.ts` },
      { find: /^@retiregolden\/engine\/(.*)$/, replacement: `${engineSrc}/$1` },
      { find: /^@retiregolden\/planner-ui$/, replacement: `${plannerUiSrc}/index.ts` },
      { find: /^@retiregolden\/planner-ui\/(.*)$/, replacement: `${plannerUiSrc}/$1` },
    ],
    // The aliased planner-ui source resolves bare imports from its own
    // directory, so if the package manager ever nests a second copy of these under a
    // workspace's node_modules (an in-place install can), the app and the
    // planner would each get their own instance — for the router that means
    // two contexts and every planner hook throwing. Force one instance.
    dedupe: ['react', 'react-dom', 'react-router'],
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
        // The incident switch must always come from the network. Keep the
        // exclusion explicit even if a future asset pattern starts matching JSON.
        globIgnores: ['**/import-feature.json'],
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
    // `scripts/` holds plain-Node build tooling (no TS build step), so its
    // tests are .mjs alongside it — the bundle budget's parsers and
    // fail-closed contract, which nothing else would catch.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.mjs'],
    // The app suite runs whole projections and optimizer tournaments, and CI
    // runs it under v8 coverage on runners measured at ~6x local runtime, so
    // ~6x slower (#230). Vitest's 5s default kept tipping marginal tests one
    // at a time (owlParity in #230, decisions/search on the next run), so the
    // suite declares its real scale once. Hangs still fail; they just get 30s
    // to prove it.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      // Package coverage (and thresholds) lives with each package; the app
      // run only measures app code, so aliased package sources don't dilute
      // the report. The socialSecurity/data floors moved to
      // packages/planner-ui/vite.config.ts with the code they guard.
      include: ['src/**'],
    },
  },
})
