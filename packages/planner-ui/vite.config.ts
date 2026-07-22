import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Engine package source, as a posix path for Vite's resolver.
const engineSrc = fileURLToPath(new URL('../engine/src', import.meta.url)).replaceAll('\\', '/')

// This config exists for the test runner only — the package has no bundling
// build of its own (it ships TypeScript source; the consumer's Vite bundles
// it). The engine alias mirrors app/vite.config.ts: tests consume the engine
// straight from its TypeScript source, no rebuild step while iterating.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@retiregolden\/engine$/, replacement: `${engineSrc}/index.ts` },
      { find: /^@retiregolden\/engine\/(.*)$/, replacement: `${engineSrc}/$1` },
    ],
  },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    server: {
      deps: {
        // The plan-export round-trip test drives the real @retiregolden/mcp.
        // Inlining it makes Vite (not Node) resolve its `@retiregolden/engine`
        // imports, so the alias above applies and BOTH sides of the comparison
        // run the same engine SOURCE — one module instance, and no dependency
        // on `packages/engine/dist` existing (CI's test job runs `npm ci` and
        // nothing else, so it does not).
        inline: ['@retiregolden/mcp'],
      },
    },
    coverage: {
      provider: 'v8',
      // Only package code: aliased engine sources must not dilute the report
      // (engine coverage and its thresholds live in packages/engine).
      include: ['src/**'],
      thresholds: {
        // Carried over from app/vite.config.ts when the planner UI moved
        // here — see that file's history for how the floors were derived.
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
