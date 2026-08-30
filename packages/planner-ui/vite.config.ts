import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { coverageConfigDefaults, defineConfig } from 'vitest/config'

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
    // Declares the React act environment once for the whole package. Files
    // still opt into jsdom per-file with a `@vitest-environment` pragma; this
    // only removes the copy-pasted act preamble that used to sit next to it.
    setupFiles: ['./src/testSupport/vitestSetup.ts'],
    coverage: {
      provider: 'v8',
      // Only package code: aliased engine sources must not dilute the report
      // (engine coverage and its thresholds live in packages/engine).
      include: ['src/**'],
      // Checked-in data fixtures have no executable statements; counting
      // them as 0%-covered modules dilutes the directory thresholds below.
      // Spread the defaults: a bare `exclude` would replace them and pull
      // test files into the report.
      exclude: [...coverageConfigDefaults.exclude, 'src/**/*.fixture.json'],
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
